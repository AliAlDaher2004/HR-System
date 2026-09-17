import { getDb, schema } from '../../db';
import { getSystemSettings } from './settings-service';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { UserSession, RBAC, AuthorizationError, requireRole, assertCanApproveAttendance } from '../auth/rbac';
import { logAuditEvent } from '../auth/audit';

export type AttendanceType = 'PRESENT' | 'ABSENT' | 'EXCUSED_ABSENCE' | 'UNEXCUSED_ABSENCE' | 'PAID_LEAVE' | 'UNPAID_LEAVE' | 'HOLIDAY';
export type AttendanceStatus = 'DRAFT' | 'APPROVED';

export interface ShiftCalculation {
  workHours: number | null;
  workedMinutes: number | null;
  lateMinutes: number | null;
}

import { formatDurationArabic, parseTimeToMinutes } from '../utils/time';
export { formatDurationArabic, parseTimeToMinutes };

export function calculateShift(
  clockIn: Date | null,
  clockOut: Date | null,
  breakMinutes: number = 0,
  scheduledInTimeStr?: string | null,
  workDateStr?: string
): ShiftCalculation {
  if (!clockIn || !clockOut) {
    return { workHours: null, workedMinutes: null, lateMinutes: null };
  }

  let diffMs = clockOut.getTime() - clockIn.getTime();
  if (diffMs < 0) {
    diffMs += 24 * 60 * 60 * 1000;
  }

  const durationMinutes = Math.floor(diffMs / (1000 * 60));
  if (durationMinutes > 24 * 60) {
    throw new Error('مدة الوردية لا يمكن أن تتجاوز 24 ساعة.');
  }

  if (breakMinutes > durationMinutes) {
    throw new Error('مدة الاستراحة لا يمكن أن تتجاوز إجمالي وقت الوردية.');
  }

  const workedMinutes = Math.max(0, durationMinutes - breakMinutes);
  const workHours = Math.round((workedMinutes / 60) * 100) / 100;

  let lateMinutes: number | null = null;
  if (scheduledInTimeStr) {
    const schedMins = parseTimeToMinutes(scheduledInTimeStr);
    const clockInMins = clockIn.getUTCHours() * 60 + clockIn.getUTCMinutes();
    lateMinutes = Math.max(0, clockInMins - schedMins);
  }

  return {
    workHours,
    workedMinutes,
    lateMinutes,
  };
}

export async function isAttendanceLocked(employeeId: string, workDate: string): Promise<boolean> {
  const db = getDb();
  const [closedPayroll] = await db.select().from(schema.payroll).where(
    and(
      eq(schema.payroll.employeeId, employeeId),
      lte(schema.payroll.periodStart, workDate),
      gte(schema.payroll.periodEnd, workDate),
      sql`status IN ('APPROVED', 'PAID')`
    )
  );
  return Boolean(closedPayroll);
}

export async function getLockedEmployeeIds(workDate: string): Promise<Set<string>> {
  const db = getDb();
  const closedPayrolls = await db.select({ employeeId: schema.payroll.employeeId }).from(schema.payroll).where(
    and(
      lte(schema.payroll.periodStart, workDate),
      gte(schema.payroll.periodEnd, workDate),
      sql`status IN ('APPROVED', 'PAID')`
    )
  );
  return new Set(closedPayrolls.map((p: { employeeId: string }) => p.employeeId));
}

export async function getAttendanceRecords(
  actor: UserSession,
  filters: {
    employeeId?: string;
    startDate?: string;
    endDate?: string;
    status?: AttendanceStatus;
    attendanceType?: AttendanceType;
  }
) {
  const db = getDb();
  let query = db.select({
    id: schema.attendance.id,
    employeeId: schema.attendance.employeeId,
    employeeName: schema.employees.name,
    employeeNo: schema.employees.employeeNo,
    department: schema.employees.department,
    workDate: schema.attendance.workDate,
    scheduledIn: schema.attendance.scheduledIn,
    clockIn: schema.attendance.clockIn,
    clockOut: schema.attendance.clockOut,
    breakMinutes: schema.attendance.breakMinutes,
    workedMinutes: schema.attendance.workedMinutes,
    lateMinutes: schema.attendance.lateMinutes,
    earlyDeparture: schema.attendance.earlyDeparture,
    earlyDepartureMinutes: schema.attendance.earlyDepartureMinutes,
    departureReason: schema.attendance.departureReason,
    departureRecordedBy: schema.attendance.departureRecordedBy,
    departureRecordedAt: schema.attendance.departureRecordedAt,
    attendanceType: schema.attendance.attendanceType,
    unpaidDays: schema.attendance.unpaidDays,
    approvedOtHours: schema.attendance.approvedOtHours,
    status: schema.attendance.status,
    leaveId: schema.attendance.leaveId,
    notes: schema.attendance.notes,
    createdAt: schema.attendance.createdAt,
    updatedAt: schema.attendance.updatedAt,
  })
  .from(schema.attendance)
  .innerJoin(schema.employees, eq(schema.attendance.employeeId, schema.employees.id));

  const conditions = [];
  if (filters.employeeId) conditions.push(eq(schema.attendance.employeeId, filters.employeeId));
  if (filters.status) conditions.push(eq(schema.attendance.status, filters.status));
  if (filters.attendanceType) conditions.push(eq(schema.attendance.attendanceType, filters.attendanceType));
  if (filters.startDate) conditions.push(gte(schema.attendance.workDate, filters.startDate));
  if (filters.endDate) conditions.push(lte(schema.attendance.workDate, filters.endDate));

  return conditions.length > 0
    ? await query.where(and(...conditions)).orderBy(desc(schema.attendance.workDate))
    : await query.orderBy(desc(schema.attendance.workDate));
}

export async function getDailyAttendanceSheet(actor: UserSession, workDate: string, department?: string) {
  const db = getDb();

  const employeesQuery = db.select().from(schema.employees)
    .where(
      and(
        eq(schema.employees.status, 'ACTIVE'),
        lte(schema.employees.startDate, workDate),
        department ? eq(schema.employees.department, department) : sql`1=1`,
        sql`(${schema.employees.endDate} IS NULL OR ${schema.employees.endDate} >= ${workDate})`
      )
    )
    .orderBy(schema.employees.department, schema.employees.employeeNo);

  const [settings, allEmployees, attendanceToday] = await Promise.all([
    getSystemSettings(),
    employeesQuery,
    db.select().from(schema.attendance).where(eq(schema.attendance.workDate, workDate)),
  ]);

  const attendanceMap = new Map<string, any>(attendanceToday.map((a: any) => [a.employeeId, a]));

  const defaultStart = settings?.defaultWorkStartTime || '08:00:00';
  const defaultEnd = settings?.defaultWorkEndTime || '17:00:00';
  const defaultBreak = settings?.defaultBreakMinutes ?? 60;

  return allEmployees.map((emp: any) => {
    const att: any = attendanceMap.get(emp.id);
    const schedIn = emp.workStartTime || defaultStart;
    const schedOut = emp.workEndTime || defaultEnd;
    const breakMins = emp.breakMinutes ?? defaultBreak;

    return {
      employee: emp,
      attendance: att || null,
      scheduledIn: schedIn,
      scheduledOut: schedOut,
      breakMinutes: breakMins,
      isMarked: Boolean(att),
      status: att?.status || 'DRAFT',
      attendanceType: att?.attendanceType || null,
      lateMinutes: att?.lateMinutes ?? 0,
      workedMinutes: att?.workedMinutes ?? 0,
      earlyDeparture: att?.earlyDeparture ?? false,
      earlyDepartureMinutes: att?.earlyDepartureMinutes ?? 0,
    };
  });
}

export async function markPresent(
  actor: UserSession,
  employeeId: string,
  workDate: string,
  actualArrivalTime?: string
) {
  const db = getDb();
  const locked = await isAttendanceLocked(employeeId, workDate);
  if (locked) {
    throw new Error(`لا يمكن تسجيل أو تعديل الحضور لتاريخ (${workDate}) لأن كشف راتب هذه الفترة معتمد أو مدفوع مسبقاً.`);
  }

  const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, employeeId));
  if (!emp) throw new Error('الموظف غير موجود');

  const settings = await getSystemSettings();
  const schedStart = emp.workStartTime || settings?.defaultWorkStartTime || '08:00:00';
  const schedEnd = emp.workEndTime || settings?.defaultWorkEndTime || '17:00:00';
  const breakMins = emp.breakMinutes ?? (settings?.defaultBreakMinutes ?? 60);

  const schedStartMinutes = parseTimeToMinutes(schedStart);
  let arrivalTimeStr = actualArrivalTime || schedStart.slice(0, 5);
  const actualArrivalMinutes = parseTimeToMinutes(arrivalTimeStr);

  // Exact minute calculation (never rounded)
  const lateMinutes = Math.max(0, actualArrivalMinutes - schedStartMinutes);

  const schedEndMinutes = parseTimeToMinutes(schedEnd);
  // Initial clockIn and clockOut
  const clockInDate = new Date(`${workDate}T${arrivalTimeStr.padStart(5, '0')}:00Z`);
  const clockOutDate = new Date(`${workDate}T${schedEnd.slice(0, 5)}:00Z`);

  const durationMinutes = Math.max(0, schedEndMinutes - actualArrivalMinutes);
  const workedMinutes = Math.max(0, durationMinutes - breakMins);

  const [existing] = await db.select().from(schema.attendance).where(
    and(
      eq(schema.attendance.employeeId, employeeId),
      eq(schema.attendance.workDate, workDate)
    )
  );

  let result;
  if (existing) {
    const [updated] = await db.update(schema.attendance)
      .set({
        scheduledIn: schedStart,
        clockIn: clockInDate,
        clockOut: existing.clockOut || clockOutDate,
        breakMinutes: breakMins,
        workedMinutes: existing.workedMinutes > 0 ? existing.workedMinutes : workedMinutes,
        lateMinutes,
        attendanceType: 'PRESENT',
        unpaidDays: '0.00',
        notes: lateMinutes > 0 ? `تأخير ${lateMinutes} دقيقة عن موعد الحضور (${schedStart.slice(0, 5)})` : null,
        updatedBy: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.attendance.id, existing.id))
      .returning();
    result = updated;
  } else {
    const [inserted] = await db.insert(schema.attendance)
      .values({
        employeeId,
        workDate,
        scheduledIn: schedStart,
        clockIn: clockInDate,
        clockOut: clockOutDate,
        breakMinutes: breakMins,
        workedMinutes,
        lateMinutes,
        earlyDeparture: false,
        earlyDepartureMinutes: 0,
        attendanceType: 'PRESENT',
        unpaidDays: '0.00',
        approvedOtHours: '0.00',
        status: 'DRAFT',
        notes: lateMinutes > 0 ? `تأخير ${lateMinutes} دقيقة عن موعد الحضور (${schedStart.slice(0, 5)})` : null,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();
    result = inserted;
  }

  await logAuditEvent({
    actor,
    tableName: 'attendance',
    recordId: result.id,
    action: lateMinutes > 0 ? 'ATTENDANCE_LATE' : 'ATTENDANCE_PRESENT',
    metadata: {
      employeeId,
      workDate,
      arrivalTime: arrivalTimeStr,
      lateMinutes,
    },
  });

  return result;
}

export async function markLate(
  actor: UserSession,
  employeeId: string,
  workDate: string,
  actualArrivalTime: string
) {
  if (!actualArrivalTime) {
    throw new Error('وقت الحضور الفعلي مطلوب لتسجيل التأخير');
  }
  return markPresent(actor, employeeId, workDate, actualArrivalTime);
}

export async function markAbsent(
  actor: UserSession,
  employeeId: string,
  workDate: string,
  absenceType: 'EXCUSED_ABSENCE' | 'UNEXCUSED_ABSENCE' | 'ABSENT' = 'UNEXCUSED_ABSENCE',
  reason?: string
) {
  const db = getDb();
  const locked = await isAttendanceLocked(employeeId, workDate);
  if (locked) {
    throw new Error(`لا يمكن تسجيل أو تعديل الغياب لتاريخ (${workDate}) لأن كشف راتب هذه الفترة معتمد أو مدفوع مسبقاً.`);
  }

  const isExcused = absenceType === 'EXCUSED_ABSENCE';
  const finalType: AttendanceType = isExcused ? 'EXCUSED_ABSENCE' : 'UNEXCUSED_ABSENCE';

  // Unexcused absence penalty: 2 days deduction (خصم يومين عن كل يوم غياب بدون عذر)
  // Excused absence: 1 day deduction
  const unpaidDaysVal = isExcused ? '1.00' : '2.00';
  const notesText = isExcused
    ? (reason ? `غياب بعذر: ${reason}` : 'غياب بعذر')
    : (reason ? `غياب بدون عذر: ${reason} (خصم يومين)` : 'غياب بدون عذر (خصم يومين عقوبة)');

  const [existing] = await db.select().from(schema.attendance).where(
    and(
      eq(schema.attendance.employeeId, employeeId),
      eq(schema.attendance.workDate, workDate)
    )
  );

  let result;
  if (existing) {
    const [updated] = await db.update(schema.attendance)
      .set({
        clockIn: null,
        clockOut: null,
        breakMinutes: 0,
        workedMinutes: 0,
        lateMinutes: 0,
        earlyDeparture: false,
        earlyDepartureMinutes: 0,
        departureReason: null,
        attendanceType: finalType,
        unpaidDays: unpaidDaysVal,
        notes: notesText,
        updatedBy: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.attendance.id, existing.id))
      .returning();
    result = updated;
  } else {
    const [inserted] = await db.insert(schema.attendance)
      .values({
        employeeId,
        workDate,
        clockIn: null,
        clockOut: null,
        breakMinutes: 0,
        workedMinutes: 0,
        lateMinutes: 0,
        earlyDeparture: false,
        earlyDepartureMinutes: 0,
        attendanceType: finalType,
        unpaidDays: unpaidDaysVal,
        approvedOtHours: '0.00',
        status: 'DRAFT',
        notes: notesText,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();
    result = inserted;
  }

  await logAuditEvent({
    actor,
    tableName: 'attendance',
    recordId: result.id,
    action: isExcused ? 'ATTENDANCE_ABSENT_EXCUSED' : 'ATTENDANCE_ABSENT_UNEXCUSED',
    metadata: { employeeId, workDate, absenceType: finalType, reason, unpaidDays: unpaidDaysVal },
  });

  return result;
}

export async function recordEarlyDeparture(
  actor: UserSession,
  attendanceId: string,
  clockOutTimeStr: string,
  departureReason?: string
) {
  const db = getDb();
  const [record] = await db.select().from(schema.attendance).where(eq(schema.attendance.id, attendanceId));
  if (!record) throw new Error('سجل الحضور غير موجود');

  const locked = await isAttendanceLocked(record.employeeId, record.workDate);
  if (locked) {
    throw new Error(`لا يمكن تسجيل المغادرة المبكرة لأن كشف راتب هذه الفترة معتمد أو مدفوع مسبقاً.`);
  }

  if (record.attendanceType !== 'PRESENT') {
    throw new Error('تسجيل المغادرة المبكرة متاح فقط للموظفين الحاضرين في هذا اليوم.');
  }

  const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, record.employeeId));
  const settings = await getSystemSettings();
  const schedEnd = emp?.workEndTime || settings?.defaultWorkEndTime || '17:00:00';
  const breakMins = record.breakMinutes ?? (emp?.breakMinutes ?? (settings?.defaultBreakMinutes ?? 60));

  const schedEndMinutes = parseTimeToMinutes(schedEnd);
  const actualOutMinutes = parseTimeToMinutes(clockOutTimeStr);

  // Exact early departure minutes: max(0, ScheduledEndTime - ClockOutTime)
  const earlyDepartureMinutes = Math.max(0, schedEndMinutes - actualOutMinutes);

  const clockOutDate = new Date(`${record.workDate}T${clockOutTimeStr.padStart(5, '0')}:00Z`);

  // Recalculate worked minutes
  let workedMinutes = record.workedMinutes;
  if (record.clockIn) {
    const clockInMinutes = record.clockIn.getUTCHours() * 60 + record.clockIn.getUTCMinutes();
    const duration = Math.max(0, actualOutMinutes - clockInMinutes);
    workedMinutes = Math.max(0, duration - breakMins);
  }

  const [updated] = await db.update(schema.attendance)
    .set({
      clockOut: clockOutDate,
      workedMinutes,
      earlyDeparture: earlyDepartureMinutes > 0,
      earlyDepartureMinutes,
      departureReason: departureReason || null,
      departureRecordedBy: actor.id,
      departureRecordedAt: new Date(),
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.attendance.id, attendanceId))
    .returning();

  await logAuditEvent({
    actor,
    tableName: 'attendance',
    recordId: attendanceId,
    action: 'EARLY_DEPARTURE',
    metadata: {
      clockOutTime: clockOutTimeStr,
      earlyDepartureMinutes,
      departureReason,
    },
  });

  return updated;
}

export async function updateOvertimeHours(
  actor: UserSession,
  employeeId: string,
  workDate: string,
  otHours: number
) {
  const db = getDb();
  const locked = await isAttendanceLocked(employeeId, workDate);
  if (locked) {
    throw new Error(`لا يمكن تسجيل العمل الإضافي لأن كشف راتب هذه الفترة معتمد أو مدفوع مسبقاً.`);
  }

  if (otHours < 0 || otHours > 24) {
    throw new Error('عدد ساعات العمل الإضافي يجب أن يكون بين 0 و 24 ساعة.');
  }

  const [existing] = await db.select().from(schema.attendance).where(
    and(
      eq(schema.attendance.employeeId, employeeId),
      eq(schema.attendance.workDate, workDate)
    )
  );

  let result;
  if (existing) {
    const [updated] = await db.update(schema.attendance)
      .set({
        approvedOtHours: otHours.toFixed(2),
        updatedBy: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.attendance.id, existing.id))
      .returning();
    result = updated;
  } else {
    const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, employeeId));
    const settings = await getSystemSettings();
    const schedStart = emp?.workStartTime || settings?.defaultWorkStartTime || '08:00:00';
    const schedEnd = emp?.workEndTime || settings?.defaultWorkEndTime || '17:00:00';

    const [inserted] = await db.insert(schema.attendance)
      .values({
        employeeId,
        workDate,
        scheduledIn: schedStart,
        clockIn: new Date(`${workDate}T${schedStart.slice(0, 5)}:00Z`),
        clockOut: new Date(`${workDate}T${schedEnd.slice(0, 5)}:00Z`),
        breakMinutes: 60,
        workedMinutes: 480,
        lateMinutes: 0,
        attendanceType: 'PRESENT',
        unpaidDays: '0.00',
        approvedOtHours: otHours.toFixed(2),
        status: 'DRAFT',
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();
    result = inserted;
  }

  await logAuditEvent({
    actor,
    tableName: 'attendance',
    recordId: result.id,
    action: 'ATTENDANCE_OVERTIME_UPDATED',
    metadata: { employeeId, workDate, otHours },
  });

  return result;
}

export async function createOrUpdateAttendance(
  actor: UserSession,
  data: {
    id?: string;
    employeeId: string;
    workDate: string;
    scheduledIn?: string | null;
    clockIn?: Date | string | null;
    clockOut?: Date | string | null;
    breakMinutes?: number;
    workedMinutes?: number;
    lateMinutes?: number;
    earlyDeparture?: boolean;
    earlyDepartureMinutes?: number;
    departureReason?: string | null;
    attendanceType: AttendanceType;
    unpaidDays?: number;
    approvedOtHours?: number;
    leaveId?: string | null;
    notes?: string | null;
    status?: AttendanceStatus;
  }
) {
  const db = getDb();

  // 1. Employee verification
  const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, data.employeeId));
  if (!emp) throw new Error('الموظف غير موجود');

  // WorkDate validation against employee tenure
  if (new Date(data.workDate) < new Date(emp.startDate)) {
    throw new Error(`تاريخ الحضور (${data.workDate}) لا يمكن أن يكون قبل تاريخ بداية عمل الموظف (${emp.startDate}).`);
  }
  if (emp.endDate && new Date(data.workDate) > new Date(emp.endDate)) {
    throw new Error(`تاريخ الحضور (${data.workDate}) لا يمكن أن يكون بعد تاريخ انتهاء خدمة الموظف (${emp.endDate}).`);
  }

  // 2. Check if locked by approved or paid payroll
  const locked = await isAttendanceLocked(data.employeeId, data.workDate);
  if (locked) {
    throw new Error(`لا يمكن تعديل سجل الحضور لهذا التاريخ (${data.workDate}) لأن كشف راتب هذه الفترة معتمد أو مدفوع مسبقاً.`);
  }

  // 3. Shift calculations and break validation
  const clockInDate = data.clockIn ? new Date(data.clockIn) : null;
  const clockOutDate = data.clockOut ? new Date(data.clockOut) : null;
  const breakMins = data.breakMinutes ?? 0;

  if (breakMins < 0) {
    throw new Error('مدة الاستراحة لا يمكن أن تكون سالبة');
  }

  const shift = calculateShift(
    clockInDate,
    clockOutDate,
    breakMins,
    data.scheduledIn,
    data.workDate
  );

  const workedMinutes = data.workedMinutes ?? (shift.workedMinutes ?? 0);
  const lateMinutes = data.lateMinutes ?? (shift.lateMinutes ?? 0);

  // 4. Overtime validations
  const otHours = data.approvedOtHours ?? 0;
  if (otHours < 0) {
    throw new Error('ساعات العمل الإضافي لا يمكن أن تكون سالبة');
  }
  if (otHours > 0 && data.attendanceType !== 'PRESENT') {
    throw new Error('يمكن تسجيل ساعات إضافية فقط عندما تكون حالة الحضور (حاضر).');
  }
  if (shift.workHours !== null && otHours > shift.workHours) {
    throw new Error(`ساعات العمل الإضافي المعتمدة (${otHours}) لا يمكن أن تتجاوز ساعات العمل الفعلية (${shift.workHours}).`);
  }

  // 5. Unpaid days validation
  const defaultUnpaid = (data.attendanceType === 'UNEXCUSED_ABSENCE' || data.attendanceType === 'ABSENT')
    ? 2
    : (data.attendanceType === 'EXCUSED_ABSENCE' || data.attendanceType === 'UNPAID_LEAVE')
    ? 1
    : 0;
  const unpaid = data.unpaidDays !== undefined ? data.unpaidDays : defaultUnpaid;

  if (unpaid < 0 || unpaid > 10) {
    throw new Error('أيام الغياب غير المدفوعة يجب أن تكون بين 0 و 10 أيام.');
  }
  if (unpaid > 0 && !['ABSENT', 'EXCUSED_ABSENCE', 'UNEXCUSED_ABSENCE', 'UNPAID_LEAVE'].includes(data.attendanceType)) {
    throw new Error('لا يمكن تسجيل أيام غير مدفوعة إلا في حالات الغياب أو الإجازة بدون راتب.');
  }

  // 6. Leave link validation
  if (['PAID_LEAVE', 'UNPAID_LEAVE'].includes(data.attendanceType)) {
    if (!data.leaveId) {
      throw new Error('معرف الإجازة (LeaveID) مطلوب عند تسجيل حضور من نوع إجازة.');
    }
    const [leave] = await db.select().from(schema.leaveRequests).where(eq(schema.leaveRequests.id, data.leaveId));
    if (!leave) throw new Error('طلب الإجازة المرتبط غير موجود');
    if (leave.employeeId !== data.employeeId) throw new Error('طلب الإجازة لا يخص هذا الموظف');
    if (leave.status !== 'APPROVED') throw new Error('يجب أن يكون طلب الإجازة معتمداً');
    if (data.workDate < leave.startDate || data.workDate > leave.endDate) {
      throw new Error('تاريخ الحضور يقع خارج نطاق تواريخ طلب الإجازة المعتمد');
    }
  }

  // 7. Role & Approval verification
  let targetStatus: AttendanceStatus = data.status || 'DRAFT';
  if (targetStatus === 'APPROVED') {
    assertCanApproveAttendance(actor);
    if (data.attendanceType === 'PRESENT') {
      if (!clockInDate || !clockOutDate) {
        throw new Error('لتأكيد واعتماد حضور موظف (حاضر)، يجب تسجيل وقت الدخول والانصراف الفعلي.');
      }
    }
  } else {
    targetStatus = 'DRAFT';
  }

  // Check unique date constraint
  const existingRecords = await db.select().from(schema.attendance).where(
    and(
      eq(schema.attendance.employeeId, data.employeeId),
      eq(schema.attendance.workDate, data.workDate)
    )
  );

  if (existingRecords.length > 0 && (!data.id || existingRecords[0].id !== data.id)) {
    throw new Error('يوجد سجل حضور لهذا الموظف في هذا التاريخ مسبقاً.');
  }

  let result;
  if (data.id || existingRecords.length > 0) {
    const recordId = data.id || existingRecords[0].id;
    const [updated] = await db.update(schema.attendance)
      .set({
        scheduledIn: data.scheduledIn || null,
        clockIn: clockInDate,
        clockOut: clockOutDate,
        breakMinutes: breakMins,
        workedMinutes,
        lateMinutes,
        earlyDeparture: data.earlyDeparture ?? false,
        earlyDepartureMinutes: data.earlyDepartureMinutes ?? 0,
        departureReason: data.departureReason || null,
        attendanceType: data.attendanceType,
        unpaidDays: unpaid.toFixed(2),
        approvedOtHours: otHours.toFixed(2),
        status: targetStatus,
        leaveId: data.leaveId || null,
        notes: data.notes || null,
        updatedBy: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.attendance.id, recordId))
      .returning();
    result = updated;

    await logAuditEvent({
      actor,
      tableName: 'attendance',
      recordId,
      action: 'ATTENDANCE_CORRECTION',
      metadata: { changes: data },
    });
  } else {
    const [inserted] = await db.insert(schema.attendance)
      .values({
        employeeId: data.employeeId,
        workDate: data.workDate,
        scheduledIn: data.scheduledIn || null,
        clockIn: clockInDate,
        clockOut: clockOutDate,
        breakMinutes: breakMins,
        workedMinutes,
        lateMinutes,
        earlyDeparture: data.earlyDeparture ?? false,
        earlyDepartureMinutes: data.earlyDepartureMinutes ?? 0,
        departureReason: data.departureReason || null,
        attendanceType: data.attendanceType,
        unpaidDays: unpaid.toFixed(2),
        approvedOtHours: otHours.toFixed(2),
        status: targetStatus,
        leaveId: data.leaveId || null,
        notes: data.notes || null,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();
    result = inserted;
  }

  return result;
}

export async function approveAttendanceRecord(actor: UserSession, attendanceId: string) {
  assertCanApproveAttendance(actor);

  const db = getDb();
  const [record] = await db.select().from(schema.attendance).where(eq(schema.attendance.id, attendanceId));
  if (!record) {
    throw new Error('سجل الحضور غير موجود');
  }

  if (record.attendanceType === 'PRESENT' && (!record.clockIn || !record.clockOut)) {
    throw new Error('لا يمكن اعتماد سجل الحضور بدون وقت الدخول ووقت الخروج الفعليين.');
  }

  const [updated] = await db.update(schema.attendance)
    .set({
      status: 'APPROVED',
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.attendance.id, attendanceId))
    .returning();

  await logAuditEvent({
    actor,
    tableName: 'attendance',
    recordId: attendanceId,
    action: 'APPROVE_ATTENDANCE',
    oldStatus: 'DRAFT',
    newStatus: 'APPROVED',
    metadata: { employeeId: record.employeeId, workDate: record.workDate },
  });

  return updated;
}

