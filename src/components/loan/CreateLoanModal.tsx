'use client';

import React, { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { Plus } from 'lucide-react';

interface CreateLoanModalProps {
  employees: Array<{ id: string; name: string; employeeNo: string }>;
  createLoanAction: (formData: FormData) => Promise<void>;
}

export function CreateLoanModal({ employees, createLoanAction }: CreateLoanModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData(e.currentTarget);
      await createLoanAction(formData);
      setIsOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ السلفة');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          setErrorMessage(null);
          setIsOpen(true);
        }}
        className="flex items-center cursor-pointer shadow-sm"
      >
        <Plus className="w-4 h-4 ml-1.5" />
        اقتراح سلفة جديدة
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="بيانات السلفة المقترحة للموظف"
        maxWidth="md"
      >
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              الموظف <span className="text-red-500">*</span>
            </label>
            <select name="employeeId" required className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#2169A6]">
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.employeeNo})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                تاريخ تقديم السلفة <span className="text-red-500">*</span>
              </label>
              <input
                name="date"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#2169A6]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                مبلغ السلفة (JOD) <span className="text-red-500">*</span>
              </label>
              <input
                name="amount"
                type="number"
                step="0.001"
                required
                placeholder="3000.000"
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#2169A6]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">الغرض والملاحظات</label>
            <textarea
              name="notes"
              rows={2}
              placeholder="سبب طلب السلفة..."
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#2169A6]"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 space-x-reverse pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'جارٍ الحفظ...' : 'حفظ كمسودة سلفة مقترحة'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
