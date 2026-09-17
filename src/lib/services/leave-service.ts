import { getDb, schema } from '../../db';
import { eq, and, sql, desc, or, not, lte, gte } from 'drizzle-orm';
import { UserSession, RBAC, AuthorizationError, requireRole } from '../auth/rbac';
import { logAuditEvent } from '../auth/audit';

export async function getLeaveBalances(employeeId: string, year?: number) {
  const db = getDb();
  const currentYear = year || new Date().getFullYear();

  const balances = await db.select().from(schema.leaveBalances).where(
    and(
      eq(schema.leaveBalances.employeeId, employeeId),
      eq(schema.leaveBalances.year, currentYear)
    )
  );

  // Compute used and remaining days
  const enrichedBalances = await Promise.all(
    balances.map(async (b: any) => {
      const approvedRequests = await db.select().from(schema.leaveRequests).where(
        and(
          eq(schema.leaveRequests.balanceId, b.id),
          eq(schema.leaveRequests.status, 'APPROVED')
        )
      );

      const usedDays = approvedRequests.reduce((sum: number, r: any) => sum + parseFloat(r.chargeDays), 0);
      const totalEntitled = parseFloat(b.openingDays) + parseFloat(b.grantedDays) + parseFloat(b.adjustmentDays);
      const remainingDays = Math.max(0, totalEntitled - usedDays);

      return {
        ...b,
        usedDays: usedDays.toFixed(2),
        remainingDays: remainingDays.toFixed(2),
        totalEntitled: totalEntitled.toFixed(2),
      };
    })
  );

  return enrichedBalances;
}

export async function getLeaveRequests(
  actor: UserSession,
  filters?: {
    employeeId?: string;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  }
) {
  // Supervisor cannot access private leave requests of employees
  if (actor.role === 'SUPERVISOR') {
    throw new AuthorizationError('غير مصرح للمشرف بالاطلاع على تفاصيل إجازات الموظفين الخاصة.');
  }

  const db = getDb();
  let query = db.select({
    id: schema.leaveRequests.id,
    employeeId: schema.leaveRequests.employeeId,
    employeeName: schema.employees.name,
    employeeNo: schema.employees.employeeNo,
    balanceId: schema.leaveRequests.balanceId,
    startDate: schema.leaveRequests.startDate,
    endDate: schema.leaveRequests.endDate,
    chargeDays: schema.leaveRequests.chargeDays,
    paid: schema.leaveRequests.paid,
    status: schema.leaveRequests.status,
    reason: schema.leaveRequests.reason,
    attachment: schema.leaveRequests.attachment,
    approvedBy: schema.leaveRequests.approvedBy,
    approvedAt: schema.leaveRequests.approvedAt,
    createdAt: schema.leaveRequests.createdAt,
  })
  .from(schema.leaveRequests)
  .innerJoin(schema.employees, eq(schema.leaveRequests.employeeId, schema.employees.id));

  const conditions = [];
  if (filters?.employeeId) conditions.push(eq(schema.leaveRequests.employeeId, filters.employeeId));
  if (filters?.status) conditions.push(eq(schema.leaveRequests.status, filters.status));

  return conditions.length > 0
    ? await query.where(and(...conditions)).orderBy(desc(schema.leaveRequests.createdAt))
    : await query.orderBy(desc(schema.leaveRequests.createdAt));
}

export async function createLeaveRequest(
  actor: UserSession,
  data: {
    employeeId: string;
    balanceId?: string | null;
    startDate: string;
    endDate: string;
    chargeDays: number;
    paid: boolean;
    reason?: string;
    attachment?: string;
  }
) {
  requireRole(actor, ['ADMIN', 'HR']);
  const db = getDb();

  if (new Date(data.endDate) < new Date(data.startDate)) {
    throw new Error('تاريخ نهاية الإجازة لا يمكن أن يكون قبل تاريخ البداية');
  }

  if (data.chargeDays <= 0) {
    throw new Error('عدد الأيام المحتسبة للإجازة يجب أن يكون أكبر من الصفر');
  }

  // Calculate calendar days
  const startMs = new Date(data.startDate).getTime();
  const endMs = new Date(data.endDate).getTime();
  const calendarDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;

  if (data.chargeDays > calendarDays) {
    throw new Error(`الأيام المحتسبة (${data.chargeDays}) لا يمكن أن تتجاوز الأيام الفعلية بين التاريخين (${calendarDays}).`);
  }

  // Check for overlapping pending or approved leave requests for the same employee
  const overlaps = await db.select().from(schema.leaveRequests).where(
    and(
      eq(schema.leaveRequests.employeeId, data.employeeId),
      sql`status IN ('PENDING', 'APPROVED')`,
      lte(schema.leaveRequests.startDate, data.endDate),
      gte(schema.leaveRequests.endDate, data.startDate)
    )
  );

  if (overlaps.length > 0) {
    throw new Error('يوجد تعارض مع طلب إجازة آخر (معلق أو معتمد) للموظف في نفس الفترة الزمنية.');
  }

  // If paid leave, verify balance availability
  if (data.paid) {
    if (!data.balanceId) {
      throw new Error('رصيد الإجازة مطلوب للإجازات المدفوعة');
    }

    const [balance] = await db.select().from(schema.leaveBalances).where(eq(schema.leaveBalances.id, data.balanceId));
    if (!balance) throw new Error('رصيد الإجازة المحدد غير موجود');

    // Verify leave dates remain within balance year
    const startYear = new Date(data.startDate).getFullYear();
    const endYear = new Date(data.endDate).getFullYear();
    if (startYear !== balance.year || endYear !== balance.year) {
      throw new Error(`تواريخ الإجازة يجب أن تقع داخل سنة رصيد الإجازة (${balance.year}).`);
    }

    const approvedRequests = await db.select().from(schema.leaveRequests).where(
      and(
        eq(schema.leaveRequests.balanceId, balance.id),
        eq(schema.leaveRequests.status, 'APPROVED')
      )
    );

    const usedDays = approvedRequests.reduce((sum: number, r: any) => sum + parseFloat(r.chargeDays), 0);
    const totalEntitled = parseFloat(balance.openingDays) + parseFloat(balance.grantedDays) + parseFloat(balance.adjustmentDays);
    const remainingDays = totalEntitled - usedDays;

    if (data.chargeDays > remainingDays) {
      throw new Error(`رصيد الإجازة المتبقي (${remainingDays} يوم) غير كافٍ لطلب ${data.chargeDays} يوم.`);
    }
  }

  const [inserted] = await db.insert(schema.leaveRequests).values({
    employeeId: data.employeeId,
    balanceId: data.balanceId || null,
    startDate: data.startDate,
    endDate: data.endDate,
    chargeDays: data.chargeDays.toFixed(2),
    paid: data.paid,
    status: 'PENDING',
    reason: data.reason || null,
    attachment: data.attachment || null,
  }).returning();

  await logAuditEvent({
    actor,
    tableName: 'leave_requests',
    recordId: inserted.id,
    action: 'CREATE_LEAVE_REQUEST',
    newStatus: 'PENDING',
    metadata: { employeeId: data.employeeId, startDate: data.startDate, chargeDays: data.chargeDays },
  });

  return inserted;
}

export async function approveLeaveRequest(actor: UserSession, leaveId: string) {
  requireRole(actor, ['ADMIN', 'HR']);
  const db = getDb();

  const [req] = await db.select().from(schema.leaveRequests).where(eq(schema.leaveRequests.id, leaveId));
  if (!req) throw new Error('طلب الإجازة غير موجود');
  if (req.status !== 'PENDING') {
    throw new Error(`لا يمكن اعتماد طلب إجازة بحالة (${req.status}). الاعتماد متاح فقط للطلبات المعلقة.`);
  }

  // Verify balance again if paid
  if (req.paid && req.balanceId) {
    const [balance] = await db.select().from(schema.leaveBalances).where(eq(schema.leaveBalances.id, req.balanceId));
    if (balance) {
      const approvedRequests = await db.select().from(schema.leaveRequests).where(
        and(
          eq(schema.leaveRequests.balanceId, balance.id),
          eq(schema.leaveRequests.status, 'APPROVED')
        )
      );
      const usedDays = approvedRequests.reduce((sum: number, r: any) => sum + parseFloat(r.chargeDays), 0);
      const totalEntitled = parseFloat(balance.openingDays) + parseFloat(balance.grantedDays) + parseFloat(balance.adjustmentDays);
      const remaining = totalEntitled - usedDays;

      if (parseFloat(req.chargeDays) > remaining) {
        throw new Error(`الرصيد المتبقي (${remaining} يوم) غير كافٍ لاعتماد الإجازة.`);
      }
    }
  }

  const [updated] = await db.update(schema.leaveRequests)
    .set({
      status: 'APPROVED',
      approvedBy: actor.id,
      approvedAt: new Date(),
      updatedBy: actor.id,
    })
    .where(eq(schema.leaveRequests.id, leaveId))
    .returning();

  await logAuditEvent({
    actor,
    tableName: 'leave_requests',
    recordId: leaveId,
    action: 'APPROVE_LEAVE',
    oldStatus: 'PENDING',
    newStatus: 'APPROVED',
    metadata: { employeeId: req.employeeId, chargeDays: req.chargeDays },
  });

  return updated;
}

export async function rejectLeaveRequest(actor: UserSession, leaveId: string, reason?: string) {
  requireRole(actor, ['ADMIN', 'HR']);
  const db = getDb();

  const [req] = await db.select().from(schema.leaveRequests).where(eq(schema.leaveRequests.id, leaveId));
  if (!req) throw new Error('طلب الإجازة غير موجود');
  if (req.status !== 'PENDING') {
    throw new Error(`لا يمكن رفض طلب إجازة بحالة (${req.status}).`);
  }

  const [updated] = await db.update(schema.leaveRequests)
    .set({
      status: 'REJECTED',
      updatedBy: actor.id,
    })
    .where(eq(schema.leaveRequests.id, leaveId))
    .returning();

  await logAuditEvent({
    actor,
    tableName: 'leave_requests',
    recordId: leaveId,
    action: 'REJECT_LEAVE',
    oldStatus: 'PENDING',
    newStatus: 'REJECTED',
    metadata: { reason },
  });

  return updated;
}
