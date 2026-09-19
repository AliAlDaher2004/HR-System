'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ShieldCheck, Printer, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface SaveMonthlyStatementModalProps {
  currentMonth?: string;
  draftCount?: number;
  totalNetPay?: number;
  approveMonthlyStatementAction: (formData: FormData) => Promise<{ approvedCount: number; errors: string[] }>;
}

export function SaveMonthlyStatementModal({
  currentMonth,
  draftCount = 0,
  totalNetPay = 0,
  approveMonthlyStatementAction,
}: SaveMonthlyStatementModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [month, setMonth] = useState<string>(currentMonth || new Date().toISOString().slice(0, 7));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ approvedCount: number; errors: string[] } | null>(null);

  const handleOpen = () => {
    setMonth(currentMonth || new Date().toISOString().slice(0, 7));
    setResult(null);
    setIsOpen(true);
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.set('month', month);

      const res = await approveMonthlyStatementAction(formData);
      setResult(res);
    } catch (err: any) {
      setResult({ approvedCount: 0, errors: [err.message || 'حدث خطأ أثناء اعتماد مسير الشهر'] });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="win-btn font-bold text-xs px-3 py-1 flex items-center gap-1.5 text-emerald-900 bg-emerald-50 border border-emerald-400 shadow-sm"
      >
        <ShieldCheck className="w-4 h-4 text-emerald-700" />
        <span>حفظ واعتماد مسير الشهر</span>
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`حفظ واعتماد مسير الشهر وتثبيت البيان المجمع: (${month})`}
        maxWidth="md"
      >
        <div className="space-y-3 text-xs select-none" dir="rtl">
          {result && (
            <div>
              {result.errors.length === 0 ? (
                <div className="p-3 bg-emerald-50 border border-emerald-400 text-emerald-900 rounded win-sunken space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>تم اعتماد وتثبيت مسير الشهر بنجاح!</span>
                  </div>
                  <p className="text-xs">
                    تم اعتماد عدد <strong className="font-mono">{result.approvedCount}</strong> كشف راتب وتجميد قيم الصافي والخصومات، وتوثيق قسائم الرواتب في ملفات الموظفين وسجل الكشف المجمع.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-rose-50 border border-rose-400 text-rose-900 rounded win-sunken space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <AlertCircle className="w-5 h-5 text-rose-600" />
                    <span>تنبيهات الاعتماد: تم اعتماد ({result.approvedCount}) وتوجد بعض الأخطاء</span>
                  </div>
                  <ul className="list-disc list-inside text-xs space-y-0.5">
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {!result && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="win-raised p-3 bg-[#ECE9D8] space-y-2">
                <label className="block font-bold text-black text-xs">الشهر المستهدف للحفظ والاعتماد النهائي</label>
                <input
                  type="month"
                  required
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="win-input w-full py-1 px-2 font-mono font-bold text-sm text-[#0A246A]"
                />
                <p className="text-[11px] text-[#505050]">
                  إجراء الاعتماد النهائي يقوم بتجميد كافة الأرقام واحتساب الخصومات والسلف والضمان للكوادر، وحفظ قسائم الرواتب في ملف كل موظف، مع الأرشفة الدائمة للبيان المجمع لهذا الشهر.
                </p>
              </div>

              {draftCount > 0 && (
                <div className="win-sunken p-2.5 bg-blue-50 border border-blue-300 text-blue-950 font-bold text-xs flex justify-between items-center">
                  <span>كشوف المسودة الجاهزة للاعتماد:</span>
                  <span className="font-mono text-sm text-blue-900">{draftCount} كشف</span>
                </div>
              )}

              {totalNetPay > 0 && (
                <div className="win-sunken p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-950 font-bold text-xs flex justify-between items-center">
                  <span>إجمالي صافي المسير المراد اعتماده:</span>
                  <span className="font-mono text-sm text-emerald-900">{totalNetPay.toFixed(3)} د.أ</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#808080]">
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
                  className="win-btn px-5 py-1.5 font-bold text-white bg-[#0A246A] hover:bg-[#081C52]"
                >
                  {isSubmitting ? 'جارٍ الاعتماد والتثبيت...' : 'تأكيد الاعتماد وحفظ المسير الشهري'}
                </button>
              </div>
            </form>
          )}

          {/* Quick Action links post-approval or inside modal */}
          <div className="pt-2 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Link
              href={`/payroll/consolidated?month=${month}`}
              onClick={() => setIsOpen(false)}
              className="win-btn text-[11px] py-1.5 px-2 flex items-center justify-center gap-1 font-bold text-[#0A246A]"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة البيان المجمع (PDF)</span>
            </Link>

            <Link
              href={`/payroll/payslips-batch?month=${month}`}
              onClick={() => setIsOpen(false)}
              className="win-btn text-[11px] py-1.5 px-2 flex items-center justify-center gap-1 font-bold text-emerald-800"
            >
              <span>🖨️</span>
              <span>طباعة قسائم الرواتب للجميع</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="win-btn text-[11px] py-1.5 px-2 flex items-center justify-center gap-1 font-bold text-slate-800"
            >
              <span>إغلاق</span>
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
