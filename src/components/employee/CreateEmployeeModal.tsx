'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Plus } from 'lucide-react';

interface CreateEmployeeModalProps {
  createEmployeeAction: (formData: FormData) => Promise<void>;
}

export function CreateEmployeeModal({ createEmployeeAction }: CreateEmployeeModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dynamic form state
  const [employmentType, setEmploymentType] = useState<'PERMANENT' | 'DAILY_WORKER'>('PERMANENT');
  const [ssRegistered, setSsRegistered] = useState<boolean>(false);
  const [ssDate, setSsDate] = useState<string>('');
  const [contractSigned, setContractSigned] = useState<boolean>(true);
  const [contractSignedDate, setContractSignedDate] = useState<string>('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (ssRegistered && !ssDate) {
        throw new Error('تاريخ التسجيل في الضمان الاجتماعي مطلوب عند اختيار (مسجل في الضمان)');
      }

      const formData = new FormData(e.currentTarget);

      if (employmentType === 'PERMANENT') {
        const basicRaw = formData.get('monthlyBasic');
        if (!basicRaw || isNaN(Number(basicRaw)) || Number(basicRaw) <= 0) {
          throw new Error('الراتب الأساسي الشهري مطلوب للموظفين المثبتين ويجب أن يكون أكبر من صفر');
        }
      }

      formData.set('socialSecurityRegistered', ssRegistered ? 'true' : 'false');
      if (ssRegistered && ssDate) {
        formData.set('socialSecurityRegistrationDate', ssDate);
      } else {
        formData.delete('socialSecurityRegistrationDate');
      }

      formData.set('contractSigned', contractSigned ? 'true' : 'false');
      if (contractSigned && contractSignedDate) {
        formData.set('contractSignedDate', contractSignedDate);
      }

      await createEmployeeAction(formData);
      setIsOpen(false);
      // Reset form
      setEmploymentType('PERMANENT');
      setSsRegistered(false);
      setSsDate('');
      setContractSigned(true);
      setContractSignedDate('');
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ بيانات الموظف');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErrorMessage(null);
          setIsOpen(true);
        }}
        className="win-btn text-xs font-bold py-1 px-3 flex items-center gap-1.5 shadow-sm"
      >
        <span className="text-emerald-700 font-bold text-sm">+</span>
        <span>إضافة موظف جديد</span>
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="معالج إضافة موظف جديد إلى السجل العام"
        maxWidth="lg"
      >
        {errorMessage && (
          <div className="mb-3 p-2 bg-rose-100 border border-rose-400 text-rose-900 text-xs win-sunken font-bold">
            ⚠ {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {/* Group 1: Basic Identity */}
          <fieldset className="border border-[#808080] p-2.5 bg-white">
            <legend className="px-1 text-black font-bold">البيانات الوظيفية والشخصية</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-black mb-0.5">
                  الرقم الوظيفي <span className="text-rose-600">*</span>
                </label>
                <input
                  name="employeeNo"
                  required
                  placeholder="EMP-1009"
                  className="win-input w-full py-1 px-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-black mb-0.5">
                  الاسم الكامل <span className="text-rose-600">*</span>
                </label>
                <input
                  name="name"
                  required
                  placeholder="الاسم الثلاثي أو الرباعي"
                  className="win-input w-full py-1 px-2"
                />
              </div>

              <div>
                <label className="block font-bold text-black mb-0.5">
                  القسم / الإدارة <span className="text-rose-600">*</span>
                </label>
                <input
                  name="department"
                  required
                  placeholder="تقنية المعلومات / المالية..."
                  className="win-input w-full py-1 px-2"
                />
              </div>

              <div>
                <label className="block font-bold text-black mb-0.5">
                  المسمى الوظيفي <span className="text-rose-600">*</span>
                </label>
                <input
                  name="jobTitle"
                  required
                  placeholder="مهندس برمجيات / محاسب..."
                  className="win-input w-full py-1 px-2"
                />
              </div>

              <div>
                <label className="block font-bold text-black mb-0.5">رقم الهاتف</label>
                <input
                  name="phone"
                  type="tel"
                  placeholder="+966500000000"
                  className="win-input w-full py-1 px-2 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-black mb-0.5">
                  تاريخ بداية العمل <span className="text-rose-600">*</span>
                </label>
                <input
                  name="startDate"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="win-input w-full py-1 px-2 font-mono font-bold"
                />
              </div>
            </div>
          </fieldset>

          {/* Group 2: Employment Type (Permanent vs Daily Worker) */}
          <fieldset className="border border-[#808080] p-2.5 bg-white">
            <legend className="px-1 text-black font-bold">نوع التوظيف وعقود المياومة</legend>
            <div className="space-y-2">
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                  <input
                    type="radio"
                    name="employmentType"
                    value="PERMANENT"
                    checked={employmentType === 'PERMANENT'}
                    onChange={() => setEmploymentType('PERMANENT')}
                  />
                  <span>موظف مثبت / دائم (عقد شهري)</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-amber-900">
                  <input
                    type="radio"
                    name="employmentType"
                    value="DAILY_WORKER"
                    checked={employmentType === 'DAILY_WORKER'}
                    onChange={() => setEmploymentType('DAILY_WORKER')}
                  />
                  <span>عامل مياومة (أجر يومي)</span>
                </label>
              </div>

              {employmentType === 'PERMANENT' && (
                <div className="win-sunken p-2.5 bg-[#F0F4F8] grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-1.5 border border-[#808080]">
                  <div>
                    <label className="block font-bold text-black mb-0.5">
                      الراتب الأساسي الشهري <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="number"
                      name="monthlyBasic"
                      step="0.001"
                      min="0.001"
                      required={employmentType === 'PERMANENT'}
                      placeholder="مثال: 500.000"
                      className="win-input w-full py-1.5 px-2 font-mono font-bold text-[#0A246A]"
                    />
                    <span className="text-[10px] text-slate-600 block mt-0.5">
                      الراتب المعتمد لحساب البدلات والرواتب والعقود.
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-black mb-0.5">
                      البدلات الشهرية (اختياري)
                    </label>
                    <input
                      type="number"
                      name="monthlyAllowances"
                      step="0.001"
                      min="0"
                      placeholder="مثال: 50.000"
                      className="win-input w-full py-1.5 px-2 font-mono"
                    />
                    <span className="text-[10px] text-slate-600 block mt-0.5">
                      إجمالي البدلات المضافة للراتب الأساسي.
                    </span>
                  </div>

                  <div className="col-span-1 sm:col-span-2 bg-white p-2.5 border border-slate-300 rounded space-y-2 mt-1">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-black text-xs">
                        <input
                          type="checkbox"
                          checked={contractSigned}
                          onChange={(e) => setContractSigned(e.target.checked)}
                          className="w-4 h-4 accent-emerald-600"
                        />
                        <span>هل تم توقيع العقد من قِبل الموظف؟</span>
                      </label>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${contractSigned ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
                        {contractSigned ? 'العقد موقع (ON)' : 'العقد غير موقع (OFF)'}
                      </span>
                    </div>

                    {contractSigned && (
                      <div>
                        <label className="block font-bold text-slate-700 text-[11px] mb-0.5">
                          تاريخ توقيع العقد (افتراضي تاريخ المباشرة إن ترك فارغاً)
                        </label>
                        <input
                          type="date"
                          value={contractSignedDate}
                          onChange={(e) => setContractSignedDate(e.target.value)}
                          className="win-input w-full py-1 px-2 font-mono text-xs"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {employmentType === 'DAILY_WORKER' && (
                <div className="win-sunken p-2 bg-[#FFFFF0] grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  <div>
                    <label className="block font-bold text-black mb-0.5">
                      أجر اليوم (Daily Rate) <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="number"
                      name="dailyRate"
                      step="0.001"
                      min="0"
                      required={employmentType === 'DAILY_WORKER'}
                      placeholder="مثال: 150.000"
                      className="win-input w-full py-1 px-2 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-black mb-0.5">
                      سعر خصم الدقيقة (Minute Deduction Rate)
                    </label>
                    <input
                      type="number"
                      name="minuteDeductionRate"
                      step="0.001"
                      min="0"
                      placeholder="افتراضي النظام إن ترك فارغاً"
                      className="win-input w-full py-1 px-2 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-black mb-0.5">
                      تاريخ بدء العمل المؤقت <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="date"
                      name="temporaryStartDate"
                      required={employmentType === 'DAILY_WORKER'}
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      className="win-input w-full py-1 px-2 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-black mb-0.5">
                      تاريخ انتهاء العمل المؤقت (اختياري)
                    </label>
                    <input
                      type="date"
                      name="temporaryEndDate"
                      className="win-input w-full py-1 px-2 font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </fieldset>

          {/* Group 3: Social Security Status */}
          <fieldset className="border border-[#808080] p-2.5 bg-white">
            <legend className="px-1 text-black font-bold">الضمان الاجتماعي</legend>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-black">
                <input
                  type="checkbox"
                  checked={ssRegistered}
                  onChange={(e) => {
                    setSsRegistered(e.target.checked);
                    if (!e.target.checked) setSsDate('');
                  }}
                  className="w-4 h-4"
                />
                <span>مسجل في الضمان الاجتماعي؟</span>
              </label>

              {ssRegistered && (
                <div className="win-sunken p-2 bg-[#F0F8FF] mt-1">
                  <label className="block font-bold text-[#0A246A] mb-0.5">
                    تاريخ التسجيل في الضمان الاجتماعي <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    required={ssRegistered}
                    value={ssDate}
                    onChange={(e) => setSsDate(e.target.value)}
                    className="win-input w-full py-1 px-2 font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    إلزامي طالما أن الموظف مسجل في الضمان الاجتماعي.
                  </span>
                </div>
              )}
            </div>
          </fieldset>

          {/* Group 4: Working Hours (Optional overrides) */}
          <fieldset className="border border-[#808080] p-2.5 bg-white">
            <legend className="px-1 text-black font-bold">أوقات الدوام المخصصة (اختياري)</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-black font-bold mb-0.5">وقت بدء الدوام</label>
                <input
                  type="time"
                  name="workStartTime"
                  defaultValue="08:00"
                  className="win-input w-full py-1 px-2 font-mono"
                />
              </div>

              <div>
                <label className="block text-black font-bold mb-0.5">وقت نهاية الدوام</label>
                <input
                  type="time"
                  name="workEndTime"
                  defaultValue="17:00"
                  className="win-input w-full py-1 px-2 font-mono"
                />
              </div>

              <div>
                <label className="block text-black font-bold mb-0.5">مدة الاستراحة (دقيقة)</label>
                <input
                  type="number"
                  name="breakMinutes"
                  defaultValue="60"
                  min="0"
                  className="win-input w-full py-1 px-2 font-mono"
                />
              </div>
            </div>
          </fieldset>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#808080]">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
              className="win-btn px-4 py-1 text-black"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="win-btn px-5 py-1 font-bold text-[#0A246A]"
            >
              {isSubmitting ? 'جارٍ الحفظ...' : 'حفظ الموظف الجديد'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
