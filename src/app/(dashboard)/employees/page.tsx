import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getEmployees, createEmployee } from '@/lib/services/employee-service';
import { Badge } from '@/components/ui';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { CreateEmployeeModal } from '@/components/employee/CreateEmployeeModal';

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    department?: string;
    status?: 'ACTIVE' | 'TERMINATED';
    socialSecurity?: 'REGISTERED' | 'NOT_REGISTERED';
    employmentType?: 'PERMANENT' | 'DAILY_WORKER';
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const resolvedSearchParams = await searchParams;

  // Fetch counts for Active vs Archived staff
  const allEmployeesForCount = await getEmployees(user);
  const activeCount = allEmployeesForCount.filter((e) => e.status === 'ACTIVE').length;
  const archivedCount = allEmployeesForCount.filter((e) => e.status === 'TERMINATED').length;

  let employees = await getEmployees(user, {
    search: resolvedSearchParams.search,
    department: resolvedSearchParams.department,
    status: resolvedSearchParams.status,
  });

  // Filter in-memory for extended social security & employment type filters if needed
  if (resolvedSearchParams.socialSecurity === 'REGISTERED') {
    employees = employees.filter((e) => e.socialSecurityRegistered);
  } else if (resolvedSearchParams.socialSecurity === 'NOT_REGISTERED') {
    employees = employees.filter((e) => !e.socialSecurityRegistered);
  }

  if (resolvedSearchParams.employmentType) {
    employees = employees.filter((e) => e.employmentType === resolvedSearchParams.employmentType);
  }

  async function handleCreateEmployee(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    const empType = (formData.get('employmentType') as 'PERMANENT' | 'DAILY_WORKER') || 'PERMANENT';
    const ssRegistered = formData.get('socialSecurityRegistered') === 'true';
    const ssDate = formData.get('socialSecurityRegistrationDate') as string;

    const dailyRateRaw = formData.get('dailyRate') as string;
    const monthlyBasicRaw = formData.get('monthlyBasic') as string;
    const monthlyAllowancesRaw = formData.get('monthlyAllowances') as string;
    const minDeductionRaw = formData.get('minuteDeductionRate') as string;
    const breakMinsRaw = formData.get('breakMinutes') as string;

    const contractSigned = formData.get('contractSigned') === 'true';
    const contractSignedDate = (formData.get('contractSignedDate') as string) || null;

    await createEmployee(currentUser, {
      employeeNo: formData.get('employeeNo') as string,
      name: formData.get('name') as string,
      department: formData.get('department') as string,
      jobTitle: formData.get('jobTitle') as string,
      phone: (formData.get('phone') as string) || undefined,
      startDate: formData.get('startDate') as string,
      endDate: (formData.get('endDate') as string) || undefined,
      socialSecurityRegistered: ssRegistered,
      socialSecurityRegistrationDate: ssRegistered ? (ssDate || null) : null,
      employmentType: empType,
      dailyRate: dailyRateRaw ? parseFloat(dailyRateRaw) : undefined,
      monthlyBasic: monthlyBasicRaw ? parseFloat(monthlyBasicRaw) : undefined,
      monthlyAllowances: monthlyAllowancesRaw ? parseFloat(monthlyAllowancesRaw) : undefined,
      temporaryStartDate: (formData.get('temporaryStartDate') as string) || undefined,
      temporaryEndDate: (formData.get('temporaryEndDate') as string) || undefined,
      minuteDeductionRate: minDeductionRaw ? parseFloat(minDeductionRaw) : undefined,
      workStartTime: (formData.get('workStartTime') as string) || undefined,
      workEndTime: (formData.get('workEndTime') as string) || undefined,
      breakMinutes: breakMinsRaw ? parseInt(breakMinsRaw, 10) : undefined,
      contractSigned,
      contractSignedDate: contractSigned ? (contractSignedDate || (formData.get('startDate') as string)) : null,
    });

    revalidatePath('/employees');
  }

  const isArchivedView = resolvedSearchParams.status === 'TERMINATED';

  return (
    <div className="space-y-3 select-none">
      {/* Page Titlebar Header & Actions */}
      <div className="win-raised p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#ECE9D8]">
        <div>
          <h1 className="text-sm font-bold text-black flex items-center gap-1.5">
            <span>👥</span>
            <span>دليل الموظفين العام - سجل الكوادر والعقود</span>
          </h1>
          <p className="text-[#505050] text-[11px] mt-0.5">
            إدارة البيانات الأساسية، الضمان الاجتماعي، عقود التثبيت والمياومة، والهويات الشخصية والأرشفة
          </p>
        </div>

        {['ADMIN', 'HR'].includes(user.role) && (
          <CreateEmployeeModal createEmployeeAction={handleCreateEmployee} />
        )}
      </div>

      {/* Section Tabs: Active Staff vs Archived Staff */}
      <div className="flex items-center gap-1 border-b-2 border-[#808080] pt-1 px-1 overflow-x-auto">
        <Link
          href="/employees?status=ACTIVE"
          className={`px-3 py-1.5 text-xs font-bold border-t-2 border-l-2 border-r-2 rounded-t flex items-center gap-1.5 transition-none ${
            !isArchivedView
              ? 'bg-[#ECE9D8] border-[#FFFFFF] border-r-[#808080] text-[#0A246A] -mb-[2px] pb-2'
              : 'bg-[#D4D0C8] border-[#808080] text-slate-700 hover:bg-[#E0DDD5]'
          }`}
        >
          <span>🟢</span>
          <span>الموظفون على رأس العمل (نشطون)</span>
          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold">
            {activeCount}
          </span>
        </Link>

        <Link
          href="/employees?status=TERMINATED"
          className={`px-3 py-1.5 text-xs font-bold border-t-2 border-l-2 border-r-2 rounded-t flex items-center gap-1.5 transition-none ${
            isArchivedView
              ? 'bg-[#ECE9D8] border-[#FFFFFF] border-r-[#808080] text-[#0A246A] -mb-[2px] pb-2'
              : 'bg-[#D4D0C8] border-[#808080] text-slate-700 hover:bg-[#E0DDD5]'
          }`}
        >
          <span>📁</span>
          <span>أرشيف الموظفين (المنتهية خدمتهم)</span>
          <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold">
            {archivedCount}
          </span>
        </Link>
      </div>

      {/* Filter / Search Bar */}
      <div className="win-raised p-2 bg-[#ECE9D8]">
        <form method="GET" className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-black mb-0.5">بحث سريع</label>
            <input
              name="search"
              defaultValue={resolvedSearchParams.search || ''}
              placeholder="بالاسم أو الرقم الوظيفي..."
              className="win-input w-full py-1 px-2"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-black mb-0.5">نوع التوظيف</label>
            <select
              name="employmentType"
              defaultValue={resolvedSearchParams.employmentType || ''}
              className="win-input w-full py-1 px-2"
            >
              <option value="">جميع الأنواع</option>
              <option value="PERMANENT">موظف مثبت / دائم</option>
              <option value="DAILY_WORKER">عامل مياومة</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-black mb-0.5">الضمان الاجتماعي</label>
            <select
              name="socialSecurity"
              defaultValue={resolvedSearchParams.socialSecurity || ''}
              className="win-input w-full py-1 px-2"
            >
              <option value="">الكل (مسجل وغير مسجل)</option>
              <option value="REGISTERED">مسجل في الضمان</option>
              <option value="NOT_REGISTERED">غير مسجل في الضمان</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-black mb-0.5">تصفية الحالة</label>
            <select
              name="status"
              defaultValue={resolvedSearchParams.status || ''}
              className="win-input w-full py-1 px-2"
            >
              <option value="">جميع الحالات</option>
              <option value="ACTIVE">على رأس العمل (نشط)</option>
              <option value="TERMINATED">منتهية خدمته (أرشيف)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="win-btn w-full py-1 font-bold text-xs flex items-center justify-center gap-1"
            >
              <span>🔍</span>
              <span>تطبيق التصفية</span>
            </button>
          </div>
        </form>
      </div>

      {/* Employees High-Density Table */}
      <div className="win-sunken bg-white overflow-x-auto">
        <table className="win-table w-full text-right text-xs">
          <thead>
            <tr>
              <th className="w-20">الرقم</th>
              <th>اسم الموظف</th>
              <th className="w-28">القسم</th>
              <th className="w-28">المسمى الوظيفي</th>
              <th className="w-24">نوع التوظيف</th>
              <th className="w-36">الضمان الاجتماعي</th>
              <th className="w-24">تاريخ المباشرة</th>
              {isArchivedView && <th className="w-24">نهاية الخدمة</th>}
              <th className="w-20">الحالة</th>
              <th className="w-24 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={isArchivedView ? 10 : 9} className="py-6 text-center text-[#808080]">
                  لا يوجد موظفون مطابقون لشروط التصفية المحددة
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-[#E8EEF7]">
                  <td className="font-mono font-bold">{emp.employeeNo}</td>
                  <td className="font-bold text-[#0A246A]">
                    <Link
                      href={`/employees/${emp.id}`}
                      className="hover:underline flex items-center gap-1"
                    >
                      <span>{emp.name}</span>
                    </Link>
                  </td>
                  <td className="text-slate-700">{emp.department}</td>
                  <td className="text-slate-700">{emp.jobTitle}</td>
                  <td>
                    <span
                      className={`px-1 py-0.5 text-[10px] font-bold ${
                        emp.employmentType === 'DAILY_WORKER'
                          ? 'bg-amber-100 text-amber-900 border border-amber-400'
                          : 'bg-blue-50 text-blue-900 border border-blue-300'
                      }`}
                    >
                      {emp.employmentType === 'DAILY_WORKER' ? 'مياومة' : 'مثبت'}
                    </span>
                  </td>
                  <td>
                    {emp.socialSecurityRegistered ? (
                      <div className="text-[11px] text-emerald-800 font-bold flex items-center gap-1">
                        <span>✓ مسجل</span>
                        {emp.socialSecurityRegistrationDate && (
                          <span className="text-[10px] text-slate-500 font-mono font-normal">
                            ({emp.socialSecurityRegistrationDate})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">غير مسجل</span>
                    )}
                  </td>
                  <td className="font-mono text-[11px]">{emp.startDate}</td>
                  {isArchivedView && (
                    <td className="font-mono text-[11px] text-rose-800 font-bold">
                      {emp.endDate || '-'}
                    </td>
                  )}
                  <td>
                    <Badge variant={emp.status === 'ACTIVE' ? 'active' : 'rejected'}>
                      {emp.status === 'ACTIVE' ? 'نشط' : 'أرشيف'}
                    </Badge>
                  </td>
                  <td className="text-center">
                    <Link
                      href={`/employees/${emp.id}`}
                      className="win-btn text-[11px] px-2 py-0.5 font-bold text-[#0A246A]"
                    >
                      فتح الملف
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

