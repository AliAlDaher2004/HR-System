import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getPayrolls, createPayrollDraft, generateBulkPayrollDrafts, updatePayrollDraft } from '@/lib/services/payroll-service';
import { getEmployees } from '@/lib/services/employee-service';
import { Badge } from '@/components/ui';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { RBAC } from '@/lib/auth/rbac';
import { CreatePayrollDraftModal } from '@/components/payroll/CreatePayrollDraftModal';
import { BulkGeneratePayrollModal } from '@/components/payroll/BulkGeneratePayrollModal';
import { ExportPayrollExcelButton } from '@/components/payroll/ExportPayrollExcelButton';
import { EditPayrollDraftModal } from '@/components/payroll/EditPayrollDraftModal';
import { PayrollSummaryCards } from '@/components/payroll/PayrollSummaryCards';

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; employeeId?: string; status?: 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED' }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!RBAC.canManagePayroll(user.role)) {
    redirect('/');
  }

  const resolvedParams = await searchParams;
  const employees = await getEmployees(user);
  const payrolls = await getPayrolls(user, {
    month: resolvedParams.month,
    employeeId: resolvedParams.employeeId,
    status: resolvedParams.status,
  });

  // Calculate summary category totals across filtered payrolls
  let totalBasicAndAllowances = 0;
  let totalOvertimeAndAdditions = 0;
  let totalLateDeductions = 0;
  let totalEarlyDepartureDeductions = 0;
  let totalDeductions = 0;
  let grandTotalNetPay = 0;
  let totalBasicEarnedColumn = 0;
  let totalOtTotalColumn = 0;
  const currency = payrolls[0]?.currency || 'JOD';

  payrolls.forEach((p: any) => {
    const net = p.netPay ? Number(p.netPay) : Number(p.netPreview || 0);
    const basicEarnedVal = p.employmentType === 'DAILY_WORKER'
      ? Number(p.dailyRate || 0) * Number(p.workedDays || 0)
      : Number(p.basicEarned || 0);
    const allowancesVal = Number(p.allowancesEarned || 0);
    const otTotalVal = Number(p.otTotal || 0);
    const otherAdditionsVal = Number(p.otherAdditions || 0);
    const lateVal = Number(p.lateDeductions || 0);
    const earlyVal = Number(p.earlyDepartureDeductions || 0);
    const totalDedVal = Number(p.totalDeductions || 0);

    totalBasicAndAllowances += basicEarnedVal + allowancesVal;
    totalOvertimeAndAdditions += otTotalVal + otherAdditionsVal;
    totalLateDeductions += lateVal;
    totalEarlyDepartureDeductions += earlyVal;
    totalDeductions += totalDedVal;
    grandTotalNetPay += net;

    totalBasicEarnedColumn += basicEarnedVal;
    totalOtTotalColumn += otTotalVal;
  });

  const summaryTotals = {
    totalBasicAndAllowances,
    totalOvertimeAndAdditions,
    totalDeductions,
    grandTotalNetPay,
    currency,
    totalEmployeesCount: payrolls.length,
  };

  const printParams = new URLSearchParams();
  if (resolvedParams.month) printParams.set('month', resolvedParams.month);
  if (resolvedParams.employeeId) printParams.set('employeeId', resolvedParams.employeeId);
  if (resolvedParams.status) printParams.set('status', resolvedParams.status);
  const batchPrintHref = `/payroll/payslips-batch${printParams.toString() ? `?${printParams.toString()}` : ''}`;

  async function handleCreatePayrollDraft(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    const [year, month] = (formData.get('monthPeriod') as string).split('-').map(Number);

    await createPayrollDraft(currentUser, {
      employeeId: formData.get('employeeId') as string,
      year,
      month,
      otherAdditions: parseFloat((formData.get('otherAdditions') as string) || '0'),
      otherDeductions: parseFloat((formData.get('otherDeductions') as string) || '0'),
      notes: (formData.get('notes') as string) || undefined,
    });

    revalidatePath('/payroll');
  }

  async function handleUpdatePayrollDraft(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    await updatePayrollDraft(currentUser, {
      payrollId: formData.get('payrollId') as string,
      otherAdditions: parseFloat((formData.get('otherAdditions') as string) || '0'),
      otherDeductions: parseFloat((formData.get('otherDeductions') as string) || '0'),
      unpaidDays: parseFloat((formData.get('unpaidDays') as string) || '0'),
      earlyDepartureMinutes: parseInt((formData.get('earlyDepartureMinutes') as string) || '0', 10),
      lateMinutes: parseInt((formData.get('lateMinutes') as string) || '0', 10),
      otHours: parseFloat((formData.get('otHours') as string) || '0'),
      notes: (formData.get('notes') as string) || undefined,
    });

    revalidatePath('/payroll');
  }

  async function handleBulkGeneratePayroll(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    const monthPeriod = (formData.get('monthPeriod') as string) || new Date().toISOString().slice(0, 7);
    const [year, month] = monthPeriod.split('-').map(Number);

    const res = await generateBulkPayrollDrafts(currentUser, { year, month });
    revalidatePath('/payroll');
    return res;
  }

  return (
    <div className="space-y-3 select-none">
      {/* Page Titlebar Header */}
      <div className="win-raised p-2 flex flex-col md:flex-row md:items-center justify-between gap-2 bg-[#ECE9D8]">
        <div>
          <h1 className="text-sm font-bold text-black flex items-center gap-1.5">
            <span>💵</span>
            <span>مسيرات الرواتب والأجور الشهرية</span>
          </h1>
          <p className="text-[#505050] text-[11px] mt-0.5">
            احتساب رواتب المثبتين وعمال المياومة، خصومات الدقائق، والاعتماد المالي النهائي
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={batchPrintHref}
            className="win-btn font-bold text-xs px-2.5 py-1 flex items-center gap-1 text-[#0A246A]"
          >
            <span>🖨️</span>
            <span>طباعة قسائم الرواتب للجميع</span>
          </Link>

          <BulkGeneratePayrollModal
            currentMonth={resolvedParams.month}
            bulkGenerateAction={handleBulkGeneratePayroll}
          />

          <ExportPayrollExcelButton
            currentMonth={resolvedParams.month}
          />

          <CreatePayrollDraftModal
            employees={employees}
            createPayrollDraftAction={handleCreatePayrollDraft}
          />
        </div>
      </div>

      {/* Category Totals Metric Cards */}
      <PayrollSummaryCards totals={summaryTotals} />

      {/* Filter Bar */}
      <div className="win-raised p-2 bg-[#ECE9D8]">
        <form method="GET" className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-black mb-0.5">الشهر المستهدف</label>
            <input
              name="month"
              type="month"
              defaultValue={resolvedParams.month || ''}
              className="win-input w-full py-1 px-2"
            />
          </div>

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
                  {e.name} ({e.employmentType === 'DAILY_WORKER' ? 'مياومة' : 'مثبت'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-black mb-0.5">حالة المسير</label>
            <select
              name="status"
              defaultValue={resolvedParams.status || ''}
              className="win-input w-full py-1 px-2"
            >
              <option value="">جميع الحالات</option>
              <option value="DRAFT">مسودة (DRAFT)</option>
              <option value="APPROVED">معتمد (APPROVED)</option>
              <option value="PAID">مدفوع (PAID)</option>
              <option value="CANCELLED">ملغى (CANCELLED)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="win-btn w-full py-1 font-bold text-xs flex items-center justify-center gap-1"
            >
              <span>🔍</span>
              <span>تصفية المسيرات</span>
            </button>
          </div>
        </form>
      </div>

      {/* High-density Payroll Table */}
      <div className="win-sunken bg-white overflow-x-auto">
        <table className="win-table w-full text-right text-xs">
          <thead>
            <tr>
              <th className="w-24">الفترة</th>
              <th>اسم الموظف</th>
              <th className="w-20">النوع</th>
              <th className="w-24">القسم</th>
              <th className="w-24">الأساسي/الأجر</th>
              <th className="w-20">الإضافي</th>
              <th className="w-24">خصم التأخير</th>
              <th className="w-24">خصم المغادرة</th>
              <th className="w-24">الاستقطاعات</th>
              <th className="w-24">صافي الراتب</th>
              <th className="w-20">الحالة</th>
              <th className="w-20 text-center">الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {payrolls.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-6 text-center text-[#808080]">
                  لا توجد مسيرات رواتب مسجلة مطابقة لشروط البحث
                </td>
              </tr>
            ) : (
              payrolls.map((p: any) => {
                const net = p.netPay ? Number(p.netPay) : Number(p.netPreview || 0);
                return (
                  <tr key={p.id} className="hover:bg-[#E8EEF7]">
                    <td className="font-mono font-bold">
                      {p.periodStart.slice(0, 7)}
                    </td>
                    <td className="font-bold text-[#0A246A]">
                      <Link href={`/payroll/${p.id}`} className="hover:underline">
                        {p.employeeName}
                      </Link>
                    </td>
                    <td>
                      <span
                        className={`px-1 py-0.5 text-[10px] font-bold ${
                          p.employmentType === 'DAILY_WORKER'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-blue-50 text-blue-900 border border-blue-200'
                        }`}
                      >
                        {p.employmentType === 'DAILY_WORKER' ? 'مياومة' : 'مثبت'}
                      </span>
                    </td>
                    <td className="text-slate-700">{p.department}</td>
                    <td className="font-mono font-semibold">
                      {p.employmentType === 'DAILY_WORKER'
                        ? `${Number(p.dailyRate || 0).toFixed(3)} × ${p.workedDays || 0}ي`
                        : Number(p.basicEarned).toFixed(3)}
                    </td>
                    <td className="font-mono text-emerald-800">
                      +{Number(p.otTotal).toFixed(3)}
                    </td>
                    <td className="font-mono text-amber-900">
                      {Number(p.lateDeductions || 0) > 0 ? `-${Number(p.lateDeductions).toFixed(3)}` : '0.000'}
                    </td>
                    <td className="font-mono text-blue-900">
                      {Number(p.earlyDepartureDeductions || 0) > 0 ? `-${Number(p.earlyDepartureDeductions).toFixed(3)}` : '0.000'}
                    </td>
                    <td className="font-mono text-rose-800">
                      -{Number(p.totalDeductions).toFixed(3)}
                    </td>
                    <td className="font-mono font-bold text-emerald-800 text-sm">
                      {net.toFixed(3)}
                    </td>
                    <td>
                      <Badge
                        variant={
                          p.status === 'PAID'
                            ? 'active'
                            : p.status === 'APPROVED'
                            ? 'approved'
                            : p.status === 'DRAFT'
                            ? 'draft'
                            : 'rejected'
                        }
                      >
                        {p.status === 'PAID'
                          ? 'مدفوع'
                          : p.status === 'APPROVED'
                          ? 'معتمد'
                          : p.status === 'DRAFT'
                          ? 'مسودة'
                          : 'ملغى'}
                      </Badge>
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {p.status === 'DRAFT' && (
                          <EditPayrollDraftModal
                            payroll={p}
                            updatePayrollDraftAction={handleUpdatePayrollDraft}
                            buttonVariant="icon"
                          />
                        )}
                        <Link
                          href={`/payroll/${p.id}`}
                          className="win-btn text-[11px] px-2 py-0.5 font-bold text-[#0A246A]"
                        >
                          عرض
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {payrolls.length > 0 && (
            <tfoot className="bg-[#ECE9D8] font-bold text-xs border-t-2 border-[#0A246A]">
              <tr>
                <td colSpan={4} className="py-2 px-3 text-[#0A246A]">
                  الإجمالي العام ({payrolls.length} مسير):
                </td>
                <td className="font-mono text-black">
                  {totalBasicEarnedColumn.toFixed(3)}
                </td>
                <td className="font-mono text-emerald-800">
                  +{totalOtTotalColumn.toFixed(3)}
                </td>
                <td className="font-mono text-amber-900">
                  {totalLateDeductions > 0 ? `-${totalLateDeductions.toFixed(3)}` : '0.000'}
                </td>
                <td className="font-mono text-blue-900">
                  {totalEarlyDepartureDeductions > 0 ? `-${totalEarlyDepartureDeductions.toFixed(3)}` : '0.000'}
                </td>
                <td className="font-mono text-rose-800">
                  -{totalDeductions.toFixed(3)}
                </td>
                <td className="font-mono font-black text-emerald-900 text-sm">
                  {grandTotalNetPay.toFixed(3)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

