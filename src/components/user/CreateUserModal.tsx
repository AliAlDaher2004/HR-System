'use client';

import React, { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { Plus, UserPlus } from 'lucide-react';

interface CreateUserModalProps {
  createUserAction: (formData: FormData) => Promise<void>;
}

export function CreateUserModal({ createUserAction }: CreateUserModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData(e.currentTarget);
      await createUserAction(formData);
      setIsOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء إنشاء المستخدم');
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
        إضافة مستخدم جديد
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="إنشاء حساب مستخدم جديد وتحديد الصلاحيات"
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
              البريد الإلكتروني <span className="text-red-500">*</span>
            </label>
            <input
              name="email"
              type="email"
              required
              placeholder="user@company.com"
              className="w-full px-3 py-2 border rounded-lg text-sm text-left focus:ring-2 focus:ring-[#2169A6]"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              الاسم الكامل <span className="text-red-500">*</span>
            </label>
            <input
              name="fullName"
              required
              placeholder="الاسم ثلاثي أو رباعي"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#2169A6]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              الدور والصلاحية في النظام <span className="text-red-500">*</span>
            </label>
            <select
              name="role"
              required
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#2169A6]"
            >
              <option value="ADMIN">إدارة (ADMIN) - كامل الصلاحيات والاعتمادات</option>
              <option value="HR">موارد بشرية (HR) - إدارة الموظفين، الحضور، الإجازات، الوثائق</option>
              <option value="ACCOUNTANT">محاسب (ACCOUNTANT) - إعداد الرواتب، السلف، وسندات الصرف</option>
              <option value="SUPERVISOR">مشرف (SUPERVISOR) - تسجيل ومراجعة الحضور الميداني فقط</option>
            </select>
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
              <UserPlus className="w-4 h-4 ml-1.5" />
              {isSubmitting ? 'جارٍ الإنشاء...' : 'إنشاء وتفعيل الحساب'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
