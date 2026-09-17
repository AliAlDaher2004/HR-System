import { getDb, schema } from '../../db';
import { eq, and, sql, desc, lte, gte } from 'drizzle-orm';
import { UserSession, RBAC, AuthorizationError, requireRole, assertCanViewDocuments } from '../auth/rbac';
import { logAuditEvent } from '../auth/audit';
import { PRIVATE_BUCKETS, getSignedDownloadUrl } from '../supabase/storage';

export type DocumentType = 'IDENTITY' | 'RESIDENCY' | 'WORK_PERMIT' | 'CERTIFICATE' | 'OTHER';

export async function getEmployeeDocuments(actor: UserSession, employeeId?: string) {
  assertCanViewDocuments(actor);
  const db = getDb();

  let query = db.select({
    id: schema.documents.id,
    employeeId: schema.documents.employeeId,
    employeeName: schema.employees.name,
    employeeNo: schema.employees.employeeNo,
    department: schema.employees.department,
    type: schema.documents.type,
    expiryDate: schema.documents.expiryDate,
    filePath: schema.documents.filePath,
    notes: schema.documents.notes,
    createdAt: schema.documents.createdAt,
  })
  .from(schema.documents)
  .innerJoin(schema.employees, eq(schema.documents.employeeId, schema.employees.id));

  const rows = employeeId
    ? await query.where(eq(schema.documents.employeeId, employeeId)).orderBy(desc(schema.documents.createdAt))
    : await query.orderBy(desc(schema.documents.createdAt));

  // Attach signed URL for each document (never public URLs!)
  const enriched = await Promise.all(
    rows.map(async (doc: any) => {
      const { signedUrl } = await getSignedDownloadUrl(PRIVATE_BUCKETS.DOCUMENTS, doc.filePath, 300);
      return {
        ...doc,
        signedUrl,
      };
    })
  );

  return enriched;
}

export async function getDocumentExpirySummary(actor: UserSession) {
  assertCanViewDocuments(actor);
  const db = getDb();

  const today = new Date().toISOString().slice(0, 10);
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Expired documents: expiry_date < today
  const expiredDocs = await db.select({
    id: schema.documents.id,
    employeeName: schema.employees.name,
    employeeNo: schema.employees.employeeNo,
    type: schema.documents.type,
    expiryDate: schema.documents.expiryDate,
  })
  .from(schema.documents)
  .innerJoin(schema.employees, eq(schema.documents.employeeId, schema.employees.id))
  .where(and(sql`expiry_date IS NOT NULL`, sql`expiry_date < ${today}`));

  // Expiring in next 30 days: expiry_date >= today and expiry_date <= in30Days
  const expiringSoonDocs = await db.select({
    id: schema.documents.id,
    employeeName: schema.employees.name,
    employeeNo: schema.employees.employeeNo,
    type: schema.documents.type,
    expiryDate: schema.documents.expiryDate,
  })
  .from(schema.documents)
  .innerJoin(schema.employees, eq(schema.documents.employeeId, schema.employees.id))
  .where(and(sql`expiry_date IS NOT NULL`, gte(schema.documents.expiryDate, today), lte(schema.documents.expiryDate, in30Days)));

  return {
    expiredCount: expiredDocs.length,
    expiringSoonCount: expiringSoonDocs.length,
    expiredList: expiredDocs,
    expiringSoonList: expiringSoonDocs,
  };
}

export async function createDocument(
  actor: UserSession,
  data: {
    employeeId: string;
    type: DocumentType;
    expiryDate?: string | null;
    filePath: string;
    notes?: string;
  }
) {
  requireRole(actor, ['ADMIN', 'HR']);
  const db = getDb();

  const [inserted] = await db.insert(schema.documents).values({
    employeeId: data.employeeId,
    type: data.type,
    expiryDate: data.expiryDate || null,
    filePath: data.filePath,
    notes: data.notes || null,
    createdBy: actor.id,
  }).returning();

  await logAuditEvent({
    actor,
    tableName: 'documents',
    recordId: inserted.id,
    action: 'UPLOAD_DOCUMENT',
    metadata: { employeeId: data.employeeId, type: data.type, expiryDate: data.expiryDate },
  });

  return inserted;
}
