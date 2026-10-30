/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { WarningDTO, WARNING_LEVELS } from '@/lib/types/warning';
import { PrintWarningModal } from './PrintWarningModal';

interface WarningDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  warning: WarningDTO | null;
  userRole: string;
  revokeWarningAction?: (id: string, reason?: string) => Promise<void>;
  deleteWarningAction?: (id: string) => Promise<void>;
}

export function WarningDetailModal({
  isOpen,
  onClose,
  warning,
  userRole,
  revokeWarningAction,
  deleteWarningAction,
}: WarningDetailModalProps) {
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false);

  if (!warning) return null;

  const levelInfo = WARNING_LEVELS[warning.warningLevel] || {
    label: warning.warningLevel,
    badgeColor: '#4B5563',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-800',
  };

  const hasAttachment = Boolean(warning.attachmentPath);
  const attachmentUrl = `/api/warnings/${warning.id}/attachment`;
  const isImageAttachment =
    warning.attachmentPath?.toLowerCase().endsWith('.jpg') ||
    warning.attachmentPath?.toLowerCase().endsWith('.jpeg') ||
    warning.attachmentPath?.toLowerCase().endsWith('.png') ||
    warning.attachmentPath?.toLowerCase().endsWith('.webp');

  async function handleRevoke() {
    if (!revokeWarningAction) return;
    const reason = prompt('يرجى كتابة سبب إلغاء هذا الإنذار (اختياري):');
    if (reason === null) return;

    if (!confirm('هل أنت متأكد من إلغاء هذا الإنذار؟ سيتم تسجيله كإنذار ملغى في السجل.')) return;

    try {
      setIsSubmitting(true);
      await revokeWarningAction(warning!.id, reason);
      alert('تم إلغاء الإنذار بنجاح.');
      onClose();
    } catch (err: any) {
      alert(err.message || 'فشل إلغاء الإنذار');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteWarningAction) return;
    if (!confirm('تحذير: هل أنت متأكد من حذف هذا الإنذار نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.')) return;

    try {
      setIsSubmitting(true);
      await deleteWarningAction(warning!.id);
      alert('تم حذف سجل الإنذار بنجاح.');
      onClose();
    } catch (err: any) {
      alert(err.message || 'فشل حذف الإنذار');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`تفاصيل الإنذار: ${warning.title}`} maxWidth="lg">
        <div className="space-y-3 text-black text-xs select-none">
          {/* Top Info Banner */}
          <div className="win-raised p-3 bg-[#ECE9D8] flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-bold text-sm text-black flex items-center gap-2">
                <span>{warning.employee.name}</span>
                <span className="font-mono text-xs font-normal text-slate-600">({warning.employee.employeeNo})</span>
              </div>
              <div className="text-[11px] text-slate-600">
                {warning.employee.department} - {warning.employee.jobTitle}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 text-xs font-bold rounded border ${levelInfo.bgClass} ${levelInfo.textClass}`}
              >
                {levelInfo.label}
              </span>
              {warning.status === 'REVOKED' && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-gray-200 text-gray-700 border border-gray-400 rounded">
                  ملغى
                </span>
              )}
            </div>
          </div>

          {/* Core Details Grid */}
          <div className="win-sunken bg-white p-3 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-b pb-2">
              <div>
                <span className="text-slate-500 block text-[10px]">تاريخ الإنذار:</span>
                <span className="font-mono font-bold">{warning.warningDate}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">توقيع الموظف بالاستلام:</span>
                {warning.signedByEmployee ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <span>✓</span> تم توقيع الموظف
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium">لم يتم التوقيع بعد</span>
                )}
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">تاريخ الإدخال:</span>
                <span className="font-mono text-slate-700">
                  {new Date(warning.createdAt).toLocaleDateString('ar-EG')}
                </span>
              </div>
            </div>

            {/* Subject */}
            <div>
              <span className="text-slate-500 block text-[10px] font-bold">موضوع الإنذار:</span>
              <span className="font-bold text-sm text-slate-900">{warning.title}</span>
            </div>

            {/* Detailed Reason */}
            <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded">
              <span className="text-amber-900 block font-bold mb-1">تفاصيل المخالفة والأسباب:</span>
              <div className="whitespace-pre-line text-slate-800 leading-relaxed font-sans">
                {warning.reason}
              </div>
            </div>

            {/* Administrative Action */}
            <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded">
              <span className="text-blue-900 block font-bold mb-1">الإجراء الإداري المتخذ:</span>
              <div className="whitespace-pre-line text-slate-800 leading-relaxed font-sans">
                {warning.administrativeAction || 'تنبيه خطي يودع في الملف الوظيفي'}
              </div>
            </div>

            {/* Notes */}
            {warning.notes && (
              <div>
                <span className="text-slate-500 block text-[10px]">ملاحظات إضافية:</span>
                <p className="text-slate-700 font-mono text-[11px] whitespace-pre-line">{warning.notes}</p>
              </div>
            )}
          </div>

          {/* Signed Attachment Preview Box */}
          <div className="win-raised p-2 bg-[#ECE9D8]">
            <div className="font-bold text-black border-b border-[#808080] pb-1 flex justify-between items-center mb-2">
              <span className="flex items-center gap-1.5">
                <span>📎</span>
                <span>صورة كتاب الإنذار وتوقيع الموظف</span>
              </span>
              {hasAttachment ? (
                <span className="text-emerald-700 font-bold text-[11px]">مرفق موجود ✓</span>
              ) : (
                <span className="text-slate-500 text-[11px]">لا يوجد مرفق</span>
              )}
            </div>

            {hasAttachment ? (
              <div className="win-sunken bg-white p-2 text-center space-y-2">
                {isImageAttachment ? (
                  <div className="space-y-2">
                    <img
                      src={attachmentUrl}
                      alt="كتاب الإنذار الموقع"
                      onClick={() => setImageLightboxOpen(true)}
                      className="max-h-48 max-w-full mx-auto object-contain cursor-pointer hover:opacity-90 border"
                    />
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setImageLightboxOpen(true)}
                        className="win-btn text-xs px-3 py-1 font-semibold"
                      >
                        🔍 تكبير صورة الإنذار
                      </button>
                      <a
                        href={attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="win-btn text-xs px-3 py-1 font-semibold flex items-center gap-1"
                      >
                        <span>📥</span>
                        <span>فتح في نافذة جديدة</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="py-4">
                    <p className="text-slate-700 mb-2">تم إرفاق مستند كتاب الإنذار بصيغة PDF أو مستند رسمي.</p>
                    <a
                      href={attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="win-btn text-xs px-4 py-1.5 font-bold inline-flex items-center gap-1.5"
                    >
                      <span>📄</span>
                      <span>معاينة وتنزيل ملف كتاب الإنذار</span>
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 text-center text-slate-500 bg-white win-sunken text-[11px]">
                لم يتم إرفاق صورة لكتاب الإنذار الموقع حتى الآن.
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-2 flex-wrap gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="win-btn text-xs font-bold px-3 py-1 flex items-center gap-1.5 text-blue-900"
              >
                <span>🖨</span>
                <span>طباعة كتاب الإنذار</span>
              </button>

              {['ADMIN', 'HR'].includes(userRole) && warning.status === 'ACTIVE' && revokeWarningAction && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleRevoke}
                  className="win-btn text-xs px-3 py-1 text-amber-900 font-semibold"
                >
                  إلغاء الإنذار
                </button>
              )}

              {userRole === 'ADMIN' && deleteWarningAction && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleDelete}
                  className="win-btn text-xs px-3 py-1 text-rose-800 font-bold"
                >
                  حذف نهائي
                </button>
              )}
            </div>

            <button type="button" onClick={onClose} className="win-btn text-xs px-4 py-1 font-bold">
              إغلاق
            </button>
          </div>
        </div>
      </Modal>

      {/* Image Lightbox Modal */}
      {imageLightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setImageLightboxOpen(false)}
        >
          <div className="max-w-4xl max-h-[90vh] flex flex-col items-center">
            <img
              src={attachmentUrl}
              alt="كتاب الإنذار الموقع"
              className="max-h-[80vh] max-w-full object-contain rounded bg-white shadow-2xl"
            />
            <div className="mt-3 flex gap-3">
              <a
                href={attachmentUrl}
                download
                className="win-btn px-4 py-1.5 font-bold text-xs bg-white text-black"
                onClick={(e) => e.stopPropagation()}
              >
                تحميل الصورة
              </a>
              <button
                type="button"
                className="win-btn px-4 py-1.5 font-bold text-xs bg-white text-black"
                onClick={() => setImageLightboxOpen(false)}
              >
                إغلاق (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Warning Letter Modal */}
      <PrintWarningModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        warning={warning}
      />
    </>
  );
}
