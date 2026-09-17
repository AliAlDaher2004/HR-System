import { getDb, schema } from '../../db';
import { eq, and, sql, desc } from 'drizzle-orm';
import { UserSession, RBAC, AuthorizationError, requireRole } from '../auth/rbac';
import { logAuditEvent } from '../auth/audit';
import { getSystemSettings } from './settings-service';

export async function getLoans(actor: UserSession, employeeId?: string) {
  if (!RBAC.canManageLoans(actor.role)) {
    throw new AuthorizationError('غير مصرح لك بالاطلاع على بيانات سلف الموظفين.');
  }

  const db = getDb();
  let query = db.select({
    id: schema.loans.id,
    employeeId: schema.loans.employeeId,
    employeeName: schema.employees.name,
    employeeNo: schema.employees.employeeNo,
    department: schema.employees.department,
    date: schema.loans.date,
    amount: schema.loans.amount,
    currency: schema.loans.currency,
    status: schema.loans.status,
    notes: schema.loans.notes,
    createdAt: schema.loans.createdAt,
  })
  .from(schema.loans)
  .innerJoin(schema.employees, eq(schema.loans.employeeId, schema.employees.id));

  const rows = employeeId
    ? await query.where(eq(schema.loans.employeeId, employeeId)).orderBy(desc(schema.loans.date))
    : await query.orderBy(desc(schema.loans.date));

  // Enrich each loan with calculated PaidTotal and Remaining
  const enrichedLoans = await Promise.all(
    rows.map(async (loan: any) => {
      const calculation = await calculateLoanBalance(loan.id);
      return {
        ...loan,
        paidTotal: calculation.paidTotal.toFixed(3),
        remaining: calculation.remaining.toFixed(3),
        isDebt: loan.status === 'DISBURSED',
      };
    })
  );

  return enrichedLoans;
}

export async function calculateLoanBalance(loanId: string): Promise<{
  loanAmount: number;
  paidTotal: number;
  remaining: number;
  status: string;
}> {
  const db = getDb();
  const [loan] = await db.select().from(schema.loans).where(eq(schema.loans.id, loanId));
  if (!loan) throw new Error('السلفة غير موجودة');

  const loanAmount = parseFloat(loan.amount);

  // If loan is not DISBURSED, it has 0 effective debt and 0 repayments
  if (loan.status !== 'DISBURSED') {
    return {
      loanAmount,
      paidTotal: 0,
      remaining: 0,
      status: loan.status,
    };
  }

  // Fetch all repayments for this loan
  const repayments = await db.select({
    amount: schema.repayments.amount,
    method: schema.repayments.method,
    status: schema.repayments.status,
    payrollStatus: schema.payroll.status,
  })
  .from(schema.repayments)
  .leftJoin(schema.payroll, eq(schema.repayments.payrollId, schema.payroll.id))
  .where(eq(schema.repayments.loanId, loanId));

  let paidTotal = 0;
  for (const rep of repayments) {
    const repAmount = parseFloat(rep.amount);
    // Rule: Cash repayment counts only when Status = PAID
    if (rep.method === 'CASH' && rep.status === 'PAID') {
      paidTotal += repAmount;
    }
    // Rule: Payroll repayment counts only when linked payroll Status = PAID
    else if (rep.method === 'PAYROLL' && rep.payrollStatus === 'PAID') {
      paidTotal += repAmount;
    }
  }

  const remaining = Math.max(0, Math.round((loanAmount - paidTotal) * 1000) / 1000);

  return {
    loanAmount,
    paidTotal: Math.round(paidTotal * 1000) / 1000,
    remaining,
    status: loan.status,
  };
}

export async function createLoan(
  actor: UserSession,
  data: {
    employeeId: string;
    date: string;
    amount: number;
    currency?: string;
    notes?: string;
  }
) {
  requireRole(actor, ['ADMIN', 'ACCOUNTANT']);
  const db = getDb();

  if (data.amount <= 0) {
    throw new Error('مبلغ السلفة يجب أن يكون أكبر من الصفر');
  }

  const currentSettings = await getSystemSettings();
  const operatingCurrency = currentSettings?.currency || 'JOD';
  const currency = data.currency || operatingCurrency;

  if (currency !== operatingCurrency) {
    throw new Error(`عملة السلفة (${currency}) يجب أن تطابق عملة النظام التشغيلية (${operatingCurrency}).`);
  }

  const [inserted] = await db.insert(schema.loans).values({
    employeeId: data.employeeId,
    date: data.date,
    amount: data.amount.toFixed(3),
    currency,
    status: 'PROPOSED', // Proposed loans do not count as debt
    notes: data.notes || null,
    createdBy: actor.id,
  }).returning();

  await logAuditEvent({
    actor,
    tableName: 'loans',
    recordId: inserted.id,
    action: 'CREATE_LOAN',
    newStatus: 'PROPOSED',
    metadata: { employeeId: data.employeeId, amount: data.amount },
  });

  return inserted;
}

export async function disburseLoan(actor: UserSession, loanId: string) {
  requireRole(actor, ['ADMIN', 'ACCOUNTANT']);
  const db = getDb();

  const [loan] = await db.select().from(schema.loans).where(eq(schema.loans.id, loanId));
  if (!loan) throw new Error('السلفة غير موجودة');
  if (loan.status !== 'PROPOSED') {
    throw new Error(`لا يمكن صرف السلفة. الحالة الحالية: (${loan.status}).`);
  }

  const [updated] = await db.update(schema.loans)
    .set({ status: 'DISBURSED' })
    .where(eq(schema.loans.id, loanId))
    .returning();

  await logAuditEvent({
    actor,
    tableName: 'loans',
    recordId: loanId,
    action: 'DISBURSE_LOAN',
    oldStatus: 'PROPOSED',
    newStatus: 'DISBURSED',
    metadata: { amount: loan.amount },
  });

  return updated;
}

export async function addRepayment(
  actor: UserSession,
  data: {
    loanId: string;
    date: string;
    amount: number;
    method: 'CASH' | 'PAYROLL';
    payrollId?: string | null;
  }
) {
  requireRole(actor, ['ADMIN', 'ACCOUNTANT']);
  const db = getDb();

  if (data.amount <= 0) {
    throw new Error('مبلغ السداد يجب أن يكون أكبر من الصفر');
  }

  const [loan] = await db.select().from(schema.loans).where(eq(schema.loans.id, data.loanId));
  if (!loan) throw new Error('السلفة غير موجودة');
  if (loan.status !== 'DISBURSED') {
    throw new Error('لا يمكن إضافة سداد إلا للسلف المصروفة (DISBURSED).');
  }

  const { remaining } = await calculateLoanBalance(data.loanId);
  if (data.amount > remaining) {
    throw new Error(
      `مبلغ السداد المطلوب (${data.amount.toFixed(3)}) يتجاوز المتبقي من السلفة (${remaining.toFixed(3)}). منع زيادة السداد مفعل.`
    );
  }

  if (data.method === 'PAYROLL') {
    if (!data.payrollId) {
      throw new Error('معرف كشف الراتب (PayrollID) مطلوب عند اختيار طريقة السداد عبر الراتب.');
    }
    const [payrollRecord] = await db.select().from(schema.payroll).where(eq(schema.payroll.id, data.payrollId));
    if (!payrollRecord) throw new Error('كشف الراتب المحدد غير موجود');
    if (payrollRecord.employeeId !== loan.employeeId) throw new Error('كشف الراتب لا يخص نفس موظف السلفة');
    if (payrollRecord.status !== 'DRAFT') {
      throw new Error('لا يمكن ربط سداد قسط راتب إلا بكشف راتب في حالة مسودة (DRAFT).');
    }
  }

  const [repayment] = await db.insert(schema.repayments).values({
    loanId: data.loanId,
    date: data.date,
    amount: data.amount.toFixed(3),
    method: data.method,
    payrollId: data.method === 'PAYROLL' ? data.payrollId : null,
    status: data.method === 'CASH' ? 'PAID' : 'SCHEDULED', // Cash defaults to PAID upon entry
    createdBy: actor.id,
  }).returning();

  await logAuditEvent({
    actor,
    tableName: 'repayments',
    recordId: repayment.id,
    action: data.method === 'CASH' ? 'CONFIRM_CASH_REPAYMENT' : 'SCHEDULE_PAYROLL_REPAYMENT',
    newStatus: repayment.status,
    metadata: { loanId: data.loanId, amount: data.amount, method: data.method },
  });

  return repayment;
}
