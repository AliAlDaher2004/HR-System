'use client';

import React, { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { Plus } from 'lucide-react';

interface CreateAttendanceModalProps {
  employees: Array<{ id: string; name: string; employeeNo: string }>;
  addAttendanceAction: (formData: FormData) => Promise<void>;
}

export function CreateAttendanceModal({ employees, addAttendanceAction }: CreateAttendanceModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData(e.currentTarget);
      await addAttendanceAction(formData);
      setIsOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء تسجيل الحضور');
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
        تسجيل حضور يومي
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="تسجيل سجل حضور جديد"
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              تاريخ العمل <span className="text-red-500">*</span>
            </label>
            <input
              name="workDate"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#2169A6]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              نوع الحضور والغياب <span className="text-red-500">*</span>
            </label>
            <select name="attendanceType" required className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#2169A6]">
              <option value="PRESENT">حاضر (PRESENT)</option>
              <option value="EXCUSED_ABSENCE">غياب بعذر - خصم 1 يوم (EXCUSED_ABSENCE)</option>
              <option value="UNEXCUSED_ABSENCE">غياب بدون عذر - خصم 2 يوم عقوبة (UNEXCUSED_ABSENCE)</option>
              <option value="HOLIDAY">عطلة رسمية (HOLIDAY)</option>
              <option value="PAID_LEAVE">إجازة مدفوعة (PAID_LEAVE)</option>
              <option value="UNPAID_LEAVE">إجازة بدون راتب (UNPAID_LEAVE)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">سبب الغياب / ملاحظات الحضور</label>
            <input
              name="notes"
              type="text"
              placeholder="مثال: ظرف صحي طارئ، إذن مسبق..."
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#2169A6]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">وقت الدخول (HH:mm)</label>
              <input name="clockIn" type="time" className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#2169A6]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">وقت الخروج (HH:mm)</label>
              <input name="clockOut" type="time" className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#2169A6]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">وقت الاستراحة (بالدقائق)</label>
              <input
                name="breakMinutes"
                type="number"
                defaultValue="60"
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#2169A6]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ساعات العمل الإضافي المعتمدة</label>
              <input
                name="approvedOtHours"
                type="number"
                step="0.5"
                defaultValue="0"
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#2169A6]"
              />
            </div>
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
              {isSubmitting ? 'جارٍ التسجيل...' : 'تسجيل وحفظ'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
