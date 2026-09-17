import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import {
  getAttendanceRecords,
  getDailyAttendanceSheet,
  markPresent,
  markAbsent,
  recordEarlyDeparture,
  updateOvertimeHours,
  approveAttendanceRecord,
  isAttendanceLocked,
  getLockedEmployeeIds,
  formatDurationArabic,
  AttendanceType,
} from '@/lib/services/attendance-service';
import { getEmployees } from '@/lib/services/employee-service';
import { Badge } from '@/components/ui';
import { revalidatePath } from 'next/cache';
import { DailyAttendanceSheetClient } from '@/components/attendance/DailyAttendanceSheetClient';
import Link from 'next/link';

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    tab?: 'daily' | 'history';
    employeeId?: string;
    startDate?: string;
    endDate?: string;
    status?: 'DRAFT' | 'APPROVED';
    attendanceType?: AttendanceType;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const resolvedParams = await searchParams;
  const activeTab = resolvedParams.tab || 'daily';
  const todayStr = new Date().toISOString().split('T')[0];
  const selectedDate = resolvedParams.date || todayStr;

  // Fetch daily attendance sheet and lock statuses in parallel
  const [rawDailyRows, employees, lockedEmpIds] = await Promise.all([
    getDailyAttendanceSheet(user, selectedDate),
    getEmployees(user),
    getLockedEmployeeIds(selectedDate),
  ]);

  const departments = Array.from(new Set(employees.map((e) => e.department))).filter(Boolean);

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

  // Fetch historical records if in history tab
  let historicalRecords: any[] = [];
  if (activeTab === 'history') {
    historicalRecords = await getAttendanceRecords(user, {
      employeeId: resolvedParams.employeeId,
      startDate: resolvedParams.startDate,
      endDate: resolvedParams.endDate,
      status: resolvedParams.status,
      attendanceType: resolvedParams.attendanceType,
    });
  }

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

  async function handleApproveRecord(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');
    const attendanceId = formData.get('attendanceId') as string;
    await approveAttendanceRecord(currentUser, attendanceId);
    revalidatePath('/attendance');
  }

  return (
    <div className="space-y-2">
      {/* Classic Windows 2000 Folder Tabs */}
      <div className="flex items-center gap-1 border-b-2 border-[#808080] pt-1 px-1">
        <Link
          href={`/attendance?tab=daily&date=${selectedDate}`}
          className={`px-3 py-1 text-xs font-bold border-t-2 border-l-2 border-r-2 rounded-t select-none transition-none ${
            activeTab === 'daily'
              ? 'bg-[#ECE9D8] border-[#FFFFFF] border-r-[#808080] text-[#0A246A] -mb-[2px] pb-1.5'
              : 'bg-[#D4D0C8] border-[#808080] text-slate-700 hover:bg-[#E0DDD5]'
          }`}
        >
          📋 جدول الحضور اليومي السريع (Daily Sheet)
        </Link>
        <Link
          href={`/attendance?tab=history&date=${selectedDate}`}
          className={`px-3 py-1 text-xs font-bold border-t-2 border-l-2 border-r-2 rounded-t select-none transition-none ${
            activeTab === 'history'
              ? 'bg-[#ECE9D8] border-[#FFFFFF] border-r-[#808080] text-[#0A246A] -mb-[2px] pb-1.5'
              : 'bg-[#D4D0C8] border-[#808080] text-slate-700 hover:bg-[#E0DDD5]'
          }`}
        >
          🔍 سجل الحضور التاريخي والبحث الموسع
        </Link>
      </div>

      {/* Main Tab Content Panel */}
      <div className="win-raised p-2 bg-[#ECE9D8]">
        {activeTab === 'daily' ? (
          <DailyAttendanceSheetClient
            initialDate={selectedDate}
            rows={dailyRowsWithLocks as any}
            departments={departments}
            markPresentAction={handleMarkPresent}
            markAbsentAction={handleMarkAbsent}
            recordEarlyDepartureAction={handleRecordEarlyDeparture}
            updateOvertimeAction={handleUpdateOvertime}
          />
        ) : (
          <div className="space-y-3">
            {/* Filter Bar */}
            <div className="win-raised p-2 bg-[#ECE9D8]">
              <form method="GET" className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                <input type="hidden" name="tab" value="history" />
                <div>
                  <label className="block text-[11px] font-bold text-black mb-0.5">الموظف</label>
                  <select
                    name="employeeId"
                    defaultValue={resolvedParams.employeeId || ''}
                    className="win-input w-full py-1 px-2"
                  >
                    <option value="">جميع الموظفين</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-black mb-0.5">من تاريخ</label>
                  <input
                    type="date"
                    name="startDate"
                    defaultValue={resolvedParams.startDate || ''}
                    className="win-input w-full py-1 px-2"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-black mb-0.5">إلى تاريخ</label>
                  <input
                    type="date"
                    name="endDate"
                    defaultValue={resolvedParams.endDate || ''}
                    className="win-input w-full py-1 px-2"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-black mb-0.5">الحالة</label>
                  <select
                    name="status"
                    defaultValue={resolvedParams.status || ''}
                    className="win-input w-full py-1 px-2"
                  >
                    <option value="">جميع الحالات</option>
                    <option value="DRAFT">مسودة (غير معتمد)</option>
                    <option value="APPROVED">معتمد</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="win-btn w-full py-1 font-bold text-xs flex items-center justify-center gap-1"
                  >
                    <span>🔍</span>
                    <span>تصفية السجلات</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Historical Table */}
            <div className="win-sunken bg-white overflow-x-auto">
              <table className="win-table w-full text-right text-xs">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>اسم الموظف</th>
                    <th>القسم</th>
                    <th>نوع الحضور</th>
                    <th>الدخول</th>
                    <th>الخروج</th>
                    <th>التأخير</th>
                    <th>المغادرة المبكرة</th>
                    <th>ساعات العمل</th>
                    <th>الحالة</th>
                    <th>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {historicalRecords.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-6 text-center text-[#808080]">
                        لا توجد سجلات حضور مطابقة لشروط البحث
                      </td>
                    </tr>
                  ) : (
                    historicalRecords.map((rec: any) => (
                      <tr key={rec.id} className="hover:bg-[#E8EEF7]">
                        <td className="font-mono font-bold">{rec.workDate}</td>
                        <td className="font-semibold text-black">{rec.employeeName}</td>
                        <td>{rec.department}</td>
                        <td>
                          <span
                            className={
                              rec.attendanceType === 'PRESENT'
                                ? 'text-emerald-700 font-bold'
                                : rec.attendanceType === 'ABSENT'
                                ? 'text-rose-700 font-bold'
                                : 'text-blue-700'
                            }
                          >
                            {rec.attendanceType === 'PRESENT'
                              ? 'حاضر'
                              : rec.attendanceType === 'ABSENT'
                              ? 'غائب'
                              : rec.attendanceType}
                          </span>
                        </td>
                        <td className="font-mono text-[11px]">
                          {rec.clockIn ? new Date(rec.clockIn).toLocaleTimeString('ar-SA') : '-'}
                        </td>
                        <td className="font-mono text-[11px]">
                          {rec.clockOut ? new Date(rec.clockOut).toLocaleTimeString('ar-SA') : '-'}
                        </td>
                        <td className="font-mono text-amber-900 font-semibold">
                          {rec.lateMinutes > 0 ? formatDurationArabic(rec.lateMinutes) : '-'}
                        </td>
                        <td className="font-mono text-blue-900 font-semibold">
                          {rec.earlyDepartureMinutes > 0
                            ? formatDurationArabic(rec.earlyDepartureMinutes)
                            : '-'}
                        </td>
                        <td className="font-mono font-bold text-slate-800">
                          {rec.workedMinutes > 0 ? formatDurationArabic(rec.workedMinutes) : '-'}
                        </td>
                        <td>
                          <Badge variant={rec.status === 'APPROVED' ? 'approved' : 'draft'}>
                            {rec.status === 'APPROVED' ? 'معتمد' : 'مسودة'}
                          </Badge>
                        </td>
                        <td>
                          {rec.status === 'DRAFT' && ['ADMIN', 'HR'].includes(user.role) && (
                            <form action={handleApproveRecord}>
                              <input type="hidden" name="attendanceId" value={rec.id} />
                              <button
                                type="submit"
                                className="win-btn text-[10px] px-2 py-0.5 font-bold text-blue-900"
                              >
                                اعتماد السجل
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
