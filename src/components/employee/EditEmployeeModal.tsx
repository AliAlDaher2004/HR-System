'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';

interface EditEmployeeModalProps {
  employee: any;
  updateEmployeeAction: (formData: FormData) => Promise<void>;
  buttonText?: string;
  buttonClassName?: string;
}

export function EditEmployeeModal({
  employee,
  updateEmployeeAction,
  buttonText = '✏️ تعديل البيانات',
  buttonClassName = 'win-btn text-xs font-bold px-2.5 py-1 flex items-center gap-1.5 text-[#0A246A]',
}: EditEmployeeModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states pre-filled with current employee data
  const [name, setName] = useState<string>(employee.name || '');
  const [department, setDepartment] = useState<string>(employee.department || '');
  const [jobTitle, setJobTitle] = useState<string>(employee.jobTitle || '');
  const [phone, setPhone] = useState<string>(employee.phone || '');
  const [employmentType, setEmploymentType] = useState<'PERMANENT' | 'PROBATIONARY' | 'DAILY_WORKER'>(
    employee.employmentType || 'PERMANENT'
  );
  const [startDate, setStartDate] = useState<string>(employee.startDate || '');
  const [endDate, setEndDate] = useState<string>(employee.endDate || '');
  const [ssRegistered, setSsRegistered] = useState<boolean>(Boolean(employee.socialSecurityRegistered));
  const [ssDate, setSsDate] = useState<string>(employee.socialSecurityRegistrationDate || '');
  const [dailyRate, setDailyRate] = useState<string>(
    employee.dailyRate ? String(employee.dailyRate) : ''
  );
  const [minuteDeductionRate, setMinuteDeductionRate] = useState<string>(
    employee.minuteDeductionRate ? String(employee.minuteDeductionRate) : ''
  );
  const [workStartTime, setWorkStartTime] = useState<string>(employee.workStartTime || '08:00');
  const [workEndTime, setWorkEndTime] = useState<string>(employee.workEndTime || '16:30');
  const [breakMinutes, setBreakMinutes] = useState<string>(
    employee.breakMinutes !== null && employee.breakMinutes !== undefined
      ? String(employee.breakMinutes)
      : '60'
  );

  const probationEndDatePreview = React.useMemo(() => {
    if (!startDate) return '';
    const [y, m, d] = startDate.split('-').map(Number);
    if (!y || !m || !d) return '';
    const date = new Date(y, m - 1 + 3, d);
    const ry = date.getFullYear();
    const rm = String(date.getMonth() + 1).padStart(2, '0');
    const rd = String(date.getDate()).padStart(2, '0');
    return `${ry}-${rm}-${rd}`;
  }, [startDate]);

  const handleOpen = () => {
    // Reset state to current employee props when modal opens
    setName(employee.name || '');
    setDepartment(employee.department || '');
    setJobTitle(employee.jobTitle || '');
    setPhone(employee.phone || '');
    setEmploymentType(employee.employmentType || 'PERMANENT');
    setStartDate(employee.startDate || '');
    setEndDate(employee.endDate || '');
    setSsRegistered(Boolean(employee.socialSecurityRegistered));
    setSsDate(employee.socialSecurityRegistrationDate || '');
    setDailyRate(employee.dailyRate ? String(employee.dailyRate) : '');
    setMinuteDeductionRate(employee.minuteDeductionRate ? String(employee.minuteDeductionRate) : '');
    setWorkStartTime(employee.workStartTime || '08:00');
    setWorkEndTime(employee.workEndTime || '16:30');
    setBreakMinutes(
      employee.breakMinutes !== null && employee.breakMinutes !== undefined
        ? String(employee.breakMinutes)
        : '60'
    );
    setErrorMessage(null);
    setIsOpen(true);
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (ssRegistered && !ssDate) {
        throw new Error('تاريخ التسجيل في الضمان الاجتماعي مطلوب عند اختيار (مسجل في الضمان)');
      }

      if (employmentType === 'DAILY_WORKER') {
        if (!dailyRate || isNaN(Number(dailyRate)) || Number(dailyRate) < 0) {
          throw new Error('أجر اليوم مطلوب لعمال المياومة ويجب أن يكون صفر أو أكثر');
        }
      }

      if (endDate && startDate && new Date(endDate) < new Date(startDate)) {
        throw new Error('تاريخ نهاية الخدمة لا يمكن أن يكون قبل تاريخ بداية العمل');
      }

      const formData = new FormData(e.currentTarget);
      formData.set('employeeId', employee.id);
      formData.set('name', name);
      formData.set('department', department);
      formData.set('jobTitle', jobTitle);
      formData.set('phone', phone);
      formData.set('employmentType', employmentType);
      formData.set('startDate', startDate);
      formData.set('endDate', endDate || '');
      formData.set('socialSecurityRegistered', ssRegistered ? 'true' : 'false');
      if (ssRegistered && ssDate) {
        formData.set('socialSecurityRegistrationDate', ssDate);
      } else {
        formData.delete('socialSecurityRegistrationDate');
      }
      if (employmentType === 'DAILY_WORKER') {
        formData.set('dailyRate', dailyRate);
      } else {
        formData.delete('dailyRate');
      }
      formData.set('minuteDeductionRate', minuteDeductionRate || '');
      formData.set('workStartTime', workStartTime || '');
      formData.set('workEndTime', workEndTime || '');
      formData.set('breakMinutes', breakMinutes || '');

      await updateEmployeeAction(formData);
      setIsOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء تعديل بيانات الموظف');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button type="button" onClick={handleOpen} className={buttonClassName}>
        <span>{buttonText}</span>
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`تعديل بيانات الموظف: ${employee.name} (${employee.employeeNo})`}
        maxWidth="lg"
      >
        {errorMessage && (
          <div className="mb-3 p-2 bg-rose-100 border border-rose-400 text-rose-900 text-xs win-sunken font-bold">
            ⚠ {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs select-none" dir="rtl">
          {/* Group 1: Basic Identity */}
          <fieldset className="border border-[#808080] p-2.5 bg-white">
            <legend className="px-1 text-black font-bold">البيانات الوظيفية والشخصية</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-black mb-0.5">الرقم الوظيفي (غير قابل للتعديل)</label>
                <input
                  value={employee.employeeNo}
                  disabled
                  className="win-input w-full py-1 px-2 font-mono font-bold bg-[#E0DDD5] text-slate-700 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-bold text-black mb-0.5">
                  الاسم الكامل <span className="text-rose-600">*</span>
                </label>
                <input
                  name="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
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
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="مهندس برمجيات / محاسب..."
                  className="win-input w-full py-1 px-2"
                />
              </div>

              <div>
                <label className="block font-bold text-black mb-0.5">رقم الهاتف</label>
                <input
                  name="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="win-input w-full py-1 px-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-black mb-0.5">تاريخ نهاية الخدمة (اختياري)</label>
                <input
                  name="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="win-input w-full py-1 px-2 font-mono"
                />
              </div>
            </div>
          </fieldset>

          {/* Group 2: Employment Type */}
          <fieldset className="border border-[#808080] p-2.5 bg-white">
            <legend className="px-1 text-black font-bold">نوع التوظيف والحالة</legend>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                  <input
                    type="radio"
                    name="employmentType"
                    value="PERMANENT"
                    checked={employmentType === 'PERMANENT'}
                    onChange={() => setEmploymentType('PERMANENT')}
                  />
                  <span>موظف مثبت / دائم</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-blue-900">
                  <input
                    type="radio"
                    name="employmentType"
                    value="PROBATIONARY"
                    checked={employmentType === 'PROBATIONARY'}
                    onChange={() => setEmploymentType('PROBATIONARY')}
                  />
                  <span>عقد تجريبي لمدة 3 أشهر (تحت التجربة)</span>
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

              {employmentType === 'PROBATIONARY' && (
                <div className="win-sunken p-2 bg-blue-50 border border-blue-400 text-blue-950 font-bold text-[11px] flex items-center justify-between">
                  <span>⏳ فترة التجربة: 3 أشهر من تاريخ المباشرة.</span>
                  <span>
                    تاريخ انتهاء التجربة المتوقع:{' '}
                    <strong className="font-mono text-blue-900 text-xs">{probationEndDatePreview}</strong>
                  </span>
                </div>
              )}

              {employmentType === 'DAILY_WORKER' && (
                <div className="win-sunken p-2 bg-[#FFFFF0] grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 border border-amber-300">
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
                      value={dailyRate}
                      onChange={(e) => setDailyRate(e.target.value)}
                      placeholder="مثال: 150.000"
                      className="win-input w-full py-1 px-2 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-black mb-0.5">سعر خصم الدقيقة (اختياري)</label>
                    <input
                      type="number"
                      name="minuteDeductionRate"
                      step="0.001"
                      min="0"
                      value={minuteDeductionRate}
                      onChange={(e) => setMinuteDeductionRate(e.target.value)}
                      placeholder="افتراضي النظام إن ترك فارغاً"
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
                </div>
              )}
            </div>
          </fieldset>

          {/* Group 4: Working Hours */}
          <fieldset className="border border-[#808080] p-2.5 bg-white">
            <legend className="px-1 text-black font-bold">أوقات الدوام المخصصة</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-black font-bold mb-0.5">وقت بدء الدوام</label>
                <input
                  type="time"
                  name="workStartTime"
                  value={workStartTime}
                  onChange={(e) => setWorkStartTime(e.target.value)}
                  className="win-input w-full py-1 px-2 font-mono"
                />
              </div>

              <div>
                <label className="block text-black font-bold mb-0.5">وقت نهاية الدوام</label>
                <input
                  type="time"
                  name="workEndTime"
                  value={workEndTime}
                  onChange={(e) => setWorkEndTime(e.target.value)}
                  className="win-input w-full py-1 px-2 font-mono"
                />
              </div>

              <div>
                <label className="block text-black font-bold mb-0.5">مدة الاستراحة (دقيقة)</label>
                <input
                  type="number"
                  name="breakMinutes"
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(e.target.value)}
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
              {isSubmitting ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
