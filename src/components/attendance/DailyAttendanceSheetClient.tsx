'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui';
import { formatDurationArabic } from '@/lib/utils/time';

interface EmployeeAttendanceRow {
  employee: {
    id: string;
    employeeNo: string;
    name: string;
    department: string;
    employmentType: 'PERMANENT' | 'DAILY_WORKER';
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
}

export function DailyAttendanceSheetClient({
  initialDate,
  rows,
  departments,
  markPresentAction,
  markAbsentAction,
  recordEarlyDepartureAction,
  updateOvertimeAction,
}: DailyAttendanceSheetClientProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [filterDept, setFilterDept] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();

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
    setFeedback(null);
    startTransition(async () => {
      try {
        await markPresentAction(empId, selectedDate);
        setFeedback({ type: 'success', message: 'تم تسجيل الحضور في الموعد بنجاح' });
        router.refresh();
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء تسجيل الحضور' });
      }
    });
  }

  async function onConfirmLate() {
    setFeedback(null);
    startTransition(async () => {
      try {
        await markPresentAction(lateModal.employeeId, selectedDate, lateModal.arrivalTime);
        setLateModal((prev) => ({ ...prev, open: false }));
        setFeedback({ type: 'success', message: 'تم تسجيل التأخير بدقة واحتساب الدقائق بنجاح' });
        router.refresh();
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء تسجيل التأخير' });
      }
    });
  }

  async function onMarkUnexcusedAbsent(empId: string) {
    setFeedback(null);
    startTransition(async () => {
      try {
        await markAbsentAction(empId, selectedDate, 'UNEXCUSED_ABSENCE');
        setFeedback({ type: 'success', message: 'تم تسجيل غياب بدون عذر وتطبيق عقوبة خصم يومين بنجاح' });
        router.refresh();
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء تسجيل الغياب' });
      }
    });
  }

  async function onConfirmExcusedAbsent() {
    setFeedback(null);
    startTransition(async () => {
      try {
        await markAbsentAction(excusedModal.employeeId, selectedDate, 'EXCUSED_ABSENCE', excusedModal.reason);
        setExcusedModal((prev) => ({ ...prev, open: false }));
        setFeedback({ type: 'success', message: 'تم تسجيل غياب بعذر واحتساب خصم يوم واحد بنجاح' });
        router.refresh();
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء تسجيل الغياب' });
      }
    });
  }

  async function onConfirmEarlyDeparture() {
    setFeedback(null);
    startTransition(async () => {
      try {
        await recordEarlyDepartureAction(
          earlyDepartureModal.attendanceId,
          earlyDepartureModal.departureTime,
          earlyDepartureModal.reason
        );
        setEarlyDepartureModal((prev) => ({ ...prev, open: false }));
        setFeedback({ type: 'success', message: 'تم تسجيل المغادرة المبكرة واحتساب الخصم الدقيق بنجاح' });
        router.refresh();
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء تسجيل المغادرة' });
      }
    });
  }

  async function onConfirmOvertime() {
    if (!updateOvertimeAction) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        await updateOvertimeAction(otModal.employeeId, selectedDate, Number(otModal.otHours) || 0);
        setOtModal((prev) => ({ ...prev, open: false }));
        setFeedback({ type: 'success', message: `تم اعتمد ${otModal.otHours} ساعة عمل إضافي للموظف بنجاح` });
        router.refresh();
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء تسجيل العمل الإضافي' });
      }
    });
  }

  // Filter rows
  const filteredRows = rows.filter((r) => {
    const matchDept = !filterDept || r.employee.department === filterDept;
    const matchSearch =
      !searchQuery ||
      r.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.employee.employeeNo.toLowerCase().includes(searchQuery.toLowerCase());
    return matchDept && matchSearch;
  });

  // Calculate statistics
  const totalCount = rows.length;
  const presentCount = rows.filter((r) => r.attendanceType === 'PRESENT' && r.lateMinutes === 0).length;
  const lateCount = rows.filter((r) => r.attendanceType === 'PRESENT' && r.lateMinutes > 0).length;
  const excusedCount = rows.filter((r) => r.attendanceType === 'EXCUSED_ABSENCE').length;
  const unexcusedCount = rows.filter((r) => r.attendanceType === 'UNEXCUSED_ABSENCE' || r.attendanceType === 'ABSENT').length;
  const earlyDepartureCount = rows.filter((r) => r.earlyDeparture).length;
  const unmarkedCount = rows.filter((r) => !r.isMarked).length;

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
              <th className="w-24">الدوام المجدول</th>
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

                return (
                  <tr key={emp.id} className="hover:bg-[#E8EEF7]">
                    <td className="font-mono font-semibold">{emp.employeeNo}</td>
                    <td className="font-semibold text-black">
                      {emp.name}
                    </td>
                    <td>
                      <span
                        className={`px-1 py-0.5 text-[10px] font-bold ${
                          emp.employmentType === 'DAILY_WORKER'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-blue-50 text-blue-900 border border-blue-200'
                        }`}
                      >
                        {emp.employmentType === 'DAILY_WORKER' ? 'مياومة' : 'مثبت'}
                      </span>
                    </td>
                    <td className="text-slate-700">{emp.department}</td>
                    <td className="font-mono text-[11px] text-slate-600">
                      {row.scheduledIn.slice(0, 5)} - {row.scheduledOut.slice(0, 5)}
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
                            disabled={isPending}
                            onClick={() => onMarkPresent(emp.id)}
                            className={`win-btn text-[10px] px-1.5 py-0.5 font-bold whitespace-nowrap ${
                              row.attendanceType === 'PRESENT' && row.lateMinutes === 0
                                ? 'bg-emerald-200 text-emerald-950 ring-1 ring-emerald-600'
                                : 'text-emerald-800'
                            }`}
                            title="حضور في موعد الدوام المحدد (0 تأخير)"
                          >
                            ✓ حضور
                          </button>

                          {/* Yellow/Orange: تأخير */}
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                              const defaultArrival = new Date().toTimeString().slice(0, 5);
                              setLateModal({
                                open: true,
                                employeeId: emp.id,
                                employeeName: emp.name,
                                scheduledIn: row.scheduledIn.slice(0, 5),
                                arrivalTime: defaultArrival > row.scheduledIn.slice(0, 5) ? defaultArrival : '08:30',
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
                            disabled={isPending}
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
                            disabled={isPending}
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
                            disabled={isPending}
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
                          disabled={isPending}
                          onClick={() => {
                            const defaultLeave = new Date().toTimeString().slice(0, 5);
                            setEarlyDepartureModal({
                              open: true,
                              attendanceId: att.id,
                              employeeName: emp.name,
                              scheduledOut: row.scheduledOut.slice(0, 5),
                              departureTime: defaultLeave < row.scheduledOut.slice(0, 5) ? defaultLeave : '14:30',
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
              disabled={isPending || !excusedModal.reason.trim()}
              onClick={onConfirmExcusedAbsent}
              className="win-btn px-4 py-1 font-bold text-black"
            >
              {isPending ? 'جاري الحفظ...' : 'تأكيد تسجيل الغياب بعذر'}
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
            const schedParts = lateModal.scheduledIn.split(':');
            const schedMins = (parseInt(schedParts[0], 10) || 0) * 60 + (parseInt(schedParts[1], 10) || 0);
            const arrParts = lateModal.arrivalTime.split(':');
            const arrMins = (parseInt(arrParts[0], 10) || 0) * 60 + (parseInt(arrParts[1], 10) || 0);
            const diff = Math.max(0, arrMins - schedMins);

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
              disabled={isPending}
              onClick={onConfirmLate}
              className="win-btn px-4 py-1 font-bold text-black"
            >
              {isPending ? 'جاري الحفظ...' : 'تأكيد وحفظ التأخير'}
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
            const schedParts = earlyDepartureModal.scheduledOut.split(':');
            const schedMins = (parseInt(schedParts[0], 10) || 0) * 60 + (parseInt(schedParts[1], 10) || 0);
            const depParts = earlyDepartureModal.departureTime.split(':');
            const depMins = (parseInt(depParts[0], 10) || 0) * 60 + (parseInt(depParts[1], 10) || 0);
            const diff = Math.max(0, schedMins - depMins);

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
              disabled={isPending}
              onClick={onConfirmEarlyDeparture}
              className="win-btn px-4 py-1 font-bold text-black"
            >
              {isPending ? 'جاري الحفظ...' : 'تسجيل المغادرة'}
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
              disabled={isPending}
              onClick={onConfirmOvertime}
              className="win-btn px-4 py-1 font-bold text-black"
            >
              {isPending ? 'جاري الحفظ...' : 'اعتماد وحفظ الساعات'}
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
