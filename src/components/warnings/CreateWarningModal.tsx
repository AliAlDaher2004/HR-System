'use client';

import React, { useState, useTransition } from 'react';
import { Modal } from '@/components/ui/Modal';
import { WARNING_LEVELS, WarningLevel } from '@/lib/types/warning';

interface EmployeeOption {
  id: string;
  name: string;
  employeeNo: string;
  department: string;
}

interface CreateWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  createWarningAction: (formData: FormData) => Promise<void>;
  employees?: EmployeeOption[];
  fixedEmployeeId?: string;
  fixedEmployeeName?: string;
}

const COMMON_TITLES = [
  'تأخر متكرر عن موعد بدء العمل',
  'غياب عن العمل دون إذن مسبق أو عذر مقبول',
  'إهمال وتقصير في أداء الواجبات الوظيفية',
  'مخالفة تعليمات وضوابط السلامة المهنية',
  'عدم الالتزام بتعليمات الإدارة المباشرة',
  'سوء سلوك أو شجار في بيئة العمل',
  'مغادرة موقع العمل قبل انتهاء الدوام الرسمي',
];

export function CreateWarningModal({
  isOpen,
  onClose,
  createWarningAction,
  employees = [],
  fixedEmployeeId,
  fixedEmployeeName,
}: CreateWarningModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(fixedEmployeeId || '');
  const [warningLevel, setWarningLevel] = useState<WarningLevel>('FIRST');
  const [warningDate, setWarningDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [administrativeAction, setAdministrativeAction] = useState('');
  const [signedByEmployee, setSignedByEmployee] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  function resetForm() {
    setSelectedEmployeeId(fixedEmployeeId || '');
    setWarningLevel('FIRST');
    setWarningDate(new Date().toISOString().slice(0, 10));
    setTitle('');
    setReason('');
    setAdministrativeAction('');
    setSignedByEmployee(false);
    setNotes('');
    setSelectedFileName(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const empId = fixedEmployeeId || selectedEmployeeId;
    if (!empId) {
      setError('يرجى تحديد الموظف المعني بالإنذار');
      return;
    }

    if (!title.trim()) {
      setError('موضوع أو عنوان الإنذار مطلوب');
      return;
    }

    if (!reason.trim()) {
      setError('يرجى كتابة سبب المخالفة بالتفصيل');
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);

    if (fixedEmployeeId) {
      formData.set('employeeId', fixedEmployeeId);
    }

    startTransition(async () => {
      try {
        await createWarningAction(formData);
        resetForm();
        onClose();
      } catch (err: any) {
        setError(err.message || 'فشل في حفظ الإنذار');
      }
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إصدار وتسجيل إنذار إداري جديد" maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-3 text-black text-xs select-none">
        {error && (
          <div className="p-2 bg-rose-50 border border-rose-300 text-rose-800 rounded font-semibold text-xs">
            {error}
          </div>
        )}

        {/* Top Info Banner */}
        <div className="win-raised p-2 bg-[#ECE9D8] text-[11px] text-slate-700">
          يتم تسجيل الإنذار رسمياً في السجل العام للشركة ويضاف تلقائياً إلى الملف الشخصي للموظف.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Employee Selection */}
          <div>
            <label className="block font-bold text-black mb-1">
              الموظف المعني: <span className="text-red-600">*</span>
            </label>
            {fixedEmployeeId ? (
              <div className="win-sunken bg-slate-100 p-1.5 font-bold text-slate-800">
                {fixedEmployeeName || 'الموظف الحالي'}
                <input type="hidden" name="employeeId" value={fixedEmployeeId} />
              </div>
            ) : (
              <select
                name="employeeId"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                required
                className="win-input w-full p-1 font-sans text-xs bg-white"
              >
                <option value="">-- اختر الموظف --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeNo}) - {emp.department}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Warning Level */}
          <div>
            <label className="block font-bold text-black mb-1">
              درجة الإنذار: <span className="text-red-600">*</span>
            </label>
            <select
              name="warningLevel"
              value={warningLevel}
              onChange={(e) => setWarningLevel(e.target.value as WarningLevel)}
              required
              className="win-input w-full p-1 font-bold text-xs bg-white"
            >
              {(Object.keys(WARNING_LEVELS) as WarningLevel[]).map((level) => (
                <option key={level} value={level}>
                  {WARNING_LEVELS[level].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Warning Date */}
          <div>
            <label className="block font-bold text-black mb-1">
              تاريخ وقوع المخالفة / الإنذار: <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              name="warningDate"
              value={warningDate}
              onChange={(e) => setWarningDate(e.target.value)}
              required
              className="win-input w-full p-1 font-mono text-xs"
            />
          </div>

          {/* Signature Checkbox */}
          <div className="flex items-end pb-1.5">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-black bg-[#ECE9D8] win-raised p-1.5 w-full">
              <input
                type="checkbox"
                name="signedByEmployee"
                value="true"
                checked={signedByEmployee}
                onChange={(e) => setSignedByEmployee(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              <span>تم توقيع الموظف على استلام الإنذار</span>
            </label>
          </div>
        </div>

        {/* Title / Subject */}
        <div>
          <label className="block font-bold text-black mb-1">
            موضوع الإنذار: <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: تأخر متكرر عن موعد العمل"
            required
            className="win-input w-full p-1 text-xs"
          />

          {/* Quick subject chips */}
          <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
            <span className="text-slate-500 py-0.5">اقتراحات:</span>
            {COMMON_TITLES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTitle(t)}
                className="px-1.5 py-0.5 bg-slate-100 hover:bg-[#0A246A] hover:text-white rounded border border-slate-300 transition-none"
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Detailed Reason */}
        <div>
          <label className="block font-bold text-black mb-1">
            تفاصيل المخالفة والسبب بالتفصيل: <span className="text-red-600">*</span>
          </label>
          <textarea
            name="reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="اشرح الواقعة بالتفصيل والتواريخ والأسباب التي استوجبت توجيه هذا الإنذار..."
            required
            className="win-input w-full p-1.5 text-xs font-sans"
          />
        </div>

        {/* Administrative Action */}
        <div>
          <label className="block font-bold text-black mb-1">
            الإجراء الإداري المتخذ:
          </label>
          <input
            type="text"
            name="administrativeAction"
            value={administrativeAction}
            onChange={(e) => setAdministrativeAction(e.target.value)}
            placeholder="مثال: خصم يوم واحد من الراتب، لفت نظر يودع في الملف، إنذار بالفصل عند التكرار..."
            className="win-input w-full p-1 text-xs"
          />
        </div>

        {/* File Attachment: Signed Warning Letter Image / PDF */}
        <div className="win-raised p-2.5 bg-[#ECE9D8] space-y-1">
          <label className="block font-bold text-black">
            إرفاق صورة كتاب الإنذار الخطي الموقع من الموظف:
          </label>
          <p className="text-[10px] text-slate-600 mb-1">
            يقبل النظام صور المستندات الموقعة (JPG, PNG, WEBP) أو ملف PDF رسمي (الحد الأقصى 10MB).
          </p>
          <input
            type="file"
            name="attachment"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setSelectedFileName(e.target.files[0].name);
              } else {
                setSelectedFileName(null);
              }
            }}
            className="win-input w-full p-1 bg-white text-xs"
          />
          {selectedFileName && (
            <div className="text-[11px] text-emerald-800 font-bold pt-1">
              الملف المحدد: {selectedFileName}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block font-bold text-black mb-1">
            ملاحظات إدارية داخلية (اختياري):
          </label>
          <input
            type="text"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات سرية للإدارة..."
            className="win-input w-full p-1 text-xs"
          />
        </div>

        {/* Dialog Actions */}
        <div className="flex justify-between items-center pt-3 border-t border-[#808080]">
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            disabled={isPending}
            className="win-btn px-4 py-1 font-semibold"
          >
            إلغاء
          </button>

          <button
            type="submit"
            disabled={isPending}
            className="win-btn font-bold px-6 py-1 bg-[#0A246A] text-white flex items-center gap-1.5"
          >
            {isPending ? (
              <span>جاري الحفظ والرفع...</span>
            ) : (
              <>
                <span>💾</span>
                <span>حفظ وتسجيل الإنذار</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
