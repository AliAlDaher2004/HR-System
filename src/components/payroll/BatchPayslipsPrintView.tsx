'use client';

import React from 'react';
import { PayslipData } from '@/lib/services/payslip-service';
import { Printer } from 'lucide-react';
import { SalaryReceiptView } from './SalaryReceiptView';

export function BatchPayslipsPrintView({ payslips }: { payslips: PayslipData[] }) {
  return (
    <div className="w-full max-w-4xl mx-auto py-4 px-2 md:px-4 font-sans select-none" dir="rtl">
      {/* Print Styles: Each payslip is strictly 1 A4 page */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }

          html, body {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            font-size: 9pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .no-print, nav, header, aside, button, a {
            display: none !important;
          }

          .payslip-page-wrapper {
            width: 100% !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            box-sizing: border-box !important;
          }

          .payslip-page-wrapper:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .payslip-card {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            border: 1.5pt solid #1e293b !important;
            padding: 6mm 7mm !important;
            margin: 0 auto !important;
          }
        }
      `}</style>

      {/* Printable Control Bar (Hidden when printing) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#ECE9D8] win-raised p-3 mb-5 gap-3 no-print">
        <div>
          <h2 className="text-sm font-bold text-black flex items-center gap-1.5">
            <span>🖨️</span>
            <span>طباعة قسائم الرواتب الرسمية (سند استلام راتب)</span>
          </h2>
          <p className="text-[#505050] text-xs mt-1">
            إجمالي عدد الموظفين: <span className="font-bold text-black">{payslips.length}</span> موظفاً
            <span className="mx-2 text-slate-400">|</span>
            تم ضبط كل قسيمة لتتسع تماماً في صفحة A4 واحدة دون أي امتداد
          </p>
          <div className="mt-1 text-xs text-blue-900 bg-blue-50 border border-blue-200 rounded px-2.5 py-1">
            💡 <strong>لطباعة قسيمتين في كل ورقة:</strong> من نافذة الطباعة في المتصفح، افتح المزيد من الإعدادات (More settings) واختر <strong>Pages per sheet: 2</strong> وسيتم دمج كل قسيمتين تلقائياً وبأعلى جودة.
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => window.print()}
            className="win-btn font-black text-xs px-5 py-2.5 flex items-center gap-2 bg-[#008080] text-white hover:bg-[#006666] shadow cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة كافة القسائم ({payslips.length})</span>
          </button>
        </div>
      </div>

      {/* Payslips Container - 1 Payslip per page wrapper */}
      <div className="space-y-8 print:space-y-0">
        {payslips.length === 0 ? (
          <div className="bg-white p-8 text-center text-slate-500 rounded-xl border border-slate-300">
            لا توجد قسائم رواتب مطابقة لشروط الفحص للطباعة
          </div>
        ) : (
          payslips.map((payslip, idx) => (
            <div
              key={`${payslip.employeeNo}-${idx}`}
              className="payslip-page-wrapper bg-white p-4 md:p-6 mb-6 print:mb-0 print:p-0 shadow-md print:shadow-none border border-slate-300 print:border-none rounded"
            >
              {/* Screen-only page header */}
              <div className="text-[11px] font-mono text-slate-500 mb-2 flex justify-between items-center no-print border-b pb-1">
                <span>
                  قسيمة موظف ({idx + 1} من {payslips.length}): <strong>{payslip.employeeName}</strong> (رقم: {payslip.employeeNo})
                </span>
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px]">
                  صفحة A4 مستقلة
                </span>
              </div>

              <SalaryReceiptView payslip={payslip} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
