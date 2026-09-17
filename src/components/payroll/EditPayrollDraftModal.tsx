'use client';

import React, { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { Edit3 } from 'lucide-react';

interface EditPayrollDraftModalProps {
  payroll: {
    id: string;
    employeeName: string;
    periodStart: string;
    otherAdditions: string | number;
    otherDeductions: string | number;
    unpaidDays: string | number;
    earlyDepartureMinutes?: number;
    lateMinutes?: number;
    otHours: string | number;
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

  return (
    <>
      {buttonVariant === 'icon' ? (
        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setIsOpen(true);
          }}
          className="win-btn text-[11px] px-2 py-0.5 font-bold text-[#0A246A] flex items-center gap-1 cursor-pointer"
          title="تعديل الخصومات والمكافآت وأيام الغياب والمغادرة المبكرة"
        >
          <Edit3 className="w-3 h-3 text-amber-700" />
          <span>تعديل</span>
        </button>
      ) : (
        <Button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setIsOpen(true);
          }}
          className="win-btn px-2.5 py-1 text-xs font-bold text-[#0A246A] flex items-center gap-1 cursor-pointer"
        >
          <Edit3 className="w-3.5 h-3.5 text-amber-700 ml-1" />
          <span>تعديل المسودة (الاستقطاعات، الإضافات، والغياب)</span>
        </Button>
      )}

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`تعديل مسودة كشف راتب: ${payroll.employeeName} (${payroll.periodStart.slice(0, 7)})`}
        maxWidth="md"
      >
        {errorMessage && (
          <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <input type="hidden" name="payrollId" value={payroll.id} />

          <div className="p-2.5 bg-[#F5F4EA] border border-[#D4D0C8] rounded text-[#333333] text-[11px]">
            يمكنك تعديل الاستقطاعات والإضافات وأيام الغياب ودقائق المغادرة المبكرة مباشرةً لكشف الراتب قبل اعتماده بصورة نهائية.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                إضافات ومكافآت أخرى (JOD)
              </label>
              <input
                name="otherAdditions"
                type="number"
                step="0.001"
                min="0"
                defaultValue={payroll.otherAdditions || '0'}
                className="win-input w-full py-1.5 px-2 font-mono text-xs text-emerald-800 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-rose-900 mb-1">
                استقطاعات وخصومات أخرى (JOD)
              </label>
              <input
                name="otherDeductions"
                type="number"
                step="0.001"
                min="0"
                defaultValue={payroll.otherDeductions || '0'}
                className="win-input w-full py-1.5 px-2 font-mono text-xs text-rose-800 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-black mb-1">
                أيام الغياب غير المدفوعة (يوم)
              </label>
              <input
                name="unpaidDays"
                type="number"
                step="0.25"
                min="0"
                defaultValue={payroll.unpaidDays || '0'}
                className="win-input w-full py-1.5 px-2 font-mono text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-black mb-1">
                دقائق المغادرة المبكرة (دقيقة)
              </label>
              <input
                name="earlyDepartureMinutes"
                type="number"
                step="1"
                min="0"
                defaultValue={payroll.earlyDepartureMinutes || 0}
                className="win-input w-full py-1.5 px-2 font-mono text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-black mb-1">
                دقائق التأخير الصباحي (دقيقة)
              </label>
              <input
                name="lateMinutes"
                type="number"
                step="1"
                min="0"
                defaultValue={payroll.lateMinutes || 0}
                className="win-input w-full py-1.5 px-2 font-mono text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                ساعات العمل الإضافي (ساعة)
              </label>
              <input
                name="otHours"
                type="number"
                step="0.5"
                min="0"
                defaultValue={payroll.otHours || '0'}
                className="win-input w-full py-1.5 px-2 font-mono text-xs text-emerald-800 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-black mb-1">ملاحظات وسبب التعديل</label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={payroll.notes || ''}
              placeholder="سبب إضافة المكافأة أو الخصم..."
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
