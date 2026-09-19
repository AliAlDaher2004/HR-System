/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useTransition } from 'react';
import { Badge } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { formatDurationArabic } from '@/lib/utils/time';
import { UpdateEmployeeStatusModal } from './UpdateEmployeeStatusModal';
import { EditEmployeeModal } from './EditEmployeeModal';
import { ContractSignedToggle } from './ContractSignedToggle';

interface EmployeeDetailTabsProps {
  employee: any;
  userRole: string;
  initialTab?: string;
  contracts: any[];
  attendances: any[];
  leaveBalances: any[];
  leaveRequests: any[];
  loans: any[];
  payrolls: any[];
  documents: any[];
  identityImages?: { frontUrl: string | null; backUrl: string | null };
  createContractAction?: (formData: FormData) => Promise<void>;
  updateSocialSecurityAction?: (formData: FormData) => Promise<void>;
  uploadIdentityImageAction?: (side: 'front' | 'back', formData: FormData) => Promise<void>;
  updateScheduleAction?: (formData: FormData) => Promise<void>;
  updateEmployeeAction?: (formData: FormData) => Promise<void>;
  updateStatusAction?: (formData: FormData) => Promise<void>;
  toggleContractSignedAction?: (formData: FormData) => Promise<void>;
}

export function EmployeeDetailTabs({
  employee,
  userRole,
  initialTab = 'basic',
  contracts,
  attendances,
  leaveBalances,
  leaveRequests,
  loans,
  payrolls,
  documents,
  identityImages = { frontUrl: null, backUrl: null },
  createContractAction,
  updateSocialSecurityAction,
  uploadIdentityImageAction,
  updateScheduleAction,
  updateEmployeeAction,
  updateStatusAction,
  toggleContractSignedAction,
}: EmployeeDetailTabsProps) {
  const [currentTab, setCurrentTab] = useState(initialTab);
  const [isPending, startTransition] = useTransition();

  // Social Security state
  const [ssRegistered, setSsRegistered] = useState<boolean>(Boolean(employee.socialSecurityRegistered));
  const [ssDate, setSsDate] = useState<string>(employee.socialSecurityRegistrationDate || '');
  const [ssFeedback, setSsFeedback] = useState<string | null>(null);

  // Contract Modal state
  const [showContractModal, setShowContractModal] = useState(false);
  const [contractSigned, setContractSigned] = useState(false);
  const [contractSignedDate, setContractSignedDate] = useState('');

  // Lightbox Modal for ID Cards
  const [lightboxImg, setLightboxImg] = useState<{ open: boolean; url: string; title: string }>({
    open: false,
    url: '',
    title: '',
  });

  // Permissions
  const canViewContracts = ['ADMIN', 'HR', 'ACCOUNTANT'].includes(userRole);
  const canManageContracts = ['ADMIN', 'HR'].includes(userRole);
  const canViewLeaves = ['ADMIN', 'HR', 'ACCOUNTANT'].includes(userRole);
  const canViewLoans = ['ADMIN', 'ACCOUNTANT'].includes(userRole);
  const canViewFinancials = ['ADMIN', 'ACCOUNTANT'].includes(userRole);
  const canViewDocuments = ['ADMIN', 'HR'].includes(userRole);
  const canViewIdentityImages = ['ADMIN', 'HR'].includes(userRole);

  const tabs = [
    { key: 'basic', label: 'البيانات الأساسية', show: true },
    { key: 'social_security', label: 'الضمان الاجتماعي', show: true },
    { key: 'identity', label: 'بطاقة الهوية والإقامة', show: true },
    { key: 'schedule', label: 'الدوام واحتساب الدقائق', show: true },
    { key: 'contracts', label: 'العقود والتعويضات', show: false },
    { key: 'attendance', label: 'سجل الحضور', show: true },
    { key: 'leaves', label: 'الإجازات والأرصدة', show: canViewLeaves },
    { key: 'loans', label: 'السلف والمستحقات', show: canViewLoans },
    { key: 'payroll', label: 'سجل الرواتب', show: canViewFinancials },
    { key: 'documents', label: 'الوثائق والمستندات', show: false },
  ].filter((t) => t.show);

  async function handleSocialSecuritySubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!updateSocialSecurityAction) return;
    e.preventDefault();
    setSsFeedback(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('socialSecurityRegistered', ssRegistered ? 'true' : 'false');
        if (ssRegistered && ssDate) {
          formData.set('socialSecurityRegistrationDate', ssDate);
        }
        await updateSocialSecurityAction(formData);
        setSsFeedback('تم تحديث حالة الضمان الاجتماعي بنجاح');
      } catch (err: any) {
        setSsFeedback(`خطأ: ${err.message || 'فشل التحديث'}`);
      }
    });
  }

  async function handleUploadImage(side: 'front' | 'back', e: React.ChangeEvent<HTMLInputElement>) {
    if (!uploadIdentityImageAction || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.set('image', file);

    startTransition(async () => {
      try {
        await uploadIdentityImageAction(side, formData);
        alert('تم رفع صورة الهوية بنجاح');
      } catch (err: any) {
        alert(err.message || 'فشل رفع صورة الهوية');
      }
    });
  }

  async function handleScheduleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!updateScheduleAction) return;
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateScheduleAction(formData);
        alert('تم تحديث إعدادات الدوام بنجاح');
      } catch (err: any) {
        alert(err.message || 'فشل تحديث إعدادات الدوام');
      }
    });
  }

  return (
    <div className="space-y-2 select-none">
      {/* Classic Folder Tabs */}
      <div className="flex items-center gap-1 border-b-2 border-[#808080] pt-1 px-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.key === currentTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setCurrentTab(tab.key)}
              className={`px-3 py-1 text-xs font-bold border-t-2 border-l-2 border-r-2 rounded-t select-none whitespace-nowrap transition-none ${
                isActive
                  ? 'bg-[#ECE9D8] border-[#FFFFFF] border-r-[#808080] text-[#0A246A] -mb-[2px] pb-1.5'
                  : 'bg-[#D4D0C8] border-[#808080] text-slate-700 hover:bg-[#E0DDD5]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Tab Content Window */}
      <div className="win-raised p-3 bg-[#ECE9D8] min-h-[350px]">
        {/* TAB 1: BASIC INFO */}
        {currentTab === 'basic' && (
          <div className="space-y-3">
            <fieldset className="border border-[#808080] p-3 bg-white">
              <div className="flex flex-wrap justify-between items-center px-1 mb-2 gap-2">
                <legend className="text-black font-bold text-xs">البيانات الوظيفية الأساسية</legend>
                <div className="flex items-center gap-2">
                  {['ADMIN', 'HR'].includes(userRole) && updateEmployeeAction && (
                    <EditEmployeeModal
                      employee={employee}
                      updateEmployeeAction={updateEmployeeAction}
                    />
                  )}
                  {['ADMIN', 'HR'].includes(userRole) && updateStatusAction && (
                    <UpdateEmployeeStatusModal
                      employeeId={employee.id}
                      employeeName={employee.name}
                      currentStatus={employee.status}
                      currentEndDate={employee.endDate}
                      updateStatusAction={updateStatusAction}
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">الاسم الكامل:</span>
                  <span className="font-bold text-black text-sm">{employee.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">الرقم الوظيفي:</span>
                  <span className="font-mono font-bold text-black">{employee.employeeNo}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">القسم:</span>
                  <span className="font-semibold text-black">{employee.department}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">المسمى الوظيفي:</span>
                  <span className="font-semibold text-black">{employee.jobTitle}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">رقم الهاتف:</span>
                  <span className="font-mono text-black">{employee.phone || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">نوع التوظيف:</span>
                  <span
                    className={`inline-block px-1.5 py-0.5 text-[11px] font-bold ${
                      employee.employmentType === 'DAILY_WORKER'
                        ? 'bg-amber-100 text-amber-900 border border-amber-400'
                        : employee.employmentType === 'PROBATIONARY'
                        ? 'bg-blue-100 text-blue-900 border border-blue-400'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-400'
                    }`}
                  >
                    {employee.employmentType === 'DAILY_WORKER'
                      ? 'عامل مياومة (أجر يومي)'
                      : employee.employmentType === 'PROBATIONARY'
                      ? 'عقد تجريبي (3 أشهر)'
                      : 'موظف مثبت / دائم'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">تاريخ بداية العمل:</span>
                  <span className="font-mono font-bold text-black">{employee.startDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">تاريخ نهاية الخدمة:</span>
                  <span className="font-mono text-black">{employee.endDate || 'مستمر على رأس العمل'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">الحالة:</span>
                  <Badge variant={employee.status === 'ACTIVE' ? 'active' : 'rejected'}>
                    {employee.status === 'ACTIVE' ? 'نشط' : 'منتهي'}
                  </Badge>
                </div>
              </div>

              {(employee.employmentType === 'PROBATIONARY' || employee.probationStatus === 'IN_PROBATION') && (
                <div className="mt-3 p-2.5 bg-blue-50 border border-blue-400 text-blue-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 win-sunken">
                  <div>
                    <div className="font-bold text-xs text-blue-900 flex items-center gap-1">
                      <span>⏳</span>
                      <span>حالة الموظف: تحت التجربة (عقد 3 أشهر)</span>
                    </div>
                    <div className="text-[11px] text-slate-700 mt-0.5">
                      تاريخ انتهاء فترة التجربة: <strong className="font-mono font-bold text-blue-900">{employee.probationEndDate || '-'}</strong>
                    </div>
                  </div>
                  {['ADMIN', 'HR'].includes(userRole) && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        if (confirm(`هل أنت تأكد من تثبيت الموظف (${employee.name}) وتوقيع العقد الدائم؟`)) {
                          startTransition(async () => {
                            try {
                              const res = await fetch(`/api/employees/${employee.id}/transition-probation`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error || 'فشل عملية التثبيت');
                              alert('تم تثبيت الموظف وتحديث عقده إلى موظف دائم بنجاح.');
                              window.location.reload();
                            } catch (err: any) {
                              alert(err.message || 'حدث خطأ أثناء تثبيت الموظف');
                            }
                          });
                        }
                      }}
                      className="win-btn text-xs font-bold px-3 py-1 text-emerald-800"
                    >
                      ✔ تثبيت الموظف وتوقيع العقد الدائم
                    </button>
                  )}
                </div>
              )}

              {contracts.length > 0 && toggleContractSignedAction && (
                <div className="mt-3 pt-2.5 border-t border-slate-200">
                  <span className="text-slate-600 block text-[11px] mb-1 font-bold">حالة توقيع العقد الحالي (مفتاح التبديل اليدوي):</span>
                  <ContractSignedToggle
                    contractId={contracts[0].id}
                    contractSigned={contracts[0].contractSigned}
                    contractSignedDate={contracts[0].contractSignedDate}
                    startDate={contracts[0].startDate}
                    userRole={userRole}
                    toggleContractSignedAction={toggleContractSignedAction}
                  />
                </div>
              )}
            </fieldset>

            {/* Daily Worker details if applicable */}
            {employee.employmentType === 'DAILY_WORKER' && (
              <fieldset className="border border-[#808080] p-3 bg-[#FFFFF0]">
                <legend className="px-1 text-amber-900 font-bold text-xs">بيانات احتساب المياومة</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-600 block">أجر اليوم (Daily Rate):</span>
                    <span className="font-mono font-bold text-amber-900 text-sm">
                      {employee.dailyRate ? Number(employee.dailyRate).toFixed(3) : '0.000'} د.أ
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 block">بدء العمل المؤقت:</span>
                    <span className="font-mono font-bold text-black">{employee.temporaryStartDate || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block">انتهاء العمل المؤقت:</span>
                    <span className="font-mono text-black">{employee.temporaryEndDate || 'غير محدد'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block">سعر خصم الدقيقة:</span>
                    <span className="font-mono text-black">
                      {employee.minuteDeductionRate ? Number(employee.minuteDeductionRate).toFixed(3) : 'افتراضي النظام'}
                    </span>
                  </div>
                </div>
              </fieldset>
            )}
          </div>
        )}

        {/* TAB 2: SOCIAL SECURITY */}
        {currentTab === 'social_security' && (
          <div className="space-y-3">
            <fieldset className="border border-[#808080] p-3 bg-white">
              <legend className="px-1 text-black font-bold text-xs">حالة التسجيل في الضمان الاجتماعي</legend>

              {ssFeedback && (
                <div
                  className={`p-2 text-xs font-bold mb-3 win-sunken ${
                    ssFeedback.startsWith('خطأ') ? 'bg-rose-100 text-rose-900' : 'bg-emerald-100 text-emerald-900'
                  }`}
                >
                  {ssFeedback}
                </div>
              )}

              {['ADMIN', 'HR'].includes(userRole) ? (
                <form onSubmit={handleSocialSecuritySubmit} className="space-y-3 text-xs">
                  <label className="flex items-center gap-2 font-bold text-black cursor-pointer">
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
                    <div className="win-sunken p-2.5 bg-[#F0F8FF] max-w-md">
                      <label className="block font-bold text-[#0A246A] mb-1">
                        تاريخ التسجيل في الضمان الاجتماعي <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="date"
                        required={ssRegistered}
                        value={ssDate}
                        onChange={(e) => setSsDate(e.target.value)}
                        className="win-input w-full py-1 px-2 font-mono font-bold"
                      />
                      <span className="text-[10px] text-slate-500 block mt-1">
                        إذا تم إلغاء تحديد خيار التسجيل، سيتم مسح تاريخ التسجيل تلقائياً.
                      </span>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="win-btn px-4 py-1 font-bold text-[#0A246A]"
                    >
                      {isPending ? 'جاري الحفظ...' : 'حفظ حالة الضمان الاجتماعي'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">الحالة:</span>
                    <span className={employee.socialSecurityRegistered ? 'text-emerald-800 font-bold' : 'text-slate-500'}>
                      {employee.socialSecurityRegistered ? 'مسجل في الضمان الاجتماعي' : 'غير مسجل في الضمان'}
                    </span>
                  </div>
                  {employee.socialSecurityRegistered && (
                    <div className="flex items-center gap-2">
                      <span className="font-bold">تاريخ التسجيل:</span>
                      <span className="font-mono">{employee.socialSecurityRegistrationDate || '-'}</span>
                    </div>
                  )}
                </div>
              )}
            </fieldset>
          </div>
        )}

        {/* TAB 3: IDENTITY CARD IMAGES */}
        {currentTab === 'identity' && (
          <div className="space-y-3">
            {!canViewIdentityImages ? (
              <div className="win-sunken p-4 bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold text-center">
                🔒 غير مصرح لك بالاطلاع على صور الهوية للموظفين. (مقتصر على إدارة النظام والموارد البشرية).
              </div>
            ) : (
              <fieldset className="border border-[#808080] p-3 bg-white">
                <legend className="px-1 text-black font-bold text-xs">
                  صور بطاقة الهوية الوطنية / الإقامة (JPG, PNG, WEBP فقط)
                </legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mt-2">
                  {/* Front Side */}
                  <div className="win-raised p-2 bg-[#ECE9D8] space-y-2">
                    <div className="font-bold text-black border-b border-[#808080] pb-1 flex justify-between">
                      <span>الوجه الأمامي للبطاقة</span>
                      {identityImages.frontUrl && <span className="text-emerald-700 font-normal">مرفوع ✓</span>}
                    </div>

                    <div className="win-sunken bg-white p-2 flex items-center justify-center min-h-[160px]">
                      {identityImages.frontUrl ? (
                        <div className="text-center">
                          <img
                            src={identityImages.frontUrl}
                            alt="الوجه الأمامي للهوية"
                            onClick={() =>
                              setLightboxImg({
                                open: true,
                                url: identityImages.frontUrl!,
                                title: `الهوية - الوجه الأمامي (${employee.name})`,
                              })
                            }
                            className="max-h-36 max-w-full object-contain cursor-pointer hover:opacity-90 border"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxImg({
                                open: true,
                                url: identityImages.frontUrl!,
                                title: `الهوية - الوجه الأمامي (${employee.name})`,
                              })
                            }
                            className="win-btn text-[10px] mt-1.5 px-2 py-0.5"
                          >
                            🔍 تكبير الصورة
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400">لم يتم رفع الوجه الأمامي</span>
                      )}
                    </div>

                    {['ADMIN', 'HR'].includes(userRole) && (
                      <div>
                        <label className="block text-[10px] font-bold text-black mb-0.5">
                          رفع صورة جديدة (JPG, PNG, WEBP):
                        </label>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp"
                          disabled={isPending}
                          onChange={(e) => handleUploadImage('front', e)}
                          className="win-input w-full text-[10px] p-0.5"
                        />
                      </div>
                    )}
                  </div>

                  {/* Back Side */}
                  <div className="win-raised p-2 bg-[#ECE9D8] space-y-2">
                    <div className="font-bold text-black border-b border-[#808080] pb-1 flex justify-between">
                      <span>الوجه الخلفي للبطاقة</span>
                      {identityImages.backUrl && <span className="text-emerald-700 font-normal">مرفوع ✓</span>}
                    </div>

                    <div className="win-sunken bg-white p-2 flex items-center justify-center min-h-[160px]">
                      {identityImages.backUrl ? (
                        <div className="text-center">
                          <img
                            src={identityImages.backUrl}
                            alt="الوجه الخلفي للهوية"
                            onClick={() =>
                              setLightboxImg({
                                open: true,
                                url: identityImages.backUrl!,
                                title: `الهوية - الوجه الخلفي (${employee.name})`,
                              })
                            }
                            className="max-h-36 max-w-full object-contain cursor-pointer hover:opacity-90 border"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxImg({
                                open: true,
                                url: identityImages.backUrl!,
                                title: `الهوية - الوجه الخلفي (${employee.name})`,
                              })
                            }
                            className="win-btn text-[10px] mt-1.5 px-2 py-0.5"
                          >
                            🔍 تكبير الصورة
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400">لم يتم رفع الوجه الخلفي</span>
                      )}
                    </div>

                    {['ADMIN', 'HR'].includes(userRole) && (
                      <div>
                        <label className="block text-[10px] font-bold text-black mb-0.5">
                          رفع صورة جديدة (JPG, PNG, WEBP):
                        </label>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp"
                          disabled={isPending}
                          onChange={(e) => handleUploadImage('back', e)}
                          className="win-input w-full text-[10px] p-0.5"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </fieldset>
            )}
          </div>
        )}

        {/* TAB 4: WORK SCHEDULE */}
        {currentTab === 'schedule' && (
          <div className="space-y-3">
            <fieldset className="border border-[#808080] p-3 bg-white space-y-3">
              <legend className="px-1 text-black font-bold text-xs">نظام الدوام واحتساب دقائق التأخير والخصم</legend>

              {/* Automatic Dual Shift Banner */}
              <div className="win-sunken p-2.5 bg-[#F4F6F9] border border-blue-200">
                <div className="font-bold text-[#0A246A] text-xs flex items-center gap-1 mb-1">
                  <span>🔄</span>
                  <span>نظام الورديات المتناوبة الذكي (التمييز التلقائي لدوام الموظف):</span>
                </div>
                <div className="text-xs text-slate-700 space-y-1">
                  <div className="flex flex-wrap gap-3">
                    <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold border border-amber-300">
                      ☀️ الوردية الصباحية: 08:00 ص - 04:30 م
                    </span>
                    <span className="bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded font-bold border border-indigo-300">
                      🌙 الوردية المسائية: 04:30 م - 01:00 ص
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    * يقوم النظام بتحديد وردية الموظف تلقائياً بناءً على ساعة تسجيل الحضور اليومي دون الحاجة إلى تحديد ثابت لكل موظف.
                  </p>
                </div>
              </div>

              <form onSubmit={handleScheduleSubmit} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-black mb-1">وقت بدء الدوام الصباحي المجدول</label>
                    <input
                      type="time"
                      name="workStartTime"
                      defaultValue={employee.workStartTime || '08:00'}
                      className="win-input w-full py-1 px-2 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-black mb-1">وقت نهاية الدوام الصباحي المجدول</label>
                    <input
                      type="time"
                      name="workEndTime"
                      defaultValue={employee.workEndTime || '16:30'}
                      className="win-input w-full py-1 px-2 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-black mb-1">مدة الاستراحة (دقيقة)</label>
                    <input
                      type="number"
                      name="breakMinutes"
                      defaultValue={employee.breakMinutes ?? 60}
                      min="0"
                      className="win-input w-full py-1 px-2 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-black mb-1">سعر خصم الدقيقة (خاص بالموظف)</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      name="minuteDeductionRate"
                      defaultValue={employee.minuteDeductionRate || ''}
                      placeholder="افتراضي النظام"
                      className="win-input w-full py-1 px-2 font-mono"
                    />
                  </div>
                </div>

                {['ADMIN', 'HR'].includes(userRole) && (
                  <div className="pt-2 border-t border-[#808080]">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="win-btn px-4 py-1 font-bold text-[#0A246A]"
                    >
                      {isPending ? 'جاري الحفظ...' : 'حفظ إعدادات الدوام'}
                    </button>
                  </div>
                )}
              </form>
            </fieldset>
          </div>
        )}

        {/* TAB 5: CONTRACTS */}
        {currentTab === 'contracts' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-xs text-black">عقود التوظيف والرواتب الأساسية</span>
              {canManageContracts && (
                <button
                  type="button"
                  onClick={() => setShowContractModal(true)}
                  className="win-btn text-xs px-2.5 py-0.5 font-bold text-emerald-800"
                >
                  + إنشاء عقد جديد
                </button>
              )}
            </div>

            <div className="win-sunken bg-white overflow-x-auto">
              <table className="win-table w-full text-right text-xs">
                <thead>
                  <tr>
                    <th>تاريخ البداية</th>
                    <th>تاريخ النهاية</th>
                    <th>الأساسي</th>
                    <th>البدلات</th>
                    <th>توقيع العقد؟</th>
                    <th>تاريخ التوقيع</th>
                    <th>سعر يوم الغياب</th>
                    <th>سعر الإضافي</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-4 text-center text-slate-400">
                        لا توجد عقود مسجلة لهذا الموظف
                      </td>
                    </tr>
                  ) : (
                    contracts.map((c) => (
                      <tr key={c.id}>
                        <td className="font-mono">{c.startDate}</td>
                        <td className="font-mono">{c.endDate || 'غير محدد'}</td>
                        <td className="font-mono font-bold text-emerald-800">{Number(c.monthlyBasic).toFixed(3)}</td>
                        <td className="font-mono">{Number(c.monthlyAllowances).toFixed(3)}</td>
                        <td colSpan={2}>
                          {toggleContractSignedAction ? (
                            <ContractSignedToggle
                              contractId={c.id}
                              contractSigned={c.contractSigned}
                              contractSignedDate={c.contractSignedDate}
                              startDate={c.startDate}
                              userRole={userRole}
                              toggleContractSignedAction={toggleContractSignedAction}
                            />
                          ) : c.contractSigned ? (
                            <span className="text-emerald-800 font-bold">✓ موقع ({c.contractSignedDate || '-'})</span>
                          ) : (
                            <span className="text-rose-700 font-bold">✗ غير موقع</span>
                          )}
                        </td>
                        <td className="font-mono">{Number(c.unpaidDayRate).toFixed(3)}</td>
                        <td className="font-mono">{Number(c.otRate).toFixed(3)}</td>
                        <td>
                          <Badge variant={c.status === 'ACTIVE' ? 'active' : 'draft'}>
                            {c.status === 'ACTIVE' ? 'نشط' : c.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Contract Modal */}
            <Modal
              isOpen={showContractModal}
              onClose={() => setShowContractModal(false)}
              title="إنشاء عقد توظيف جديد"
              maxWidth="md"
            >
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!createContractAction) return;
                  const formData = new FormData(e.currentTarget);
                  formData.set('contractSigned', contractSigned ? 'true' : 'false');
                  if (contractSigned && contractSignedDate) {
                    formData.set('contractSignedDate', contractSignedDate);
                  }
                  startTransition(async () => {
                    try {
                      await createContractAction(formData);
                      setShowContractModal(false);
                      alert('تم إنشاء العقد بنجاح');
                    } catch (err: any) {
                      alert(err.message || 'فشل حفظ العقد');
                    }
                  });
                }}
                className="space-y-3 text-xs"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-black mb-0.5">تاريخ البداية *</label>
                    <input
                      type="date"
                      name="startDate"
                      required
                      defaultValue={employee.startDate}
                      className="win-input w-full py-1 px-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-black mb-0.5">تاريخ النهاية</label>
                    <input type="date" name="endDate" className="win-input w-full py-1 px-2 font-mono" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-black mb-0.5">الراتب الأساسي الشهري *</label>
                    <input
                      type="number"
                      step="0.001"
                      name="monthlyBasic"
                      required
                      className="win-input w-full py-1 px-2 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-black mb-0.5">البدلات الشهرية</label>
                    <input
                      type="number"
                      step="0.001"
                      name="monthlyAllowances"
                      defaultValue="0"
                      className="win-input w-full py-1 px-2 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-black mb-0.5">سعر يوم الخصم *</label>
                    <input
                      type="number"
                      step="0.001"
                      name="unpaidDayRate"
                      required
                      className="win-input w-full py-1 px-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-black mb-0.5">سعر ساعة الإضافي *</label>
                    <input
                      type="number"
                      step="0.001"
                      name="otRate"
                      required
                      className="win-input w-full py-1 px-2 font-mono"
                    />
                  </div>
                </div>

                {/* Contract Signed status */}
                <div className="win-sunken p-2 bg-white">
                  <label className="flex items-center gap-2 font-bold text-black cursor-pointer">
                    <input
                      type="checkbox"
                      checked={contractSigned}
                      onChange={(e) => {
                        setContractSigned(e.target.checked);
                        if (!e.target.checked) setContractSignedDate('');
                      }}
                      className="w-4 h-4"
                    />
                    <span>تم توقيع العقد؟</span>
                  </label>

                  {contractSigned && (
                    <div className="mt-1.5">
                      <label className="block font-bold text-black mb-0.5">
                        تاريخ توقيع العقد <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="date"
                        required={contractSigned}
                        value={contractSignedDate}
                        onChange={(e) => setContractSignedDate(e.target.value)}
                        className="win-input w-full py-1 px-2 font-mono font-bold"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#808080]">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="win-btn px-4 py-1 font-bold text-black"
                  >
                    {isPending ? 'جاري الحفظ...' : 'حفظ العقد'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowContractModal(false)}
                    className="win-btn px-3 py-1 text-slate-700"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </Modal>
          </div>
        )}

        {/* TAB 6: ATTENDANCE */}
        {currentTab === 'attendance' && (
          <div className="win-sunken bg-white overflow-x-auto">
            <table className="win-table w-full text-right text-xs">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>نوع الحضور</th>
                  <th>الدخول</th>
                  <th>الخروج</th>
                  <th>التأخير</th>
                  <th>المغادرة المبكرة</th>
                  <th>العمل الفعلي</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {attendances.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-4 text-center text-slate-400">
                      لا توجد سجلات حضور مسجلة لهذا الموظف
                    </td>
                  </tr>
                ) : (
                  attendances.map((att) => (
                    <tr key={att.id}>
                      <td className="font-mono font-bold">{att.workDate}</td>
                      <td>{att.attendanceType}</td>
                      <td className="font-mono text-[11px]">
                        {att.clockIn ? new Date(att.clockIn).toLocaleTimeString('ar-SA') : '-'}
                      </td>
                      <td className="font-mono text-[11px]">
                        {att.clockOut ? new Date(att.clockOut).toLocaleTimeString('ar-SA') : '-'}
                      </td>
                      <td className="font-mono text-amber-900 font-bold">
                        {att.lateMinutes > 0 ? formatDurationArabic(att.lateMinutes) : '-'}
                      </td>
                      <td className="font-mono text-blue-900 font-bold">
                        {att.earlyDepartureMinutes > 0 ? formatDurationArabic(att.earlyDepartureMinutes) : '-'}
                      </td>
                      <td className="font-mono font-bold">
                        {att.workedMinutes > 0 ? formatDurationArabic(att.workedMinutes) : '-'}
                      </td>
                      <td>
                        <Badge variant={att.status === 'APPROVED' ? 'approved' : 'draft'}>
                          {att.status === 'APPROVED' ? 'معتمد' : 'مسودة'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 7: LEAVES */}
        {currentTab === 'leaves' && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {leaveBalances.map((b) => (
                <div key={b.id || b.leaveType} className="win-sunken bg-white p-2.5 text-center border-t-2 border-[#0A246A]">
                  <div className="text-xs font-bold text-slate-700 mb-0.5">
                    {b.leaveTypeLabel || (b.leaveType === 'ANNUAL' ? '🌴 إجازة سنوية' : b.leaveType === 'SICK' ? '🏥 إجازة مرضية' : b.leaveType === 'EMERGENCY' ? '🚨 إجازة طارئة' : 'إجازة أخرى')}
                  </div>
                  <div className="text-base font-bold text-[#0A246A]">{b.remainingDays} يوم متبقي</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    المستحق: <strong className="font-mono text-black">{b.totalEntitled || b.openingDays}</strong> | المستخدم: <strong className="font-mono text-rose-800">{b.usedDays}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div className="win-sunken bg-white overflow-x-auto">
              <table className="win-table w-full text-right text-xs">
                <thead>
                  <tr className="bg-[#ECE9D8] text-[#0A246A]">
                    <th className="w-28">نوع الإجازة</th>
                    <th className="w-24">من تاريخ</th>
                    <th className="w-24">إلى تاريخ</th>
                    <th className="w-20 text-center">الأيام</th>
                    <th>وصف / سبب الإجازة</th>
                    <th className="w-24 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400">
                        لا توجد طلبات إجازة مسجلة لهذا الموظف
                      </td>
                    </tr>
                  ) : (
                    leaveRequests.map((r) => (
                      <tr key={r.id} className="hover:bg-[#E8EEF7]">
                        <td className="font-bold text-[#0A246A]">
                          {r.leaveTypeLabel || (r.leaveType === 'ANNUAL' ? 'إجازة سنوية' : r.leaveType === 'SICK' ? 'إجازة مرضية' : r.leaveType === 'EMERGENCY' ? 'إجازة طارئة' : (!r.paid ? 'إجازة بدون أجر' : 'إجازة اعتيادية'))}
                        </td>
                        <td className="font-mono">{r.startDate}</td>
                        <td className="font-mono">{r.endDate}</td>
                        <td className="font-mono font-bold text-center text-emerald-800">
                          {r.chargeDays || r.daysCount || '-'} يوم
                        </td>
                        <td className="text-slate-700 font-medium">
                          {r.reason || <span className="text-slate-400 italic">بدون وصف</span>}
                        </td>
                        <td className="text-center">
                          <Badge
                            variant={
                              r.status === 'APPROVED' ? 'approved' : r.status === 'REJECTED' ? 'rejected' : 'draft'
                            }
                          >
                            {r.status === 'APPROVED'
                              ? 'معتمد'
                              : r.status === 'REJECTED'
                              ? 'مرفوض'
                              : r.status === 'PENDING'
                              ? 'قيد الانتظار'
                              : r.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 8: LOANS */}
        {currentTab === 'loans' && (
          <div className="win-sunken bg-white overflow-x-auto text-xs">
            <table className="win-table w-full text-right">
              <thead>
                <tr>
                  <th>مبلغ السلفة</th>
                  <th>المتبقي</th>
                  <th>القسط الشهري</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {loans.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400">
                      لا توجد سلف مسجلة لهذا الموظف
                    </td>
                  </tr>
                ) : (
                  loans.map((l) => (
                    <tr key={l.id}>
                      <td className="font-mono font-bold">{Number(l.totalAmount).toFixed(3)}</td>
                      <td className="font-mono font-bold text-rose-800">{Number(l.remainingAmount).toFixed(3)}</td>
                      <td className="font-mono">{Number(l.monthlyInstallment).toFixed(3)}</td>
                      <td>
                        <Badge variant={l.status === 'APPROVED' ? 'approved' : 'draft'}>{l.status}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 9: PAYROLL */}
        {currentTab === 'payroll' && (
          <div className="win-sunken bg-white overflow-x-auto text-xs">
            <table className="win-table w-full text-right">
              <thead>
                <tr>
                  <th>الفترة</th>
                  <th>الإجمالي</th>
                  <th>خصم التأخير</th>
                  <th>خصم المغادرة</th>
                  <th>الاستقطاعات</th>
                  <th>الصافي</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-slate-400">
                      لا توجد مسيرات رواتب سابقة
                    </td>
                  </tr>
                ) : (
                  payrolls.map((p) => (
                    <tr key={p.id}>
                      <td className="font-mono font-bold">
                        {p.periodStart} ~ {p.periodEnd}
                      </td>
                      <td className="font-mono">{Number(p.grossPay).toFixed(3)}</td>
                      <td className="font-mono text-amber-900">{Number(p.lateDeductions || 0).toFixed(3)}</td>
                      <td className="font-mono text-blue-900">{Number(p.earlyDepartureDeductions || 0).toFixed(3)}</td>
                      <td className="font-mono text-rose-800">{Number(p.totalDeductions).toFixed(3)}</td>
                      <td className="font-mono font-bold text-emerald-800 text-sm">
                        {Number(p.netPay).toFixed(3)}
                      </td>
                      <td>
                        <Badge variant={p.status === 'PAID' ? 'active' : 'draft'}>{p.status}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 10: DOCUMENTS */}
        {currentTab === 'documents' && (
          <div className="win-sunken bg-white overflow-x-auto text-xs">
            <table className="win-table w-full text-right">
              <thead>
                <tr>
                  <th>نوع الوثيقة</th>
                  <th>رقم الوثيقة</th>
                  <th>تاريخ الانتهاء</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400">
                      لا توجد وثائق مرفوعة لهذا الموظف
                    </td>
                  </tr>
                ) : (
                  documents.map((d) => (
                    <tr key={d.id}>
                      <td>{d.documentType}</td>
                      <td className="font-mono">{d.documentNumber || '-'}</td>
                      <td className="font-mono">{d.expiryDate || 'لا يوجد'}</td>
                      <td>
                        <Badge variant="active">سارية</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lightbox Modal for Full Image Inspection */}
      <Modal
        isOpen={lightboxImg.open}
        onClose={() => setLightboxImg({ open: false, url: '', title: '' })}
        title={lightboxImg.title}
        maxWidth="lg"
      >
        <div className="win-sunken p-2 bg-black flex items-center justify-center">
          <img
            src={lightboxImg.url}
            alt={lightboxImg.title}
            className="max-h-[70vh] max-w-full object-contain rounded"
          />
        </div>
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => setLightboxImg({ open: false, url: '', title: '' })}
            className="win-btn px-4 py-1 text-black font-bold"
          >
            إغلاق المعاينة
          </button>
        </div>
      </Modal>
    </div>
  );
}
