import { getDb, schema } from '../../db';
import { eq, and, sql, desc, ilike, or } from 'drizzle-orm';
import { UserSession, RBAC, AuthorizationError, requireRole } from '../auth/rbac';
import { logAuditEvent } from '../auth/audit';
import { uploadPrivateFile, getSignedDownloadUrl, PRIVATE_BUCKETS } from '../supabase/storage';
import path from 'path';
import crypto from 'crypto';

export interface BasicEmployeeDTO {
  id: string;
  employeeNo: string;
  name: string;
  department: string;
  jobTitle: string;
  phone: string | null;
  startDate: string;
  endDate: string | null;
  status: 'ACTIVE' | 'TERMINATED';
  socialSecurityRegistered: boolean;
  socialSecurityRegistrationDate: string | null;
  employmentType: 'PERMANENT' | 'PROBATIONARY' | 'DAILY_WORKER';
  probationEndDate: string | null;
  probationStatus: 'IN_PROBATION' | 'PROBATION_ENDED' | 'PASSED' | 'FAILED' | 'NOT_APPLICABLE' | null;
  dailyRate: string | null;
  temporaryStartDate: string | null;
  temporaryEndDate: string | null;
  minuteDeductionRate: string | null;
  workStartTime: string | null;
  workEndTime: string | null;
  breakMinutes: number | null;
  identityImageFront: string | null;
  identityImageBack: string | null;
  createdAt: Date;
}

export interface DetailedEmployeeDTO extends BasicEmployeeDTO {
  currentContract?: {
    id: string;
    startDate: string;
    endDate: string | null;
    monthlyBasic: string;
    monthlyAllowances: string;
    unpaidDayRate: string;
    otRate: string;
    currency: string;
    contractSigned: boolean;
    contractSignedDate: string | null;
  } | null;
}

export function calculateProbationEndDate(startDateStr: string): string {
  const [year, month, day] = startDateStr.split('-').map(Number);
  const d = new Date(year, month - 1 + 3, day);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

export async function getEmployees(
  actor: UserSession,
  filters?: {
    search?: string;
    department?: string;
    status?: 'ACTIVE' | 'TERMINATED';
    employmentType?: 'PERMANENT' | 'PROBATIONARY' | 'DAILY_WORKER';
    socialSecurityRegistered?: boolean;
  }
): Promise<BasicEmployeeDTO[]> {
  const db = getDb();
  let query = db.select().from(schema.employees);

  const conditions = [];

  if (filters?.status) {
    conditions.push(eq(schema.employees.status, filters.status));
  }
  if (filters?.employmentType) {
    conditions.push(eq(schema.employees.employmentType, filters.employmentType));
  }
  if (filters?.socialSecurityRegistered !== undefined) {
    conditions.push(eq(schema.employees.socialSecurityRegistered, filters.socialSecurityRegistered));
  }
  if (filters?.department) {
    conditions.push(eq(schema.employees.department, filters.department));
  }
  if (filters?.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(schema.employees.name, term),
        ilike(schema.employees.employeeNo, term),
        ilike(schema.employees.jobTitle, term),
        ilike(schema.employees.department, term)
      )
    );
  }

  const rows = conditions.length > 0 
    ? await query.where(and(...conditions)).orderBy(desc(schema.employees.createdAt))
    : await query.orderBy(desc(schema.employees.createdAt));

  const canViewSensitive = ['ADMIN', 'HR'].includes(actor.role);
  const canViewFinancial = RBAC.canViewContracts(actor.role);

  return rows.map((emp: any) => ({
    id: emp.id,
    employeeNo: emp.employeeNo,
    name: emp.name,
    department: emp.department,
    jobTitle: emp.jobTitle,
    phone: emp.phone,
    startDate: emp.startDate,
    endDate: emp.endDate,
    status: emp.status,
    socialSecurityRegistered: emp.socialSecurityRegistered,
    socialSecurityRegistrationDate: emp.socialSecurityRegistrationDate,
    employmentType: emp.employmentType,
    probationEndDate: emp.probationEndDate || (emp.employmentType === 'PROBATIONARY' ? calculateProbationEndDate(emp.startDate) : null),
    probationStatus: emp.probationStatus || (emp.employmentType === 'PROBATIONARY' ? 'IN_PROBATION' : 'NOT_APPLICABLE'),
    dailyRate: canViewFinancial ? emp.dailyRate : null,
    temporaryStartDate: emp.temporaryStartDate,
    temporaryEndDate: emp.temporaryEndDate,
    minuteDeductionRate: emp.minuteDeductionRate,
    workStartTime: emp.workStartTime,
    workEndTime: emp.workEndTime,
    breakMinutes: emp.breakMinutes,
    identityImageFront: canViewSensitive ? emp.identityImageFront : null,
    identityImageBack: canViewSensitive ? emp.identityImageBack : null,
    createdAt: emp.createdAt,
  })) as BasicEmployeeDTO[];
}

export async function getEmployeeById(
  actor: UserSession,
  employeeId: string
): Promise<DetailedEmployeeDTO> {
  const db = getDb();
  const rows = await db.select().from(schema.employees).where(eq(schema.employees.id, employeeId));

  if (rows.length === 0) {
    throw new Error('لم يتم العثور على الموظف المطلوب');
  }

  const emp = rows[0];
  const canViewSensitive = ['ADMIN', 'HR'].includes(actor.role);
  const canViewFinancial = RBAC.canViewContracts(actor.role);

  const result: DetailedEmployeeDTO = {
    id: emp.id,
    employeeNo: emp.employeeNo,
    name: emp.name,
    department: emp.department,
    jobTitle: emp.jobTitle,
    phone: emp.phone,
    startDate: emp.startDate,
    endDate: emp.endDate,
    status: emp.status,
    socialSecurityRegistered: emp.socialSecurityRegistered,
    socialSecurityRegistrationDate: emp.socialSecurityRegistrationDate,
    employmentType: emp.employmentType,
    probationEndDate: emp.probationEndDate || (emp.employmentType === 'PROBATIONARY' ? calculateProbationEndDate(emp.startDate) : null),
    probationStatus: emp.probationStatus || (emp.employmentType === 'PROBATIONARY' ? 'IN_PROBATION' : 'NOT_APPLICABLE'),
    dailyRate: canViewFinancial ? emp.dailyRate : null,
    temporaryStartDate: emp.temporaryStartDate,
    temporaryEndDate: emp.temporaryEndDate,
    minuteDeductionRate: emp.minuteDeductionRate,
    workStartTime: emp.workStartTime,
    workEndTime: emp.workEndTime,
    breakMinutes: emp.breakMinutes,
    identityImageFront: canViewSensitive ? emp.identityImageFront : null,
    identityImageBack: canViewSensitive ? emp.identityImageBack : null,
    createdAt: emp.createdAt,
  };

  // Only return financial compensation data if actor role is authorized (ADMIN, HR, ACCOUNTANT)
  // SUPERVISOR will NEVER receive salary or ID image details
  if (canViewFinancial) {
    const contracts = await db.select().from(schema.contracts)
      .where(eq(schema.contracts.employeeId, employeeId))
      .orderBy(desc(schema.contracts.startDate));

    if (contracts.length > 0) {
      const activeContract = contracts[0];
      result.currentContract = {
        id: activeContract.id,
        startDate: activeContract.startDate,
        endDate: activeContract.endDate,
        monthlyBasic: activeContract.monthlyBasic,
        monthlyAllowances: activeContract.monthlyAllowances,
        unpaidDayRate: activeContract.unpaidDayRate,
        otRate: activeContract.otRate,
        currency: activeContract.currency,
        contractSigned: activeContract.contractSigned,
        contractSignedDate: activeContract.contractSignedDate,
      };
    }
  }

  return result;
}

export async function createEmployee(
  actor: UserSession,
  data: {
    employeeNo: string;
    name: string;
    department: string;
    jobTitle: string;
    phone?: string;
    startDate: string;
    endDate?: string;
    socialSecurityRegistered?: boolean;
    socialSecurityRegistrationDate?: string | null;
    employmentType?: 'PERMANENT' | 'PROBATIONARY' | 'DAILY_WORKER';
    dailyRate?: number | null;
    monthlyBasic?: number | null;
    monthlyAllowances?: number | null;
    unpaidDayRate?: number | null;
    otRate?: number | null;
    temporaryStartDate?: string | null;
    temporaryEndDate?: string | null;
    minuteDeductionRate?: number | null;
    workStartTime?: string | null;
    workEndTime?: string | null;
    breakMinutes?: number | null;
    identityImageFront?: string | null;
    identityImageBack?: string | null;
    contractSigned?: boolean;
    contractSignedDate?: string | null;
  }
) {
  requireRole(actor, ['ADMIN', 'HR']);
  const db = getDb();

  // 1. Validation
  if (!data.name?.trim()) throw new Error('اسم الموظف مطلوب');
  if (!data.employeeNo?.trim()) throw new Error('الرقم الوظيفي مطلوب');
  if (!data.department?.trim()) throw new Error('القسم مطلوب');
  if (!data.jobTitle?.trim()) throw new Error('المسمى الوظيفي مطلوب');
  if (!data.startDate) throw new Error('تاريخ بداية العمل مطلوب');

  if (data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
    throw new Error('تاريخ نهاية الخدمة لا يمكن أن يكون قبل تاريخ البداية');
  }

  // Social Security validation:
  const ssRegistered = Boolean(data.socialSecurityRegistered);
  let ssDate: string | null = null;
  if (ssRegistered) {
    if (!data.socialSecurityRegistrationDate) {
      throw new Error('تاريخ التسجيل في الضمان الاجتماعي مطلوب عند تسجيل الموظف في الضمان');
    }
    ssDate = data.socialSecurityRegistrationDate;
  } else {
    ssDate = null;
  }

  // Employment type & daily worker / probation rules
  const empType = data.employmentType || 'PERMANENT';
  let dailyRateStr: string | null = null;
  let probationEndDateVal: string | null = null;
  let probationStatusVal: 'IN_PROBATION' | 'PROBATION_ENDED' | 'PASSED' | 'FAILED' | 'NOT_APPLICABLE' = 'NOT_APPLICABLE';

  if (empType === 'PROBATIONARY') {
    probationEndDateVal = calculateProbationEndDate(data.startDate);
    probationStatusVal = 'IN_PROBATION';
  } else {
    probationEndDateVal = null;
    probationStatusVal = 'NOT_APPLICABLE';
  }

  if (empType === 'DAILY_WORKER') {
    if (data.dailyRate === undefined || data.dailyRate === null || data.dailyRate < 0) {
      throw new Error('أجرة المياومة مطلوبة لعمال المياومة ويجب أن تكون صفر أو أكبر');
    }
    dailyRateStr = Number(data.dailyRate).toFixed(3);

    if (data.temporaryStartDate && data.temporaryEndDate && new Date(data.temporaryEndDate) < new Date(data.temporaryStartDate)) {
      throw new Error('تاريخ نهاية العمل المؤقت لا يمكن أن يسبق تاريخ البداية');
    }
  } else {
    dailyRateStr = data.dailyRate !== undefined && data.dailyRate !== null ? Number(data.dailyRate).toFixed(3) : null;
  }

  // 2. Uniqueness check
  const existing = await db.select().from(schema.employees).where(eq(schema.employees.employeeNo, data.employeeNo.trim()));
  if (existing.length > 0) {
    throw new Error(`الرقم الوظيفي (${data.employeeNo}) مستخدم بالفعل لموظف آخر.`);
  }

  const [inserted] = await db.insert(schema.employees).values({
    employeeNo: data.employeeNo.trim(),
    name: data.name.trim(),
    department: data.department.trim(),
    jobTitle: data.jobTitle.trim(),
    phone: data.phone?.trim() || null,
    startDate: data.startDate,
    endDate: data.endDate || null,
    status: 'ACTIVE',
    socialSecurityRegistered: ssRegistered,
    socialSecurityRegistrationDate: ssDate,
    employmentType: empType,
    probationEndDate: probationEndDateVal,
    probationStatus: probationStatusVal,
    dailyRate: dailyRateStr,
    temporaryStartDate: data.temporaryStartDate || null,
    temporaryEndDate: data.temporaryEndDate || null,
    minuteDeductionRate: data.minuteDeductionRate !== undefined && data.minuteDeductionRate !== null ? Number(data.minuteDeductionRate).toFixed(3) : null,
    workStartTime: data.workStartTime || null,
    workEndTime: data.workEndTime || null,
    breakMinutes: data.breakMinutes !== undefined && data.breakMinutes !== null ? Number(data.breakMinutes) : null,
    identityImageFront: data.identityImageFront || null,
    identityImageBack: data.identityImageBack || null,
    createdBy: actor.id,
    updatedBy: actor.id,
  }).returning();

  if (empType === 'DAILY_WORKER' && dailyRateStr) {
    await db.insert(schema.dailyRateHistory).values({
      employeeId: inserted.id,
      dailyRate: dailyRateStr,
      effectiveFrom: data.temporaryStartDate || data.startDate,
      createdBy: actor.id,
    });
  }

  // Auto-create initial contract for Permanent / Probationary Employee if basic salary is specified
  if ((empType === 'PERMANENT' || empType === 'PROBATIONARY') && data.monthlyBasic !== undefined && data.monthlyBasic !== null && data.monthlyBasic > 0) {
    const basic = Number(data.monthlyBasic);
    const allowances = data.monthlyAllowances ? Number(data.monthlyAllowances) : 0;
    const total = basic + allowances;
    const unpaidDayRate = data.unpaidDayRate !== undefined && data.unpaidDayRate !== null
      ? Number(data.unpaidDayRate)
      : Math.round((total / 30) * 1000) / 1000;
    const otRate = data.otRate !== undefined && data.otRate !== null
      ? Number(data.otRate)
      : Math.round(((total / 240) * 1.5) * 1000) / 1000;

    const isSigned = data.contractSigned !== undefined ? Boolean(data.contractSigned) : (empType === 'PERMANENT');
    const signedDate = isSigned ? (data.contractSignedDate || data.startDate) : null;

    const { createContract } = await import('./contract-service');
    await createContract(actor, {
      employeeId: inserted.id,
      startDate: data.startDate,
      endDate: data.endDate || (empType === 'PROBATIONARY' ? probationEndDateVal : null),
      monthlyBasic: basic,
      monthlyAllowances: allowances,
      unpaidDayRate,
      otRate,
      contractSigned: isSigned,
      contractSignedDate: signedDate,
    });
  }

  await logAuditEvent({
    actor,
    tableName: 'employees',
    recordId: inserted.id,
    action: 'CREATE_EMPLOYEE',
    newStatus: 'ACTIVE',
    metadata: {
      employeeNo: inserted.employeeNo,
      name: inserted.name,
      employmentType: inserted.employmentType,
      socialSecurityRegistered: inserted.socialSecurityRegistered,
      probationEndDate: inserted.probationEndDate,
    },
  });

  return inserted;
}

export async function updateEmployee(
  actor: UserSession,
  employeeId: string,
  data: {
    name?: string;
    department?: string;
    jobTitle?: string;
    phone?: string;
    startDate?: string;
    endDate?: string | null;
    status?: 'ACTIVE' | 'TERMINATED';
    socialSecurityRegistered?: boolean;
    socialSecurityRegistrationDate?: string | null;
    employmentType?: 'PERMANENT' | 'PROBATIONARY' | 'DAILY_WORKER';
    dailyRate?: number | null;
    temporaryStartDate?: string | null;
    temporaryEndDate?: string | null;
    minuteDeductionRate?: number | null;
    workStartTime?: string | null;
    workEndTime?: string | null;
    breakMinutes?: number | null;
    identityImageFront?: string | null;
    identityImageBack?: string | null;
  }
) {
  requireRole(actor, ['ADMIN', 'HR']);
  const db = getDb();

  const existing = await db.select().from(schema.employees).where(eq(schema.employees.id, employeeId));
  if (existing.length === 0) {
    throw new Error('الموظف غير موجود');
  }

  const current = existing[0];
  const effectiveStart = data.startDate || current.startDate;
  const effectiveEnd = data.endDate !== undefined ? data.endDate : current.endDate;

  if (effectiveEnd && new Date(effectiveEnd) < new Date(effectiveStart)) {
    throw new Error('تاريخ نهاية الخدمة لا يمكن أن يكون قبل تاريخ البداية');
  }

  // Handle Social Security rules
  const ssRegistered = data.socialSecurityRegistered !== undefined ? Boolean(data.socialSecurityRegistered) : current.socialSecurityRegistered;
  let ssDate = current.socialSecurityRegistrationDate;
  if (data.socialSecurityRegistered !== undefined || data.socialSecurityRegistrationDate !== undefined) {
    if (ssRegistered) {
      const dateToUse = data.socialSecurityRegistrationDate !== undefined ? data.socialSecurityRegistrationDate : current.socialSecurityRegistrationDate;
      if (!dateToUse) {
        throw new Error('تاريخ التسجيل في الضمان الاجتماعي مطلوب عند تسجيل الموظف في الضمان');
      }
      ssDate = dateToUse;
    } else {
      ssDate = null;
    }
  }

  // Handle employment type & daily worker rules
  const empType = data.employmentType || current.employmentType;
  let dailyRateStr = current.dailyRate;
  if (data.dailyRate !== undefined) {
    dailyRateStr = data.dailyRate !== null ? Number(data.dailyRate).toFixed(3) : null;
  }
  if (empType === 'DAILY_WORKER' && (dailyRateStr === null || Number(dailyRateStr) < 0)) {
    throw new Error('أجرة المياومة مطلوبة لعمال المياومة ويجب أن تكون صفر أو أكبر');
  }

  let probationEndDateVal = current.probationEndDate;
  let probationStatusVal = current.probationStatus;
  if (data.employmentType !== undefined || data.startDate !== undefined) {
    if (empType === 'PROBATIONARY') {
      probationEndDateVal = calculateProbationEndDate(effectiveStart);
      probationStatusVal = 'IN_PROBATION';
    } else if (empType === 'PERMANENT') {
      probationEndDateVal = null;
      probationStatusVal = (current.probationStatus === 'IN_PROBATION' || current.probationStatus === 'PROBATION_ENDED') ? 'PASSED' : 'NOT_APPLICABLE';
    } else {
      probationEndDateVal = null;
      probationStatusVal = 'NOT_APPLICABLE';
    }
  }

  const [updated] = await db.update(schema.employees)
    .set({
      name: data.name?.trim() ?? current.name,
      department: data.department?.trim() ?? current.department,
      jobTitle: data.jobTitle?.trim() ?? current.jobTitle,
      phone: data.phone !== undefined ? data.phone?.trim() || null : current.phone,
      startDate: effectiveStart,
      endDate: effectiveEnd,
      status: data.status ?? current.status,
      socialSecurityRegistered: ssRegistered,
      socialSecurityRegistrationDate: ssDate,
      employmentType: empType,
      probationEndDate: probationEndDateVal,
      probationStatus: probationStatusVal,
      dailyRate: dailyRateStr,
      temporaryStartDate: data.temporaryStartDate !== undefined ? data.temporaryStartDate : current.temporaryStartDate,
      temporaryEndDate: data.temporaryEndDate !== undefined ? data.temporaryEndDate : current.temporaryEndDate,
      minuteDeductionRate: data.minuteDeductionRate !== undefined ? (data.minuteDeductionRate !== null ? Number(data.minuteDeductionRate).toFixed(3) : null) : current.minuteDeductionRate,
      workStartTime: data.workStartTime !== undefined ? data.workStartTime : current.workStartTime,
      workEndTime: data.workEndTime !== undefined ? data.workEndTime : current.workEndTime,
      breakMinutes: data.breakMinutes !== undefined ? (data.breakMinutes !== null ? Number(data.breakMinutes) : null) : current.breakMinutes,
      identityImageFront: data.identityImageFront !== undefined ? data.identityImageFront : current.identityImageFront,
      identityImageBack: data.identityImageBack !== undefined ? data.identityImageBack : current.identityImageBack,
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.employees.id, employeeId))
    .returning();

  if (data.dailyRate !== undefined && data.dailyRate !== null && Number(data.dailyRate).toFixed(3) !== current.dailyRate) {
    const todayDateStr = new Date().toISOString().slice(0, 10);
    await db.insert(schema.dailyRateHistory).values({
      employeeId,
      dailyRate: Number(data.dailyRate).toFixed(3),
      effectiveFrom: todayDateStr,
      createdBy: actor.id,
    });
  }

  await logAuditEvent({
    actor,
    tableName: 'employees',
    recordId: employeeId,
    action: 'UPDATE_EMPLOYEE',
    oldStatus: current.status,
    newStatus: updated.status,
    metadata: { changes: data },
  });

  return updated;
}

export async function updateSocialSecurity(
  actor: UserSession,
  employeeId: string,
  data: {
    socialSecurityRegistered: boolean;
    socialSecurityRegistrationDate?: string | null;
  }
) {
  requireRole(actor, ['ADMIN', 'HR']);
  const db = getDb();

  const [existing] = await db.select().from(schema.employees).where(eq(schema.employees.id, employeeId));
  if (!existing) {
    throw new Error('الموظف غير موجود');
  }

  let regDate: string | null = null;
  if (data.socialSecurityRegistered) {
    if (!data.socialSecurityRegistrationDate) {
      throw new Error('تاريخ التسجيل في الضمان الاجتماعي مطلوب عند تسجيل الموظف');
    }
    regDate = data.socialSecurityRegistrationDate;
  } else {
    regDate = null;
  }

  const [updated] = await db.update(schema.employees)
    .set({
      socialSecurityRegistered: data.socialSecurityRegistered,
      socialSecurityRegistrationDate: regDate,
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.employees.id, employeeId))
    .returning();

  await logAuditEvent({
    actor,
    tableName: 'employees',
    recordId: employeeId,
    action: 'SOCIAL_SECURITY_UPDATE',
    metadata: {
      socialSecurityRegistered: data.socialSecurityRegistered,
      socialSecurityRegistrationDate: regDate,
    },
  });

  return updated;
}

export async function uploadIdentityImage(
  actor: UserSession,
  employeeId: string,
  side: 'front' | 'back',
  fileBuffer: Buffer,
  mimeType: string,
  originalFilename: string
) {
  requireRole(actor, ['ADMIN', 'HR']);
  const db = getDb();

  // Strict MIME type validation: JPG, PNG, WEBP ONLY. PDF explicitly rejected.
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimeTypes.includes(mimeType)) {
    throw new Error('صيغة الملف غير مدعومة للهوية. يجب أن تكون الصورة من نوع JPG أو PNG أو WEBP فقط (ملفات PDF غير مقبولة).');
  }

  const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, employeeId));
  if (!emp) {
    throw new Error('الموظف غير موجود');
  }

  const ext = path.extname(originalFilename) || (mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg');
  const fileKey = `identities/${employeeId}_${side}_${crypto.randomBytes(6).toString('hex')}${ext}`;

  const uploadResult = await uploadPrivateFile(PRIVATE_BUCKETS.DOCUMENTS, fileKey, fileBuffer, mimeType);
  if (!uploadResult.success) {
    throw new Error(uploadResult.error || 'فشل رفع صورة الهوية');
  }

  const updateField = side === 'front' 
    ? { identityImageFront: uploadResult.path }
    : { identityImageBack: uploadResult.path };

  const [updated] = await db.update(schema.employees)
    .set({
      ...updateField,
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.employees.id, employeeId))
    .returning();

  await logAuditEvent({
    actor,
    tableName: 'employees',
    recordId: employeeId,
    action: 'IDENTITY_IMAGE_UPDATE',
    metadata: {
      side,
      path: uploadResult.path,
    },
  });

  return updated;
}

export async function getEmployeeIdentityImages(
  actor: UserSession,
  employeeId: string
): Promise<{ frontUrl: string | null; backUrl: string | null }> {
  if (!['ADMIN', 'HR'].includes(actor.role)) {
    throw new AuthorizationError('غير مصرح لك بالاطلاع على صور الهوية للموظفين.');
  }

  const db = getDb();
  const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, employeeId));
  if (!emp) {
    throw new Error('الموظف غير موجود');
  }

  let frontUrl: string | null = null;
  let backUrl: string | null = null;

  if (emp.identityImageFront) {
    const res = await getSignedDownloadUrl(PRIVATE_BUCKETS.DOCUMENTS, emp.identityImageFront);
    frontUrl = res.signedUrl;
  }
  if (emp.identityImageBack) {
    const res = await getSignedDownloadUrl(PRIVATE_BUCKETS.DOCUMENTS, emp.identityImageBack);
    backUrl = res.signedUrl;
  }

  return { frontUrl, backUrl };
}

export interface EmployeeDueForContractDTO {
  id: string;
  employeeNo: string;
  name: string;
  department: string;
  jobTitle: string;
  startDate: string;
  probationEndDate: string;
  daysPassedSinceProbationEnd: number;
  contractSigned: boolean;
}

export async function getEmployeesDueForContractSigning(
  actor: UserSession
): Promise<EmployeeDueForContractDTO[]> {
  const db = getDb();
  const todayStr = new Date().toISOString().slice(0, 10);

  // Active employees
  const activeEmps = await db.select().from(schema.employees)
    .where(eq(schema.employees.status, 'ACTIVE'));

  const allContracts = await db.select().from(schema.contracts);

  const results: EmployeeDueForContractDTO[] = [];

  for (const emp of activeEmps) {
    if (emp.employmentType === 'PROBATIONARY' || emp.probationStatus === 'IN_PROBATION' || emp.probationStatus === 'PROBATION_ENDED') {
      const probationEnd = emp.probationEndDate || calculateProbationEndDate(emp.startDate);

      // Probation period has ended (or ends today)
      if (todayStr >= probationEnd) {
        const empContracts = allContracts.filter((c: any) => c.employeeId === emp.id);
        const hasSignedPermanentContract = empContracts.some((c: any) => c.contractSigned === true && emp.employmentType === 'PERMANENT');

        if (!hasSignedPermanentContract) {
          const diffMs = new Date(todayStr).getTime() - new Date(probationEnd).getTime();
          const daysPassed = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

          results.push({
            id: emp.id,
            employeeNo: emp.employeeNo,
            name: emp.name,
            department: emp.department,
            jobTitle: emp.jobTitle,
            startDate: emp.startDate,
            probationEndDate: probationEnd,
            daysPassedSinceProbationEnd: daysPassed,
            contractSigned: false,
          });
        }
      }
    }
  }

  return results;
}

export async function transitionProbationToPermanent(
  actor: UserSession,
  employeeId: string,
  contractDetails?: {
    monthlyBasic?: number;
    monthlyAllowances?: number;
    unpaidDayRate?: number;
    otRate?: number;
    contractSignedDate?: string;
  }
) {
  requireRole(actor, ['ADMIN', 'HR']);
  const db = getDb();

  const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, employeeId));
  if (!emp) {
    throw new Error('الموظف غير موجود');
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const signedDate = contractDetails?.contractSignedDate || todayStr;

  const [updated] = await db.update(schema.employees)
    .set({
      employmentType: 'PERMANENT',
      probationStatus: 'PASSED',
      probationEndDate: null,
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.employees.id, employeeId))
    .returning();

  if (contractDetails?.monthlyBasic && contractDetails.monthlyBasic > 0) {
    const basic = Number(contractDetails.monthlyBasic);
    const allowances = contractDetails.monthlyAllowances ? Number(contractDetails.monthlyAllowances) : 0;
    const total = basic + allowances;
    const unpaidDayRate = contractDetails.unpaidDayRate !== undefined
      ? Number(contractDetails.unpaidDayRate)
      : Math.round((total / 30) * 1000) / 1000;
    const otRate = contractDetails.otRate !== undefined
      ? Number(contractDetails.otRate)
      : Math.round(((total / 240) * 1.5) * 1000) / 1000;

    const { createContract } = await import('./contract-service');
    await createContract(actor, {
      employeeId,
      startDate: signedDate,
      monthlyBasic: basic,
      monthlyAllowances: allowances,
      unpaidDayRate,
      otRate,
      contractSigned: true,
      contractSignedDate: signedDate,
    });
  } else {
    // Check if employee has an existing contract and update it to signed
    const existingContracts = await db.select().from(schema.contracts)
      .where(eq(schema.contracts.employeeId, employeeId));
    if (existingContracts.length > 0) {
      const activeContract = existingContracts[0];
      const { updateContract } = await import('./contract-service');
      await updateContract(actor, activeContract.id, {
        contractSigned: true,
        contractSignedDate: signedDate,
      });
    }
  }

  await logAuditEvent({
    actor,
    tableName: 'employees',
    recordId: employeeId,
    action: 'TRANSITION_PROBATION_TO_PERMANENT',
    oldStatus: emp.employmentType,
    newStatus: 'PERMANENT',
    metadata: {
      probationEndDate: emp.probationEndDate,
      contractSignedDate: signedDate,
    },
  });

  return updated;
}

