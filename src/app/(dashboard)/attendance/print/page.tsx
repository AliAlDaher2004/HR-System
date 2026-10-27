import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getDailyAttendanceSheet } from '@/lib/services/attendance-service';
import { getSystemSettings } from '@/lib/services/settings-service';
import { getEmployeeShiftCode } from '@/lib/utils/shift';
import { PrintAttendanceToolbar } from '@/components/attendance/PrintAttendanceToolbar';

export default async function PrintDailyAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    shift?: 'ALL' | 'MORNING' | 'EVENING';
    department?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const resolvedParams = await searchParams;
  const todayStr = new Date().toISOString().split('T')[0];
  const selectedDate = resolvedParams.date || todayStr;
  const currentShift = resolvedParams.shift || 'ALL';
  const currentDept = resolvedParams.department || '';

  const [settings, dailyRows] = await Promise.all([
    getSystemSettings(),
    getDailyAttendanceSheet(user, selectedDate),
  ]);

  const departments = Array.from(new Set(dailyRows.map((r: any) => r.employee.department))).filter(Boolean) as string[];

  // Shift counts
  const totalCount = dailyRows.length;
  const morningCount = dailyRows.filter(
    (r: any) => getEmployeeShiftCode(r.scheduledIn || r.employee.workStartTime) === 'MORNING'
  ).length;
  const eveningCount = dailyRows.filter(
    (r: any) => getEmployeeShiftCode(r.scheduledIn || r.employee.workStartTime) === 'EVENING'
  ).length;

  // Filter rows
  let filteredRows = dailyRows;
  if (currentShift === 'MORNING') {
    filteredRows = filteredRows.filter(
      (r: any) => getEmployeeShiftCode(r.scheduledIn || r.employee.workStartTime) === 'MORNING'
    );
  } else if (currentShift === 'EVENING') {
    filteredRows = filteredRows.filter(
      (r: any) => getEmployeeShiftCode(r.scheduledIn || r.employee.workStartTime) === 'EVENING'
    );
  }

  if (currentDept) {
    filteredRows = filteredRows.filter((r: any) => r.employee.department === currentDept);
  }

  const companyName = settings?.companyName || 'شركة التقنية والحلول المتقدمة';
  const country = settings?.country || 'المملكة الأردنية الهاشمية';

  // Arabic date representation
  const dateObj = new Date(selectedDate);
  const weekday = dateObj.toLocaleDateString('ar-JO', { weekday: 'long' });

  let shiftTitle = 'جميع الورديات (الصباحية والمسائية)';
  if (currentShift === 'MORNING') shiftTitle = 'الوردية الصباحية (08:00 - 16:30)';
  if (currentShift === 'EVENING') shiftTitle = 'الوردية المسائية (16:30 - 01:00)';

  return (
    <div className="min-h-screen bg-slate-100 py-4 px-3 flex flex-col items-center print:bg-white print:p-0 print:m-0 print:block" dir="rtl">
      {/* Print Styles for A4 Portrait Fitting */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 6mm 8mm 6mm;
          }
          
          html, body {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            font-size: 7.5pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .no-print, nav, header, aside, button, a, .win-titlebar, .win-toolbar, .win-statusbar {
            display: none !important;
          }

          main {
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }

          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }

          .print-table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            border: 1pt solid #0f172a !important;
          }

          .print-table th {
            padding: 5px 2px !important;
            border: 0.75pt solid #0f172a !important;
            font-size: 8pt !important;
            font-weight: 700 !important;
            background-color: #F1F5F9 !important;
            text-align: center !important;
          }

          .print-table td {
            padding: 4px 2px !important;
            border: 0.5pt solid #334155 !important;
            font-size: 8pt !important;
            height: 30px !important;
          }

          .company-header {
            margin-bottom: 6px !important;
            padding-bottom: 4px !important;
            border-bottom: 1.5pt solid #0f172a !important;
          }
        }
      `}</style>

      {/* Action / Filter Bar (Client Component, hidden when printing) */}
      <PrintAttendanceToolbar
        currentDate={selectedDate}
        currentShift={currentShift}
        currentDept={currentDept}
        totalCount={totalCount}
        morningCount={morningCount}
        eveningCount={eveningCount}
        departments={departments}
      />

      {/* Main Printable Document */}
      <div className="print-container w-full max-w-[900px] bg-white p-6 shadow-sm border border-slate-300 print:shadow-none print:border-none print:p-0">
        {/* Document Header */}
        <div className="company-header border-b-2 border-slate-900 pb-3 mb-3">
          <div className="flex justify-between items-center">
            <div className="text-right">
              <h1 className="text-lg font-bold text-slate-900">{companyName}</h1>
              <div className="text-xs text-slate-600 font-semibold">{country}</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">إدارة الموارد البشرية - سجل الدوام والرقابة</div>
            </div>

            <div className="text-center">
              <div className="inline-block px-4 py-1 rounded bg-slate-100 border border-slate-300 mb-1">
                <h2 className="text-sm font-bold text-slate-900">
                  سجل وكشف الحضور والانصراف اليومي الرسمي
                </h2>
              </div>
              <div className="text-xs font-bold text-blue-950 flex items-center justify-center gap-1.5">
                <span>ليوم {weekday} الموافق:</span>
                <span className="font-mono underline">{selectedDate}</span>
                <span>| {shiftTitle}</span>
                {currentDept && <span>- قسم: {currentDept}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Printable Daily Attendance Table */}
        <div className="overflow-x-auto">
          <table className="print-table w-full text-right text-xs border-collapse border border-slate-700 table-fixed">
            <thead>
              <tr className="bg-slate-100 text-slate-900">
                <th className="border border-slate-600 py-2.5 px-1 text-center font-bold w-[4%]">#</th>
                <th className="border border-slate-600 py-2.5 px-1 text-center font-bold w-[10%]">الرقم</th>
                <th className="border border-slate-600 py-2.5 px-2 text-right font-bold w-[24%]">اسم الموظف</th>
                <th className="border border-slate-600 py-2.5 px-1 text-center font-bold w-[12%]">حالة الحضور</th>
                <th className="border border-slate-600 py-2.5 px-1 text-center font-mono font-bold w-[9%]">الدخول</th>
                <th className="border border-slate-600 py-2.5 px-1 text-center font-mono font-bold w-[9%]">الخروج</th>
                <th className="border border-slate-600 py-2.5 px-1 text-center font-bold w-[7%]">التأخير</th>
                <th className="border border-slate-600 py-2.5 px-1 text-center font-bold w-[7%]">مغادرة</th>
                <th className="border border-slate-600 py-2.5 px-1 text-center font-bold w-[6%]">إضافي</th>
                <th className="border border-slate-600 py-2.5 px-1 text-center font-bold w-[12%]">توقيع الموظف</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <>
                  {Array.from({ length: 15 }).map((_, i) => (
                    <tr key={`empty-blank-${i}`} className="border-b border-slate-300 h-10 print:h-[30px] bg-white">
                      <td className="border border-slate-400 text-center font-mono text-slate-400">{i + 1}</td>
                      <td className="border border-slate-400 text-center"></td>
                      <td className="border border-slate-400 px-2"></td>
                      <td className="border border-slate-400 text-center"></td>
                      <td className="border border-slate-400 text-center"></td>
                      <td className="border border-slate-400 text-center"></td>
                      <td className="border border-slate-400 text-center"></td>
                      <td className="border border-slate-400 text-center"></td>
                      <td className="border border-slate-400 text-center"></td>
                      <td className="border border-slate-400 text-center bg-slate-50/50"></td>
                    </tr>
                  ))}
                </>
              ) : (
                <>
                  {filteredRows.map((row: any, index: number) => {
                    const emp = row.employee;
                    const att = row.attendance;

                    // Extract clockIn and clockOut times (no dashes if empty)
                    let clockInStr = '';
                    let clockOutStr = '';
                    if (att?.clockIn) {
                      try {
                        clockInStr = new Date(att.clockIn).toLocaleTimeString('ar-JO', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                      } catch {
                        clockInStr = '';
                      }
                    }
                    if (att?.clockOut) {
                      try {
                        clockOutStr = new Date(att.clockOut).toLocaleTimeString('ar-JO', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                      } catch {
                        clockOutStr = '';
                      }
                    }

                    // Status text & style (blank if unmarked, no dashes)
                    let statusText = '';
                    let statusStyle = '';
                    if (row.isMarked) {
                      if (row.attendanceType === 'PRESENT') {
                        if (row.lateMinutes > 0) {
                          statusText = `متأخر (${row.lateMinutes} د)`;
                          statusStyle = 'text-amber-800 font-bold';
                        } else {
                          statusText = 'حاضر بالموعد';
                          statusStyle = 'text-emerald-800 font-bold';
                        }
                      } else if (row.attendanceType === 'EXCUSED_ABSENCE') {
                        statusText = 'غياب بعذر';
                        statusStyle = 'text-indigo-800 font-bold';
                      } else if (row.attendanceType === 'UNEXCUSED_ABSENCE' || row.attendanceType === 'ABSENT') {
                        statusText = 'غياب بدون عذر';
                        statusStyle = 'text-rose-800 font-bold';
                      } else if (row.attendanceType === 'PAID_LEAVE') {
                        statusText = 'إجازة مدفوعة';
                        statusStyle = 'text-blue-800 font-semibold';
                      } else if (row.attendanceType === 'UNPAID_LEAVE') {
                        statusText = 'إجازة بدون راتب';
                        statusStyle = 'text-purple-800 font-semibold';
                      }
                    }

                    return (
                      <tr key={emp.id} className="border-b border-slate-300 hover:bg-slate-50 h-10 print:h-[30px]">
                        <td className="border border-slate-400 text-center font-mono font-bold text-slate-600">{index + 1}</td>
                        <td className="border border-slate-400 text-center font-mono font-bold text-slate-900">{emp.employeeNo}</td>
                        <td className="border border-slate-400 px-2 font-bold text-slate-900 truncate">{emp.name}</td>
                        <td className={`border border-slate-400 text-center whitespace-nowrap ${statusStyle}`}>
                          <span>{statusText}</span>
                        </td>
                        <td className="border border-slate-400 font-mono text-center text-[11px]">{clockInStr}</td>
                        <td className="border border-slate-400 font-mono text-center text-[11px]">{clockOutStr}</td>
                        <td className="border border-slate-400 text-center font-mono font-semibold text-amber-900">
                          {row.lateMinutes > 0 ? `${row.lateMinutes} د` : ''}
                        </td>
                        <td className="border border-slate-400 text-center font-mono font-semibold text-blue-900">
                          {row.earlyDeparture && row.earlyDepartureMinutes > 0 ? `${row.earlyDepartureMinutes} د` : ''}
                        </td>
                        <td className="border border-slate-400 text-center font-mono font-bold text-purple-900">
                          {att && Number(att.approvedOtHours) > 0 ? `${att.approvedOtHours}س` : ''}
                        </td>
                        {/* Employee Signature Box */}
                        <td className="border border-slate-400 text-center bg-slate-50/50"></td>
                      </tr>
                    );
                  })}

                  {/* Additional blank rows for manual handwriting / day workers */}
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`blank-${i}`} className="border-b border-slate-300 h-10 print:h-[30px] bg-white">
                      <td className="border border-slate-400 text-center font-mono text-slate-400">{filteredRows.length + i + 1}</td>
                      <td className="border border-slate-400 text-center"></td>
                      <td className="border border-slate-400 px-2"></td>
                      <td className="border border-slate-400 text-center"></td>
                      <td className="border border-slate-400 text-center"></td>
                      <td className="border border-slate-400 text-center"></td>
                      <td className="border border-slate-400 text-center"></td>
                      <td className="border border-slate-400 text-center"></td>
                      <td className="border border-slate-400 text-center"></td>
                      <td className="border border-slate-400 text-center bg-slate-50/50"></td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
