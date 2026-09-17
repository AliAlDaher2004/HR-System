import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getDb, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { RBAC } from '@/lib/auth/rbac';
import { revalidatePath } from 'next/cache';
import { logAuditEvent } from '@/lib/auth/audit';
import { getSystemSettings } from '@/lib/services/settings-service';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!RBAC.canManageSettings(user.role)) {
    redirect('/');
  }

  const settings = await getSystemSettings();

  async function handleSaveSettings(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser || !RBAC.canManageSettings(currentUser.role)) {
      throw new Error('غير مصرح بتعديل الإعدادات');
    }

    const companyName = formData.get('companyName') as string;
    const country = formData.get('country') as string;
    const timezone = formData.get('timezone') as string;
    const payrollPolicy = formData.get('payrollPolicy') as string;
    const payrollPolicyConfirmed = formData.get('payrollPolicyConfirmed') === 'true';

    const defaultWorkStartTime = (formData.get('defaultWorkStartTime') as string) || '08:00:00';
    const defaultWorkEndTime = (formData.get('defaultWorkEndTime') as string) || '17:00:00';
    const defaultBreakMinutes = parseInt((formData.get('defaultBreakMinutes') as string) || '60', 10);
    const defaultMinuteDeductionRate = formData.get('defaultMinuteDeductionRate')
      ? parseFloat(formData.get('defaultMinuteDeductionRate') as string)
      : null;
    const defaultOtRate = formData.get('defaultOtRate')
      ? parseFloat(formData.get('defaultOtRate') as string)
      : 2.500;

    const currentDb = getDb();
    const [existing] = await currentDb.select().from(schema.settings).limit(1);

    if (existing) {
      await currentDb
        .update(schema.settings)
        .set({
          companyName,
          country,
          timezone,
          payrollPolicy,
          payrollPolicyConfirmed,
          defaultWorkStartTime,
          defaultWorkEndTime,
          defaultBreakMinutes,
          defaultMinuteDeductionRate: defaultMinuteDeductionRate !== null ? defaultMinuteDeductionRate.toFixed(3) : null,
          defaultOtRate: defaultOtRate.toFixed(3),
          updatedBy: currentUser.id,
          updatedAt: new Date(),
        })
        .where(eq(schema.settings.id, existing.id));

      await logAuditEvent({
        actor: currentUser,
        tableName: 'settings',
        recordId: existing.id,
        action: 'UPDATE_COMPANY_SETTINGS',
        metadata: {
          payrollPolicyConfirmed,
          defaultWorkStartTime,
          defaultWorkEndTime,
          defaultBreakMinutes,
          defaultMinuteDeductionRate,
        },
      });
    }

    revalidatePath('/settings');
    revalidatePath('/');
  }

  return (
    <div className="space-y-2 select-none max-w-4xl mx-auto text-xs">
      {/* Windows 2000 Titlebar */}
      <div className="win-raised p-2 flex items-center justify-between bg-[#ECE9D8]">
        <div>
          <h1 className="text-sm font-bold text-black flex items-center gap-1.5">
            <span>⚙</span>
            <span>إعدادات النظام وسياسات الدوام والرواتب المعتمدة</span>
          </h1>
          <p className="text-[#505050] text-[11px] mt-0.5">
            تحديد مواعيد الدوام القياسية للشركة، سعر خصم الدقيقة الافتراضي، وسياسة صرف الرواتب
          </p>
        </div>
      </div>

      {!settings?.payrollPolicyConfirmed && (
        <div className="win-sunken p-2.5 bg-amber-50 border border-amber-400 text-amber-950 font-bold">
          ⚠ تنبيه حاسم: لا يمكن اعتماد كشوف الرواتب الشهرية ما لم يتم تفعيل خيار (تأكيد واعتماد سياسة الرواتب) أدناه.
        </div>
      )}

      <div className="win-raised p-3 bg-[#ECE9D8]">
        <form action={handleSaveSettings} className="space-y-3">
          {/* Section 1: Company Profile */}
          <fieldset className="border border-[#808080] p-3 bg-white">
            <legend className="px-1 text-black font-bold">بيانات الشركة الأساسية</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-black mb-0.5">اسم الشركة / المؤسسة *</label>
                <input
                  name="companyName"
                  defaultValue={settings?.companyName || ''}
                  required
                  className="win-input w-full py-1 px-2"
                />
              </div>

              <div>
                <label className="block font-bold text-black mb-0.5">الدولة *</label>
                <input
                  name="country"
                  defaultValue={settings?.country || 'المملكة الأردنية الهاشمية'}
                  required
                  className="win-input w-full py-1 px-2"
                />
              </div>

              <div>
                <label className="block font-bold text-black mb-0.5">العملة التشغيلية المعتمدة</label>
                <input
                  value={settings?.currency || 'JOD'}
                  disabled
                  className="win-input w-full py-1 px-2 bg-slate-100 font-mono text-slate-500 cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  تغيير العملة محظور لحماية السجلات المالية التاريخية.
                </span>
              </div>

              <div>
                <label className="block font-bold text-black mb-0.5">المنطقة الزمنية *</label>
                <input
                  name="timezone"
                  defaultValue={settings?.timezone || 'Asia/Amman'}
                  required
                  className="win-input w-full py-1 px-2 font-mono"
                />
              </div>
            </div>
          </fieldset>

          {/* Section 2: Default Work Schedule & Minute Lateness */}
          <fieldset className="border border-[#808080] p-3 bg-white">
            <legend className="px-1 text-[#0A246A] font-bold">مواعيد الدوام القياسية للشركة وسعر خصم الدقيقة</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block font-bold text-black mb-0.5">وقت بدء الدوام الافتراضي</label>
                <input
                  type="time"
                  name="defaultWorkStartTime"
                  defaultValue={settings?.defaultWorkStartTime?.slice(0, 5) || '08:00'}
                  required
                  className="win-input w-full py-1 px-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-black mb-0.5">وقت نهاية الدوام الافتراضي</label>
                <input
                  type="time"
                  name="defaultWorkEndTime"
                  defaultValue={settings?.defaultWorkEndTime?.slice(0, 5) || '17:00'}
                  required
                  className="win-input w-full py-1 px-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-black mb-0.5">مدة الاستراحة الافتراضية (دقيقة)</label>
                <input
                  type="number"
                  name="defaultBreakMinutes"
                  defaultValue={settings?.defaultBreakMinutes ?? 60}
                  min="0"
                  required
                  className="win-input w-full py-1 px-2 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-black mb-0.5">سعر خصم الدقيقة الافتراضي</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  name="defaultMinuteDeductionRate"
                  defaultValue={settings?.defaultMinuteDeductionRate ? Number(settings.defaultMinuteDeductionRate).toFixed(3) : '0.500'}
                  required
                  className="win-input w-full py-1 px-2 font-mono font-bold"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  يُطبق في حال عدم تحديد سعر مخصص في ملف الموظف.
                </span>
              </div>

              <div>
                <label className="block font-bold text-black mb-0.5">سعر/معدل أجر الساعة الإضافية (د.أ/ساعة) *</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  name="defaultOtRate"
                  defaultValue={settings?.defaultOtRate ? Number(settings.defaultOtRate).toFixed(3) : '2.500'}
                  required
                  className="win-input w-full py-1 px-2 font-mono font-bold text-purple-900 bg-purple-50"
                />
                <span className="text-[10px] text-purple-700 block mt-0.5 font-semibold">
                  سعر أجر الساعة الإضافية المعتمد للشركة لتطبيق الاحتساب الآلي في الرواتب.
                </span>
              </div>
            </div>
          </fieldset>

          {/* Section 3: Payroll Policy Text & Confirmation */}
          <fieldset className="border border-[#808080] p-3 bg-white">
            <legend className="px-1 text-black font-bold">لائحة وسياسة الرواتب والأجور</legend>
            <div className="space-y-2">
              <textarea
                name="payrollPolicy"
                rows={3}
                defaultValue={settings?.payrollPolicy || ''}
                required
                className="win-input w-full py-1 px-2 text-xs leading-relaxed"
              />

              <div className="win-sunken p-2 bg-[#F5F5F5] flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="confirmPolicy"
                  name="payrollPolicyConfirmed"
                  value="true"
                  defaultChecked={settings?.payrollPolicyConfirmed ?? false}
                  className="w-4 h-4"
                />
                <label htmlFor="confirmPolicy" className="text-xs font-bold text-black cursor-pointer">
                  تأكيد واعتماد سياسة الرواتب (السماح باعتماد وتجميد كشوف الرواتب الشهرية)
                </label>
              </div>
            </div>
          </fieldset>

          <div className="flex justify-end pt-2 border-t border-[#808080]">
            <button
              type="submit"
              className="win-btn px-6 py-1.5 font-bold text-[#0A246A] flex items-center gap-1.5"
            >
              <span>💾</span>
              <span>حفظ الإعدادات المعتمدة</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
