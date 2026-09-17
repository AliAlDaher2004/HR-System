import { getDb, schema } from '../../db';
import { getSystemSettings } from './settings-service';
import { eq, and, desc, sql } from 'drizzle-orm';
import { UserSession, RBAC, AuthorizationError, requireRole } from '../auth/rbac';
import { logAuditEvent } from '../auth/audit';

export async function getContractsByEmployeeId(actor: UserSession, employeeId: string) {
  if (!RBAC.canViewContracts(actor.role)) {
    throw new AuthorizationError('غير مصرح لك باستعراض عقود الموظفين أو الرواتب.');
  }

  const db = getDb();
  return db.select()
    .from(schema.contracts)
    .where(eq(schema.contracts.employeeId, employeeId))
    .orderBy(desc(schema.contracts.startDate));
}

export async function createContract(
  actor: UserSession,
  data: {
    employeeId: string;
    startDate: string;
    endDate?: string | null;
    monthlyBasic: number;
    monthlyAllowances?: number;
    unpaidDayRate: number;
    otRate: number;
    currency?: string;
    contractSigned?: boolean;
    contractSignedDate?: string | null;
    fileUrl?: string;
  }
) {
  requireRole(actor, ['ADMIN', 'HR']);
  const db = getDb();

  // Validate employee
  const emp = await db.select().from(schema.employees).where(eq(schema.employees.id, data.employeeId));
  if (emp.length === 0) {
    throw new Error('الموظف غير موجود');
  }

  // Validate dates
  if (!data.startDate) throw new Error('تاريخ بداية العقد مطلوب');
  if (data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
    throw new Error('تاريخ نهاية العقد لا يمكن أن يكون قبل تاريخ البداية');
  }

  // Contract signature rules
  const contractSigned = Boolean(data.contractSigned);
  let contractSignedDate: string | null = null;
  if (contractSigned) {
    if (!data.contractSignedDate) {
      throw new Error('تاريخ توقيع العقد مطلوب عند تحديد أن العقد موقع');
    }
    contractSignedDate = data.contractSignedDate;
  }

  // Monetary fields validation
  if (data.monthlyBasic < 0) throw new Error('الراتب الأساسي لا يمكن أن يكون سالباً');
  if ((data.monthlyAllowances ?? 0) < 0) throw new Error('البدلات لا يمكن أن تكون سالبة');
  if (data.unpaidDayRate < 0) throw new Error('معدل اليوم غير المدفوع لا يمكن أن يكون سالباً');
  if (data.otRate < 0) throw new Error('معدل الساعة الإضافية لا يمكن أن يكون سالباً');

  // Verify operating currency
  const currentSettings = await getSystemSettings();
  const operatingCurrency = currentSettings?.currency || 'JOD';
  const currency = data.currency || operatingCurrency;
  if (currency !== operatingCurrency) {
    throw new Error(`عملة العقد (${currency}) يجب أن تطابق عملة النظام التشغيلية (${operatingCurrency}).`);
  }

  const [inserted] = await db.insert(schema.contracts).values({
    employeeId: data.employeeId,
    startDate: data.startDate,
    endDate: data.endDate || null,
    monthlyBasic: data.monthlyBasic.toFixed(3),
    monthlyAllowances: (data.monthlyAllowances ?? 0).toFixed(3),
    unpaidDayRate: data.unpaidDayRate.toFixed(3),
    otRate: data.otRate.toFixed(3),
    currency,
    contractSigned,
    contractSignedDate,
    fileUrl: data.fileUrl || null,
    createdBy: actor.id,
  }).returning();

  await logAuditEvent({
    actor,
    tableName: 'contracts',
    recordId: inserted.id,
    action: 'CREATE_CONTRACT',
    metadata: {
      employeeId: data.employeeId,
      startDate: data.startDate,
      monthlyBasic: data.monthlyBasic,
      contractSigned,
      contractSignedDate,
    },
  });

  return inserted;
}

export async function updateContract(
  actor: UserSession,
  contractId: string,
  data: {
    endDate?: string | null;
    monthlyBasic?: number;
    monthlyAllowances?: number;
    unpaidDayRate?: number;
    otRate?: number;
    contractSigned?: boolean;
    contractSignedDate?: string | null;
    fileUrl?: string;
  }
) {
  requireRole(actor, ['ADMIN', 'HR']);
  const db = getDb();

  const [existing] = await db.select().from(schema.contracts).where(eq(schema.contracts.id, contractId));
  if (!existing) {
    throw new Error('العقد غير موجود');
  }

  // Check if contract has been used in closed or active payroll
  const linkedPayrolls = await db.select().from(schema.payroll)
    .where(and(eq(schema.payroll.contractId, contractId), sql`status IN ('APPROVED', 'PAID')`));

  const hasFinancialEdits = 
    data.monthlyBasic !== undefined ||
    data.monthlyAllowances !== undefined ||
    data.unpaidDayRate !== undefined ||
    data.otRate !== undefined;

  if (linkedPayrolls.length > 0 && hasFinancialEdits) {
    throw new Error(
      'لا يمكن تعديل بنود الراتب أو التعويضات لعقد تم استخدامه مسبقاً في كشوف رواتب معتمدة أو مدفوعة. يجب إنشاء عقد جديد بتاريخ سريان جديد للحفاظ على سلامة التاريخ المالي.'
    );
  }

  const contractSigned = data.contractSigned !== undefined ? Boolean(data.contractSigned) : existing.contractSigned;
  let contractSignedDate = existing.contractSignedDate;
  if (data.contractSigned !== undefined || data.contractSignedDate !== undefined) {
    if (contractSigned) {
      const dateToUse = data.contractSignedDate !== undefined ? data.contractSignedDate : existing.contractSignedDate;
      if (!dateToUse) {
        throw new Error('تاريخ توقيع العقد مطلوب عند تحديد أن العقد موقع');
      }
      contractSignedDate = dateToUse;
    } else {
      contractSignedDate = null;
    }
  }

  const [updated] = await db.update(schema.contracts)
    .set({
      endDate: data.endDate !== undefined ? data.endDate : existing.endDate,
      monthlyBasic: data.monthlyBasic !== undefined ? data.monthlyBasic.toFixed(3) : existing.monthlyBasic,
      monthlyAllowances: data.monthlyAllowances !== undefined ? data.monthlyAllowances.toFixed(3) : existing.monthlyAllowances,
      unpaidDayRate: data.unpaidDayRate !== undefined ? data.unpaidDayRate.toFixed(3) : existing.unpaidDayRate,
      otRate: data.otRate !== undefined ? data.otRate.toFixed(3) : existing.otRate,
      contractSigned,
      contractSignedDate,
      fileUrl: data.fileUrl !== undefined ? data.fileUrl : existing.fileUrl,
    })
    .where(eq(schema.contracts.id, contractId))
    .returning();

  await logAuditEvent({
    actor,
    tableName: 'contracts',
    recordId: contractId,
    action: data.contractSigned !== undefined ? 'CONTRACT_SIGNATURE_UPDATE' : 'UPDATE_CONTRACT',
    metadata: { changes: data },
  });

  return updated;
}

