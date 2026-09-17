'use client';

import React, { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { CreditCard, CheckCircle2 } from 'lucide-react';

interface ConfirmPaymentModalProps {
  payrollId: string;
  employeeName: string;
  netPay: string;
  currency: string;
  confirmPaymentAction: (formData: FormData) => Promise<void>;
}

export function ConfirmPaymentModal({
  payrollId,
  employeeName,
  netPay,
  currency,
  confirmPaymentAction,
}: ConfirmPaymentModalProps) {
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
      await confirmPaymentAction(formData);
      setIsOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء تأكيد الدفع');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => {
          setErrorMessage(null);
          setIsOpen(true);
        }}
        className="bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
      >
        <CreditCard className="w-4 h-4 ml-1" />
        تأكيد الدفع
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="تأكيد صرف وتحويل الراتب"
        maxWidth="sm"
      >
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {errorMessage}
          </div>
        )}

        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
          <div>الموظف: <span className="font-bold">{employeeName}</span></div>
          <div className="mt-1">صافي الراتب المستحق: <span className="font-bold font-mono">{netPay} {currency}</span></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              طريقة الدفع <span className="text-red-500">*</span>
            </label>
            <select name="paymentMethod" required className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-600">
              <option value="BANK_TRANSFER">تحويل بنكي (BANK_TRANSFER)</option>
              <option value="CASH">نقدي (CASH)</option>
              <option value="CHEQUE">شيك بنكي (CHEQUE)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              المرجع المالي / رقم الحوالة <span className="text-red-500">*</span>
            </label>
            <input
              name="paymentReference"
              required
              placeholder="مثال: JOD-BNK-2026-991"
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 space-x-reverse pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-emerald-700 hover:bg-emerald-800 flex items-center"
            >
              <CheckCircle2 className="w-4 h-4 ml-1" />
              {isSubmitting ? 'جارٍ التأكيد...' : 'تأكيد الصرف النهائي'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
