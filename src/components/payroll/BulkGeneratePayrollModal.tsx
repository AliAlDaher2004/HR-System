'use client';

import React, { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { Zap, CheckCircle2, AlertTriangle } from 'lucide-react';

interface BulkGeneratePayrollModalProps {
  currentMonth?: string;
  bulkGenerateAction: (formData: FormData) => Promise<{
    totalActiveCount: number;
    successCount: number;
    skippedCount: number;
    errors: { employeeId: string; employeeName: string; reason: string }[];
  }>;
}

export function BulkGeneratePayrollModal({
  currentMonth,
  bulkGenerateAction,
}: BulkGeneratePayrollModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{
    totalActiveCount: number;
    successCount: number;
    skippedCount: number;
    errors: { employeeId: string; employeeName: string; reason: string }[];
  } | null>(null);

  const defaultMonth = currentMonth || new Date().toISOString().slice(0, 7);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setResult(null);

    try {
      const formData = new FormData(e.currentTarget);
      const res = await bulkGenerateAction(formData);
      setResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء الاحتساب والتوليد التلقائي للرواتب');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setIsOpen(false);
    setResult(null);
    setErrorMessage(null);
  }

  return (
    <>
      <Button
        type="button"
        variant="primary"
        onClick={() => {
          setErrorMessage(null);
          setResult(null);
          setIsOpen(true);
        }}
        className="win-btn bg-[#0A246A] hover:bg-[#113388] text-white flex items-center font-bold px-3 py-1 text-xs cursor-pointer shadow-sm"
      >
        <Zap className="w-3.5 h-3.5 ml-1.5 text-amber-300" />
        توليد الرواتب لجميع الموظفين
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="الاحتساب والتوليد التلقائي لرواتب الموظفين النشطين"
        maxWidth="md"
      >
        {result ? (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded text-emerald-900 text-xs">
              <div className="font-bold flex items-center gap-1.5 text-sm mb-1 text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>اكتملت عملية التوليد التلقائي بنجاح</span>
              </div>
              <ul className="list-disc list-inside space-y-1 mr-2 mt-2 font-mono text-[11px]">
                <li>إجمالي عدد الموظفين النشطين: <strong>{result.totalActiveCount}</strong></li>
                <li>عدد المسودات الجديدة المنشأة: <strong className="text-emerald-700">{result.successCount}</strong></li>
                <li>عدد الموظفين المتجاوزين (مسودات موجودة سابقاً): <strong>{result.skippedCount}</strong></li>
              </ul>
            </div>

            {result.errors.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded text-amber-900 text-xs">
                <div className="font-bold flex items-center gap-1 text-amber-800 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>تنبيهات وتجاوزات ({result.errors.length})</span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] pr-2">
                  {result.errors.map((err, idx) => (
                    <div key={idx} className="border-b border-amber-200 pb-1">
                      <span className="font-bold">{err.employeeName}:</span> {err.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button type="button" onClick={handleClose} className="win-btn font-bold px-4 py-1 text-xs">
                إغلاق والمتابعة
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            {errorMessage && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                {errorMessage}
              </div>
            )}

            <div className="p-3 bg-[#F5F4EA] border border-[#D4D0C8] rounded text-[#404040] space-y-1.5 leading-relaxed text-[11px]">
              <p className="font-bold text-black flex items-center gap-1">
                <span>⚡</span>
                <span>ماذا ستفعل هذه العملية؟</span>
              </p>
              <p>
                سيتم مسح جميع الموظفين النشطين في المؤسسة واحتساب كشوفات الرواتب الشهرية لهم تلقائياً بحسب نوع عقودهم (مثبتين أو عمال مياومة)، مع تطبيق خصومات الدقائق وساعات الإضافي وسلف الموظفين.
              </p>
              <p className="text-amber-800 font-semibold">
                ملاحظة: الموظفون الذين لديهم كشف راتب نشط مسبقاً لهذا الشهر لن يتم تكرارهم.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-black mb-1">
                الشهر المستهدف للاحتساب والتوليد <span className="text-red-600">*</span>
              </label>
              <input
                name="monthPeriod"
                type="month"
                required
                defaultValue={defaultMonth}
                className="win-input w-full py-1.5 px-2 font-mono font-bold text-xs"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 space-x-reverse pt-3 border-t border-[#D4D0C8]">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="win-btn text-xs"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="win-btn bg-[#0A246A] hover:bg-[#113388] text-white font-bold text-xs px-4 py-1"
              >
                {isSubmitting ? 'جارٍ احتساب وتوليد الرواتب...' : 'بدء الاحتساب والتوليد التلقائي'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
