import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getPayrolls, createPayrollDraft, generateBulkPayrollDrafts, updatePayrollDraft, deletePayrollRun, approveBulkPayrollForMonth, isLegacyOtRate } from '@/lib/services/payroll-service';
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
  const [employees, payrolls] = await Promise.all([
    getEmployees(user),
    getPayrolls(user, {
      month: resolvedParams.month,
      employeeId: resolvedParams.employeeId,
      status: resolvedParams.status,
    }),
  ]);

  // Calculate summary category totals across filtered payrolls
  let totalBasicEarned = 0;
  let totalTransport = 0;
  let totalDelivery = 0;
  let totalGratuities = 0;
  let totalOtherAdditions = 0;
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
    const transportVal = isDailyWorker ? 0 : (p.allowancesEarned !== undefined && p.allowancesEarned !== null ? Number(p.allowancesEarned) : Math.max(0, 30 - unpaidDaysVal));
    const deliveryVal = Number(p.deliveryAllowance || 0);
    const gratuitiesVal = Number(p.gratuities || 0);
    const otherAdditionsVal = Number(p.otherAdditions || 0);
    const otHoursVal = Number(p.otHours || 0);
    const calculatedOtRate = isDailyWorker
      ? (Number(p.dailyRate || 0) > 0 ? (Number(p.dailyRate || 0) / 4) : 0)
      : (basicEarnedVal > 0 ? (basicEarnedVal / 120) : 0);
    const rawOtRate = Number(p.otRate || 0);
    const otRateVal = rawOtRate > 0 && !isLegacyOtRate(rawOtRate) ? rawOtRate : calculatedOtRate;
    const otTotalVal = p.otTotal !== undefined && Number(p.otTotal) > 0 ? Number(p.otTotal) : Math.round(otHoursVal * otRateVal * 100) / 100;
    const grossPayVal = basicEarnedVal + transportVal + deliveryVal + gratuitiesVal + otherAdditionsVal + otTotalVal;

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
    const netVal = Math.round((grossPayVal - totalDeductionsVal) * 1000) / 1000;

    totalBasicEarned += basicEarnedVal;
    totalTransport += transportVal;
    totalDelivery += deliveryVal;
    totalGratuities += gratuitiesVal;
    totalOtherAdditions += otherAdditionsVal;
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
    totalOvertimeAndAdditions += otTotalVal + gratuitiesVal + deliveryVal + otherAdditionsVal;
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
      gratuities: formData.has('gratuities') ? parseFloat((formData.get('gratuities') as string) || '0') : undefined,
      deliveryAllowance: formData.has('deliveryAllowance') ? parseFloat((formData.get('deliveryAllowance') as string) || '0') : undefined,
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
            href={`/payroll/adjustments${resolvedParams.month ? `?month=${resolvedParams.month}` : ''}`}
            className="win-btn font-extrabold text-xs px-2.5 py-1 flex items-center gap-1 text-[#800000] bg-amber-50 border border-amber-400 hover:bg-amber-100 shadow-sm"
            title="مراجعة متغيرات الدوام، إكراميات الموظفين، بدل مشاوير الديزل والمخالفات قبل ترحيل الرواتب"
          >
            <span>⚡</span>
            <span>إعداد ومراجعة متغيرات الرواتب (مكافآت / عقوبات)</span>
          </Link>

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
                  {e.name} ({e.employmentType === 'DAILY_WORKER' ? 'مياومة' : e.employmentType === 'PROBATIONARY' ? 'تجريبي' : 'مثبت'})
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
        <table className="win-table w-full text-center text-[8.5px] md:text-[9px] border-collapse table-fixed tracking-tighter min-w-[1700px]">
          <colgroup>
            {[
              <col key="1" style={{ width: '4.5%' }} />,  // الرقم الوظيفي
              <col key="2" style={{ width: '9.0%' }} />,  // اسم الموظف
              <col key="3" style={{ width: '3.5%' }} />,  // الفترة
              <col key="4" style={{ width: '3.0%' }} />,  // النوع
              <col key="5" style={{ width: '4.0%' }} />,  // القسم
              <col key="6" style={{ width: '4.5%' }} />,  // الراتب الأساسي
              <col key="7" style={{ width: '4.5%' }} />,  // مكافأة مواصلات
              <col key="8" style={{ width: '3.5%' }} />,  // بدل توصيل
              <col key="9" style={{ width: '3.5%' }} />,  // اكراميات
              <col key="10" style={{ width: '3.5%' }} />, // اضافات اخرى
              <col key="11" style={{ width: '3.5%' }} />, // ساعات عمل إضافي
              <col key="12" style={{ width: '4.0%' }} />, // بدل إضافي
              <col key="13" style={{ width: '5.0%' }} />, // اجمالي الراتب
              <col key="14" style={{ width: '4.0%' }} />, // ضمان اجتماعي
              <col key="15" style={{ width: '3.5%' }} />, // السلف
              <col key="16" style={{ width: '3.0%' }} />, // عدد أيام الغياب
              <col key="17" style={{ width: '4.0%' }} />, // خصم الغياب
              <col key="18" style={{ width: '3.0%' }} />, // ساعات مغادرة
              <col key="19" style={{ width: '4.0%' }} />, // خصم مغادرة
              <col key="20" style={{ width: '3.0%' }} />, // ساعات التأخير
              <col key="21" style={{ width: '4.0%' }} />, // خصم تأخير
              <col key="22" style={{ width: '3.5%' }} />, // خصومات أخرى
              <col key="23" style={{ width: '5.0%' }} />, // اجمالي الخصومات
              <col key="24" style={{ width: '5.5%' }} />, // صافي الراتب
              <col key="25" style={{ width: '3.5%' }} />, // الحالة
              <col key="26" style={{ width: '7.5%' }} />, // الإجراء
            ]}
          </colgroup>
          <thead>
            {/* Group Headers matching بيان الرواتب structure */}
            <tr className="bg-slate-800 text-white font-bold border-b border-slate-400 text-[10px]">
              <th colSpan={5} className="py-1 px-1 border-r border-slate-600 bg-slate-800">بيانات الموظف</th>
              <th colSpan={8} className="py-1 px-1 border-r border-slate-600 bg-[#1D4ED8]">الإضافات</th>
              <th colSpan={10} className="py-1 px-1 border-r border-slate-600 bg-[#991B1B]">الخصومات</th>
              <th colSpan={1} className="py-1 px-1 border-r border-slate-600 bg-slate-900">الصافي النهائي</th>
              <th colSpan={2} className="py-1 px-1 bg-slate-800">التحكم والإجراء</th>
            </tr>
            {/* Column Headers matching بيان الرواتب exactly in name and order */}
            <tr className="bg-[#ECE9D8] text-[#0A246A] font-bold border-b border-[#D4D0C8] text-[8.5px] leading-tight">
              {/* Employee info */}
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">الرقم الوظيفي</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">اسم الموظف</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">الفترة</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">النوع</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">القسم</th>

              {/* Additions (matching بيان الرواتب exactly) */}
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-blue-50/70">الراتب الأساسي</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-blue-50/70">مكافأة مواصلات أيام عمل</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-amber-50/70 font-black text-amber-950">بدل توصيل</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-emerald-50/70 font-black text-emerald-950">اكراميات</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-blue-50/70">اضافات اخرى</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-blue-50/70">ساعات عمل إضافي</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-blue-50/70">بدل إضافي</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-blue-100 text-blue-950 font-black">اجمالي الراتب</th>

              {/* Deductions (matching بيان الرواتب exactly) */}
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-rose-50/60">ضمان اجتماعي</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-rose-50/60 font-black text-rose-950">السلف</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-rose-50/60">عدد أيام الغياب</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-rose-50/60">خصم الغياب</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-rose-50/60">ساعات مغادرة</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-rose-50/60">خصم مغادرة</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-rose-50/60">ساعات التأخير</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-rose-50/60">خصم تأخير</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-rose-50/60">خصومات أخرى</th>
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-rose-100 text-rose-950 font-black">اجمالي الخصومات</th>

              {/* Net */}
              <th className="py-1 px-0.5 border-r border-[#D4D0C8] bg-[#0A246A] text-white font-black">صافي الراتب</th>

              {/* Status and Action */}
              <th className="py-1 px-0.5 border-r border-[#D4D0C8]">الحالة</th>
              <th className="sticky left-0 bg-[#D4D0C8] text-[#0A246A] z-20 py-1 px-1 text-center whitespace-nowrap font-bold border-r border-[#808080] shadow-[-2px_0_5px_rgba(0,0,0,0.15)] min-w-[135px] w-[135px]">الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {payrolls.length === 0 ? (
              <tr>
                <td colSpan={26} className="py-6 text-center text-[#808080]">
                  لا توجد مسيرات رواتب مسجلة مطابقة لشروط البحث
                </td>
              </tr>
            ) : (
              payrolls.map((p: any) => {
                const isDailyWorker = p.employmentType === 'DAILY_WORKER';
                const isProbationary = p.employmentType === 'PROBATIONARY';
                const basicEarnedVal = isDailyWorker
                  ? Number(p.dailyRate || 0) * Number(p.workedDays || 0)
                  : Number(p.basicEarned || 0);

                const unpaidDaysVal = Number(p.unpaidDays || 0);
                const transportVal = isDailyWorker ? 0 : (p.allowancesEarned !== undefined && p.allowancesEarned !== null ? Number(p.allowancesEarned) : Math.max(0, 30 - unpaidDaysVal));
                const deliveryVal = Number(p.deliveryAllowance || 0);
                const gratuitiesVal = Number(p.gratuities || 0);
                const otherAdditionsVal = Number(p.otherAdditions || 0);
                const otHoursVal = Number(p.otHours || 0);
                const calculatedOtRate = isDailyWorker
                  ? (Number(p.dailyRate || 0) > 0 ? (Number(p.dailyRate || 0) / 4) : 0)
                  : (basicEarnedVal > 0 ? (basicEarnedVal / 120) : 0);
                const rawOtRate = Number(p.otRate || 0);
                const otRateVal = rawOtRate > 0 && !isLegacyOtRate(rawOtRate) ? rawOtRate : calculatedOtRate;
                const otTotalVal = p.otTotal !== undefined && Number(p.otTotal) > 0 ? Number(p.otTotal) : Math.round(otHoursVal * otRateVal * 100) / 100;
                const grossPayVal = basicEarnedVal + transportVal + deliveryVal + gratuitiesVal + otherAdditionsVal + otTotalVal;

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
                const netVal = Math.round((grossPayVal - totalDeductionsVal) * 1000) / 1000;

                return (
                  <tr key={p.id} className="hover:bg-[#E8EEF7] divide-x divide-x-reverse divide-slate-200 group">
                    {/* Employee Info */}
                    <td className="py-1 px-0.5 font-mono font-bold text-center border-r border-[#D4D0C8]">{p.employeeNo || '-'}</td>
                    <td className="py-1 px-0.5 font-bold text-[#0A246A] text-right truncate border-r border-[#D4D0C8]" title={p.employeeName}>
                      <Link href={`/payroll/${p.id}`} className="hover:underline">
                        {p.employeeName}
                      </Link>
                    </td>
                    <td className="py-1 px-0.5 font-mono text-center truncate border-r border-[#D4D0C8]">{p.periodStart.slice(0, 7)}</td>
                    <td className="py-1 px-0.5 text-center truncate border-r border-[#D4D0C8]">
                      <span
                        className={`px-0.5 py-0 text-[8px] font-bold ${
                          isDailyWorker
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isProbationary
                            ? 'bg-purple-100 text-purple-900 border border-purple-300'
                            : 'bg-blue-50 text-blue-900 border border-blue-200'
                        }`}
                      >
                        {isDailyWorker ? 'مياومة' : isProbationary ? 'تجريبي' : 'مثبت'}
                      </span>
                    </td>
                    <td className="py-1 px-0.5 text-slate-700 text-center truncate border-r border-[#D4D0C8]">{p.department || '-'}</td>

                    {/* Additions */}
                    <td className="py-1 px-0.5 font-mono font-semibold text-center border-r border-[#D4D0C8]">
                      {isDailyWorker
                        ? `${Number(p.dailyRate || 0).toFixed(2)}×${p.workedDays || 0}ي`
                        : basicEarnedVal.toFixed(2)}
                    </td>
                    <td className="py-1 px-0.5 font-mono text-center border-r border-[#D4D0C8]">{transportVal > 0 ? transportVal.toFixed(2) : '-'}</td>
                    <td className="py-1 px-0.5 font-mono text-center border-r border-[#D4D0C8] font-bold text-amber-950 bg-amber-50/40">
                      {deliveryVal > 0 ? deliveryVal.toFixed(2) : '-'}
                    </td>
                    <td className="py-1 px-0.5 font-mono text-center border-r border-[#D4D0C8] font-bold text-emerald-950 bg-emerald-50/40">
                      {gratuitiesVal > 0 ? gratuitiesVal.toFixed(2) : '-'}
                    </td>
                    <td className="py-1 px-0.5 font-mono text-center border-r border-[#D4D0C8]">
                      {otherAdditionsVal > 0 ? otherAdditionsVal.toFixed(2) : '-'}
                    </td>
                    <td className="py-1 px-0.5 font-mono text-center border-r border-[#D4D0C8]">{otHoursVal > 0 ? otHoursVal.toFixed(2) : '-'}</td>
                    <td className="py-1 px-0.5 font-mono text-emerald-800 text-center border-r border-[#D4D0C8] font-bold">
                      {otTotalVal > 0 ? `+${otTotalVal.toFixed(2)}` : '-'}
                    </td>
                    <td className="py-1 px-0.5 font-mono font-bold bg-blue-50 text-blue-950 text-center border-r border-[#D4D0C8]">
                      {grossPayVal.toFixed(2)}
                    </td>

                    {/* Deductions */}
                    <td className="py-1 px-0.5 font-mono text-center border-r border-[#D4D0C8]">{socialSecurityVal > 0 ? socialSecurityVal.toFixed(2) : '-'}</td>
                    <td className="py-1 px-0.5 font-mono text-center border-r border-[#D4D0C8] font-bold text-rose-950">
                      {loansVal > 0 ? loansVal.toFixed(2) : '-'}
                    </td>
                    <td className="py-1 px-0.5 font-mono text-center border-r border-[#D4D0C8]">{unpaidDaysVal > 0 ? unpaidDaysVal : '-'}</td>
                    <td className="py-1 px-0.5 font-mono text-rose-800 text-center border-r border-[#D4D0C8]">
                      {unpaidDeductionVal > 0 ? `-${unpaidDeductionVal.toFixed(2)}` : '-'}
                    </td>
                    <td className="py-1 px-0.5 font-mono text-center border-r border-[#D4D0C8]">{earlyDepartureHoursVal > 0 ? earlyDepartureHoursVal.toFixed(2) : '-'}</td>
                    <td className="py-1 px-0.5 font-mono text-rose-800 text-center border-r border-[#D4D0C8]">
                      {earlyDepartureDeductionVal > 0 ? `-${earlyDepartureDeductionVal.toFixed(2)}` : '-'}
                    </td>
                    <td className="py-1 px-0.5 font-mono text-center border-r border-[#D4D0C8]">{lateHoursVal > 0 ? lateHoursVal.toFixed(2) : '-'}</td>
                    <td className="py-1 px-0.5 font-mono text-rose-800 text-center border-r border-[#D4D0C8]">
                      {lateDeductionVal > 0 ? `-${lateDeductionVal.toFixed(2)}` : '-'}
                    </td>
                    <td className="py-1 px-0.5 font-mono text-center border-r border-[#D4D0C8]">
                      {otherDeductionsVal > 0 ? `-${otherDeductionsVal.toFixed(2)}` : '-'}
                    </td>
                    <td className="py-1 px-0.5 font-mono font-bold bg-amber-50 text-rose-950 text-center border-r border-[#D4D0C8]">
                      -{totalDeductionsVal.toFixed(2)}
                    </td>

                    {/* Net Pay */}
                    <td className="py-1 px-0.5 font-mono font-black text-emerald-900 text-[9.5px] bg-slate-100 text-center border-r border-[#D4D0C8]">
                      {netVal.toFixed(2)}
                    </td>

                    {/* Status */}
                    <td className="py-1 px-0.5 text-center border-r border-[#D4D0C8]">
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

                    {/* Action */}
                    <td className="sticky left-0 bg-white group-hover:bg-[#E8EEF7] z-10 py-1 px-1 text-center whitespace-nowrap border-r border-[#D4D0C8] shadow-[-2px_0_5px_rgba(0,0,0,0.15)] min-w-[135px] w-[135px]">
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
                <td colSpan={5} className="py-1 px-0.5 text-[#0A246A] text-right font-black truncate">
                  الإجمالي ({payrolls.length}):
                </td>
                <td className="py-1 px-0.5 font-mono text-center">{totalBasicEarned.toFixed(2)}</td>
                <td className="py-1 px-0.5 font-mono text-center">{totalTransport > 0 ? totalTransport.toFixed(2) : '-'}</td>
                <td className="py-1 px-0.5 font-mono text-center font-bold text-amber-950">{totalDelivery > 0 ? totalDelivery.toFixed(2) : '-'}</td>
                <td className="py-1 px-0.5 font-mono text-center font-bold text-emerald-950">{totalGratuities > 0 ? totalGratuities.toFixed(2) : '-'}</td>
                <td className="py-1 px-0.5 font-mono text-center">{totalOtherAdditions > 0 ? totalOtherAdditions.toFixed(2) : '-'}</td>
                <td className="py-1 px-0.5 font-mono text-center">{totalOtHours > 0 ? totalOtHours.toFixed(2) : '-'}</td>
                <td className="py-1 px-0.5 font-mono text-emerald-800 text-center font-bold">+{totalOtTotal.toFixed(2)}</td>
                <td className="py-1 px-0.5 font-mono font-bold bg-blue-100 text-blue-950 text-center">{totalGrossPay.toFixed(2)}</td>
                <td className="py-1 px-0.5 font-mono text-center">{totalSocialSecurity > 0 ? totalSocialSecurity.toFixed(2) : '-'}</td>
                <td className="py-1 px-0.5 font-mono text-center font-bold text-rose-950">{totalLoans > 0 ? totalLoans.toFixed(2) : '-'}</td>
                <td className="py-1 px-0.5 font-mono text-center">{totalUnpaidDays > 0 ? totalUnpaidDays : '-'}</td>
                <td className="py-1 px-0.5 font-mono text-rose-800 text-center">{totalUnpaidDeduction > 0 ? `-${totalUnpaidDeduction.toFixed(2)}` : '-'}</td>
                <td className="py-1 px-0.5 font-mono text-center">{totalEarlyDepartureHours > 0 ? totalEarlyDepartureHours.toFixed(2) : '-'}</td>
                <td className="py-1 px-0.5 font-mono text-rose-800 text-center">{totalEarlyDepartureDeduction > 0 ? `-${totalEarlyDepartureDeduction.toFixed(2)}` : '-'}</td>
                <td className="py-1 px-0.5 font-mono text-center">{totalLateHours > 0 ? totalLateHours.toFixed(2) : '-'}</td>
                <td className="py-1 px-0.5 font-mono text-rose-800 text-center">{totalLateDeduction > 0 ? `-${totalLateDeduction.toFixed(2)}` : '-'}</td>
                <td className="py-1 px-0.5 font-mono text-center">{totalOtherDeductions > 0 ? `-${totalOtherDeductions.toFixed(2)}` : '-'}</td>
                <td className="py-1 px-0.5 font-mono font-bold bg-amber-100 text-rose-950 text-center">-{totalDeductions.toFixed(2)}</td>
                <td className="py-1 px-0.5 font-mono font-black text-emerald-950 text-[10px] bg-slate-200 text-center">{grandTotalNetPay.toFixed(2)}</td>
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

