'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Trash2 } from 'lucide-react';

interface DeletePayrollModalProps {
  payrollId: string;
  employeeName: string;
  monthPeriod: string;
  deletePayrollAction: (formData: FormData) => Promise<void>;
  buttonVariant?: 'icon' | 'button' | 'danger';
  buttonText?: string;
}

export function DeletePayrollModal({
  payrollId,
  employeeName,
  monthPeriod,
  deletePayrollAction,
  buttonVariant = 'button',
  buttonText,
}: DeletePayrollModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData(e.currentTarget);
      formData.set('payrollId', payrollId);
      await deletePayrollAction(formData);
      setIsOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حذف مسير الراتب');
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
          className="win-btn text-[9px] px-1 py-0.5 font-bold text-rose-700 hover:bg-rose-100 flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
          title="حذف المسير"
        >
          <Trash2 className="w-3 h-3" />
          <span>حذف</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setIsOpen(true);
          }}
          className="win-btn text-xs font-bold px-2.5 py-1 text-rose-800 hover:bg-rose-100 flex items-center gap-1 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{buttonText || 'حذف مسير الراتب'}</span>
        </button>
      )}

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="تأكيد حذف مسير الراتب"
        maxWidth="sm"
      >
        {errorMessage && (
          <div className="mb-3 p-2 bg-rose-100 border border-rose-400 text-rose-900 text-xs font-bold win-sunken">
            ⚠ {errorMessage}
          </div>
        )}

        <div className="mb-3 p-2.5 bg-amber-50 border border-amber-300 text-amber-950 text-xs win-sunken space-y-1">
          <div className="font-bold text-rose-900 flex items-center gap-1">
            <span>⚠</span>
            <span>تنبيه: تحذير حذف نهائي</span>
          </div>
          <div>
            الموظف: <strong className="text-black">{employeeName}</strong>
          </div>
          <div>
            فترة المسير: <strong className="font-mono text-black">{monthPeriod}</strong>
          </div>
          <p className="text-[11px] text-slate-700 mt-1">
            هل أنت أسرّ على حذف مسير الراتب هذا نهائياً من النظام؟ لا يمكن التراجع عن هذا الإجراء بعد تنفيذه.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <input type="hidden" name="payrollId" value={payrollId} />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#808080]">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
              className="win-btn px-3 py-1 text-xs font-bold"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="win-btn px-3 py-1 text-xs font-bold text-rose-900 bg-rose-50 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'جارٍ الحذف...' : 'حذف المسير نهائياً'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
