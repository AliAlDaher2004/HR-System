import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import {
  getDailyAttendanceSheet,
  markPresent,
  markAbsent,
  recordEarlyDeparture,
  updateOvertimeHours,
  getLockedEmployeeIds,
  bulkMarkPresentForDate,
  approveAllDailyAttendance,
} from '@/lib/services/attendance-service';
import { revalidatePath } from 'next/cache';
import { DailyAttendanceSheetClient } from '@/components/attendance/DailyAttendanceSheetClient';

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const resolvedParams = await searchParams;
  const todayStr = new Date().toISOString().split('T')[0];
  const selectedDate = resolvedParams.date || todayStr;

  // Fetch daily attendance sheet and lock statuses in parallel
  const [rawDailyRows, lockedEmpIds] = await Promise.all([
    getDailyAttendanceSheet(user, selectedDate),
    getLockedEmployeeIds(selectedDate),
  ]);

  const departments = Array.from(new Set(rawDailyRows.map((r: any) => r.employee.department))).filter(Boolean) as string[];

  const dailyRowsWithLocks = rawDailyRows.map((row: any) => ({
    ...row,
    isLocked: lockedEmpIds.has(row.employee.id),
    attendance: row.attendance
      ? {
          ...row.attendance,
          clockIn: row.attendance.clockIn ? row.attendance.clockIn.toISOString() : null,
          clockOut: row.attendance.clockOut ? row.attendance.clockOut.toISOString() : null,
        }
      : null,
  }));

  // Server Actions for Fast Daily Attendance
  async function handleMarkPresent(employeeId: string, date: string, arrivalTime?: string) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');
    await markPresent(currentUser, employeeId, date, arrivalTime);
    revalidatePath('/attendance');
  }

  async function handleMarkAbsent(
    employeeId: string,
    date: string,
    absenceType: 'EXCUSED_ABSENCE' | 'UNEXCUSED_ABSENCE' | 'ABSENT' = 'UNEXCUSED_ABSENCE',
    reason?: string
  ) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');
    await markAbsent(currentUser, employeeId, date, absenceType, reason);
    revalidatePath('/attendance');
  }

  async function handleRecordEarlyDeparture(attendanceId: string, clockOutTime: string, reason: string) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');
    await recordEarlyDeparture(currentUser, attendanceId, clockOutTime, reason);
    revalidatePath('/attendance');
  }

  async function handleUpdateOvertime(employeeId: string, date: string, otHours: number) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');
    await updateOvertimeHours(currentUser, employeeId, date, otHours);
    revalidatePath('/attendance');
  }

  async function handleBulkMarkPresent(date: string, onlyUnmarked: boolean = true) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');
    const result = await bulkMarkPresentForDate(currentUser, date, onlyUnmarked);
    revalidatePath('/attendance');
    return result;
  }

  async function handleApproveAllDaily(date: string) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');
    const result = await approveAllDailyAttendance(currentUser, date);
    revalidatePath('/attendance');
    return result;
  }

  return (
    <div className="space-y-2">
      <DailyAttendanceSheetClient
        initialDate={selectedDate}
        rows={dailyRowsWithLocks as any}
        departments={departments}
        markPresentAction={handleMarkPresent}
        markAbsentAction={handleMarkAbsent}
        recordEarlyDepartureAction={handleRecordEarlyDeparture}
        updateOvertimeAction={handleUpdateOvertime}
        bulkMarkPresentAction={handleBulkMarkPresent}
        approveAllDailyAction={handleApproveAllDaily}
        canApprove={['ADMIN', 'HR'].includes(user.role)}
      />
    </div>
  );
}
