'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui';
import { formatDurationArabic, calculateEarlyDepartureMinutes, calculateLateMinutes } from '@/lib/utils/time';
import { getEmployeeShift, getEmployeeShiftCode } from '@/lib/utils/shift';

interface EmployeeAttendanceRow {
  employee: {
    id: string;
    employeeNo: string;
    name: string;
    department: string;
    employmentType: 'PERMANENT' | 'PROBATIONARY' | 'DAILY_WORKER';
    workStartTime: string | null;
    workEndTime: string | null;
  };
  attendance: {
    id: string;
    workDate: string;
    clockIn: string | null;
    clockOut: string | null;
    attendanceType: string;
    lateMinutes: number;
    workedMinutes: number;
    earlyDeparture: boolean;
    earlyDepartureMinutes: number;
    departureReason: string | null;
    approvedOtHours?: string | number | null;
    status: string;
  } | null;
  scheduledIn: string;
  scheduledOut: string;
  breakMinutes: number;
  isMarked: boolean;
  status: string;
  attendanceType: string | null;
  lateMinutes: number;
  workedMinutes: number;
  earlyDeparture: boolean;
  earlyDepartureMinutes: number;
  isLocked?: boolean;
}

interface DailyAttendanceSheetClientProps {
  initialDate: string;
  rows: EmployeeAttendanceRow[];
  departments: string[];
  markPresentAction: (employeeId: string, date: string, arrivalTime?: string) => Promise<void>;
  markAbsentAction: (
    employeeId: string,
    date: string,
    absenceType: 'EXCUSED_ABSENCE' | 'UNEXCUSED_ABSENCE' | 'ABSENT',
    reason?: string
  ) => Promise<void>;
  recordEarlyDepartureAction: (attendanceId: string, clockOutTime: string, reason: string) => Promise<void>;
  updateOvertimeAction?: (employeeId: string, date: string, otHours: number) => Promise<void>;
  bulkMarkPresentAction?: (date: string, onlyUnmarked: boolean) => Promise<{ markedCount: number; skippedCount: number; total: number }>;
  approveAllDailyAction?: (date: string) => Promise<{ approvedCount: number }>;
  canApprove?: boolean;
}

export function DailyAttendanceSheetClient({
  initialDate,
  rows,
  departments,
  markPresentAction,
  markAbsentAction,
  recordEarlyDepartureAction,
  updateOvertimeAction,
  bulkMarkPresentAction,
  approveAllDailyAction,
  canApprove = false,
}: DailyAttendanceSheetClientProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [filterDept, setFilterDept] = useState('');
  const [filterShift, setFilterShift] = useState<'ALL' | 'MORNING' | 'EVENING'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Per-employee pending set so clicking one employee never blocks or dims other employees
  const [pendingEmpIds, setPendingEmpIds] = useState<Set<string>>(new Set());
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isModalPending, setIsModalPending] = useState(false);

  // Optimistic display rows for instantaneous 0ms UI feedback
  const [displayRows, setDisplayRows] = useState(rows);

  React.useEffect(() => {
    setDisplayRows(rows);
  }, [rows]);

  // Modal States
  const [lateModal, setLateModal] = useState<{
    open: boolean;
    employeeId: string;
    employeeName: string;
    scheduledIn: string;
    arrivalTime: string;
  }>({
    open: false,
    employeeId: '',
    employeeName: '',
    scheduledIn: '',
    arrivalTime: '08:15',
  });

  const [otModal, setOtModal] = useState<{
    open: boolean;
    employeeId: string;
    employeeName: string;
    otHours: number;
  }>({
    open: false,
    employeeId: '',
    employeeName: '',
    otHours: 1.5,
  });

  const [excusedModal, setExcusedModal] = useState<{
    open: boolean;
    employeeId: string;
    employeeName: string;
    reason: string;
  }>({
    open: false,
    employeeId: '',
    employeeName: '',
    reason: 'ظرف صحي / طبي',
  });

  const [earlyDepartureModal, setEarlyDepartureModal] = useState<{
    open: boolean;
    attendanceId: string;
    employeeName: string;
    scheduledOut: string;
    departureTime: string;
    reason: string;
  }>({
    open: false,
    attendanceId: '',
    employeeName: '',
    scheduledOut: '',
    departureTime: '15:00',
    reason: 'شخصي',
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  function handleDateChange(newDate: string) {
    setSelectedDate(newDate);
    router.push(`/attendance?date=${newDate}`);
  }

  function handlePrevDay() {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    const prev = d.toISOString().split('T')[0];
    handleDateChange(prev);
  }

  function handleNextDay() {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const next = d.toISOString().split('T')[0];
    handleDateChange(next);
  }

  function handleToday() {
    const today = new Date().toISOString().split('T')[0];
    handleDateChange(today);
  }

  async function onMarkPresent(empId: string) {
    const prev = displayRows;

    // Instant optimistic update (0ms UI latency)
    setDisplayRows((current) =>
      current.map((r) =>
        r.employee.id === empId
          ? {
              ...r,
              isMarked: true,
              attendanceType: 'PRESENT',
              lateMinutes: 0,
            }
          : r
      )
    );

    setPendingEmpIds((prevSet) => new Set(prevSet).add(empId));
    try {
      await markPresentAction(empId, selectedDate);
    } catch (err: any) {
      setDisplayRows(prev);
      setFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء تسجيل الحضور' });
    } finally {
      setPendingEmpIds((prevSet) => {
        const nextSet = new Set(prevSet);
        nextSet.delete(empId);
        return nextSet;
      });
    }
  }

  async function onConfirmLate() {
    setFeedback(null);
    const empId = lateModal.employeeId;
    const prev = displayRows;
    const diff = calculateLateMinutes(lateModal.scheduledIn, lateModal.arrivalTime);

    // Instant optimistic update
    setDisplayRows((current) =>
      current.map((r) =>
        r.employee.id === empId
          ? {
              ...r,
              isMarked: true,
              attendanceType: 'PRESENT',
              lateMinutes: diff,
            }
          : r
      )
    );
    setLateModal((m) => ({ ...m, open: false }));

    setIsModalPending(true);
    setPendingEmpIds((prevSet) => new Set(prevSet).add(empId));
    try {
      await markPresentAction(empId, selectedDate, lateModal.arrivalTime);
      setFeedback({ type: 'success', message: 'تم تسجيل التأخير بدقة واحتساب الدقائق بنجاح' });
    } catch (err: any) {
      setDisplayRows(prev);
      setFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء تسجيل التأخير' });
    } finally {
      setIsModalPending(false);
      setPendingEmpIds((prevSet) => {
        const nextSet = new Set(prevSet);
        nextSet.delete(empId);
        return nextSet;
      });
    }
  }

  async function onMarkUnexcusedAbsent(empId: string) {
    setFeedback(null);
    const prev = displayRows;

    // Instant optimistic update
    setDisplayRows((current) =>
      current.map((r) =>
        r.employee.id === empId
          ? {
              ...r,
              isMarked: true,
              attendanceType: 'UNEXCUSED_ABSENCE',
              lateMinutes: 0,
            }
          : r
      )
    );

    setPendingEmpIds((prevSet) => new Set(prevSet).add(empId));
    try {
      await markAbsentAction(empId, selectedDate, 'UNEXCUSED_ABSENCE');
      setFeedback({ type: 'success', message: 'تم تسجيل غياب بدون عذر وتطبيق عقوبة خصم يومين بنجاح' });
    } catch (err: any) {
      setDisplayRows(prev);
      setFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء تسجيل الغياب' });
    } finally {
      setPendingEmpIds((prevSet) => {
        const nextSet = new Set(prevSet);
        nextSet.delete(empId);
        return nextSet;
      });
    }
  }

  async function onConfirmExcusedAbsent() {
    setFeedback(null);
    const empId = excusedModal.employeeId;
    const prev = displayRows;

    // Instant optimistic update
    setDisplayRows((current) =>
      current.map((r) =>
        r.employee.id === empId
          ? {
              ...r,
              isMarked: true,
              attendanceType: 'EXCUSED_ABSENCE',
              lateMinutes: 0,
            }
          : r
      )
    );
    setExcusedModal((m) => ({ ...m, open: false }));

    setIsModalPending(true);
    setPendingEmpIds((prevSet) => new Set(prevSet).add(empId));
    try {
      await markAbsentAction(empId, selectedDate, 'EXCUSED_ABSENCE', excusedModal.reason);
      setFeedback({ type: 'success', message: 'تم تسجيل غياب بعذر واحتساب خصم يوم واحد بنجاح' });
    } catch (err: any) {
      setDisplayRows(prev);
      setFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء تسجيل الغياب' });
    } finally {
      setIsModalPending(false);
      setPendingEmpIds((prevSet) => {
        const nextSet = new Set(prevSet);
        nextSet.delete(empId);
        return nextSet;
      });
    }
  }

  async function onConfirmEarlyDeparture() {
    setFeedback(null);
    const prev = displayRows;
    const diff = calculateEarlyDepartureMinutes(
      earlyDepartureModal.scheduledOut,
      earlyDepartureModal.departureTime
    );

    // Instant optimistic update
    setDisplayRows((current) =>
      current.map((r) =>
        r.attendance?.id === earlyDepartureModal.attendanceId
          ? {
              ...r,
              earlyDeparture: diff > 0,
              earlyDepartureMinutes: diff,
            }
          : r
      )
    );
    setEarlyDepartureModal((m) => ({ ...m, open: false }));

    setIsModalPending(true);
    try {
      await recordEarlyDepartureAction(
        earlyDepartureModal.attendanceId,
        earlyDepartureModal.departureTime,
        earlyDepartureModal.reason
      );
      setFeedback({ type: 'success', message: 'تم تسجيل المغادرة المبكرة واحتساب الخصم الدقيق بنجاح' });
    } catch (err: any) {
      setDisplayRows(prev);
      setFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء تسجيل المغادرة' });
    } finally {
      setIsModalPending(false);
    }
  }

  async function onConfirmOvertime() {
    if (!updateOvertimeAction) return;
    setFeedback(null);
    const empId = otModal.employeeId;
    const prev = displayRows;

    setDisplayRows((current) =>
      current.map((r) =>
        r.employee.id === empId
          ? {
              ...r,
              attendance: r.attendance
                ? { ...r.attendance, approvedOtHours: otModal.otHours }
                : null,
            }
          : r
      )
    );
    setOtModal((m) => ({ ...m, open: false }));

    setIsModalPending(true);
    setPendingEmpIds((prevSet) => new Set(prevSet).add(empId));
    try {
      await updateOvertimeAction(empId, selectedDate, Number(otModal.otHours) || 0);
      setFeedback({ type: 'success', message: `تم اعتمد ${otModal.otHours} ساعة عمل إضافي للموظف بنجاح` });
    } catch (err: any) {
      setDisplayRows(prev);
      setFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء تسجيل العمل الإضافي' });
    } finally {
      setIsModalPending(false);
      setPendingEmpIds((prevSet) => {
        const nextSet = new Set(prevSet);
        nextSet.delete(empId);
        return nextSet;
      });
    }
  }

  async function onSaveAndTransferDailySheet() {
    setFeedback(null);
    setIsSavingAll(true);
    try {
      let additionalMarked = 0;
      if (bulkMarkPresentAction && unmarkedCount > 0) {
        const res = await bulkMarkPresentAction(selectedDate, true);
        additionalMarked = res.markedCount;
      }
      setFeedback({
        type: 'success',
        message: `✓ تم بنجاح حفظ وترحيل سجل الحضور اليومي لتاريخ (${selectedDate}) ونقل البيانات إلى سجل الحضور الدائم والأرشيف.${
          additionalMarked > 0 ? ` (تم تسجيل وترحيل ${additionalMarked} موظفاً إضافياً كحاضرين بالموعد).` : ''
        }`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء حفظ وترحيل سجل الحضور' });
    } finally {
      setIsSavingAll(false);
    }
  }

  async function onBulkMarkRemainingPresent() {
    if (!bulkMarkPresentAction) return;
    setFeedback(null);
    const prev = displayRows;

    // Instant optimistic update for all unmarked
    setDisplayRows((current) =>
      current.map((r) =>
        !r.isMarked && !r.isLocked
          ? {
              ...r,
              isMarked: true,
              attendanceType: 'PRESENT',
              lateMinutes: 0,
            }
          : r
      )
    );

    setIsSavingAll(true);
    try {
      const res = await bulkMarkPresentAction(selectedDate, true);
      setFeedback({
        type: 'success',
        message: `✓ تم تسجيل وترحيل حضور ${res.markedCount} موظفاً متبقياً كـ (حاضر في الموعد) وحفظهم بنجاح.`,
      });
    } catch (err: any) {
      setDisplayRows(prev);
      setFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء تسجيل الحضور الجماعي' });
    } finally {
      setIsSavingAll(false);
    }
  }

  async function onApproveAllDailyRecords() {
    if (!approveAllDailyAction) return;
    setFeedback(null);
    setIsSavingAll(true);
    try {
      const res = await approveAllDailyAction(selectedDate);
      setFeedback({
        type: 'success',
        message: `✓ تم بنجاح اعتماد وترحيل ${res.approvedCount} سجلاً مكتملاً لهذا اليوم.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء اعتماد السجلات' });
    } finally {
      setIsSavingAll(false);
    }
  }

  // Shift counts (calculated from optimistic displayRows)
  const morningCount = displayRows.filter((r) => getEmployeeShiftCode(r.scheduledIn || r.employee.workStartTime) === 'MORNING').length;
  const eveningCount = displayRows.filter((r) => getEmployeeShiftCode(r.scheduledIn || r.employee.workStartTime) === 'EVENING').length;

  // Filter rows
  const filteredRows = displayRows.filter((r) => {
    const matchDept = !filterDept || r.employee.department === filterDept;
    const matchSearch =
      !searchQuery ||
      r.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.employee.employeeNo.toLowerCase().includes(searchQuery.toLowerCase());
    const empShiftCode = getEmployeeShiftCode(r.scheduledIn || r.employee.workStartTime);
    const matchShift = filterShift === 'ALL' || empShiftCode === filterShift;
    return matchDept && matchSearch && matchShift;
  });

  // Calculate statistics from optimistic state
  const totalCount = filteredRows.length;
  const presentCount = filteredRows.filter((r) => r.attendanceType === 'PRESENT' && r.lateMinutes === 0).length;
  const lateCount = filteredRows.filter((r) => r.attendanceType === 'PRESENT' && r.lateMinutes > 0).length;
  const excusedCount = filteredRows.filter((r) => r.attendanceType === 'EXCUSED_ABSENCE').length;
  const unexcusedCount = filteredRows.filter((r) => r.attendanceType === 'UNEXCUSED_ABSENCE' || r.attendanceType === 'ABSENT').length;
  const earlyDepartureCount = filteredRows.filter((r) => r.earlyDeparture).length;
  const unmarkedCount = filteredRows.filter((r) => !r.isMarked).length;

  return (
    <div className="space-y-3">
      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-2 text-xs font-semibold win-raised flex items-center justify-between ${
            feedback.type === 'success' ? 'bg-emerald-100 text-emerald-900 border-emerald-500' : 'bg-rose-100 text-rose-900 border-rose-500'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="win-btn text-[10px] px-1 py-0.5"
          >
            إغلاق ×
          </button>
        </div>
      )}

      {/* Control Bar: Date Selector, Navigation, and Filters */}
      <div className="win-raised p-2 flex flex-wrap items-center justify-between gap-2 bg-[#ECE9D8]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <label className="text-xs font-bold text-black flex items-center gap-1">
            <span>📅</span>
            <span>تاريخ الحضور:</span>
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="win-input text-xs py-1 px-2 font-mono font-bold"
          />
          <button
            type="button"
            onClick={handlePrevDay}
            className="win-btn text-xs py-0.5 px-2"
            title="اليوم السابق"
          >
            ◄ السابق
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="win-btn text-xs py-0.5 px-2 font-bold"
            title="تاريخ اليوم"
          >
            اليوم
          </button>
          <button
            type="button"
            onClick={handleNextDay}
            className="win-btn text-xs py-0.5 px-2"
            title="اليوم التالي"
          >
            التالي ►
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Department Filter */}
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="win-input text-xs py-1 px-2"
          >
            <option value="">جميع الأقسام ({departments.length})</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* Search box */}
          <input
            type="text"
            placeholder="بحث بالاسم أو الرقم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="win-input text-xs py-1 px-2 w-44"
          />
        </div>
      </div>

      {/* Shift Toggle Buttons: Morning vs Evening distinction */}
      <div className="win-raised p-2 bg-[#F5F3EC] flex flex-wrap items-center justify-between gap-2 border border-[#808080]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-black flex items-center gap-1">
            <span>⏱️</span>
            <span>تصفية الوردية:</span>
          </span>
          <div className="inline-flex rounded border border-[#808080] bg-[#D4D0C8] p-0.5 gap-1">
            <button
              type="button"
              onClick={() => setFilterShift('ALL')}
              className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1.5 transition-none ${
                filterShift === 'ALL'
                  ? 'bg-[#0A246A] text-white shadow-inner'
                  : 'bg-[#ECE9D8] text-slate-800 hover:bg-[#F0EEE5]'
              }`}
            >
              <span>🔘</span>
              <span>جميع الورديات</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${filterShift === 'ALL' ? 'bg-blue-900 text-white' : 'bg-white text-slate-700 border'}`}>
                {displayRows.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterShift('MORNING')}
              className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1.5 transition-none ${
                filterShift === 'MORNING'
                  ? 'bg-amber-600 text-white shadow-inner'
                  : 'bg-[#ECE9D8] text-amber-950 hover:bg-[#F0EEE5]'
              }`}
            >
              <span>☀️</span>
              <span>الوردية الصباحية</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${filterShift === 'MORNING' ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-900 border border-amber-300'}`}>
                {morningCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterShift('EVENING')}
              className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1.5 transition-none ${
                filterShift === 'EVENING'
                  ? 'bg-indigo-700 text-white shadow-inner'
                  : 'bg-[#ECE9D8] text-indigo-950 hover:bg-[#F0EEE5]'
              }`}
            >
              <span>🌙</span>
              <span>الوردية المسائية</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${filterShift === 'EVENING' ? 'bg-indigo-900 text-white' : 'bg-indigo-100 text-indigo-900 border border-indigo-300'}`}>
                {eveningCount}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Action Bar: Save & Transfer to Permanent Record, Bulk Attendance, Print */}
      <div className="win-raised p-2 bg-[#D4D0C8] flex flex-wrap items-center justify-between gap-2 border border-[#808080]">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Primary Save Button */}
          <button
            type="button"
            disabled={isSavingAll}
            onClick={onSaveAndTransferDailySheet}
            className="win-btn px-4 py-1.5 font-bold text-xs bg-[#0A246A] text-white flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-60"
            title="حفظ وترحيل سجل الحضور اليومي الحالي واعتماده في قاعدة البيانات والأرشيف الدائم"
          >
            <span>💾</span>
            <span>{isSavingAll ? 'جاري الحفظ والترحيل...' : 'حفظ وترحيل سجل الحضور اليومي'}</span>
          </button>

          {/* Quick Mark Remaining as Present */}
          {unmarkedCount > 0 && (
            <button
              type="button"
              disabled={isSavingAll}
              onClick={onBulkMarkRemainingPresent}
              className="win-btn px-3 py-1.5 font-bold text-xs text-emerald-950 bg-emerald-100 flex items-center gap-1.5 border border-emerald-400 cursor-pointer disabled:opacity-60"
              title="تسجيل جميع الموظفين غير المسجلين كـ (حاضر في الموعد) دفعة واحدة وترحيلهم"
            >
              <span>⚡</span>
              <span>{isSavingAll ? 'جاري التسجيل...' : `تسجيل المتبقين (${unmarkedCount}) كحاضرين`}</span>
            </button>
          )}

          {/* Approve All Button if HR/Admin */}
          {canApprove && (
            <button
              type="button"
              disabled={isSavingAll}
              onClick={onApproveAllDailyRecords}
              className="win-btn px-3 py-1.5 font-bold text-xs text-blue-900 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              title="اعتماد كافة سجلات الحضور المحفوظة لهذا اليوم"
            >
              <span>✓</span>
              <span>{isSavingAll ? 'جاري الاعتماد...' : 'اعتماد سجلات اليوم'}</span>
            </button>
          )}

          {/* Saved status indicator */}
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-white border border-[#808080] text-[11px] font-semibold">
            <span className={unmarkedCount === 0 ? 'text-emerald-700 font-bold' : 'text-amber-800'}>
              {unmarkedCount === 0 ? '● السجل مكتمل ومحفوظ' : `○ متبقي ${unmarkedCount} غير مسجل`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Print Button */}
          <Link
            href={`/attendance/print?date=${selectedDate}`}
            className="win-btn px-3.5 py-1.5 font-bold text-xs text-[#0A246A] flex items-center gap-1.5"
            title="فتح سجل الحضور اليومي بنسخة رسمية جاهزة للطباعة والتوقيع A4 / PDF"
          >
            <span>🖨️</span>
            <span>طباعة سجل اليوم (A4 / PDF)</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Bar (Classic sunken tiles) */}
      <div className="grid grid-cols-2 sm:grid-cols-7 gap-1 text-xs select-none">
        <div className="win-sunken bg-white p-1 text-center">
          <div className="text-[10px] text-[#404040]">الإجمالي</div>
          <div className="text-sm font-bold text-black">{totalCount}</div>
        </div>
        <div className="win-sunken bg-white p-1 text-center border-r-2 border-emerald-600">
          <div className="text-[10px] text-emerald-800">حاضر بالموعد</div>
          <div className="text-sm font-bold text-emerald-700">{presentCount}</div>
        </div>
        <div className="win-sunken bg-white p-1 text-center border-r-2 border-amber-500">
          <div className="text-[10px] text-amber-800">متأخرون</div>
          <div className="text-sm font-bold text-amber-700">{lateCount}</div>
        </div>
        <div className="win-sunken bg-white p-1 text-center border-r-2 border-indigo-600">
          <div className="text-[10px] text-indigo-800">غياب بعذر (خصم 1)</div>
          <div className="text-sm font-bold text-indigo-700">{excusedCount}</div>
        </div>
        <div className="win-sunken bg-white p-1 text-center border-r-2 border-rose-600">
          <div className="text-[10px] text-rose-800">غياب بدون عذر (خصم 2)</div>
          <div className="text-sm font-bold text-rose-700">{unexcusedCount}</div>
        </div>
        <div className="win-sunken bg-white p-1 text-center border-r-2 border-blue-600">
          <div className="text-[10px] text-blue-800">مغادرة مبكرة</div>
          <div className="text-sm font-bold text-blue-700">{earlyDepartureCount}</div>
        </div>
        <div className="win-sunken bg-white p-1 text-center border-r-2 border-slate-400">
          <div className="text-[10px] text-slate-600">غير مسجل</div>
          <div className="text-sm font-bold text-slate-600">{unmarkedCount}</div>
        </div>
      </div>

      {/* High-density Attendance Table */}
      <div className="win-sunken bg-white overflow-x-auto">
        <table className="win-table w-full text-right text-xs">
          <thead>
            <tr>
              <th className="w-16">الرقم</th>
              <th>اسم الموظف</th>
              <th className="w-20">النوع</th>
              <th className="w-24">القسم</th>
              <th className="w-36">الوردية والدوام المجدول</th>
              <th className="w-40">حالة الحضور والغياب</th>
              <th className="w-24 font-bold">ساعات العمل</th>
              <th className="text-center whitespace-nowrap min-w-[340px]">تسجيل الحضور والغياب السريع</th>
              <th className="w-24 text-center whitespace-nowrap">المغادرة</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-[#808080]">
                  لا يوجد موظفون مطابقون للشروط المحددة
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const emp = row.employee;
                const att = row.attendance;
                const isLocked = row.isLocked;
                const empShift = getEmployeeShift(row.scheduledIn || emp.workStartTime);
                const isEmpPending = pendingEmpIds.has(emp.id) || isSavingAll;

                return (
                  <tr key={emp.id} className="hover:bg-[#E8EEF7]">
                    <td className="font-mono font-semibold">{emp.employeeNo}</td>
                    <td className="font-semibold text-black">
                      {emp.name}
                    </td>
                    <td>
                      <span
                        className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded border ${
                          emp.employmentType === 'DAILY_WORKER'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : emp.employmentType === 'PROBATIONARY'
                            ? 'bg-blue-100 text-blue-900 border-blue-300'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        }`}
                      >
                        {emp.employmentType === 'DAILY_WORKER'
                          ? 'مياومة'
                          : emp.employmentType === 'PROBATIONARY'
                          ? 'تجريبي'
                          : 'مثبت'}
                      </span>
                    </td>
                    <td className="text-slate-700">{emp.department}</td>
                    <td className="whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded border ${empShift.badgeBg} ${empShift.badgeText} ${empShift.badgeBorder} w-fit`}
                        >
                          <span>{empShift.icon}</span>
                          <span>{empShift.name}</span>
                        </span>
                        <span className="font-mono text-[11px] text-slate-600">
                          {row.scheduledIn.slice(0, 5)} - {row.scheduledOut.slice(0, 5)}
                        </span>
                      </div>
                    </td>
                    <td>
                      {!row.isMarked ? (
                        <span className="text-slate-400 font-medium">غير مسجل</span>
                      ) : row.attendanceType === 'PRESENT' ? (
                        <div className="flex flex-col gap-0.5">
                          {row.lateMinutes > 0 ? (
                            <span className="text-amber-800 font-bold flex items-center gap-1">
                              <span>⚠</span>
                              <span>متأخر ({formatDurationArabic(row.lateMinutes)})</span>
                            </span>
                          ) : (
                            <span className="text-emerald-800 font-bold flex items-center gap-1">
                              <span>✓</span>
                              <span>حاضر في الموعد</span>
                            </span>
                          )}
                          {row.earlyDeparture && (
                            <span className="text-blue-800 font-semibold text-[10px]">
                              ← غادر مبكراً ({formatDurationArabic(row.earlyDepartureMinutes)})
                            </span>
                          )}
                        </div>
                      ) : row.attendanceType === 'EXCUSED_ABSENCE' ? (
                        <span className="text-indigo-800 font-bold flex items-center gap-1" title={att?.departureReason || ''}>
                          <span>ℹ</span>
                          <span>غياب بعذر (خصم يوم)</span>
                        </span>
                      ) : row.attendanceType === 'UNEXCUSED_ABSENCE' || row.attendanceType === 'ABSENT' ? (
                        <span className="text-rose-700 font-bold flex items-center gap-1">
                          <span>✗</span>
                          <span>غياب بدون عذر (خصم يومين)</span>
                        </span>
                      ) : (
                        <span className="text-purple-700 font-medium">{row.attendanceType}</span>
                      )}
                    </td>
                    <td className="font-mono text-[11px]">
                      {row.workedMinutes > 0 ? formatDurationArabic(row.workedMinutes) : '-'}
                    </td>
                    <td className="text-center whitespace-nowrap">
                      {isLocked ? (
                        <span className="text-[10px] text-slate-500 font-semibold" title="الدوام مقفل لاعتماد مسير الرواتب">
                          🔒 مقفل
                        </span>
                      ) : (
                        <div className="inline-flex items-center gap-1 justify-center whitespace-nowrap">
                          {/* Green: حضور */}
                          <button
                            type="button"
                            disabled={isEmpPending}
                            onClick={() => onMarkPresent(emp.id)}
                            className={`win-btn text-[10px] px-1.5 py-0.5 font-bold whitespace-nowrap ${
                              row.attendanceType === 'PRESENT' && row.lateMinutes === 0
                                ? 'bg-emerald-200 text-emerald-950 ring-1 ring-emerald-600'
                                : 'text-emerald-800'
                            }`}
                            title="حضور في موعد الدوام المحدد (0 تأخير)"
                          >
                            {pendingEmpIds.has(emp.id) ? '⏳...' : '✓ حضور'}
                          </button>

                          {/* Yellow/Orange: تأخير */}
                          <button
                            type="button"
                            disabled={isEmpPending}
                            onClick={() => {
                              const isEvening = empShift.code === 'EVENING';
                              const defaultArrival = new Date().toTimeString().slice(0, 5);
                              const schedStart = row.scheduledIn.slice(0, 5);
                              let arrivalSuggestion = '08:15';
                              if (isEvening) {
                                arrivalSuggestion = defaultArrival > '17:00' ? defaultArrival : '17:15';
                              } else {
                                arrivalSuggestion = defaultArrival > schedStart ? defaultArrival : '08:15';
                              }

                              setLateModal({
                                open: true,
                                employeeId: emp.id,
                                employeeName: emp.name,
                                scheduledIn: schedStart,
                                arrivalTime: arrivalSuggestion,
                              });
                            }}
                            className={`win-btn text-[10px] px-1.5 py-0.5 font-bold whitespace-nowrap ${
                              row.attendanceType === 'PRESENT' && row.lateMinutes > 0
                                ? 'bg-amber-200 text-amber-950 ring-1 ring-amber-600'
                                : 'text-amber-800'
                            }`}
                            title="تسجيل وقت الحضور الفعلي واحتساب دقائق التأخير"
                          >
                            ⏰ تأخير
                          </button>

                          {/* Indigo: غياب بعذر */}
                          <button
                            type="button"
                            disabled={isEmpPending}
                            onClick={() => {
                              setExcusedModal({
                                open: true,
                                employeeId: emp.id,
                                employeeName: emp.name,
                                reason: 'ظرف صحي / طبي',
                              });
                            }}
                            className={`win-btn text-[10px] px-1.5 py-0.5 font-bold whitespace-nowrap ${
                              row.attendanceType === 'EXCUSED_ABSENCE'
                                ? 'bg-indigo-200 text-indigo-950 ring-1 ring-indigo-600'
                                : 'text-indigo-800'
                            }`}
                            title="تسجيل غياب بعذر (خصم يوم واحد)"
                          >
                            📝 بعذر
                          </button>

                          {/* Red: غياب بدون عذر */}
                          <button
                            type="button"
                            disabled={isEmpPending}
                            onClick={() => onMarkUnexcusedAbsent(emp.id)}
                            className={`win-btn text-[10px] px-1.5 py-0.5 font-bold whitespace-nowrap ${
                              row.attendanceType === 'UNEXCUSED_ABSENCE' || row.attendanceType === 'ABSENT'
                                ? 'bg-rose-200 text-rose-950 ring-1 ring-rose-600'
                                : 'text-rose-800'
                            }`}
                            title="تسجيل غياب بدون عذر (خصم يومين عقوبة)"
                          >
                            ❌ بدون عذر (خصم 2)
                          </button>

                          {/* Purple: عمل إضافي */}
                          <button
                            type="button"
                            disabled={isEmpPending}
                            onClick={() => {
                              setOtModal({
                                open: true,
                                employeeId: emp.id,
                                employeeName: emp.name,
                                otHours: Number(att?.approvedOtHours) || 1.5,
                              });
                            }}
                            className={`win-btn text-[10px] px-1.5 py-0.5 font-bold whitespace-nowrap ${
                              att && Number(att.approvedOtHours) > 0
                                ? 'bg-purple-200 text-purple-950 ring-1 ring-purple-600'
                                : 'text-purple-900'
                            }`}
                            title="تسجيل أو تعديل ساعات العمل الإضافي المعتمدة للموظف"
                          >
                            {att && Number(att.approvedOtHours) > 0 ? `⚡ إضافي (${att.approvedOtHours}س)` : '⚡ +إضافي'}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="text-center">
                      {row.attendanceType === 'PRESENT' && att && !isLocked ? (
                        <button
                          type="button"
                          disabled={isEmpPending}
                          onClick={() => {
                            const isEvening = getEmployeeShiftCode(row.scheduledIn) === 'EVENING';
                            let defaultLeave = '14:30';
                            if (att?.clockOut && row.earlyDeparture) {
                              const d = new Date(att.clockOut);
                              defaultLeave = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
                            } else if (isEvening) {
                              defaultLeave = '20:00';
                            }
                            setEarlyDepartureModal({
                              open: true,
                              attendanceId: att.id,
                              employeeName: emp.name,
                              scheduledOut: row.scheduledOut.slice(0, 5),
                              departureTime: defaultLeave,
                              reason: att.departureReason || 'شخصي',
                            });
                          }}
                          className={`win-btn text-[10px] px-1.5 py-0.5 ${
                            row.earlyDeparture ? 'bg-blue-100 font-bold text-blue-900' : 'text-slate-800'
                          }`}
                          title="تسجيل انصراف مبكر واحتساب دقائق الخصم"
                        >
                          {row.earlyDeparture ? 'تعديل' : 'مغادرة'}
                        </button>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Excused Absence Modal Dialog */}
      <Modal
        isOpen={excusedModal.open}
        onClose={() => setExcusedModal((prev) => ({ ...prev, open: false }))}
        title={`تسجيل غياب بعذر: ${excusedModal.employeeName}`}
      >
        <div className="space-y-3 text-xs">
          <div className="bg-[#FFFFE1] border border-[#808080] p-2 text-slate-800">
            <div>نوع الغياب: <strong>غياب بعذر (خصم يوم واحد من الراتب)</strong></div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              يرجى إدخال أو اختيار سبب الغياب المبرر للتأثيث والمراجعة.
            </div>
          </div>

          <div>
            <label className="block font-bold text-black mb-1">سبب الغياب المبرر <span className="text-red-600">*</span></label>
            <input
              type="text"
              required
              value={excusedModal.reason}
              onChange={(e) => setExcusedModal((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="أدخل سبب الغياب تفصيلياً..."
              className="win-input w-full py-1.5 px-2 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#808080]">
            <button
              type="button"
              disabled={isModalPending || !excusedModal.reason.trim()}
              onClick={onConfirmExcusedAbsent}
              className="win-btn px-4 py-1 font-bold text-black"
            >
              {isModalPending ? 'جاري الحفظ...' : 'تأكيد تسجيل الغياب بعذر'}
            </button>
            <button
              type="button"
              onClick={() => setExcusedModal((prev) => ({ ...prev, open: false }))}
              className="win-btn px-3 py-1 text-slate-700"
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>

      {/* Lateness Modal Dialog */}
      <Modal
        isOpen={lateModal.open}
        onClose={() => setLateModal((prev) => ({ ...prev, open: false }))}
        title={`تسجيل تأخير موظف: ${lateModal.employeeName}`}
      >
        <div className="space-y-3 text-xs">
          <div className="bg-[#FFFFE1] border border-[#808080] p-2 text-slate-800">
            <div>موعد الحضور المجدول: <strong>{lateModal.scheduledIn}</strong></div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              يتم احتساب دقائق التأخير الفعلية بدقة تامة دون أي تقريب أو سماحية.
            </div>
          </div>

          <div>
            <label className="block font-bold text-black mb-1">متى حضر الموظف؟ (الوقت الفعلي)</label>
            <input
              type="time"
              value={lateModal.arrivalTime}
              onChange={(e) => setLateModal((prev) => ({ ...prev, arrivalTime: e.target.value }))}
              className="win-input w-full py-1.5 px-2 font-mono text-sm font-bold"
            />
          </div>

          {/* Quick calculated feedback */}
          {(() => {
            const diff = calculateLateMinutes(lateModal.scheduledIn, lateModal.arrivalTime);

            return (
              <div className="win-sunken p-2 bg-white text-center font-bold">
                {diff > 0 ? (
                  <span className="text-amber-800">
                    مدة التأخير المحسوبة: {formatDurationArabic(diff)} ({diff} دقيقة)
                  </span>
                ) : (
                  <span className="text-emerald-700">
                    لا يوجد تأخير (الوقت المدخل يسبق أو يطابق موعد البداية)
                  </span>
                )}
              </div>
            );
          })()}

          <div className="flex justify-end gap-2 pt-2 border-t border-[#808080]">
            <button
              type="button"
              disabled={isModalPending}
              onClick={onConfirmLate}
              className="win-btn px-4 py-1 font-bold text-black"
            >
              {isModalPending ? 'جاري الحفظ...' : 'تأكيد وحفظ التأخير'}
            </button>
            <button
              type="button"
              onClick={() => setLateModal((prev) => ({ ...prev, open: false }))}
              className="win-btn px-3 py-1 text-slate-700"
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>

      {/* Early Departure Modal Dialog */}
      <Modal
        isOpen={earlyDepartureModal.open}
        onClose={() => setEarlyDepartureModal((prev) => ({ ...prev, open: false }))}
        title={`تسجيل مغادرة مبكرة: ${earlyDepartureModal.employeeName}`}
      >
        <div className="space-y-3 text-xs">
          <div className="bg-[#FFFFE1] border border-[#808080] p-2 text-slate-800">
            <div>موعد نهاية الدوام المجدول: <strong>{earlyDepartureModal.scheduledOut}</strong></div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              كل دقيقة مغادرة قبل موعد انتهاء الدوام يتم احتسابها في الخصم دون مسامحة. حالة الحضور تظل (حاضر).
            </div>
          </div>

          <div>
            <label className="block font-bold text-black mb-1">وقت المغادرة والانصراف الفعلي</label>
            <input
              type="time"
              value={earlyDepartureModal.departureTime}
              onChange={(e) =>
                setEarlyDepartureModal((prev) => ({ ...prev, departureTime: e.target.value }))
              }
              className="win-input w-full py-1.5 px-2 font-mono text-sm font-bold"
            />
          </div>

          <div>
            <label className="block font-bold text-black mb-1">سبب المغادرة</label>
            <select
              value={earlyDepartureModal.reason}
              onChange={(e) =>
                setEarlyDepartureModal((prev) => ({ ...prev, reason: e.target.value }))
              }
              className="win-input w-full py-1.5 px-2 text-xs"
            >
              <option value="شخصي">إذن شخصي</option>
              <option value="طبي">ظرف صحي / طبي</option>
              <option value="عمل رسمي">مهمة عمل خارجية رسمية</option>
              <option value="طارئ">ظرف عائلي طارئ</option>
              <option value="أخرى">سبب آخر</option>
            </select>
          </div>

          {/* Quick calculated feedback */}
          {(() => {
            const diff = calculateEarlyDepartureMinutes(
              earlyDepartureModal.scheduledOut,
              earlyDepartureModal.departureTime
            );

            return (
              <div className="win-sunken p-2 bg-white text-center font-bold">
                {diff > 0 ? (
                  <span className="text-blue-800">
                    مدة المغادرة المبكرة: {formatDurationArabic(diff)} ({diff} دقيقة)
                  </span>
                ) : (
                  <span className="text-emerald-700">
                    لا توجد مغادرة مبكرة (وقت الانصراف بعد أو يطابق نهاية الدوام)
                  </span>
                )}
              </div>
            );
          })()}

          <div className="flex justify-end gap-2 pt-2 border-t border-[#808080]">
            <button
              type="button"
              disabled={isModalPending}
              onClick={onConfirmEarlyDeparture}
              className="win-btn px-4 py-1 font-bold text-black"
            >
              {isModalPending ? 'جاري الحفظ...' : 'تسجيل المغادرة'}
            </button>
            <button
              type="button"
              onClick={() => setEarlyDepartureModal((prev) => ({ ...prev, open: false }))}
              className="win-btn px-3 py-1 text-slate-700"
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>

      {/* Overtime Hours Modal Dialog */}
      <Modal
        isOpen={otModal.open}
        onClose={() => setOtModal((prev) => ({ ...prev, open: false }))}
        title={`تسجيل عمل إضافي: ${otModal.employeeName}`}
      >
        <div className="space-y-3 text-xs">
          <div className="bg-[#E6F0FA] border border-[#2169A6] p-2 text-slate-800">
            <div>تاريخ الحضور: <strong>{selectedDate}</strong></div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              يتم احتساب أجر الساعات الإضافية المعتمدة تلقائياً بناءً على سعر الساعة الإضافية المحدد في عقد الموظف وتضاف لصافي الراتب الشهري.
            </div>
          </div>

          <div>
            <label className="block font-bold text-black mb-1">عدد ساعات العمل الإضافي المعتمدة</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="24"
              value={otModal.otHours}
              onChange={(e) =>
                setOtModal((prev) => ({ ...prev, otHours: parseFloat(e.target.value) || 0 }))
              }
              className="win-input w-full py-1.5 px-2 font-mono text-sm font-bold"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#808080]">
            <button
              type="button"
              disabled={isModalPending}
              onClick={onConfirmOvertime}
              className="win-btn px-4 py-1 font-bold text-black"
            >
              {isModalPending ? 'جاري الحفظ...' : 'اعتماد وحفظ الساعات'}
            </button>
            <button
              type="button"
              onClick={() => setOtModal((prev) => ({ ...prev, open: false }))}
              className="win-btn px-3 py-1 text-slate-700"
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
