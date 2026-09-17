import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import {
  getPayrollById,
  refreshPayrollDraft,
  updatePayrollDraft,
  approvePayroll,
  confirmPayrollPayment,
  cancelPayrollDraft,
  validatePayrollCompleteness,
} from '@/lib/services/payroll-service';
import { Badge, Alert } from '@/components/ui';
import { RBAC } from '@/lib/auth/rbac';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { ConfirmPaymentModal } from '@/components/payroll/ConfirmPaymentModal';
import { EditPayrollDraftModal } from '@/components/payroll/EditPayrollDraftModal';
import { formatDurationArabic } from '@/lib/services/attendance-service';

export default async function PayrollDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!RBAC.canManagePayroll(user.role)) {
    redirect('/');
  }

  const resolvedParams = await params;
  const payrollId = resolvedParams.id;
  const payroll = await getPayrollById(user, payrollId);

  // Validate completeness to show real-time diagnostics before approval
  const completeness = await validatePayrollCompleteness(payrollId);

  async function handleRefresh() {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');
    await refreshPayrollDraft(currentUser, payrollId);
    revalidatePath(`/payroll/${payrollId}`);
  }

  async function handleUpdateDraft(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    await updatePayrollDraft(currentUser, {
      payrollId,
      otherAdditions: parseFloat((formData.get('otherAdditions') as string) || '0'),
      otherDeductions: parseFloat((formData.get('otherDeductions') as string) || '0'),
      unpaidDays: parseFloat((formData.get('unpaidDays') as string) || '0'),
      earlyDepartureMinutes: parseInt((formData.get('earlyDepartureMinutes') as string) || '0', 10),
      lateMinutes: parseInt((formData.get('lateMinutes') as string) || '0', 10),
      otHours: parseFloat((formData.get('otHours') as string) || '0'),
      notes: (formData.get('notes') as string) || undefined,
    });
    revalidatePath(`/payroll/${payrollId}`);
  }

  async function handleApprove() {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');
    await approvePayroll(currentUser, payrollId);
    revalidatePath(`/payroll/${payrollId}`);
  }

  async function handleConfirmPayment(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    await confirmPayrollPayment(currentUser, {
      payrollId,
      paymentMethod: formData.get('paymentMethod') as any,
      paymentReference: formData.get('paymentReference') as string,
    });
    revalidatePath(`/payroll/${payrollId}`);
  }

  async function handleCancel() {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');
    await cancelPayrollDraft(currentUser, payrollId);
    revalidatePath(`/payroll/${payrollId}`);
  }

  const isDraft = payroll.status === 'DRAFT';
  const isApproved = payroll.status === 'APPROVED';
  const isPaid = payroll.status === 'PAID';
  const isDailyWorker = payroll.employmentType === 'DAILY_WORKER';

  return (
    <div className="space-y-2 select-none max-w-5xl mx-auto">
      {/* Titlebar Header */}
      <div className="win-raised p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#ECE9D8]">
        <div className="flex items-center gap-2">
          <Link
            href="/payroll"
            className="win-btn text-xs font-bold px-2 py-0.5"
            title="العودة لقائمة المسيرات"
          >
            ◄ مسيرات الرواتب
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-black">
                كشف راتب: {payroll.employeeName}
              </span>
              <span className="font-mono text-xs font-bold text-[#0A246A]">
                ({payroll.periodStart.slice(0, 7)})
              </span>
              <Badge
                variant={
                  isPaid
                    ? 'active'
                    : isApproved
                    ? 'approved'
                    : isDraft
                    ? 'draft'
                    : 'rejected'
                }
              >
                {isPaid
                  ? 'مدفوع'
                  : isApproved
                  ? 'معتمد (نهائي)'
                  : isDraft
                  ? 'مسودة'
                  : 'ملغى'}
              </Badge>
            </div>
            <div className="text-[11px] text-[#505050]">
              {payroll.jobTitle} - {payroll.department} | الرقم الوظيفي: {payroll.employeeNo} |{' '}
              <span className="font-bold text-black">
                {isDailyWorker ? 'عامل مياومة' : 'موظف مثبت'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Completeness check warnings for DRAFT */}
      {isDraft && !completeness.isValid && (
        <div className="win-sunken p-2.5 bg-amber-50 border border-amber-400 text-amber-950 text-xs">
          <strong className="block font-bold mb-1">⚠ متطلبات ناقصة قبل إمكانية اعتماد الراتب:</strong>
          <ul className="list-disc list-inside space-y-0.5 font-medium">
            {completeness.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Workflow Action Bar */}
      <div className="win-raised p-2 bg-[#ECE9D8] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="text-[11px] text-[#404040]">
          حالة الكشف: <strong className="text-black">{payroll.status}</strong>
          {payroll.approvedAt && ` | اعتمد في: ${new Date(payroll.approvedAt).toLocaleDateString('ar-SA')}`}
          {payroll.paidAt && ` | تم الصرف في: ${new Date(payroll.paidAt).toLocaleDateString('ar-SA')}`}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {isDraft && (
            <>
              {/* Edit draft modal */}
              <EditPayrollDraftModal
                payroll={payroll}
                updatePayrollDraftAction={handleUpdateDraft}
              />

              {/* Refresh snapshot button */}
              <form action={handleRefresh}>
                <button
                  type="submit"
                  className="win-btn px-2.5 py-1 text-xs font-bold text-[#0A246A] flex items-center gap-1"
                >
                  <span>🔄</span>
                  <span>تحديث المسودة (إعادة احتساب الحضور والسلف)</span>
                </button>
              </form>

              {/* Approve payroll button (ADMIN ONLY) */}
              {user.role === 'ADMIN' && (
                <form action={handleApprove}>
                  <button
                    type="submit"
                    disabled={!completeness.isValid}
                    className="win-btn px-3 py-1 text-xs font-bold text-emerald-800 flex items-center gap-1"
                  >
                    <span>✓</span>
                    <span>اعتماد وتجميد كشف الراتب</span>
                  </button>
                </form>
              )}

              {/* Cancel Draft */}
              <form action={handleCancel}>
                <button
                  type="submit"
                  className="win-btn px-2 py-1 text-xs font-bold text-rose-800 flex items-center gap-1"
                >
                  <span>✗</span>
                  <span>إلغاء المسودة</span>
                </button>
              </form>
            </>
          )}

          {isApproved && (
            <>
              <ConfirmPaymentModal
                payrollId={payrollId}
                employeeName={payroll.employeeName}
                netPay={payroll.netPay ? payroll.netPay : payroll.netPreview}
                currency={payroll.currency}
                confirmPaymentAction={handleConfirmPayment}
              />

              <Link href={`/payroll/${payrollId}/payslip`} target="_blank" className="win-btn text-xs px-2.5 py-1 font-bold">
                🖨 قسيمة الراتب (PDF)
              </Link>
            </>
          )}

          {isPaid && (
            <Link href={`/payroll/${payrollId}/payslip`} target="_blank" className="win-btn text-xs px-2.5 py-1 font-bold">
              🖨 طباعة قسيمة الراتب
            </Link>
          )}
        </div>
      </div>

      {/* Financial Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        {/* EARNINGS */}
        <fieldset className="border border-[#808080] p-3 bg-white">
          <legend className="px-1 text-emerald-900 font-bold">الاستحقاقات ومكونات الدخل (Earnings)</legend>
          <div className="space-y-2 mt-1">
            {isDailyWorker ? (
              <>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">أجر اليوم المعتمد (Daily Rate):</span>
                  <span className="font-mono font-bold text-black">
                    {Number(payroll.dailyRate || 0).toFixed(3)} {payroll.currency}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">عدد أيام الحضور المكتملة (Worked Days):</span>
                  <span className="font-mono font-bold text-black">{payroll.workedDays || 0} يوم</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 bg-emerald-50 px-1">
                  <span className="font-bold text-emerald-900">إجمالي أجر المياومة (WorkedDays × DailyRate):</span>
                  <span className="font-mono font-bold text-emerald-800">
                    +{Number(payroll.basicEarned).toFixed(3)} {payroll.currency}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">الراتب الأساسي الشهري:</span>
                  <span className="font-mono font-bold text-black">
                    {Number(payroll.basicEarned).toFixed(3)} {payroll.currency}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">البدلات الشهرية:</span>
                  <span className="font-mono font-bold text-black">
                    {Number(payroll.allowancesEarned).toFixed(3)} {payroll.currency}
                  </span>
                </div>
              </>
            )}

            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-600">
                العمل الإضافي ({payroll.otHours} ساعة × {payroll.otRate}):
              </span>
              <span className="font-mono font-bold text-emerald-700">
                +{Number(payroll.otTotal).toFixed(3)} {payroll.currency}
              </span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-slate-600">مكافآت وإضافات أخرى:</span>
              <span className="font-mono font-bold text-emerald-700">
                +{Number(payroll.otherAdditions).toFixed(3)} {payroll.currency}
              </span>
            </div>

            <div className="pt-2 border-t border-[#808080] flex justify-between font-bold text-emerald-950">
              <span>إجمالي الراتب المستحق (Gross Pay):</span>
              <span className="font-mono text-sm">{Number(payroll.grossPay).toFixed(3)} {payroll.currency}</span>
            </div>
          </div>
        </fieldset>

        {/* DEDUCTIONS */}
        <fieldset className="border border-[#808080] p-3 bg-white">
          <legend className="px-1 text-rose-900 font-bold">الاستقطاعات والخصومات (Deductions)</legend>
          <div className="space-y-2 mt-1">
            {!isDailyWorker && (
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">
                  خصم الغياب ({payroll.unpaidDays} يوم × {payroll.unpaidDayRate}):
                </span>
                <span className="font-mono font-bold text-rose-700">
                  -{Number(payroll.unpaidDeduction).toFixed(3)} {payroll.currency}
                </span>
              </div>
            )}

            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-600">
                خصم التأخير الصباحي ({formatDurationArabic(payroll.lateMinutes || 0)}):
              </span>
              <span className="font-mono font-bold text-amber-900">
                -{Number(payroll.lateDeduction || 0).toFixed(3)} {payroll.currency}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-600">
                خصم المغادرة المبكرة ({formatDurationArabic(payroll.earlyDepartureMinutes || 0)}):
              </span>
              <span className="font-mono font-bold text-blue-900">
                -{Number(payroll.earlyDepartureDeduction || 0).toFixed(3)} {payroll.currency}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-600">خصم أقساط السلف:</span>
              <span className="font-mono font-bold text-rose-700">
                -{Number(payroll.loanDeduction).toFixed(3)} {payroll.currency}
              </span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-slate-600">استقطاعات أخرى:</span>
              <span className="font-mono font-bold text-rose-700">
                -{Number(payroll.otherDeductions).toFixed(3)} {payroll.currency}
              </span>
            </div>

            <div className="pt-2 border-t border-[#808080] flex justify-between font-bold text-rose-950">
              <span>إجمالي الخصومات (Total Deductions):</span>
              <span className="font-mono text-sm">-{Number(payroll.totalDeductions).toFixed(3)} {payroll.currency}</span>
            </div>
          </div>
        </fieldset>
      </div>

      {/* NET PAY RESULT BOX (Windows 2000 Sunken Display) */}
      <div className="win-sunken bg-gradient-to-r from-[#0A246A] to-[#15324F] text-white p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs text-slate-300 block">
            {isDraft ? 'صافي الراتب المتوقع (Net Preview)' : 'صافي الراتب النهائي المجمد (Net Pay)'}
          </span>
          <div className="text-2xl font-bold font-mono text-white mt-0.5">
            {payroll.netPay ? Number(payroll.netPay).toFixed(3) : Number(payroll.netPreview || 0).toFixed(3)}{' '}
            <span className="text-sm font-normal text-slate-300">{payroll.currency}</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-200 border-r border-slate-600 pr-4">
          <div>فترة المسير: {payroll.periodStart} ~ {payroll.periodEnd}</div>
          {payroll.paymentMethod && <div>طريقة الصرف: {payroll.paymentMethod}</div>}
          {payroll.paymentReference && <div>المرجع: {payroll.paymentReference}</div>}
        </div>
      </div>
    </div>
  );
}
