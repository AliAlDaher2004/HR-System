import { getDb, schema } from '../../db';
import { UserSession } from './rbac';

export interface AuditLogParams {
  actor: UserSession;
  tableName: string;
  recordId: string;
  action: string;
  oldStatus?: string | null;
  newStatus?: string | null;
  metadata?: Record<string, any>;
}

export async function logAuditEvent({
  actor,
  tableName,
  recordId,
  action,
  oldStatus = null,
  newStatus = null,
  metadata = {},
}: AuditLogParams) {
  const db = getDb();

  try {
    await db.insert(schema.auditLog).values({
      actorId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      tableName,
      recordId,
      action,
      oldStatus,
      newStatus,
      metadata,
    });
  } catch (err) {
    console.error('Failed to write to audit log:', err);
    // Audit log failures must be logged, but in critical financial pipelines should not be bypassed
    throw new Error('فشل تسجيل العملية في سجل التدقيق الأمني');
  }
}
