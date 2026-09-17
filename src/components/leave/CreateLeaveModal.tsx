'use client';

import React, { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { Plus } from 'lucide-react';

interface CreateLeaveModalProps {
  employees: Array<{ id: string; name: string; employeeNo: string }>;
  createLeaveAction: (formData: FormData) => Promise<void>;
}

export function CreateLeaveModal({ employees, createLeaveAction }: CreateLeaveModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData(e.currentTarget);
      await createLeaveAction(formData);
      setIsOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء تقديم طلب الإجازة');
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
        تقديم طلب إجازة جديد
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="تقديم طلب إجازة جديد للموظف"
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
                تاريخ البداية <span className="text-red-500">*</span>
              </label>
              <input name="startDate" type="date" required className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#2169A6]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                تاريخ النهاية <span className="text-red-500">*</span>
              </label>
              <input name="endDate" type="date" required className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#2169A6]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                الأيام المحتسبة (ChargeDays) <span className="text-red-500">*</span>
              </label>
              <input name="chargeDays" type="number" step="0.5" defaultValue="1" required className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#2169A6]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">نوع الإجازة والراتب</label>
              <select name="paid" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#2169A6]">
                <option value="true">مدفوعة الراتب (خصم من الرصيد)</option>
                <option value="false">بدون راتب (خصم من مسير الراتب)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">سبب ومبررات الإجازة</label>
            <textarea name="reason" rows={2} placeholder="تفاصيل الإجازة..." className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#2169A6]" />
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
              {isSubmitting ? 'جارٍ التقديم...' : 'تقديم طلب الإجازة'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
