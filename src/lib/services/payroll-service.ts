import { getDb, schema } from '../../db';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { UserSession, RBAC, AuthorizationError, requireRole, assertCanApprovePayroll, assertCanViewFinancials } from '../auth/rbac';
import { logAuditEvent } from '../auth/audit';
import { getSystemSettings } from './settings-service';

export interface NetCalculationResult {
  employmentType?: 'PERMANENT' | 'DAILY_WORKER';
  workedDays: number;
  dailyRate: number;
  dailyEarnings: number;
  basicEarned: number;
  allowancesEarned: number;
  otHours: number;
  otRate: number;
  otTotal: number;
  unpaidDays: number;
  unpaidDayRate: number;
  unpaidDeduction: number;
  lateMinutes: number;
  lateDeduction: number;
  earlyDepartureMinutes: number;
  earlyDepartureDeduction: number;
  otherAdditions: number;
  otherDeductions: number;
  loanDeduction: number;
  grossPay: number;
  totalDeductions: number;
  netPreview: number;
}

export function computeNetPayroll(values: {
  employmentType?: 'PERMANENT' | 'DAILY_WORKER';
  workedDays?: number;
  dailyRate?: number;
  basicEarned?: number;
  allowancesEarned?: number;
  otHours?: number;
  otRate?: number;
  otherAdditions?: number;
  unpaidDays?: number;
  unpaidDayRate?: number;
  lateMinutes?: number;
  lateDeduction?: number;
  earlyDepartureMinutes?: number;
  earlyDepartureDeduction?: number;
  otherDeductions?: number;
  loanDeduction?: number;
}): NetCalculationResult {
  const isDailyWorker = values.employmentType === 'DAILY_WORKER';

  const basicEarned = values.basicEarned ?? 0;
  const allowancesEarned = values.allowancesEarned ?? 0;
  const otHours = values.otHours ?? 0;
  const otRate = values.otRate ?? 0;
  const otherAdditions = values.otherAdditions ?? 0;
  const unpaidDays = values.unpaidDays ?? 0;
  const unpaidDayRate = values.unpaidDayRate ?? 0;
  const otherDeductions = values.otherDeductions ?? 0;
  const loanDeduction = values.loanDeduction ?? 0;
  const lateDeduction = values.lateDeduction ?? 0;
  const earlyDepartureDeduction = values.earlyDepartureDeduction ?? 0;
  const workedDays = values.workedDays ?? 0;
  const dailyRate = values.dailyRate ?? 0;

  // Validate non-negative numbers
  if (basicEarned < 0) throw new Error('الراتب الأساسي لا يمكن أن يكون سالباً');
  if (allowancesEarned < 0) throw new Error('البدلات لا يمكن أن تكون سالبة');
  if (otHours < 0) throw new Error('ساعات العمل الإضافي لا يمكن أن تكون سالبة');
  if (otRate < 0) throw new Error('معدل الساعة الإضافية لا يمكن أن يكون سالباً');
  if (otherAdditions < 0) throw new Error('الإضافات الأخرى لا يمكن أن تكون سالبة');
  if (unpaidDays < 0) throw new Error('أيام الغياب غير المدفوعة لا يمكن أن تكون سالبة');
  if (unpaidDayRate < 0) throw new Error('معدل اليوم غير المدفوع لا يمكن أن يكون سالباً');
  if (otherDeductions < 0) throw new Error('الخصومات الأخرى لا يمكن أن تكون سالبة');
  if (loanDeduction < 0) throw new Error('خصم السلفة لا يمكن أن يكون سالباً');
  if (lateDeduction < 0) throw new Error('خصم التأخير لا يمكن أن يكون سالباً');
  if (earlyDepartureDeduction < 0) throw new Error('خصم المغادرة المبكرة لا يمكن أن يكون سالباً');
  if (dailyRate < 0) throw new Error('أجرة المياومة لا يمكن أن تكون سالبة');
  if (workedDays < 0) throw new Error('أيام العمل لا يمكن أن تكون سالبة');

  const otTotal = Math.round(otHours * otRate * 1000) / 1000;
  const unpaidDeduction = isDailyWorker ? 0 : Math.round(unpaidDays * unpaidDayRate * 1000) / 1000;
  const dailyEarnings = isDailyWorker ? Math.round(workedDays * dailyRate * 1000) / 1000 : 0;

  const totalEarnings = isDailyWorker
    ? dailyEarnings + otTotal + otherAdditions
    : basicEarned + allowancesEarned + otTotal + otherAdditions;

  const totalDeductions = unpaidDeduction + lateDeduction + earlyDepartureDeduction + otherDeductions + loanDeduction;
  const netPreview = Math.round((totalEarnings - totalDeductions) * 1000) / 1000;

  return {
    employmentType: values.employmentType || 'PERMANENT',
    workedDays,
    dailyRate,
    dailyEarnings,
    basicEarned,
    allowancesEarned,
    otHours,
    otRate,
    otTotal,
    unpaidDays,
    unpaidDayRate,
    unpaidDeduction,
    lateMinutes: values.lateMinutes ?? 0,
    lateDeduction,
    earlyDepartureMinutes: values.earlyDepartureMinutes ?? 0,
    earlyDepartureDeduction,
    otherAdditions,
    otherDeductions,
    loanDeduction,
    grossPay: Math.round(totalEarnings * 1000) / 1000,
    totalDeductions: Math.round(totalDeductions * 1000) / 1000,
    netPreview,
  };
}

export async function getPayrolls(
  actor: UserSession,
  filters?: {
    month?: string; // YYYY-MM
    employeeId?: string;
    status?: 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED';
  }
) {
  assertCanViewFinancials(actor);
  const db = getDb();

  let query = db.select({
    id: schema.payroll.id,
    employeeId: schema.payroll.employeeId,
    employeeName: schema.employees.name,
    employeeNo: schema.employees.employeeNo,
    department: schema.employees.department,
    employmentType: schema.employees.employmentType,
    contractId: schema.payroll.contractId,
    periodStart: schema.payroll.periodStart,
    periodEnd: schema.payroll.periodEnd,
    currency: schema.payroll.currency,
    basicEarned: schema.payroll.basicEarned,
    allowancesEarned: schema.payroll.allowancesEarned,
    otHours: schema.payroll.otHours,
    otRate: schema.payroll.otRate,
    unpaidDays: schema.payroll.unpaidDays,
    unpaidDayRate: schema.payroll.unpaidDayRate,
    workedDays: schema.payroll.workedDays,
    workedMinutes: schema.payroll.workedMinutes,
    lateMinutes: schema.payroll.lateMinutes,
    lateDeduction: schema.payroll.lateDeduction,
    earlyDepartureMinutes: schema.payroll.earlyDepartureMinutes,
    earlyDepartureDeduction: schema.payroll.earlyDepartureDeduction,
    dailyRate: schema.payroll.dailyRate,
    otherAdditions: schema.payroll.otherAdditions,
    otherDeductions: schema.payroll.otherDeductions,
    loanDeduction: schema.payroll.loanDeduction,
    netPay: schema.payroll.netPay,
    status: schema.payroll.status,
    paymentMethod: schema.payroll.paymentMethod,
    paymentReference: schema.payroll.paymentReference,
    approvedAt: schema.payroll.approvedAt,
    paidAt: schema.payroll.paidAt,
    notes: schema.payroll.notes,
    createdAt: schema.payroll.createdAt,
  })
  .from(schema.payroll)
  .innerJoin(schema.employees, eq(schema.payroll.employeeId, schema.employees.id));

  const conditions = [];
  if (filters?.employeeId) conditions.push(eq(schema.payroll.employeeId, filters.employeeId));
  if (filters?.status) conditions.push(eq(schema.payroll.status, filters.status));
  if (filters?.month) {
    const start = `${filters.month}-01`;
    conditions.push(eq(schema.payroll.periodStart, start));
  }

  const rows = conditions.length > 0
    ? await query.where(and(...conditions)).orderBy(desc(schema.payroll.periodStart))
    : await query.orderBy(desc(schema.payroll.periodStart));

  return rows.map((p: any) => {
    const calc = computeNetPayroll({
      employmentType: p.employmentType,
      workedDays: p.workedDays,
      dailyRate: parseFloat(p.dailyRate || '0'),
      basicEarned: parseFloat(p.basicEarned || '0'),
      allowancesEarned: parseFloat(p.allowancesEarned || '0'),
      otHours: parseFloat(p.otHours || '0'),
      otRate: parseFloat(p.otRate || '0'),
      otherAdditions: parseFloat(p.otherAdditions || '0'),
      unpaidDays: parseFloat(p.unpaidDays || '0'),
      unpaidDayRate: parseFloat(p.unpaidDayRate || '0'),
      lateMinutes: p.lateMinutes,
      lateDeduction: parseFloat(p.lateDeduction || '0'),
      earlyDepartureMinutes: p.earlyDepartureMinutes,
      earlyDepartureDeduction: parseFloat(p.earlyDepartureDeduction || '0'),
      otherDeductions: parseFloat(p.otherDeductions || '0'),
      loanDeduction: parseFloat(p.loanDeduction || '0'),
    });

    return {
      ...p,
      grossPay: calc.grossPay.toFixed(3),
      totalDeductions: calc.totalDeductions.toFixed(3),
      netPreview: calc.netPreview.toFixed(3),
      otTotal: calc.otTotal.toFixed(3),
      unpaidDeduction: calc.unpaidDeduction.toFixed(3),
      dailyEarnings: calc.dailyEarnings.toFixed(3),
    };
  });
}

export async function getPayrollById(actor: UserSession, payrollId: string) {
  assertCanViewFinancials(actor);
  const db = getDb();

  const [record] = await db.select({
    id: schema.payroll.id,
    employeeId: schema.payroll.employeeId,
    employeeName: schema.employees.name,
    employeeNo: schema.employees.employeeNo,
    department: schema.employees.department,
    jobTitle: schema.employees.jobTitle,
    employmentType: schema.employees.employmentType,
    contractId: schema.payroll.contractId,
    periodStart: schema.payroll.periodStart,
    periodEnd: schema.payroll.periodEnd,
    currency: schema.payroll.currency,
    basicEarned: schema.payroll.basicEarned,
    allowancesEarned: schema.payroll.allowancesEarned,
    otHours: schema.payroll.otHours,
    otRate: schema.payroll.otRate,
    unpaidDays: schema.payroll.unpaidDays,
    unpaidDayRate: schema.payroll.unpaidDayRate,
    workedDays: schema.payroll.workedDays,
    workedMinutes: schema.payroll.workedMinutes,
    lateMinutes: schema.payroll.lateMinutes,
    lateDeduction: schema.payroll.lateDeduction,
    earlyDepartureMinutes: schema.payroll.earlyDepartureMinutes,
    earlyDepartureDeduction: schema.payroll.earlyDepartureDeduction,
    dailyRate: schema.payroll.dailyRate,
    otherAdditions: schema.payroll.otherAdditions,
    otherDeductions: schema.payroll.otherDeductions,
    loanDeduction: schema.payroll.loanDeduction,
    netPay: schema.payroll.netPay,
    status: schema.payroll.status,
    paymentMethod: schema.payroll.paymentMethod,
    paymentReference: schema.payroll.paymentReference,
    approvedBy: schema.payroll.approvedBy,
    approvedAt: schema.payroll.approvedAt,
    paidAt: schema.payroll.paidAt,
    notes: schema.payroll.notes,
  })
  .from(schema.payroll)
  .innerJoin(schema.employees, eq(schema.payroll.employeeId, schema.employees.id))
  .where(eq(schema.payroll.id, payrollId));

  if (!record) throw new Error('كشف الراتب غير موجود');

  const calc = computeNetPayroll({
    employmentType: record.employmentType,
    workedDays: record.workedDays,
    dailyRate: parseFloat(record.dailyRate || '0'),
    basicEarned: parseFloat(record.basicEarned || '0'),
    allowancesEarned: parseFloat(record.allowancesEarned || '0'),
    otHours: parseFloat(record.otHours || '0'),
    otRate: parseFloat(record.otRate || '0'),
    otherAdditions: parseFloat(record.otherAdditions || '0'),
    unpaidDays: parseFloat(record.unpaidDays || '0'),
    unpaidDayRate: parseFloat(record.unpaidDayRate || '0'),
    lateMinutes: record.lateMinutes,
    lateDeduction: parseFloat(record.lateDeduction || '0'),
    earlyDepartureMinutes: record.earlyDepartureMinutes,
    earlyDepartureDeduction: parseFloat(record.earlyDepartureDeduction || '0'),
    otherDeductions: parseFloat(record.otherDeductions || '0'),
    loanDeduction: parseFloat(record.loanDeduction || '0'),
  });

  return {
    ...record,
    grossPay: calc.grossPay.toFixed(3),
    totalDeductions: calc.totalDeductions.toFixed(3),
    netPreview: calc.netPreview.toFixed(3),
    otTotal: calc.otTotal.toFixed(3),
    unpaidDeduction: calc.unpaidDeduction.toFixed(3),
    dailyEarnings: calc.dailyEarnings.toFixed(3),
  };
}

export async function createPayrollDraft(
  actor: UserSession,
  data: {
    employeeId: string;
    year: number;
    month: number; // 1-12
    basicEarned?: number;
    allowancesEarned?: number;
    otherAdditions?: number;
    otherDeductions?: number;
    notes?: string;
  }
) {
  requireRole(actor, ['ADMIN', 'ACCOUNTANT']);
  const db = getDb();

  const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, data.employeeId));
  if (!emp) throw new Error('الموظف غير موجود');

  const settings = await getSystemSettings();
  const minuteDeductionRate = emp.minuteDeductionRate
    ? parseFloat(emp.minuteDeductionRate)
    : (settings?.defaultMinuteDeductionRate ? parseFloat(settings.defaultMinuteDeductionRate) : 0);

  const monthStr = data.month < 10 ? `0${data.month}` : `${data.month}`;
  const periodStart = `${data.year}-${monthStr}-01`;
  
  const lastDay = new Date(data.year, data.month, 0).getDate();
  const periodEnd = `${data.year}-${monthStr}-${lastDay}`;

  // Check unique active payroll per employee/month
  const existingActive = await db.select().from(schema.payroll).where(
    and(
      eq(schema.payroll.employeeId, data.employeeId),
      eq(schema.payroll.periodStart, periodStart),
      sql`status != 'CANCELLED'`
    )
  );

  if (existingActive.length > 0) {
    throw new Error('يوجد كشف راتب نشط بالفعل لهذا الموظف في هذا الشهر.');
  }

  const isDailyWorker = emp.employmentType === 'DAILY_WORKER';

  let contractId: string | null = null;
  let basicEarned = 0;
  let allowancesEarned = 0;
  let otRate = 0;
  let unpaidDayRate = 0;
  let dailyRate = 0;
  const currency = settings?.currency || 'JOD';

  if (isDailyWorker) {
    const historyRates = await db.select().from(schema.dailyRateHistory).where(
      and(
        eq(schema.dailyRateHistory.employeeId, data.employeeId),
        lte(schema.dailyRateHistory.effectiveFrom, periodEnd),
        sql`(${schema.dailyRateHistory.effectiveTo} IS NULL OR ${schema.dailyRateHistory.effectiveTo} >= ${periodStart})`
      )
    ).orderBy(desc(schema.dailyRateHistory.effectiveFrom));

    if (historyRates.length > 0) {
      dailyRate = parseFloat(historyRates[0].dailyRate);
    } else {
      dailyRate = emp.dailyRate ? parseFloat(emp.dailyRate) : 0;
    }
  } else {
    // Permanent employee requires an active contract
    const contracts = await db.select().from(schema.contracts).where(
      and(
        eq(schema.contracts.employeeId, data.employeeId),
        lte(schema.contracts.startDate, periodEnd),
        sql`(end_date IS NULL OR end_date >= ${periodStart})`
      )
    ).orderBy(desc(schema.contracts.startDate));

    if (contracts.length === 0) {
      throw new Error('لا يوجد عقد عمل ساري المفعول يغطي فترة كشف الراتب المحددة.');
    }

    const contract = contracts[0];
    contractId = contract.id;
    basicEarned = data.basicEarned !== undefined ? data.basicEarned : parseFloat(contract.monthlyBasic);
    allowancesEarned = data.allowancesEarned !== undefined ? data.allowancesEarned : parseFloat(contract.monthlyAllowances);
    const companyOtRate = settings?.defaultOtRate ? parseFloat(settings.defaultOtRate) : 2.5;
    otRate = (contract.otRate && parseFloat(contract.otRate) > 0) ? parseFloat(contract.otRate) : companyOtRate;
    unpaidDayRate = parseFloat(contract.unpaidDayRate);
  }

  // Fetch attendance records within period to snapshot metrics
  const attendances = await db.select().from(schema.attendance).where(
    and(
      eq(schema.attendance.employeeId, data.employeeId),
      gte(schema.attendance.workDate, periodStart),
      lte(schema.attendance.workDate, periodEnd)
    )
  );

  const workedDays = attendances.filter((a: any) => a.attendanceType === 'PRESENT').length;
  const workedMinutes = attendances.reduce((acc: number, a: any) => acc + (a.workedMinutes || 0), 0);
  const lateMinutes = attendances.reduce((acc: number, a: any) => acc + (a.lateMinutes || 0), 0);
  const earlyDepartureMinutes = attendances.reduce((acc: number, a: any) => acc + (a.earlyDepartureMinutes || 0), 0);
  const totalOtHours = attendances.reduce((acc: number, a: any) => acc + parseFloat(a.approvedOtHours || '0'), 0);
  const totalUnpaidDays = attendances.reduce((acc: number, a: any) => acc + parseFloat(a.unpaidDays || '0'), 0);

  if (isDailyWorker) {
    basicEarned = workedDays * dailyRate;
  }

  const lateDeduction = Math.round(lateMinutes * minuteDeductionRate * 1000) / 1000;
  const earlyDepartureDeduction = Math.round(earlyDepartureMinutes * minuteDeductionRate * 1000) / 1000;

  const [inserted] = await db.insert(schema.payroll).values({
    employeeId: data.employeeId,
    contractId: contractId || null,
    periodStart,
    periodEnd,
    currency,
    basicEarned: basicEarned.toFixed(3),
    allowancesEarned: allowancesEarned.toFixed(3),
    otHours: totalOtHours.toFixed(2),
    otRate: otRate.toFixed(3),
    unpaidDays: totalUnpaidDays.toFixed(2),
    unpaidDayRate: unpaidDayRate.toFixed(3),
    workedDays,
    workedMinutes,
    lateMinutes,
    lateDeduction: lateDeduction.toFixed(3),
    earlyDepartureMinutes,
    earlyDepartureDeduction: earlyDepartureDeduction.toFixed(3),
    dailyRate: dailyRate.toFixed(3),
    otherAdditions: (data.otherAdditions ?? 0).toFixed(3),
    otherDeductions: (data.otherDeductions ?? 0).toFixed(3),
    loanDeduction: '0.000',
    netPay: null,
    status: 'DRAFT',
    preparedBy: actor.id,
    notes: data.notes || null,
  }).returning();

  await logAuditEvent({
    actor,
    tableName: 'payroll',
    recordId: inserted.id,
    action: 'CREATE_PAYROLL_DRAFT',
    newStatus: 'DRAFT',
    metadata: { employeeId: data.employeeId, periodStart, periodEnd, isDailyWorker },
  });

  const calc = computeNetPayroll({
    employmentType: emp.employmentType,
    workedDays,
    dailyRate,
    basicEarned,
    allowancesEarned,
    otHours: totalOtHours,
    otRate,
    otherAdditions: data.otherAdditions ?? 0,
    unpaidDays: totalUnpaidDays,
    unpaidDayRate,
    lateMinutes,
    lateDeduction,
    earlyDepartureMinutes,
    earlyDepartureDeduction,
    otherDeductions: data.otherDeductions ?? 0,
    loanDeduction: 0,
  });

  return {
    ...inserted,
    employmentType: emp.employmentType,
    lateDeductions: inserted.lateDeduction,
    earlyDepartureDeductions: inserted.earlyDepartureDeduction,
    grossPay: calc.grossPay.toFixed(3),
    netPreview: calc.netPreview.toFixed(3),
  };
}

export async function refreshPayrollDraft(actor: UserSession, payrollId: string) {
  requireRole(actor, ['ADMIN', 'ACCOUNTANT']);
  const db = getDb();

  const [payrollRecord] = await db.select().from(schema.payroll).where(eq(schema.payroll.id, payrollId));
  if (!payrollRecord) throw new Error('كشف الراتب غير موجود');
  if (payrollRecord.status !== 'DRAFT') {
    throw new Error('تحديث المسودة متاح فقط لكشوف الرواتب التي في حالة مسودة (DRAFT).');
  }

  const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, payrollRecord.employeeId));
  const settings = await getSystemSettings();
  const minuteDeductionRate = emp?.minuteDeductionRate
    ? parseFloat(emp.minuteDeductionRate)
    : (settings?.defaultMinuteDeductionRate ? parseFloat(settings.defaultMinuteDeductionRate) : 0);

  // Refresh attendance snapshots
  const attendances = await db.select().from(schema.attendance).where(
    and(
      eq(schema.attendance.employeeId, payrollRecord.employeeId),
      gte(schema.attendance.workDate, payrollRecord.periodStart),
      lte(schema.attendance.workDate, payrollRecord.periodEnd)
    )
  );

  const workedDays = attendances.filter((a: any) => a.attendanceType === 'PRESENT').length;
  const workedMinutes = attendances.reduce((acc: number, a: any) => acc + (a.workedMinutes || 0), 0);
  const lateMinutes = attendances.reduce((acc: number, a: any) => acc + (a.lateMinutes || 0), 0);
  const earlyDepartureMinutes = attendances.reduce((acc: number, a: any) => acc + (a.earlyDepartureMinutes || 0), 0);
  const totalOtHours = attendances.reduce((acc: number, a: any) => acc + parseFloat(a.approvedOtHours || '0'), 0);
  const totalUnpaidDays = attendances.reduce((acc: number, a: any) => acc + parseFloat(a.unpaidDays || '0'), 0);

  const lateDeduction = Math.round(lateMinutes * minuteDeductionRate * 1000) / 1000;
  const earlyDepartureDeduction = Math.round(earlyDepartureMinutes * minuteDeductionRate * 1000) / 1000;

  // Refresh linked loan repayments
  const linkedRepayments = await db.select().from(schema.repayments).where(
    and(
      eq(schema.repayments.payrollId, payrollId),
      sql`status != 'CANCELLED'`
    )
  );

  const totalLoanDeduction = linkedRepayments.reduce((acc: number, r: any) => acc + parseFloat(r.amount), 0);

  // Contract rates for permanent
  let otRate = parseFloat(payrollRecord.otRate);
  let unpaidDayRate = parseFloat(payrollRecord.unpaidDayRate);
  if (payrollRecord.contractId) {
    const [contract] = await db.select().from(schema.contracts).where(eq(schema.contracts.id, payrollRecord.contractId));
    if (contract) {
      otRate = parseFloat(contract.otRate);
      unpaidDayRate = parseFloat(contract.unpaidDayRate);
    }
  }

  let basicEarned = parseFloat(payrollRecord.basicEarned);
  if (emp?.employmentType === 'DAILY_WORKER') {
    const historyRates = await db.select().from(schema.dailyRateHistory).where(
      and(
        eq(schema.dailyRateHistory.employeeId, payrollRecord.employeeId),
        lte(schema.dailyRateHistory.effectiveFrom, payrollRecord.periodEnd),
        sql`(${schema.dailyRateHistory.effectiveTo} IS NULL OR ${schema.dailyRateHistory.effectiveTo} >= ${payrollRecord.periodStart})`
      )
    ).orderBy(desc(schema.dailyRateHistory.effectiveFrom));

    const dailyRate = historyRates.length > 0 ? parseFloat(historyRates[0].dailyRate) : parseFloat(payrollRecord.dailyRate || '0');
    basicEarned = workedDays * dailyRate;
  }

  const [updated] = await db.update(schema.payroll)
    .set({
      basicEarned: basicEarned.toFixed(3),
      workedDays,
      workedMinutes,
      lateMinutes,
      lateDeduction: lateDeduction.toFixed(3),
      earlyDepartureMinutes,
      earlyDepartureDeduction: earlyDepartureDeduction.toFixed(3),
      otHours: totalOtHours.toFixed(2),
      otRate: otRate.toFixed(3),
      unpaidDays: totalUnpaidDays.toFixed(2),
      unpaidDayRate: unpaidDayRate.toFixed(3),
      loanDeduction: totalLoanDeduction.toFixed(3),
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.payroll.id, payrollId))
    .returning();

  return {
    ...updated,
    employmentType: emp?.employmentType,
    lateDeductions: updated.lateDeduction,
    earlyDepartureDeductions: updated.earlyDepartureDeduction,
  };
}


export async function validatePayrollCompleteness(payrollId: string): Promise<{
  isValid: boolean;
  errors: string[];
  expectedDays: number;
  actualDays: number;
}> {
  const db = getDb();
  const errors: string[] = [];

  const [payrollRecord] = await db.select().from(schema.payroll).where(eq(schema.payroll.id, payrollId));
  if (!payrollRecord) {
    return { isValid: false, errors: ['كشف الراتب غير موجود'], expectedDays: 0, actualDays: 0 };
  }

  // 1. Check PayrollPolicyConfirmed
  const settings = await getSystemSettings();
  if (!settings || !settings.payrollPolicyConfirmed) {
    errors.push('لم يتم تأكيد سياسة الرواتب والأجور في إعدادات الشركة.');
  }

  // 2. Check Employee and Service Period Coverage
  const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, payrollRecord.employeeId));
  if (!emp) {
    errors.push('بيانات الموظف غير متوفرة');
    return { isValid: false, errors, expectedDays: 0, actualDays: 0 };
  }

  const isDailyWorker = emp.employmentType === 'DAILY_WORKER';
  const periodStart = payrollRecord.periodStart;
  const periodEnd = payrollRecord.periodEnd;

  // Mid-month hire / termination logic:
  const effectiveStart = emp.startDate > periodStart ? emp.startDate : periodStart;
  const effectiveEnd = emp.endDate && emp.endDate < periodEnd ? emp.endDate : periodEnd;

  const startMs = new Date(effectiveStart).getTime();
  const endMs = new Date(effectiveEnd).getTime();
  const expectedDays = isDailyWorker
    ? payrollRecord.workedDays
    : Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;

  // 3. Fetch all attendance records inside service window
  const attendances = await db.select().from(schema.attendance).where(
    and(
      eq(schema.attendance.employeeId, emp.id),
      gte(schema.attendance.workDate, effectiveStart),
      lte(schema.attendance.workDate, effectiveEnd)
    )
  );

  const actualDays = attendances.length;

  if (!isDailyWorker && actualDays < expectedDays) {
    errors.push(`توجد أيام حضور ناقصة: المطلوب ${expectedDays} يوماً، والمسجل ${actualDays} يوماً فقط.`);
  }

  const draftAttendances = attendances.filter((a: any) => a.status === 'DRAFT');
  if (draftAttendances.length > 0) {
    errors.push(`يوجد ${draftAttendances.length} سجل حضور في حالة مسودة (غير معتمد) خلال هذه الفترة.`);
  }

  const workDates = attendances.map((a: any) => a.workDate);
  const uniqueDates = new Set(workDates);
  if (uniqueDates.size !== workDates.length) {
    errors.push('يوجد تكرار في تواريخ سجلات الحضور لنفس الموظف.');
  }

  // 4. Validate Calculations
  const calc = computeNetPayroll({
    employmentType: emp.employmentType,
    workedDays: payrollRecord.workedDays,
    dailyRate: parseFloat(payrollRecord.dailyRate || '0'),
    basicEarned: parseFloat(payrollRecord.basicEarned || '0'),
    allowancesEarned: parseFloat(payrollRecord.allowancesEarned || '0'),
    otHours: parseFloat(payrollRecord.otHours || '0'),
    otRate: parseFloat(payrollRecord.otRate || '0'),
    otherAdditions: parseFloat(payrollRecord.otherAdditions || '0'),
    unpaidDays: parseFloat(payrollRecord.unpaidDays || '0'),
    unpaidDayRate: parseFloat(payrollRecord.unpaidDayRate || '0'),
    lateMinutes: payrollRecord.lateMinutes,
    lateDeduction: parseFloat(payrollRecord.lateDeduction || '0'),
    earlyDepartureMinutes: payrollRecord.earlyDepartureMinutes,
    earlyDepartureDeduction: parseFloat(payrollRecord.earlyDepartureDeduction || '0'),
    otherDeductions: parseFloat(payrollRecord.otherDeductions || '0'),
    loanDeduction: parseFloat(payrollRecord.loanDeduction || '0'),
  });

  if (calc.netPreview < 0) {
    errors.push(`صافي الراتب المتوقع (${calc.netPreview.toFixed(3)}) لا يمكن أن يكون سالباً.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    expectedDays,
    actualDays,
  };
}

export async function approvePayroll(actor: UserSession, payrollId: string) {
  // ONLY ADMIN can approve payroll
  assertCanApprovePayroll(actor);
  const db = getDb();

  const [payrollRecord] = await db.select().from(schema.payroll).where(eq(schema.payroll.id, payrollId));
  if (!payrollRecord) throw new Error('كشف الراتب غير موجود');
  if (payrollRecord.status !== 'DRAFT') {
    throw new Error(`لا يمكن اعتماد كشف راتب بحالة (${payrollRecord.status}). الاعتماد متاح فقط للمسودات.`);
  }

  // Perform completeness verification
  const verification = await validatePayrollCompleteness(payrollId);
  if (!verification.isValid) {
    throw new Error(`تعذر اعتماد الراتب للأسباب التالية:\n• ${verification.errors.join('\n• ')}`);
  }

  const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, payrollRecord.employeeId));

  const calc = computeNetPayroll({
    employmentType: emp?.employmentType || 'PERMANENT',
    workedDays: payrollRecord.workedDays,
    dailyRate: parseFloat(payrollRecord.dailyRate || '0'),
    basicEarned: parseFloat(payrollRecord.basicEarned || '0'),
    allowancesEarned: parseFloat(payrollRecord.allowancesEarned || '0'),
    otHours: parseFloat(payrollRecord.otHours || '0'),
    otRate: parseFloat(payrollRecord.otRate || '0'),
    otherAdditions: parseFloat(payrollRecord.otherAdditions || '0'),
    unpaidDays: parseFloat(payrollRecord.unpaidDays || '0'),
    unpaidDayRate: parseFloat(payrollRecord.unpaidDayRate || '0'),
    lateMinutes: payrollRecord.lateMinutes,
    lateDeduction: parseFloat(payrollRecord.lateDeduction || '0'),
    earlyDepartureMinutes: payrollRecord.earlyDepartureMinutes,
    earlyDepartureDeduction: parseFloat(payrollRecord.earlyDepartureDeduction || '0'),
    otherDeductions: parseFloat(payrollRecord.otherDeductions || '0'),
    loanDeduction: parseFloat(payrollRecord.loanDeduction || '0'),
  });

  // Transaction: Freeze NetPay = NetPreview and change status to APPROVED
  const [approved] = await db.update(schema.payroll)
    .set({
      netPay: calc.netPreview.toFixed(3),
      status: 'APPROVED',
      approvedBy: actor.id,
      approvedAt: new Date(),
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.payroll.id, payrollId))
    .returning();

  await logAuditEvent({
    actor,
    tableName: 'payroll',
    recordId: payrollId,
    action: 'APPROVE_PAYROLL',
    oldStatus: 'DRAFT',
    newStatus: 'APPROVED',
    metadata: {
      netPay: approved.netPay,
      employeeId: approved.employeeId,
      periodStart: approved.periodStart,
    },
  });

  return approved;
}

export async function confirmPayrollPayment(
  actor: UserSession,
  data: {
    payrollId: string;
    paymentMethod: 'BANK_TRANSFER' | 'CASH' | 'CHEQUE';
    paymentReference: string;
  }
) {
  requireRole(actor, ['ADMIN', 'ACCOUNTANT']);
  const db = getDb();

  const [payrollRecord] = await db.select().from(schema.payroll).where(eq(schema.payroll.id, data.payrollId));
  if (!payrollRecord) throw new Error('كشف الراتب غير موجود');
  if (payrollRecord.status !== 'APPROVED') {
    throw new Error('تأكيد الدفع متاح فقط لكشوف الرواتب المعتمدة (APPROVED).');
  }

  if (!data.paymentReference?.trim()) {
    throw new Error('المرجع المالي أو رقم التحويل مطلوب لتأكيد الدفع.');
  }

  const [paid] = await db.update(schema.payroll)
    .set({
      status: 'PAID',
      paymentMethod: data.paymentMethod,
      paymentReference: data.paymentReference.trim(),
      paidAt: new Date(),
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.payroll.id, data.payrollId))
    .returning();

  await logAuditEvent({
    actor,
    tableName: 'payroll',
    recordId: data.payrollId,
    action: 'CONFIRM_PAYROLL_PAYMENT',
    oldStatus: 'APPROVED',
    newStatus: 'PAID',
    metadata: {
      paymentMethod: data.paymentMethod,
      paymentReference: data.paymentReference,
    },
  });

  return paid;
}

export async function cancelPayrollDraft(actor: UserSession, payrollId: string) {
  requireRole(actor, ['ADMIN', 'ACCOUNTANT']);
  const db = getDb();

  const [payrollRecord] = await db.select().from(schema.payroll).where(eq(schema.payroll.id, payrollId));
  if (!payrollRecord) throw new Error('كشف الراتب غير موجود');
  if (payrollRecord.status !== 'DRAFT') {
    throw new Error('لا يمكن إلغاء إلا كشوف الرواتب التي ما تزال في حالة مسودة (DRAFT).');
  }

  // Release/cancel any scheduled loan repayments attached to this payroll
  await db.update(schema.repayments)
    .set({ status: 'CANCELLED' })
    .where(eq(schema.repayments.payrollId, payrollId));

  const [cancelled] = await db.update(schema.payroll)
    .set({
      status: 'CANCELLED',
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.payroll.id, payrollId))
    .returning();

  await logAuditEvent({
    actor,
    tableName: 'payroll',
    recordId: payrollId,
    action: 'CANCEL_PAYROLL_DRAFT',
    oldStatus: 'DRAFT',
    newStatus: 'CANCELLED',
  });

  return cancelled;
}

export async function generateBulkPayrollDrafts(
  actor: UserSession,
  data: { year: number; month: number }
) {
  requireRole(actor, ['ADMIN', 'ACCOUNTANT']);
  const db = getDb();

  const activeEmployees = await db
    .select()
    .from(schema.employees)
    .where(eq(schema.employees.status, 'ACTIVE'));

  let successCount = 0;
  let skippedCount = 0;
  const errors: { employeeId: string; employeeName: string; reason: string }[] = [];

  for (const emp of activeEmployees) {
    try {
      await createPayrollDraft(actor, {
        employeeId: emp.id,
        year: data.year,
        month: data.month,
      });
      successCount++;
    } catch (err: any) {
      if (err.message && err.message.includes('يوجد كشف راتب نشط بالفعل')) {
        skippedCount++;
      } else {
        errors.push({
          employeeId: emp.id,
          employeeName: emp.name,
          reason: err.message || 'خطأ غير معروف أثناء توليد كشف الراتب',
        });
      }
    }
  }

  await logAuditEvent({
    actor,
    tableName: 'payroll',
    recordId: `BULK_${data.year}_${data.month}`,
    action: 'BULK_CREATE_PAYROLL_DRAFT',
    metadata: {
      year: data.year,
      month: data.month,
      totalActive: activeEmployees.length,
      successCount,
      skippedCount,
      errorCount: errors.length,
    },
  });

  return {
    totalActiveCount: activeEmployees.length,
    successCount,
    skippedCount,
    errors,
  };
}

export async function updatePayrollDraft(
  actor: UserSession,
  data: {
    payrollId: string;
    otherAdditions?: number;
    otherDeductions?: number;
    unpaidDays?: number;
    earlyDepartureMinutes?: number;
    lateMinutes?: number;
    otHours?: number;
    notes?: string;
  }
) {
  requireRole(actor, ['ADMIN', 'ACCOUNTANT']);
  const db = getDb();

  const [payrollRecord] = await db.select().from(schema.payroll).where(eq(schema.payroll.id, data.payrollId));
  if (!payrollRecord) throw new Error('كشف الراتب غير موجود');
  if (payrollRecord.status !== 'DRAFT') {
    throw new Error('تعديل كشف الراتب متاح فقط لكشوف الرواتب التي في حالة مسودة (DRAFT).');
  }

  const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, payrollRecord.employeeId));
  const settings = await getSystemSettings();
  const minuteDeductionRate = emp?.minuteDeductionRate
    ? parseFloat(emp.minuteDeductionRate)
    : (settings?.defaultMinuteDeductionRate ? parseFloat(settings.defaultMinuteDeductionRate) : 0);

  const updatedOtherAdditions = data.otherAdditions !== undefined ? data.otherAdditions : parseFloat(payrollRecord.otherAdditions);
  const updatedOtherDeductions = data.otherDeductions !== undefined ? data.otherDeductions : parseFloat(payrollRecord.otherDeductions);
  const updatedUnpaidDays = data.unpaidDays !== undefined ? data.unpaidDays : parseFloat(payrollRecord.unpaidDays);
  const updatedEarlyDepartureMinutes = data.earlyDepartureMinutes !== undefined ? data.earlyDepartureMinutes : (payrollRecord.earlyDepartureMinutes || 0);
  const updatedLateMinutes = data.lateMinutes !== undefined ? data.lateMinutes : (payrollRecord.lateMinutes || 0);
  const updatedOtHours = data.otHours !== undefined ? data.otHours : parseFloat(payrollRecord.otHours);
  const updatedNotes = data.notes !== undefined ? data.notes : (payrollRecord.notes || undefined);

  if (updatedOtherAdditions < 0) throw new Error('الإضافات الأخرى لا يمكن أن تكون سالبة');
  if (updatedOtherDeductions < 0) throw new Error('الخصومات الأخرى لا يمكن أن تكون سالبة');
  if (updatedUnpaidDays < 0) throw new Error('أيام الغياب لا يمكن أن تكون سالبة');
  if (updatedEarlyDepartureMinutes < 0) throw new Error('دقائق المغادرة المبكرة لا يمكن أن تكون سالبة');
  if (updatedLateMinutes < 0) throw new Error('دقائق التأخير لا يمكن أن تكون سالبة');
  if (updatedOtHours < 0) throw new Error('ساعات الإضافي لا يمكن أن تكون سالبة');

  const lateDeduction = Math.round(updatedLateMinutes * minuteDeductionRate * 1000) / 1000;
  const earlyDepartureDeduction = Math.round(updatedEarlyDepartureMinutes * minuteDeductionRate * 1000) / 1000;

  const [updated] = await db.update(schema.payroll)
    .set({
      otherAdditions: updatedOtherAdditions.toFixed(3),
      otherDeductions: updatedOtherDeductions.toFixed(3),
      unpaidDays: updatedUnpaidDays.toFixed(2),
      lateMinutes: updatedLateMinutes,
      lateDeduction: lateDeduction.toFixed(3),
      earlyDepartureMinutes: updatedEarlyDepartureMinutes,
      earlyDepartureDeduction: earlyDepartureDeduction.toFixed(3),
      otHours: updatedOtHours.toFixed(2),
      notes: updatedNotes || null,
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.payroll.id, data.payrollId))
    .returning();

  await logAuditEvent({
    actor,
    tableName: 'payroll',
    recordId: data.payrollId,
    action: 'UPDATE_PAYROLL_DRAFT',
    metadata: {
      otherAdditions: updatedOtherAdditions,
      otherDeductions: updatedOtherDeductions,
      unpaidDays: updatedUnpaidDays,
      earlyDepartureMinutes: updatedEarlyDepartureMinutes,
      lateMinutes: updatedLateMinutes,
      otHours: updatedOtHours,
    },
  });

  return updated;
}


