import { getDb, schema } from '../../db';
import { eq, desc, and, or, ilike, gte, lte } from 'drizzle-orm';
import { UserSession, RBAC, requireRole, AuthorizationError } from '../auth/rbac';
import { logAuditEvent } from '../auth/audit';
import { uploadPrivateFile, getSignedDownloadUrl, PRIVATE_BUCKETS } from '../supabase/storage';
import path from 'path';
import crypto from 'crypto';

import { WarningLevel, WARNING_LEVELS, WarningDTO } from '../types/warning';
export type { WarningLevel, WarningDTO };
export { WARNING_LEVELS };

export async function getWarnings(
  actor: UserSession,
  filters?: {
    employeeId?: string;
    warningLevel?: WarningLevel;
    status?: 'ACTIVE' | 'REVOKED';
    search?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<WarningDTO[]> {
  if (!RBAC.canViewWarnings(actor.role)) {
    throw new AuthorizationError('غير مصرح لك باستعراض سجل الإنذارات');
  }

  const db = getDb();
  const conditions = [];

  if (filters?.employeeId) {
    conditions.push(eq(schema.warnings.employeeId, filters.employeeId));
  }
  if (filters?.warningLevel) {
    conditions.push(eq(schema.warnings.warningLevel, filters.warningLevel));
  }
  if (filters?.status) {
    conditions.push(eq(schema.warnings.status, filters.status));
  }
  if (filters?.startDate) {
    conditions.push(gte(schema.warnings.warningDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(schema.warnings.warningDate, filters.endDate));
  }
  if (filters?.search) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(schema.warnings.title, term),
        ilike(schema.warnings.reason, term),
        ilike(schema.warnings.administrativeAction, term),
        ilike(schema.employees.name, term),
        ilike(schema.employees.employeeNo, term),
        ilike(schema.employees.department, term)
      )
    );
  }

  let query = db
    .select({
      warning: schema.warnings,
      employee: {
        id: schema.employees.id,
        employeeNo: schema.employees.employeeNo,
        name: schema.employees.name,
        department: schema.employees.department,
        jobTitle: schema.employees.jobTitle,
      },
    })
    .from(schema.warnings)
    .innerJoin(schema.employees, eq(schema.warnings.employeeId, schema.employees.id));

  let rows;
  if (conditions.length > 0) {
    rows = await query
      .where(and(...conditions))
      .orderBy(desc(schema.warnings.warningDate), desc(schema.warnings.createdAt));
  } else {
    rows = await query.orderBy(desc(schema.warnings.warningDate), desc(schema.warnings.createdAt));
  }

  return rows.map((r: any) => ({
    id: r.warning.id,
    employeeId: r.warning.employeeId,
    warningLevel: r.warning.warningLevel,
    warningDate: r.warning.warningDate,
    title: r.warning.title,
    reason: r.warning.reason,
    administrativeAction: r.warning.administrativeAction,
    signedByEmployee: r.warning.signedByEmployee,
    attachmentPath: r.warning.attachmentPath,
    status: r.warning.status,
    notes: r.warning.notes,
    createdAt: r.warning.createdAt,
    createdBy: r.warning.createdBy,
    employee: r.employee,
  }));
}

export async function getEmployeeWarnings(actor: UserSession, employeeId: string): Promise<WarningDTO[]> {
  return getWarnings(actor, { employeeId });
}

export async function getWarningById(actor: UserSession, id: string): Promise<WarningDTO | null> {
  if (!RBAC.canViewWarnings(actor.role)) {
    throw new AuthorizationError('غير مصرح لك باستعراض بيانات الإنذار');
  }

  const db = getDb();
  const rows = await db
    .select({
      warning: schema.warnings,
      employee: {
        id: schema.employees.id,
        employeeNo: schema.employees.employeeNo,
        name: schema.employees.name,
        department: schema.employees.department,
        jobTitle: schema.employees.jobTitle,
      },
    })
    .from(schema.warnings)
    .innerJoin(schema.employees, eq(schema.warnings.employeeId, schema.employees.id))
    .where(eq(schema.warnings.id, id))
    .limit(1);

  if (rows.length === 0) return null;

  const r = rows[0];
  return {
    id: r.warning.id,
    employeeId: r.warning.employeeId,
    warningLevel: r.warning.warningLevel,
    warningDate: r.warning.warningDate,
    title: r.warning.title,
    reason: r.warning.reason,
    administrativeAction: r.warning.administrativeAction,
    signedByEmployee: r.warning.signedByEmployee,
    attachmentPath: r.warning.attachmentPath,
    status: r.warning.status,
    notes: r.warning.notes,
    createdAt: r.warning.createdAt,
    createdBy: r.warning.createdBy,
    employee: r.employee,
  };
}

export async function createWarning(
  actor: UserSession,
  data: {
    employeeId: string;
    warningLevel: WarningLevel;
    warningDate: string;
    title: string;
    reason: string;
    administrativeAction?: string | null;
    signedByEmployee?: boolean;
    notes?: string | null;
    fileBuffer?: Buffer;
    mimeType?: string;
    originalFilename?: string;
  }
): Promise<WarningDTO> {
  requireRole(actor, ['ADMIN', 'HR']);

  if (!data.employeeId?.trim()) throw new Error('يرجى تحديد الموظف');
  if (!data.warningLevel) throw new Error('درجة الإنذار مطلوبة');
  if (!data.warningDate) throw new Error('تاريخ الإنذار مطلوب');
  if (!data.title?.trim()) throw new Error('موضوع / عنوان الإنذار مطلوب');
  if (!data.reason?.trim()) throw new Error('سبب المخالفة بالتفصيل مطلوب');

  const db = getDb();

  // Validate employee exists
  const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, data.employeeId));
  if (!emp) {
    throw new Error('الموظف المحدد غير موجود في النظام');
  }

  let uploadedPath: string | null = null;

  if (data.fileBuffer && data.mimeType) {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedMimes.includes(data.mimeType)) {
      throw new Error('نوع الملف غير مدعوم لكتاب الإنذار. يرجى إرفاق صورة (JPG, PNG, WEBP) أو ملف PDF');
    }

    const ext = path.extname(data.originalFilename || '') || (data.mimeType === 'application/pdf' ? '.pdf' : '.jpg');
    const fileKey = `warnings/${data.employeeId}_${crypto.randomBytes(6).toString('hex')}${ext}`;

    const uploadRes = await uploadPrivateFile(PRIVATE_BUCKETS.DOCUMENTS, fileKey, data.fileBuffer, data.mimeType);
    if (!uploadRes.success) {
      throw new Error(uploadRes.error || 'فشل في حفظ ملف/صورة كتاب الإنذار');
    }
    uploadedPath = uploadRes.path;
  }

  const [inserted] = await db
    .insert(schema.warnings)
    .values({
      employeeId: data.employeeId,
      warningLevel: data.warningLevel,
      warningDate: data.warningDate,
      title: data.title.trim(),
      reason: data.reason.trim(),
      administrativeAction: data.administrativeAction?.trim() || null,
      signedByEmployee: Boolean(data.signedByEmployee),
      attachmentPath: uploadedPath,
      status: 'ACTIVE',
      notes: data.notes?.trim() || null,
      createdBy: actor.id,
      updatedBy: actor.id,
    })
    .returning();

  await logAuditEvent({
    actor,
    tableName: 'warnings',
    recordId: inserted.id,
    action: 'CREATE_WARNING',
    newStatus: inserted.warningLevel,
    metadata: {
      employeeId: emp.id,
      employeeName: emp.name,
      warningLevel: inserted.warningLevel,
      warningDate: inserted.warningDate,
      title: inserted.title,
      signedByEmployee: inserted.signedByEmployee,
      hasAttachment: Boolean(uploadedPath),
    },
  });

  return {
    id: inserted.id,
    employeeId: inserted.employeeId,
    warningLevel: inserted.warningLevel,
    warningDate: inserted.warningDate,
    title: inserted.title,
    reason: inserted.reason,
    administrativeAction: inserted.administrativeAction,
    signedByEmployee: inserted.signedByEmployee,
    attachmentPath: inserted.attachmentPath,
    status: inserted.status,
    notes: inserted.notes,
    createdAt: inserted.createdAt,
    createdBy: inserted.createdBy,
    employee: {
      id: emp.id,
      employeeNo: emp.employeeNo,
      name: emp.name,
      department: emp.department,
      jobTitle: emp.jobTitle,
    },
  };
}

export async function updateWarning(
  actor: UserSession,
  id: string,
  data: {
    warningLevel?: WarningLevel;
    warningDate?: string;
    title?: string;
    reason?: string;
    administrativeAction?: string | null;
    signedByEmployee?: boolean;
    status?: 'ACTIVE' | 'REVOKED';
    notes?: string | null;
    fileBuffer?: Buffer;
    mimeType?: string;
    originalFilename?: string;
  }
): Promise<WarningDTO> {
  requireRole(actor, ['ADMIN', 'HR']);

  const db = getDb();
  const [existing] = await db.select().from(schema.warnings).where(eq(schema.warnings.id, id));
  if (!existing) {
    throw new Error('الإنذار المطلوب غير موجود');
  }

  let uploadedPath = existing.attachmentPath;

  if (data.fileBuffer && data.mimeType) {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedMimes.includes(data.mimeType)) {
      throw new Error('نوع الملف غير مدعوم لكتاب الإنذار. يرجى إرفاق صورة (JPG, PNG, WEBP) أو ملف PDF');
    }

    const ext = path.extname(data.originalFilename || '') || (data.mimeType === 'application/pdf' ? '.pdf' : '.jpg');
    const fileKey = `warnings/${existing.employeeId}_${crypto.randomBytes(6).toString('hex')}${ext}`;

    const uploadRes = await uploadPrivateFile(PRIVATE_BUCKETS.DOCUMENTS, fileKey, data.fileBuffer, data.mimeType);
    if (!uploadRes.success) {
      throw new Error(uploadRes.error || 'فشل في حفظ ملف/صورة كتاب الإنذار');
    }
    uploadedPath = uploadRes.path;
  }

  const [updated] = await db
    .update(schema.warnings)
    .set({
      warningLevel: data.warningLevel ?? existing.warningLevel,
      warningDate: data.warningDate ?? existing.warningDate,
      title: data.title ? data.title.trim() : existing.title,
      reason: data.reason ? data.reason.trim() : existing.reason,
      administrativeAction:
        data.administrativeAction !== undefined ? data.administrativeAction?.trim() || null : existing.administrativeAction,
      signedByEmployee: data.signedByEmployee !== undefined ? data.signedByEmployee : existing.signedByEmployee,
      status: data.status ?? existing.status,
      notes: data.notes !== undefined ? data.notes?.trim() || null : existing.notes,
      attachmentPath: uploadedPath,
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.warnings.id, id))
    .returning();

  const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, updated.employeeId));

  await logAuditEvent({
    actor,
    tableName: 'warnings',
    recordId: id,
    action: 'UPDATE_WARNING',
    oldStatus: existing.warningLevel,
    newStatus: updated.warningLevel,
    metadata: {
      changes: data,
    },
  });

  return {
    id: updated.id,
    employeeId: updated.employeeId,
    warningLevel: updated.warningLevel,
    warningDate: updated.warningDate,
    title: updated.title,
    reason: updated.reason,
    administrativeAction: updated.administrativeAction,
    signedByEmployee: updated.signedByEmployee,
    attachmentPath: updated.attachmentPath,
    status: updated.status,
    notes: updated.notes,
    createdAt: updated.createdAt,
    createdBy: updated.createdBy,
    employee: {
      id: emp.id,
      employeeNo: emp.employeeNo,
      name: emp.name,
      department: emp.department,
      jobTitle: emp.jobTitle,
    },
  };
}

export async function revokeWarning(actor: UserSession, id: string, reason?: string): Promise<void> {
  requireRole(actor, ['ADMIN', 'HR']);
  const db = getDb();

  const [existing] = await db.select().from(schema.warnings).where(eq(schema.warnings.id, id));
  if (!existing) {
    throw new Error('الإنذار المطلوب غير موجود');
  }

  await db
    .update(schema.warnings)
    .set({
      status: 'REVOKED',
      notes: reason ? `${existing.notes ? existing.notes + ' | ' : ''}تم إلغاء الإنذار: ${reason}` : existing.notes,
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.warnings.id, id));

  await logAuditEvent({
    actor,
    tableName: 'warnings',
    recordId: id,
    action: 'REVOKE_WARNING',
    oldStatus: existing.status,
    newStatus: 'REVOKED',
    metadata: { reason },
  });
}

export async function deleteWarning(actor: UserSession, id: string): Promise<void> {
  requireRole(actor, ['ADMIN']);
  const db = getDb();

  const [existing] = await db.select().from(schema.warnings).where(eq(schema.warnings.id, id));
  if (!existing) {
    throw new Error('الإنذار المطلوب غير موجود');
  }

  await db.delete(schema.warnings).where(eq(schema.warnings.id, id));

  await logAuditEvent({
    actor,
    tableName: 'warnings',
    recordId: id,
    action: 'DELETE_WARNING',
    oldStatus: existing.warningLevel,
    metadata: {
      employeeId: existing.employeeId,
      title: existing.title,
    },
  });
}

export async function getWarningAttachmentSignedUrl(
  actor: UserSession,
  attachmentPath: string
): Promise<string | null> {
  if (!RBAC.canViewWarnings(actor.role)) {
    throw new AuthorizationError('غير مصرح لك بالاطلاع على مرفقات الإنذارات');
  }

  if (!attachmentPath) return null;

  const result = await getSignedDownloadUrl(PRIVATE_BUCKETS.DOCUMENTS, attachmentPath, 3600);
  return result.signedUrl || null;
}
