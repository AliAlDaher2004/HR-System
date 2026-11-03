'use client';

import React, { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { Plus } from 'lucide-react';

interface CreateLoanModalProps {
  employees: Array<{ id: string; name: string; employeeNo: string; status?: string }>;
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
                  {e.name} ({e.employeeNo}){e.status === 'TERMINATED' ? ' 📁 [مؤرشف]' : ''}
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
                placeholder="300.000"
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#2169A6]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-2.5 bg-blue-50/60 rounded border border-blue-100">
            <div>
              <label className="block text-xs font-semibold text-blue-950 mb-1">
                فترة التقسيط (عدد الأشهر)
              </label>
              <select
                name="installmentMonths"
                defaultValue="1"
                className="w-full px-2.5 py-1.5 border rounded text-xs bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">شهر واحد (سلفة شهرية عادية)</option>
                <option value="2">شهرين (2)</option>
                <option value="3">3 أشهر (سلفة طويلة الأمد)</option>
                <option value="4">4 أشهر</option>
                <option value="5">5 أشهر</option>
                <option value="6">6 أشهر</option>
                <option value="10">10 أشهر</option>
                <option value="12">12 شهراً (سنة كاملة)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-blue-950 mb-1">
                شهر بدء الخصم بالرواتب
              </label>
              <input
                name="startMonth"
                type="month"
                defaultValue={new Date().toISOString().slice(0, 7)}
                className="w-full px-2.5 py-1.5 border rounded text-xs bg-white font-mono focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 p-2 bg-emerald-50 rounded border border-emerald-200 cursor-pointer">
            <input
              type="checkbox"
              name="disburseImmediately"
              value="true"
              defaultChecked
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-xs font-bold text-emerald-950">
              صرف السلفة فورياً وترحيل القسط مباشرة إلى مسيرات الرواتب وبيان الرواتب
            </span>
          </label>

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
            <Button type="submit" disabled={isSubmitting} className="bg-[#0A246A] hover:bg-[#07194A] text-white">
              {isSubmitting ? 'جارٍ الحفظ والترحيل...' : 'حفظ وترحيل السلفة'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
