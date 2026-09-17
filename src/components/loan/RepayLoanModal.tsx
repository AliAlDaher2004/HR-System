'use client';

import React, { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { HandCoins } from 'lucide-react';

interface RepayLoanModalProps {
  loanId: string;
  employeeName: string;
  remainingAmount: string;
  currency: string;
  repayLoanAction: (formData: FormData) => Promise<void>;
}

export function RepayLoanModal({
  loanId,
  employeeName,
  remainingAmount,
  currency,
  repayLoanAction,
}: RepayLoanModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData(e.currentTarget);
      formData.set('loanId', loanId);
      await repayLoanAction(formData);
      setIsOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء تسجيل السداد');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          setErrorMessage(null);
          setIsOpen(true);
        }}
        className="text-teal-700 border-teal-300 hover:bg-teal-50 cursor-pointer"
      >
        <HandCoins className="w-3.5 h-3.5 ml-1" />
        سداد نقدي
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`تسجيل سداد نقدي للموظف: ${employeeName}`}
        maxWidth="sm"
      >
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {errorMessage}
          </div>
        )}

        <div className="mb-3 p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-800">
          المبلغ المتبقي على السلفة: <span className="font-bold font-mono">{remainingAmount} {currency}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <input type="hidden" name="loanId" value={loanId} />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              مبلغ السداد النقدي ({currency}) <span className="text-red-500">*</span>
            </label>
            <input
              name="amount"
              type="number"
              step="0.001"
              max={remainingAmount}
              required
              placeholder="0.000"
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              تاريخ استلام السداد <span className="text-red-500">*</span>
            </label>
            <input
              name="date"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
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
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'جارٍ التأكيد...' : 'تأكيد وقيد السداد'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
