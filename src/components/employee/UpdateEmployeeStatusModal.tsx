'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui';
import { AlertCircle, UserCheck, UserX } from 'lucide-react';

interface UpdateEmployeeStatusModalProps {
  employeeId: string;
  employeeName: string;
  currentStatus: 'ACTIVE' | 'TERMINATED';
  currentEndDate?: string | null;
  updateStatusAction: (formData: FormData) => Promise<void>;
}

export function UpdateEmployeeStatusModal({
  employeeId,
  employeeName,
  currentStatus,
  currentEndDate,
  updateStatusAction,
}: UpdateEmployeeStatusModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<'ACTIVE' | 'TERMINATED'>(currentStatus);
  const [endDate, setEndDate] = useState<string>(currentEndDate || new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.set('status', status);
      if (status === 'TERMINATED') {
        formData.set('endDate', endDate);
      } else {
        formData.set('endDate', '');
      }

      await updateStatusAction(formData);
      setIsOpen(false);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحديث الحالة الوظيفية');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="win-btn text-xs font-bold px-2 py-1 flex items-center gap-1 text-[#0A246A]"
      >
        <span>⚙️</span>
        <span>تعديل الحالة الوظيفية / الأرشفة</span>
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`تحديث الحالة الوظيفية للموظف: ${employeeName}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs select-none" dir="rtl">
          {error && (
            <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2.5 rounded text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-[#ECE9D8] win-raised p-2.5 space-y-2">
            <label className="block font-bold text-black text-xs mb-1">الحالة الوظيفية الجديدة</label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex items-center gap-2 p-2 border rounded cursor-pointer font-bold transition-all ${
                  status === 'ACTIVE'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm'
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value="ACTIVE"
                  checked={status === 'ACTIVE'}
                  onChange={() => setStatus('ACTIVE')}
                  className="accent-emerald-600"
                />
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>على رأس العمل (نشط)</span>
              </label>

              <label
                className={`flex items-center gap-2 p-2 border rounded cursor-pointer font-bold transition-all ${
                  status === 'TERMINATED'
                    ? 'bg-rose-50 border-rose-500 text-rose-900 shadow-sm'
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value="TERMINATED"
                  checked={status === 'TERMINATED'}
                  onChange={() => setStatus('TERMINATED')}
                  className="accent-rose-600"
                />
                <UserX className="w-4 h-4 text-rose-600" />
                <span>أرشفة (إنهاء خدمة)</span>
              </label>
            </div>
          </div>

          {status === 'TERMINATED' ? (
            <div className="space-y-1 bg-amber-50 border border-amber-200 p-3 rounded">
              <label className="block font-bold text-amber-900 text-xs">
                تاريخ نهاية الخدمة / تاريخ المغادرة <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="win-input w-full py-1.5 px-2 bg-white"
              />
              <p className="text-[11px] text-amber-800 mt-1">
                سيتم حفظ كافة سجلات الموظف السابقة (العقود، الحضور، الرواتب) ونقله إلى قسم أرشيف الكوادر المنتهية خدمتهم.
              </p>
            </div>
          ) : (
            <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-900 text-[11px] rounded">
              إعادة الموظف إلى حالة النشاط تجعله مؤهلاً لإدراج اسمه في مسيرات الرواتب وسجلات الحضور والعمل المباشر.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={loading}
              className="text-xs"
            >
              إلغاء
            </Button>
            <Button type="submit" disabled={loading} className="text-xs font-bold">
              {loading ? 'جاري الحفظ...' : 'تأكيد وحفظ الحالة'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
