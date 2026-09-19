'use client';

import React, { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { Edit3, Calculator, AlertCircle } from 'lucide-react';

interface EditPayrollDraftModalProps {
  payroll: {
    id: string;
    employeeName: string;
    periodStart: string;
    basicEarned?: string | number;
    allowancesEarned?: string | number;
    gratuities?: string | number;
    otherAdditions?: string | number;
    otherDeductions: string | number;
    unpaidDays: string | number;
    unpaidDayRate?: string | number;
    earlyDepartureMinutes?: number;
    earlyDepartureDeduction?: string | number;
    lateMinutes?: number;
    lateDeduction?: string | number;
    otHours: string | number;
    otRate?: string | number;
    loanDeduction?: string | number;
    socialSecurityRegistered?: boolean;
    employmentType?: string;
    notes?: string | null;
  };
  updatePayrollDraftAction: (formData: FormData) => Promise<void>;
  buttonVariant?: 'icon' | 'btn';
}

export function EditPayrollDraftModal({
  payroll,
  updatePayrollDraftAction,
  buttonVariant = 'btn',
}: EditPayrollDraftModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state for live preview calculations
  const basicEarned = Number(payroll.basicEarned || 0);
  const isDailyWorker = payroll.employmentType === 'DAILY_WORKER';

  const [gratuities, setGratuities] = useState<number>(Number(payroll.gratuities || 0));
  const [otherDeductions, setOtherDeductions] = useState<number>(Number(payroll.otherDeductions || 0));
  const [unpaidDays, setUnpaidDays] = useState<number>(Number(payroll.unpaidDays || 0));
  const [earlyDepartureMinutes, setEarlyDepartureMinutes] = useState<number>(Number(payroll.earlyDepartureMinutes || 0));
  const [lateMinutes, setLateMinutes] = useState<number>(Number(payroll.lateMinutes || 0));
  const [otHours, setOtHours] = useState<number>(Number(payroll.otHours || 0));

  // Calculated values
  const calculatedOtRate = basicEarned > 0 ? ((basicEarned / 26) / 9) * 2 : 0;
  const otRate = Number(payroll.otRate || 0) > 0 && Number(payroll.otRate || 0) !== 2.5
    ? Number(payroll.otRate)
    : calculatedOtRate;

  const otTotal = otHours * otRate;
  const transportationAllowance = isDailyWorker ? 0 : Math.max(0, 30 - unpaidDays);
  const grossPay = basicEarned + transportationAllowance + gratuities + otTotal;

  const unpaidDayRate = Number(payroll.unpaidDayRate || (basicEarned > 0 ? basicEarned / 26 : 0));
  const unpaidDeduction = isDailyWorker ? 0 : unpaidDays * unpaidDayRate;

  const isSocialSecurity = Boolean(payroll.socialSecurityRegistered);
  const socialSecurityDeduction = isSocialSecurity ? Math.round(basicEarned * 0.075 * 100) / 100 : 0;

  const loans = Number(payroll.loanDeduction || 0);
  const lateDeduction = Number(payroll.lateDeduction || 0);
  const earlyDepartureDeduction = Number(payroll.earlyDepartureDeduction || 0);

  const totalDeductions = socialSecurityDeduction + loans + unpaidDeduction + earlyDepartureDeduction + lateDeduction + otherDeductions;
  const netPay = grossPay - totalDeductions;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData(e.currentTarget);
      formData.set('payrollId', payroll.id);
      await updatePayrollDraftAction(formData);
      setIsOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ تعديلات المسودة');
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleOpen = () => {
    setGratuities(Number(payroll.gratuities || 0));
    setOtherDeductions(Number(payroll.otherDeductions || 0));
    setUnpaidDays(Number(payroll.unpaidDays || 0));
    setEarlyDepartureMinutes(Number(payroll.earlyDepartureMinutes || 0));
    setLateMinutes(Number(payroll.lateMinutes || 0));
    setOtHours(Number(payroll.otHours || 0));
    setErrorMessage(null);
    setIsOpen(true);
  };

  return (
    <>
      {buttonVariant === 'icon' ? (
        <button
          type="button"
          onClick={handleOpen}
          className="win-btn text-[9px] px-1 py-0.5 font-bold text-[#0A246A] flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
          title="تعديل تفاصيل المسودة"
        >
          <Edit3 className="w-3 h-3 text-amber-700" />
          <span>تعديل</span>
        </button>
      ) : (
        <Button
          type="button"
          onClick={handleOpen}
          className="win-btn px-2.5 py-1 text-xs font-bold text-[#0A246A] flex items-center gap-1 cursor-pointer"
        >
          <Edit3 className="w-3.5 h-3.5 text-amber-700 ml-1" />
          <span>تعديل تفاصيل المسودة والإكراميات والغياب</span>
        </Button>
      )}

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`تعديل مسودة كشف راتب تفصيلي: ${payroll.employeeName} (${payroll.periodStart.slice(0, 7)})`}
        maxWidth="lg"
      >
        {errorMessage && (
          <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs select-none">
          <input type="hidden" name="payrollId" value={payroll.id} />

          {/* Live Calculated Consolidated Breakdown Preview */}
          <div className="bg-slate-900 text-white p-3 rounded border border-slate-700 space-y-2">
            <div className="flex justify-between items-center text-xs border-b border-slate-700 pb-1.5 font-bold">
              <span className="flex items-center gap-1 text-blue-300">
                <Calculator className="w-4 h-4" />
                معاينة احتساب الراتب المجمع التفاعلي (Live Consolidated Preview)
              </span>
              <span className="font-mono text-emerald-400 text-sm">
                صافي الراتب: {netPay.toFixed(3)} JOD
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
              <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                <span className="text-slate-400 block text-[10px]">الراتب الأساسي</span>
                <span className="font-bold text-white">{basicEarned.toFixed(3)}</span>
              </div>
              <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                <span className="text-slate-400 block text-[10px]">بدل مواصلات (30 - غياب)</span>
                <span className="font-bold text-emerald-400">{transportationAllowance.toFixed(3)}</span>
              </div>
              <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                <span className="text-slate-400 block text-[10px]">معدل الساعة الإضافية</span>
                <span className="font-bold text-amber-300">{otRate.toFixed(3)} JOD/س</span>
              </div>
              <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                <span className="text-slate-400 block text-[10px]">إجمالي بدل الإضافي</span>
                <span className="font-bold text-emerald-400">+{otTotal.toFixed(3)}</span>
              </div>

              <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                <span className="text-slate-400 block text-[10px]">الضمان الاجتماعي (7.5%)</span>
                <span className="font-bold text-rose-400">{isSocialSecurity ? `-${socialSecurityDeduction.toFixed(3)}` : 'غير مسجل (0.00)'}</span>
              </div>
              <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                <span className="text-slate-400 block text-[10px]">خصم الغياب (أيام)</span>
                <span className="font-bold text-rose-400">-{unpaidDeduction.toFixed(3)}</span>
              </div>
              <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                <span className="text-slate-400 block text-[10px]">إجمالي الإضافات</span>
                <span className="font-bold text-blue-300">{grossPay.toFixed(3)}</span>
              </div>
              <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                <span className="text-slate-400 block text-[10px]">إجمالي الخصومات</span>
                <span className="font-bold text-rose-300">-{totalDeductions.toFixed(3)}</span>
              </div>
            </div>
          </div>

          {/* Form Inputs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Earnings & Overtime */}
            <div className="bg-[#F5F4EA] p-3 border border-[#D4D0C8] rounded space-y-3">
              <h3 className="font-bold text-[#0A246A] border-b border-[#D4D0C8] pb-1 text-xs">
                💚 بنود الإضافات والمكافآت
              </h3>

              <div>
                <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                  اكراميات ومكافآت (يدوي) (JOD)
                </label>
                <input
                  name="gratuities"
                  type="number"
                  step="0.001"
                  min="0"
                  value={gratuities}
                  onChange={(e) => setGratuities(parseFloat(e.target.value || '0'))}
                  className="win-input w-full py-1.5 px-2 font-mono text-xs text-emerald-800 font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                  ساعات العمل الإضافي (ساعة)
                </label>
                <input
                  name="otHours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={otHours}
                  onChange={(e) => setOtHours(parseFloat(e.target.value || '0'))}
                  className="win-input w-full py-1.5 px-2 font-mono text-xs text-emerald-800 font-bold"
                />
                <span className="text-[10px] text-slate-600 mt-0.5 block">
                  معدل الساعة = {otRate.toFixed(3)} JOD/س | النتيجة = +{otTotal.toFixed(3)} JOD
                </span>
              </div>
            </div>

            {/* Right: Deductions & Days */}
            <div className="bg-[#F5F4EA] p-3 border border-[#D4D0C8] rounded space-y-3">
              <h3 className="font-bold text-[#0A246A] border-b border-[#D4D0C8] pb-1 text-xs">
                🔴 بنود الخصومات والغياب
              </h3>

              <div>
                <label className="block text-[11px] font-bold text-rose-900 mb-1">
                  خصومات أخرى (يدوي) (JOD)
                </label>
                <input
                  name="otherDeductions"
                  type="number"
                  step="0.001"
                  min="0"
                  value={otherDeductions}
                  onChange={(e) => setOtherDeductions(parseFloat(e.target.value || '0'))}
                  className="win-input w-full py-1.5 px-2 font-mono text-xs text-rose-800 font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-black mb-1">
                  أيام الغياب غير المدفوعة (يوم)
                </label>
                <input
                  name="unpaidDays"
                  type="number"
                  step="0.25"
                  min="0"
                  value={unpaidDays}
                  onChange={(e) => setUnpaidDays(parseFloat(e.target.value || '0'))}
                  className="win-input w-full py-1.5 px-2 font-mono text-xs font-bold"
                />
                <span className="text-[10px] text-slate-600 mt-0.5 block">
                  يخصم 1د من المواصلات ({transportationAllowance.toFixed(2)} باقي) | خصم الأيام = -{unpaidDeduction.toFixed(3)} JOD
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">
                    دقائق التأخير الصباحي (دقيقة)
                  </label>
                  <input
                    name="lateMinutes"
                    type="number"
                    step="1"
                    min="0"
                    value={lateMinutes}
                    onChange={(e) => setLateMinutes(parseInt(e.target.value || '0', 10))}
                    className="win-input w-full py-1.5 px-2 font-mono text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">
                    دقائق المغادرة المبكرة (دقيقة)
                  </label>
                  <input
                    name="earlyDepartureMinutes"
                    type="number"
                    step="1"
                    min="0"
                    value={earlyDepartureMinutes}
                    onChange={(e) => setEarlyDepartureMinutes(parseInt(e.target.value || '0', 10))}
                    className="win-input w-full py-1.5 px-2 font-mono text-xs font-bold"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-black mb-1">ملاحظات وسبب التعديل</label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={payroll.notes || ''}
              placeholder="سبب تعديل المسودة أو إضافة الخصم والمكافأة..."
              className="win-input w-full p-2 text-xs"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 space-x-reverse pt-3 border-t border-[#D4D0C8]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
              className="win-btn text-xs"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="win-btn bg-[#0A246A] hover:bg-[#113388] text-white font-bold text-xs px-4 py-1"
            >
              {isSubmitting ? 'جارٍ الحفظ...' : 'حفظ التعديلات وتحديث الراتب'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

