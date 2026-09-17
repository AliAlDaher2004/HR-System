'use client';

import React, { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { Plus, Upload } from 'lucide-react';

interface UploadDocumentModalProps {
  employees: Array<{ id: string; name: string; employeeNo: string }>;
  uploadDocumentAction: (formData: FormData) => Promise<void>;
}

export function UploadDocumentModal({
  employees,
  uploadDocumentAction,
}: UploadDocumentModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData(e.currentTarget);
      await uploadDocumentAction(formData);
      setIsOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء رفع الوثيقة');
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
        رفع وثيقة جديدة
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="رفع وثيقة جديدة للموظف في التخزين الآمن"
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
                نوع الوثيقة <span className="text-red-500">*</span>
              </label>
              <select name="type" required className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#2169A6]">
                <option value="IDENTITY">بطاقة هوية وطنية (IDENTITY)</option>
                <option value="RESIDENCY">إقامة (RESIDENCY)</option>
                <option value="WORK_PERMIT">تصريح عمل (WORK_PERMIT)</option>
                <option value="CERTIFICATE">شهادة مهنية / مؤهل (CERTIFICATE)</option>
                <option value="OTHER">وثيقة أخرى (OTHER)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">تاريخ انتهاء الصلاحية</label>
              <input name="expiryDate" type="date" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#2169A6]" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              تحديد الملف (PDF أو صورة) <span className="text-red-500">*</span>
            </label>
            <input
              name="file"
              type="file"
              required
              accept=".pdf,.png,.jpg,.jpeg,.docx"
              className="w-full px-3 py-2 border rounded-lg text-xs file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-blue-50 file:text-[#2169A6] hover:file:bg-blue-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات الوثيقة</label>
            <textarea
              name="notes"
              rows={2}
              placeholder="ملاحظات حول الوثيقة أو التجديد..."
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
            <Button type="submit" disabled={isSubmitting} className="flex items-center">
              <Upload className="w-4 h-4 ml-1.5" />
              {isSubmitting ? 'جارٍ الرفع والتشفير...' : 'رفع وحفظ الوثيقة'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
