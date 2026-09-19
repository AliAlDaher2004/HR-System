import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getPayrolls, createPayrollDraft, generateBulkPayrollDrafts, updatePayrollDraft, deletePayrollRun, approveBulkPayrollForMonth } from '@/lib/services/payroll-service';
import { getEmployees } from '@/lib/services/employee-service';
import { Badge } from '@/components/ui';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { RBAC } from '@/lib/auth/rbac';
import { CreatePayrollDraftModal } from '@/components/payroll/CreatePayrollDraftModal';
import { BulkGeneratePayrollModal } from '@/components/payroll/BulkGeneratePayrollModal';
import { ExportPayrollExcelButton } from '@/components/payroll/ExportPayrollExcelButton';
import { EditPayrollDraftModal } from '@/components/payroll/EditPayrollDraftModal';
import { DeletePayrollModal } from '@/components/payroll/DeletePayrollModal';
import { PayrollSummaryCards } from '@/components/payroll/PayrollSummaryCards';
import { SaveMonthlyStatementModal } from '@/components/payroll/SaveMonthlyStatementModal';

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
  let totalBasicEarned = 0;
  let totalTransport = 0;
  let totalGratuities = 0;
  let totalOtHours = 0;
  let totalOtTotal = 0;
  let totalGrossPay = 0;
  let totalSocialSecurity = 0;
  let totalLoans = 0;
  let totalUnpaidDays = 0;
  let totalUnpaidDeduction = 0;
  let totalEarlyDepartureHours = 0;
  let totalEarlyDepartureDeduction = 0;
  let totalLateHours = 0;
  let totalLateDeduction = 0;
  let totalOtherDeductions = 0;
  let totalDeductions = 0;
  let grandTotalNetPay = 0;

  let totalBasicAndAllowances = 0;
  let totalOvertimeAndAdditions = 0;
  let totalLateDeductions = 0;
  let totalEarlyDepartureDeductions = 0;
  const currency = payrolls[0]?.currency || 'JOD';

  payrolls.forEach((p: any) => {
    const isDailyWorker = p.employmentType === 'DAILY_WORKER';
    const basicEarnedVal = isDailyWorker
      ? Number(p.dailyRate || 0) * Number(p.workedDays || 0)
      : Number(p.basicEarned || 0);

    const unpaidDaysVal = Number(p.unpaidDays || 0);
    const transportVal = isDailyWorker ? 0 : Math.max(0, 30 - unpaidDaysVal);
    const gratuitiesVal = Number(p.gratuities || 0);
    const otHoursVal = Number(p.otHours || 0);
    const calculatedOtRate = basicEarnedVal > 0 ? ((basicEarnedVal / 26) / 9) * 2 : 0;
    const otRateVal = Number(p.otRate || 0) > 0 && Number(p.otRate || 0) !== 2.5 ? Number(p.otRate) : calculatedOtRate;
    const otTotalVal = p.otTotal !== undefined && Number(p.otTotal) > 0 ? Number(p.otTotal) : Math.round(otHoursVal * otRateVal * 100) / 100;
    const grossPayVal = basicEarnedVal + transportVal + gratuitiesVal + otTotalVal;

    const isSocialSecurity = Boolean(p.socialSecurityRegistered);
    const socialSecurityVal = isSocialSecurity ? Math.round(basicEarnedVal * 0.075 * 100) / 100 : 0;
    const loansVal = Number(p.loanDeduction || 0);
    const unpaidDeductionVal = Number(p.unpaidDeduction || 0);

    const earlyDepartureMinutes = Number(p.earlyDepartureMinutes || 0);
    const earlyDepartureHoursVal = Math.round((earlyDepartureMinutes / 60) * 100) / 100;
    const earlyDepartureDeductionVal = Number(p.earlyDepartureDeduction || p.earlyDepartureDeductions || 0);

    const lateMinutes = Number(p.lateMinutes || 0);
    const lateHoursVal = Math.round((lateMinutes / 60) * 100) / 100;
    const lateDeductionVal = Number(p.lateDeduction || p.lateDeductions || 0);

    const otherDeductionsVal = Number(p.otherDeductions || 0);
    const totalDeductionsVal = socialSecurityVal + loansVal + unpaidDeductionVal + earlyDepartureDeductionVal + lateDeductionVal + otherDeductionsVal;
    const netVal = p.netPay ? Number(p.netPay) : grossPayVal - totalDeductionsVal;

    totalBasicEarned += basicEarnedVal;
    totalTransport += transportVal;
    totalGratuities += gratuitiesVal;
    totalOtHours += otHoursVal;
    totalOtTotal += otTotalVal;
    totalGrossPay += grossPayVal;
    totalSocialSecurity += socialSecurityVal;
    totalLoans += loansVal;
    totalUnpaidDays += unpaidDaysVal;
    totalUnpaidDeduction += unpaidDeductionVal;
    totalEarlyDepartureHours += earlyDepartureHoursVal;
    totalEarlyDepartureDeduction += earlyDepartureDeductionVal;
    totalLateHours += lateHoursVal;
    totalLateDeduction += lateDeductionVal;
    totalOtherDeductions += otherDeductionsVal;
    totalDeductions += totalDeductionsVal;
    grandTotalNetPay += netVal;

    totalBasicAndAllowances += basicEarnedVal + transportVal;
    totalOvertimeAndAdditions += otTotalVal + gratuitiesVal;
    totalLateDeductions += lateDeductionVal;
    totalEarlyDepartureDeductions += earlyDepartureDeductionVal;
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

  async function handleDeletePayrollRun(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    const payrollId = formData.get('payrollId') as string;
    await deletePayrollRun(currentUser, payrollId);
    revalidatePath('/payroll');
  }

  async function handleApproveMonthlyStatement(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    const month = formData.get('month') as string;
    if (!month) throw new Error('الشهر المستهدف مفقود');

    const res = await approveBulkPayrollForMonth(currentUser, month);
    revalidatePath('/payroll');
    revalidatePath('/payroll/consolidated');
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
            href={`/payroll/consolidated${resolvedParams.month ? `?month=${resolvedParams.month}` : ''}`}
            className="win-btn font-bold text-xs px-2.5 py-1 flex items-center gap-1 text-[#0A246A] bg-blue-50 border border-blue-300"
          >
            <span>📊</span>
            <span>عرض بيان الرواتب المجمع (بيان رواتب)</span>
          </Link>

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

          <SaveMonthlyStatementModal
            currentMonth={resolvedParams.month}
            draftCount={payrolls.filter((p: any) => p.status === 'DRAFT').length}
            totalNetPay={grandTotalNetPay}
            approveMonthlyStatementAction={handleApproveMonthlyStatement}
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

      {/* High-density Payroll Table - Fitted with smooth horizontal scrolling & fixed action bar */}
      <div className="win-sunken bg-white w-full overflow-x-auto">
        <table className="win-table w-full text-center text-[8.5px] md:text-[9px] border-collapse table-fixed tracking-tighter min-w-[1450px]">
          <colgroup>
            {[
              <col key="1" style={{ width: '4.0%' }} />,
              <col key="2" style={{ width: '9.0%' }} />,
              <col key="3" style={{ width: '3.5%' }} />,
              <col key="4" style={{ width: '4.5%' }} />,
              <col key="5" style={{ width: '4.5%' }} />,
              <col key="6" style={{ width: '3.5%' }} />,
              <col key="7" style={{ width: '3.5%' }} />,
              <col key="8" style={{ width: '3.0%' }} />,
              <col key="9" style={{ width: '4.0%' }} />,
              <col key="10" style={{ width: '5.5%' }} />,
              <col key="11" style={{ width: '4.0%' }} />,
              <col key="12" style={{ width: '3.5%' }} />,
              <col key="13" style={{ width: '3.0%' }} />,
              <col key="14" style={{ width: '4.0%' }} />,
              <col key="15" style={{ width: '3.0%' }} />,
              <col key="16" style={{ width: '4.0%' }} />,
              <col key="17" style={{ width: '3.0%' }} />,
              <col key="18" style={{ width: '4.0%' }} />,
              <col key="19" style={{ width: '3.5%' }} />,
              <col key="20" style={{ width: '5.5%' }} />,
              <col key="21" style={{ width: '5.5%' }} />,
              <col key="22" style={{ width: '3.5%' }} />,
              <col key="23" style={{ width: '9.0%' }} />,
            ]}
          </colgroup>
          <thead>
            <tr className="bg-[#ECE9D8] text-[#0A246A] font-bold border-b border-[#D4D0C8] text-[8.5px] leading-tight">
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">الفترة</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">اسم الموظف</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">النوع</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">القسم</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">الأساسي</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">مواصلات</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">اكراميات</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">س.إضافي</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">بدل إضافي</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-blue-50 text-blue-900">إجمالي الراتب</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">ضمان</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">السلف</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">أيام غياب</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">خصم غياب</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">س.مغادرة</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">خصم مغادرة</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">س.تأخير</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">خصم تأخير</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">خصم آخر</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-amber-50 text-rose-900">إجمالي الخصومات</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-[#0A246A] text-white">صافي الراتب</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">الحالة</th>
              <th className="sticky left-0 bg-[#D4D0C8] text-[#0A246A] z-20 py-1 px-1 text-center whitespace-nowrap font-bold border-r border-[#808080] shadow-[-2px_0_5px_rgba(0,0,0,0.15)] min-w-[135px] w-[135px]">الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {payrolls.length === 0 ? (
              <tr>
                <td colSpan={23} className="py-6 text-center text-[#808080]">
                  لا توجد مسيرات رواتب مسجلة مطابقة لشروط البحث
                </td>
              </tr>
            ) : (
              payrolls.map((p: any) => {
                const isDailyWorker = p.employmentType === 'DAILY_WORKER';
                const basicEarnedVal = isDailyWorker
                  ? Number(p.dailyRate || 0) * Number(p.workedDays || 0)
                  : Number(p.basicEarned || 0);

                const unpaidDaysVal = Number(p.unpaidDays || 0);
                const transportVal = isDailyWorker ? 0 : Math.max(0, 30 - unpaidDaysVal);
                const gratuitiesVal = Number(p.gratuities || 0);
                const otHoursVal = Number(p.otHours || 0);
                const calculatedOtRate = basicEarnedVal > 0 ? ((basicEarnedVal / 26) / 9) * 2 : 0;
                const otRateVal = Number(p.otRate || 0) > 0 && Number(p.otRate || 0) !== 2.5 ? Number(p.otRate) : calculatedOtRate;
                const otTotalVal = p.otTotal !== undefined && Number(p.otTotal) > 0 ? Number(p.otTotal) : Math.round(otHoursVal * otRateVal * 100) / 100;
                const grossPayVal = basicEarnedVal + transportVal + gratuitiesVal + otTotalVal;

                const isSocialSecurity = Boolean(p.socialSecurityRegistered);
                const socialSecurityVal = isSocialSecurity ? Math.round(basicEarnedVal * 0.075 * 100) / 100 : 0;
                const loansVal = Number(p.loanDeduction || 0);
                const unpaidDeductionVal = Number(p.unpaidDeduction || 0);

                const earlyDepartureMinutes = Number(p.earlyDepartureMinutes || 0);
                const earlyDepartureHoursVal = Math.round((earlyDepartureMinutes / 60) * 100) / 100;
                const earlyDepartureDeductionVal = Number(p.earlyDepartureDeduction || p.earlyDepartureDeductions || 0);

                const lateMinutes = Number(p.lateMinutes || 0);
                const lateHoursVal = Math.round((lateMinutes / 60) * 100) / 100;
                const lateDeductionVal = Number(p.lateDeduction || p.lateDeductions || 0);

                const otherDeductionsVal = Number(p.otherDeductions || 0);
                const totalDeductionsVal = socialSecurityVal + loansVal + unpaidDeductionVal + earlyDepartureDeductionVal + lateDeductionVal + otherDeductionsVal;
                const netVal = p.netPay ? Number(p.netPay) : grossPayVal - totalDeductionsVal;

                return (
                  <tr key={p.id} className="hover:bg-[#E8EEF7] divide-x divide-x-reverse divide-slate-200 group">
                    <td className="py-1 px-0.5 font-mono font-bold truncate">{p.periodStart.slice(0, 7)}</td>
                    <td className="py-1 px-0.5 font-bold text-[#0A246A] text-right truncate" title={p.employeeName}>
                      <Link href={`/payroll/${p.id}`} className="hover:underline">
                        {p.employeeName}
                      </Link>
                    </td>
                    <td className="py-1 px-0.5 truncate">
                      <span
                        className={`px-0.5 py-0 text-[8px] font-bold ${
                          isDailyWorker
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-blue-50 text-blue-900 border border-blue-200'
                        }`}
                      >
                        {isDailyWorker ? 'مياومة' : 'مثبت'}
                      </span>
                    </td>
                    <td className="py-1 px-0.5 text-slate-700 truncate">{p.department}</td>
                    <td className="py-1 px-0.5 font-mono font-semibold truncate">
                      {isDailyWorker
                        ? `${Number(p.dailyRate || 0).toFixed(2)}×${p.workedDays || 0}ي`
                        : basicEarnedVal.toFixed(2)}
                    </td>
                    <td className="py-1 px-0.5 font-mono truncate">{transportVal > 0 ? transportVal.toFixed(2) : '-'}</td>
                    <td className="py-1 px-0.5 font-mono truncate">{gratuitiesVal > 0 ? gratuitiesVal.toFixed(2) : '-'}</td>
                    <td className="py-1 px-0.5 font-mono truncate">{otHoursVal > 0 ? otHoursVal.toFixed(2) : '-'}</td>
                    <td className="py-1 px-0.5 font-mono text-emerald-800 truncate">+{otTotalVal.toFixed(2)}</td>
                    <td className="py-1 px-0.5 font-mono font-bold bg-blue-50 text-blue-900 truncate">{grossPayVal.toFixed(2)}</td>
                    <td className="py-1 px-0.5 font-mono truncate">{socialSecurityVal > 0 ? socialSecurityVal.toFixed(2) : '-'}</td>
                    <td className="py-1 px-0.5 font-mono truncate">{loansVal > 0 ? loansVal.toFixed(2) : '-'}</td>
                    <td className="py-1 px-0.5 font-mono truncate">{unpaidDaysVal > 0 ? unpaidDaysVal : '-'}</td>
                    <td className="py-1 px-0.5 font-mono text-rose-800 truncate">{unpaidDeductionVal > 0 ? `-${unpaidDeductionVal.toFixed(2)}` : '-'}</td>
                    <td className="py-1 px-0.5 font-mono truncate">{earlyDepartureHoursVal > 0 ? earlyDepartureHoursVal.toFixed(2) : '-'}</td>
                    <td className="py-1 px-0.5 font-mono text-rose-800 truncate">{earlyDepartureDeductionVal > 0 ? `-${earlyDepartureDeductionVal.toFixed(2)}` : '-'}</td>
                    <td className="py-1 px-0.5 font-mono truncate">{lateHoursVal > 0 ? lateHoursVal.toFixed(2) : '-'}</td>
                    <td className="py-1 px-0.5 font-mono text-rose-800 truncate">{lateDeductionVal > 0 ? `-${lateDeductionVal.toFixed(2)}` : '-'}</td>
                    <td className="py-1 px-0.5 font-mono truncate">{otherDeductionsVal > 0 ? `-${otherDeductionsVal.toFixed(2)}` : '-'}</td>
                    <td className="py-1 px-0.5 font-mono font-bold bg-amber-50 text-rose-900 truncate">-{totalDeductionsVal.toFixed(2)}</td>
                    <td className="py-1 px-0.5 font-mono font-bold text-emerald-800 text-[9.5px] bg-slate-100 truncate">
                      {netVal.toFixed(2)}
                    </td>
                    <td className="py-1 px-0.5 truncate">
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
                    <td className="sticky left-0 bg-white group-hover:bg-[#E8EEF7] z-10 py-1 px-1 text-center whitespace-nowrap border-r border-slate-300 shadow-[-2px_0_5px_rgba(0,0,0,0.15)] min-w-[135px] w-[135px]">
                      <div className="inline-flex items-center justify-center gap-1 whitespace-nowrap">
                        <Link
                          href={`/payroll/${p.id}`}
                          className="win-btn text-[9px] px-1.5 py-0.5 font-bold text-[#0A246A] whitespace-nowrap flex items-center gap-0.5"
                          title="عرض تفاصيل قسيمة الراتب"
                        >
                          👁️ عرض
                        </Link>
                        {p.status === 'DRAFT' && (
                          <EditPayrollDraftModal
                            payroll={p}
                            updatePayrollDraftAction={handleUpdatePayrollDraft}
                            buttonVariant="icon"
                          />
                        )}
                        {['ADMIN', 'HR', 'ACCOUNTANT', 'SUPERVISOR'].includes(user.role) && (
                          <DeletePayrollModal
                            payrollId={p.id}
                            employeeName={p.employeeName}
                            monthPeriod={p.periodStart.slice(0, 7)}
                            deletePayrollAction={handleDeletePayrollRun}
                            buttonVariant="icon"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {payrolls.length > 0 && (
            <tfoot className="bg-[#ECE9D8] font-bold text-[8.5px] border-t-2 border-[#0A246A]">
              <tr>
                <td colSpan={4} className="py-1 px-0.5 text-[#0A246A] text-right font-black truncate">
                  الإجمالي ({payrolls.length}):
                </td>
                <td className="py-1 px-0.5 font-mono truncate">{totalBasicEarned.toFixed(2)}</td>
                <td className="py-1 px-0.5 font-mono truncate">{totalTransport > 0 ? totalTransport.toFixed(2) : '-'}</td>
                <td className="py-1 px-0.5 font-mono truncate">{totalGratuities > 0 ? totalGratuities.toFixed(2) : '-'}</td>
                <td className="py-1 px-0.5 font-mono truncate">{totalOtHours > 0 ? totalOtHours.toFixed(2) : '-'}</td>
                <td className="py-1 px-0.5 font-mono text-emerald-800 truncate">+{totalOtTotal.toFixed(2)}</td>
                <td className="py-1 px-0.5 font-mono font-bold bg-blue-50 text-blue-900 truncate">{totalGrossPay.toFixed(2)}</td>
                <td className="py-1 px-0.5 font-mono truncate">{totalSocialSecurity > 0 ? totalSocialSecurity.toFixed(2) : '-'}</td>
                <td className="py-1 px-0.5 font-mono truncate">{totalLoans > 0 ? totalLoans.toFixed(2) : '-'}</td>
                <td className="py-1 px-0.5 font-mono truncate">{totalUnpaidDays > 0 ? totalUnpaidDays : '-'}</td>
                <td className="py-1 px-0.5 font-mono text-rose-800 truncate">{totalUnpaidDeduction > 0 ? `-${totalUnpaidDeduction.toFixed(2)}` : '-'}</td>
                <td className="py-1 px-0.5 font-mono truncate">{totalEarlyDepartureHours > 0 ? totalEarlyDepartureHours.toFixed(2) : '-'}</td>
                <td className="py-1 px-0.5 font-mono text-rose-800 truncate">{totalEarlyDepartureDeduction > 0 ? `-${totalEarlyDepartureDeduction.toFixed(2)}` : '-'}</td>
                <td className="py-1 px-0.5 font-mono truncate">{totalLateHours > 0 ? totalLateHours.toFixed(2) : '-'}</td>
                <td className="py-1 px-0.5 font-mono text-rose-800 truncate">{totalLateDeduction > 0 ? `-${totalLateDeduction.toFixed(2)}` : '-'}</td>
                <td className="py-1 px-0.5 font-mono truncate">{totalOtherDeductions > 0 ? `-${totalOtherDeductions.toFixed(2)}` : '-'}</td>
                <td className="py-1 px-0.5 font-mono font-bold bg-amber-50 text-rose-900 truncate">-{totalDeductions.toFixed(2)}</td>
                <td className="py-1 px-0.5 font-mono font-black text-emerald-800 text-[9.5px] bg-slate-100 truncate">
                  {grandTotalNetPay.toFixed(2)}
                </td>
                <td className="py-1 px-0.5"></td>
                <td className="sticky left-0 bg-[#ECE9D8] z-10 py-1 px-0.5 border-r border-[#0A246A] shadow-[-2px_0_5px_rgba(0,0,0,0.15)] min-w-[135px] w-[135px]"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

