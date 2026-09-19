import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getPayrolls, approveBulkPayrollForMonth } from '@/lib/services/payroll-service';
import { RBAC } from '@/lib/auth/rbac';
import { ConsolidatedPayrollSheet, ConsolidatedPayrollRow } from '@/components/payroll/ConsolidatedPayrollSheet';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { SaveMonthlyStatementModal } from '@/components/payroll/SaveMonthlyStatementModal';

export default async function ConsolidatedPayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!RBAC.canViewFinancials(user.role)) {
    redirect('/');
  }

  const resolvedParams = await searchParams;
  const currentMonth = resolvedParams.month || new Date().toISOString().slice(0, 7);

  const payrolls = await getPayrolls(user, { month: currentMonth });

  const rows: ConsolidatedPayrollRow[] = payrolls.map((p: any) => {
    const basicEarned = p.employmentType === 'DAILY_WORKER'
      ? Number(p.dailyRate || 0) * Number(p.workedDays || 0)
      : Number(p.basicEarned || 0);

    const unpaidDays = Number(p.unpaidDays || 0);
    // Fixed 30 JOD transportation allowance minus 1 JOD per absence day
    const transportationAllowance = p.employmentType === 'DAILY_WORKER'
      ? 0
      : Math.max(0, 30 - unpaidDays);

    const gratuities = Number(p.gratuities || 0);
    const otHours = Number(p.otHours || 0);
    const calculatedOtRate = basicEarned > 0 ? ((basicEarned / 26) / 9) * 2 : 0;
    const otRate = Number(p.otRate || 0) > 0 ? Number(p.otRate) : calculatedOtRate;
    const otTotal = p.otTotal !== undefined && Number(p.otTotal) > 0 ? Number(p.otTotal) : Math.round(otHours * otRate * 100) / 100;
    const grossPay = basicEarned + transportationAllowance + gratuities + otTotal;

    // Social Security: 7.5% of basic salary ONLY IF registered
    const isSocialSecurity = Boolean(p.socialSecurityRegistered);
    const socialSecurity = isSocialSecurity ? Math.round(basicEarned * 0.075 * 100) / 100 : 0;
    const loans = Number(p.loanDeduction || 0);
    const unpaidDeduction = Number(p.unpaidDeduction || 0);
    const earlyDepartureMinutes = Number(p.earlyDepartureMinutes || 0);
    const earlyDepartureHours = Math.round((earlyDepartureMinutes / 60) * 100) / 100;
    const earlyDepartureDeduction = Number(p.earlyDepartureDeduction || 0);
    const lateMinutes = Number(p.lateMinutes || 0);
    const lateHours = Math.round((lateMinutes / 60) * 100) / 100;
    const lateDeduction = Number(p.lateDeduction || 0);
    const otherDeductions = Number(p.otherDeductions || 0);

    const totalDeductions = socialSecurity + loans + unpaidDeduction + earlyDepartureDeduction + lateDeduction + otherDeductions;
    const netPay = p.netPay ? Number(p.netPay) : grossPay - totalDeductions;

    return {
      id: p.id,
      employeeNo: p.employeeNo || 'N/A',
      employeeName: p.employeeName || 'N/A',
      basicEarned,
      transportationAllowance,
      gratuities,
      otHours,
      otTotal,
      grossPay,
      socialSecurity,
      loans,
      unpaidDays,
      unpaidDeduction,
      earlyDepartureHours,
      earlyDepartureDeduction,
      lateHours,
      lateDeduction,
      otherDeductions,
      totalDeductions,
      netPay,
    };
  });

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

  const draftCount = payrolls.filter((p: any) => p.status === 'DRAFT').length;
  const totalNetPay = rows.reduce((acc, r) => acc + r.netPay, 0);

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 flex flex-col items-center print:bg-white print:p-0 print:m-0 print:block">
      {/* Action Bar */}
      <div className="w-full max-w-[1400px] flex justify-between items-center mb-4 no-print">
        <Link
          href="/payroll"
          className="text-sm font-semibold text-[#2169A6] hover:text-[#1B5587] flex items-center"
        >
          <ArrowRight className="w-4 h-4 ml-1.5" />
          العودة لقائمة المسيرات
        </Link>

        {['ADMIN'].includes(user.role) && (
          <SaveMonthlyStatementModal
            currentMonth={currentMonth}
            draftCount={draftCount}
            totalNetPay={totalNetPay}
            approveMonthlyStatementAction={handleApproveMonthlyStatement}
          />
        )}
      </div>

      <div className="w-full max-w-[1400px] print:max-w-full print:w-full">
        <ConsolidatedPayrollSheet periodMonth={currentMonth} rows={rows} />
      </div>
    </div>
  );
}
