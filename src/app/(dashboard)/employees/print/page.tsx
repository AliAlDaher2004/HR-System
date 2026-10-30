import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getEmployees } from '@/lib/services/employee-service';
import { getSystemSettings } from '@/lib/services/settings-service';
import { getEmployeeShift, getEmployeeShiftCode } from '@/lib/utils/shift';
import { PrintToolbar } from '@/components/employee/PrintToolbar';

export default async function PrintEmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{
    shift?: 'ALL' | 'MORNING' | 'EVENING';
    department?: string;
    employmentType?: 'PERMANENT' | 'PROBATIONARY' | 'DAILY_WORKER';
    search?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const resolvedParams = await searchParams;
  const currentShift = resolvedParams.shift || 'ALL';
  const currentDept = resolvedParams.department || '';
  const currentEmpType = resolvedParams.employmentType || '';
  const currentSearch = resolvedParams.search || '';

  const [settings, allEmployees] = await Promise.all([
    getSystemSettings(),
    getEmployees(user),
  ]);

  // Only active employees on this list
  const activeStaff = allEmployees.filter((e) => e.status === 'ACTIVE');
  const departments = Array.from(new Set(activeStaff.map((e) => e.department))).filter(Boolean);

  // Overall shift counts for active employees
  const totalActiveCount = activeStaff.length;
  const morningActiveCount = activeStaff.filter((e) => getEmployeeShiftCode(e.workStartTime) === 'MORNING').length;
  const eveningActiveCount = activeStaff.filter((e) => getEmployeeShiftCode(e.workStartTime) === 'EVENING').length;

  // Apply filters
  let filteredEmployees = activeStaff;

  if (currentShift === 'MORNING') {
    filteredEmployees = filteredEmployees.filter((e) => getEmployeeShiftCode(e.workStartTime) === 'MORNING');
  } else if (currentShift === 'EVENING') {
    filteredEmployees = filteredEmployees.filter((e) => getEmployeeShiftCode(e.workStartTime) === 'EVENING');
  }

  if (currentDept) {
    filteredEmployees = filteredEmployees.filter((e) => e.department === currentDept);
  }

  if (currentEmpType) {
    filteredEmployees = filteredEmployees.filter((e) => e.employmentType === currentEmpType);
  }

  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    filteredEmployees = filteredEmployees.filter(
      (e) => e.name.toLowerCase().includes(q) || e.employeeNo.toLowerCase().includes(q)
    );
  }

  // Shift title for header
  let shiftTitle = 'جميع الورديات (الصباحية والمسائية)';
  if (currentShift === 'MORNING') shiftTitle = 'الوردية الصباحية (08:00 - 17:00)';
  if (currentShift === 'EVENING') shiftTitle = 'الوردية المسائية (17:00 - 01:00)';

  const companyName = settings?.companyName || 'شركة التقنية والحلول المتقدمة';
  const country = settings?.country || 'المملكة الأردنية الهاشمية';
  const printDate = new Date().toISOString().slice(0, 10);
  const printTime = new Date().toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' });

  // Counts for filtered list
  const permanentCount = filteredEmployees.filter((e) => e.employmentType === 'PERMANENT').length;
  const probationaryCount = filteredEmployees.filter((e) => e.employmentType === 'PROBATIONARY').length;
  const dailyWorkerCount = filteredEmployees.filter((e) => e.employmentType === 'DAILY_WORKER').length;
  const ssRegisteredCount = filteredEmployees.filter((e) => e.socialSecurityRegistered).length;

  return (
    <div className="min-h-screen bg-slate-100 py-4 px-3 flex flex-col items-center print:bg-white print:p-0 print:m-0 print:block" dir="rtl">
      {/* Print Styles for A4 Landscape Fitting */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 6mm 7mm 6mm 7mm;
          }
          
          html, body {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            font-size: 8pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .no-print, nav, header, aside, button, a {
            display: none !important;
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
            table-layout: auto !important;
            border-collapse: collapse !important;
            font-size: 7.5pt !important;
            line-height: 1.2 !important;
          }

          .print-table th, 
          .print-table td {
            padding: 3px 4px !important;
            border: 0.5pt solid #334155 !important;
          }

          .print-table th {
            font-size: 7.5pt !important;
            font-weight: 700 !important;
            background-color: #F1F5F9 !important;
          }

          .company-header {
            margin-bottom: 8px !important;
            padding-bottom: 4px !important;
            border-bottom: 1.5pt solid #0f172a !important;
          }

          .signatures-block {
            margin-top: 16px !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Action / Filter Bar (Client Component, hidden when printing) */}
      <PrintToolbar
        currentShift={currentShift}
        currentDept={currentDept}
        currentEmpType={currentEmpType}
        totalActiveCount={totalActiveCount}
        morningActiveCount={morningActiveCount}
        eveningActiveCount={eveningActiveCount}
        departments={departments}
      />

      {/* Main Printable Document */}
      <div className="print-container w-full max-w-[1300px] bg-white p-6 shadow-sm border border-slate-300 print:shadow-none print:border-none print:p-0">
        {/* Document Header */}
        <div className="company-header border-b-2 border-slate-900 pb-3 mb-3">
          <div className="flex justify-between items-start">
            <div className="text-right">
              <h1 className="text-lg font-bold text-slate-900">{companyName}</h1>
              <div className="text-xs text-slate-600 font-semibold">{country}</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">إدارة الموارد البشرية والشؤون الإدارية</div>
            </div>

            <div className="text-center">
              <div className="inline-block px-4 py-1 rounded bg-slate-100 border border-slate-300 mb-1">
                <h2 className="text-sm font-bold text-slate-900">
                  كشف الكوادر والموظفين على رأس العمل
                </h2>
              </div>
              <div className="text-xs font-bold text-blue-950 flex items-center justify-center gap-1">
                <span>البيان:</span>
                <span>{shiftTitle}</span>
                {currentDept && <span>- قسم: {currentDept}</span>}
              </div>
            </div>

            <div className="text-left text-xs space-y-0.5">
              <div className="text-slate-700">
                <span>تاريخ الإصدار: </span>
                <span className="font-mono font-bold">{printDate}</span>
              </div>
              <div className="text-slate-700">
                <span>وقت الطباعة: </span>
                <span className="font-mono">{printTime}</span>
              </div>
              <div className="text-slate-500 text-[11px]">
                <span>المستخدم: </span>
                <span>{user.fullName || user.email}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Statistical Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-3 text-xs select-none">
          <div className="p-1.5 rounded border border-slate-300 bg-slate-50 text-center">
            <div className="text-[10px] text-slate-500 font-bold">إجمالي الكشف</div>
            <div className="text-sm font-extrabold text-slate-900 font-mono">{filteredEmployees.length}</div>
          </div>
          <div className="p-1.5 rounded border border-amber-300 bg-amber-50 text-center">
            <div className="text-[10px] text-amber-800 font-bold">☀️ الوردية الصباحية</div>
            <div className="text-sm font-extrabold text-amber-900 font-mono">
              {filteredEmployees.filter((e) => getEmployeeShiftCode(e.workStartTime) === 'MORNING').length}
            </div>
          </div>
          <div className="p-1.5 rounded border border-indigo-300 bg-indigo-50 text-center">
            <div className="text-[10px] text-indigo-800 font-bold">🌙 الوردية المسائية</div>
            <div className="text-sm font-extrabold text-indigo-900 font-mono">
              {filteredEmployees.filter((e) => getEmployeeShiftCode(e.workStartTime) === 'EVENING').length}
            </div>
          </div>
          <div className="p-1.5 rounded border border-emerald-300 bg-emerald-50 text-center">
            <div className="text-[10px] text-emerald-800 font-bold">مثبتون</div>
            <div className="text-sm font-extrabold text-emerald-900 font-mono">{permanentCount}</div>
          </div>
          <div className="p-1.5 rounded border border-blue-300 bg-blue-50 text-center">
            <div className="text-[10px] text-blue-800 font-bold">فترة تجريبية</div>
            <div className="text-sm font-extrabold text-blue-900 font-mono">{probationaryCount}</div>
          </div>
          <div className="p-1.5 rounded border border-purple-300 bg-purple-50 text-center">
            <div className="text-[10px] text-purple-800 font-bold">مسجل بالضمان</div>
            <div className="text-sm font-extrabold text-purple-900 font-mono">{ssRegisteredCount}</div>
          </div>
        </div>

        {/* Printable Employees Table */}
        <div className="overflow-x-auto">
          <table className="print-table w-full text-right text-xs border border-slate-700">
            <thead>
              <tr className="bg-slate-100 text-slate-900 border-b border-slate-700">
                <th className="w-8 text-center">#</th>
                <th className="w-16">الرقم</th>
                <th>اسم الموظف</th>
                <th className="w-24">القسم</th>
                <th className="w-28">المسمى الوظيفي</th>
                <th className="w-24">الوردية</th>
                <th className="w-28">الدوام المعتمد</th>
                <th className="w-16 text-center">نوع العقد</th>
                <th className="w-24">الضمان الاجتماعي</th>
                <th className="w-24">رقم الهاتف</th>
                <th className="w-20">المباشرة</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-6 text-center text-slate-500 font-bold">
                    لا يوجد موظفون مطابقون لشروط التصفية المحددة في هذا الكشف
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp, index) => {
                  const empShift = getEmployeeShift(emp.workStartTime);
                  const startTime = emp.workStartTime ? emp.workStartTime.slice(0, 5) : '08:00';
                  const endTime = emp.workEndTime
                    ? emp.workEndTime.slice(0, 5)
                    : empShift.code === 'EVENING'
                    ? '01:00'
                    : '17:00';

                  return (
                    <tr key={emp.id} className="border-b border-slate-300 hover:bg-slate-50">
                      <td className="text-center font-mono font-bold text-slate-600">{index + 1}</td>
                      <td className="font-mono font-bold text-slate-900">{emp.employeeNo}</td>
                      <td className="font-bold text-slate-900">{emp.name}</td>
                      <td className="text-slate-700">{emp.department}</td>
                      <td className="text-slate-700">{emp.jobTitle}</td>
                      <td>
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.2 text-[10px] font-bold rounded border ${empShift.badgeBg} ${empShift.badgeText} ${empShift.badgeBorder} whitespace-nowrap`}
                        >
                          <span>{empShift.icon}</span>
                          <span>{empShift.shortName}</span>
                        </span>
                      </td>
                      <td className="font-mono text-[11px] text-slate-700 whitespace-nowrap">
                        {startTime} - {endTime}
                      </td>
                      <td className="text-center">
                        <span className="text-[10px] font-semibold text-slate-800">
                          {emp.employmentType === 'DAILY_WORKER'
                            ? 'مياومة'
                            : emp.employmentType === 'PROBATIONARY'
                            ? 'تجريبي'
                            : 'مثبت'}
                        </span>
                      </td>
                      <td>
                        {emp.socialSecurityRegistered ? (
                          <span className="text-emerald-800 font-semibold text-[10px]">
                            ✓ مسجل {emp.socialSecurityRegistrationDate ? `(${emp.socialSecurityRegistrationDate})` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">غير مسجل</span>
                        )}
                      </td>
                      <td className="font-mono text-[10px] text-slate-700" dir="ltr">
                        {emp.phone || '-'}
                      </td>
                      <td className="font-mono text-[10px] text-slate-700">{emp.startDate}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Signatures & Certification Block */}
        <div className="signatures-block mt-8 pt-4 border-t border-slate-400">
          <div className="grid grid-cols-3 gap-6 text-center text-xs">
            <div>
              <div className="text-slate-700 font-bold mb-8">إعداد وتنظيم: شؤون الموظفين</div>
              <div className="border-t border-dashed border-slate-400 pt-1 font-semibold text-slate-500">
                التوقيع: ............................
              </div>
            </div>

            <div>
              <div className="text-slate-700 font-bold mb-8">تدقيق: الإدارة المالية</div>
              <div className="border-t border-dashed border-slate-400 pt-1 font-semibold text-slate-500">
                التوقيع: ............................
              </div>
            </div>

            <div>
              <div className="text-slate-700 font-bold mb-8">اعتماد: المدير العام / المفوض</div>
              <div className="border-t border-dashed border-slate-400 pt-1 font-semibold text-slate-500">
                الختم والتوقيع: ............................
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
