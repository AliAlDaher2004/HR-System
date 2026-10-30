'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { WarningDTO, WARNING_LEVELS } from '@/lib/types/warning';

interface PrintWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  warning: WarningDTO | null;
  companyName?: string;
}

export function PrintWarningModal({
  isOpen,
  onClose,
  warning,
  companyName = 'شركة التقنية والحلول المتقدمة',
}: PrintWarningModalProps) {
  if (!warning) return null;

  const levelInfo = WARNING_LEVELS[warning.warningLevel] || { label: warning.warningLevel };

  function handlePrint() {
    window.print();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="طباعة كتاب الإنذار الرسمي" maxWidth="xl">
      <div className="space-y-4 text-black text-xs select-none">
        {/* Top Action Bar */}
        <div className="flex justify-between items-center bg-[#ECE9D8] p-2 win-raised print:hidden">
          <div className="text-slate-700 font-bold">معاينة كتاب الإنذار قبل الطباعة</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="win-btn font-bold px-3 py-1 flex items-center gap-1.5"
            >
              <span>🖨</span>
              <span>طباعة الكتاب الآن</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="win-btn px-3 py-1"
            >
              إغلاق
            </button>
          </div>
        </div>

        {/* Printable Formal Document */}
        <div
          id="printable-warning-letter"
          className="bg-white p-8 border border-slate-300 shadow-sm text-black print:p-0 print:border-none print:shadow-none"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex justify-between items-center border-b-2 border-slate-800 pb-4 mb-6">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{companyName}</h1>
              <p className="text-xs text-slate-600">قسم إدارة الموارد البشرية والشؤون الإدارية</p>
            </div>
            <div className="text-left text-xs space-y-1 font-mono">
              <div><strong>الرقم المرجعي:</strong> WRN-{warning.id.slice(0, 8).toUpperCase()}</div>
              <div><strong>التاريخ:</strong> {warning.warningDate}</div>
              <div><strong>الحالة:</strong> {warning.status === 'ACTIVE' ? 'ساري المفعول' : 'ملغى'}</div>
            </div>
          </div>

          {/* Letter Title */}
          <div className="text-center my-6">
            <div className="inline-block border-2 border-slate-900 px-6 py-1.5 rounded-sm">
              <h2 className="text-lg font-bold tracking-wide">
                كتاب {levelInfo.label.toUpperCase()}
              </h2>
            </div>
          </div>

          {/* Recipient Details */}
          <div className="bg-slate-50 border border-slate-300 p-4 mb-6 rounded space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-bold text-slate-700">إلى السيد / السيدة:</span>{' '}
                <span className="font-bold text-slate-900 text-sm">{warning.employee.name}</span>
              </div>
              <div>
                <span className="font-bold text-slate-700">الرقم الوظيفي:</span>{' '}
                <span className="font-mono font-bold">{warning.employee.employeeNo}</span>
              </div>
              <div>
                <span className="font-bold text-slate-700">القسم / الإدارة:</span>{' '}
                <span>{warning.employee.department}</span>
              </div>
              <div>
                <span className="font-bold text-slate-700">المسمى الوظيفي:</span>{' '}
                <span>{warning.employee.jobTitle}</span>
              </div>
            </div>
          </div>

          {/* Subject */}
          <div className="mb-4">
            <span className="font-bold text-slate-800">الموضوع:</span>{' '}
            <span className="font-bold text-slate-900 text-sm underline decoration-slate-400 underline-offset-4">
              {warning.title}
            </span>
          </div>

          {/* Body */}
          <div className="space-y-4 text-justify leading-relaxed text-sm mb-6">
            <p>
              نحيطكم علماً بأنه قد تبيّن لإدارة الشركة ولجنة المتابعة ارتكابكم المخالفة الإدارية / السلوكية المبيّنة تفاصيلها أدناه:
            </p>

            <div className="p-3 bg-amber-50/50 border-r-4 border-amber-600 rounded">
              <p className="font-bold text-xs text-amber-900 mb-1">تفاصيل المخالفة والأسباب:</p>
              <p className="whitespace-pre-line text-slate-800 font-sans text-xs">
                {warning.reason}
              </p>
            </div>

            {warning.administrativeAction && (
              <div className="p-3 bg-blue-50/50 border-r-4 border-blue-600 rounded">
                <p className="font-bold text-xs text-blue-900 mb-1">الإجراء الإداري المتخذ:</p>
                <p className="whitespace-pre-line text-slate-800 font-sans text-xs">
                  {warning.administrativeAction}
                </p>
              </div>
            )}

            <p className="text-xs text-slate-700">
              وحيث أن هذا التصرف يخالف التعليمات واللوائح الداخلية المنظمة للعمل وسياسات الشركة، فإننا نوجه إليكم هذا ({levelInfo.label}) مع التنبيه بضرورة تدارك هذا الخلل وتجنب تكراره مستقبلاً.
            </p>

            <p className="text-xs text-rose-800 font-semibold">
              تنويه هام: في حال تكرار هذه المخالفة أو ارتكاب أي مخالفة أخرى مستقبلاً، فإن إدارة الشركة ستتخذ بحقكم الإجراءات التأديبية الأشد المنصوص عليها في قانون العمل ولائحة الجزاءات الداخلية، بما قد يصل إلى إنهاء عقد العمل دون إشعار.
            </p>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300 mt-8">
            <div className="text-center space-y-12">
              <div className="font-bold text-slate-800">إدارة الموارد البشرية / المدير المعتمد</div>
              <div className="text-xs text-slate-500">التوقيع والختم: .......................................</div>
            </div>

            <div className="text-center space-y-12">
              <div className="font-bold text-slate-800">إشعار استلام الموظف</div>
              <div className="text-xs text-slate-600 space-y-2">
                <div>أقر أنا الموظف الموقع أدناه باستلام نسخة من هذا الإنذار وأتعهد بالالتزام التام.</div>
                <div className="flex justify-between pt-4 px-4 text-slate-500">
                  <span>التوقيع: ............................</span>
                  <span>التاريخ: {warning.signedByEmployee ? warning.warningDate : '..... / ..... / 202...'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-12 text-[10px] text-slate-400 text-center border-t border-slate-200 pt-2">
            نسخة: الملف الوظيفي للموظف | نسخة: الإدارة المالية (في حال وجود خصم) | نسخة: الموظف
          </div>
        </div>
      </div>
    </Modal>
  );
}
