'use client';

import React, { useMemo } from 'react';
import { PayslipData } from '@/lib/services/payslip-service';
import { Printer } from 'lucide-react';
import { SalaryReceiptView } from './SalaryReceiptView';

export function BatchPayslipsPrintView({ payslips }: { payslips: PayslipData[] }) {
  // Pair payslips two-by-two so exactly 2 payslips fit on 1 A4 portrait page
  const pages: PayslipData[][] = useMemo(() => {
    const res: PayslipData[][] = [];
    for (let i = 0; i < payslips.length; i += 2) {
      res.push(payslips.slice(i, i + 2));
    }
    return res;
  }, [payslips]);

  return (
    <div className="w-full max-w-4xl mx-auto py-4 px-2 md:px-4 font-sans select-none" dir="rtl">
      {/* Print Styles for 2 Payslips Per A4 Sheet */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 4mm 5mm 4mm 5mm;
          }

          html, body {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            font-size: 8pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .no-print, nav, header, aside, button, a {
            display: none !important;
          }

          .a4-sheet-page {
            width: 100% !important;
            height: 288mm !important;
            max-height: 288mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }

          .payslip-half-container {
            width: 100% !important;
            height: 140mm !important;
            max-height: 140mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
          }

          .payslip-card {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            border: 1pt solid #475569 !important;
            padding: 3mm 4mm !important;
          }

          .cut-line-separator {
            height: 6mm !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
        }
      `}</style>

      {/* Printable Control Bar (Hidden when printing) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#ECE9D8] win-raised p-3 mb-5 gap-3 no-print">
        <div>
          <h2 className="text-sm font-bold text-black flex items-center gap-1.5">
            <span>🖨️</span>
            <span>طباعة قسائم الرواتب (قسيمتان في كل صفحة A4)</span>
          </h2>
          <p className="text-[#505050] text-xs mt-0.5">
            إجمالي عدد الموظفين: <span className="font-bold text-black">{payslips.length}</span> موظفاً
            <span className="mx-2 text-slate-400">|</span>
            إجمالي أوراق الطباعة: <span className="font-bold text-blue-900 bg-blue-100 px-2 py-0.2 rounded border border-blue-300 font-mono">{pages.length}</span> ورقة A4 فقط
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="win-btn font-black text-xs px-5 py-2 flex items-center gap-2 bg-[#008080] text-white hover:bg-[#006666] shadow cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة كافة القسائم (PDF)</span>
          </button>
        </div>
      </div>

      {/* Payslips Container - Grouped in pairs of 2 per A4 sheet */}
      <div className="space-y-8 print:space-y-0">
        {payslips.length === 0 ? (
          <div className="bg-white p-8 text-center text-slate-500 rounded-xl border border-slate-300">
            لا توجد قسائم رواتب مطابقة لشروط الفحص للطباعة
          </div>
        ) : (
          pages.map((pair, pageIdx) => (
            <div
              key={`a4-page-${pageIdx}`}
              className="a4-sheet-page bg-white p-3 md:p-4 mb-6 print:mb-0 print:p-0 print:border-none shadow-md print:shadow-none border border-slate-300 rounded"
            >
              {/* Page Number Badge on Screen View */}
              <div className="text-[10px] font-mono text-slate-400 mb-2 flex justify-between no-print">
                <span>صفحة A4 رقم: {pageIdx + 1} من {pages.length}</span>
                <span>(تحتوي على قسيمتي راتب)</span>
              </div>

              {pair.map((payslip, itemIdx) => (
                <React.Fragment key={`${payslip.employeeNo}-${pageIdx}-${itemIdx}`}>
                  <div className="payslip-half-container w-full">
                    <SalaryReceiptView payslip={payslip} />
                  </div>

                  {/* Cut-line separator between payslip 1 and payslip 2 on the same sheet */}
                  {itemIdx === 0 && pair.length > 1 && (
                    <div className="cut-line-separator relative flex items-center justify-center my-3 print:my-0 text-slate-400 select-none">
                      <div className="w-full border-b border-dashed border-slate-500" />
                      <span className="absolute bg-white px-3 text-[9px] font-mono text-slate-600 flex items-center gap-1.5 border border-slate-300 rounded-full">
                        <span>✂</span>
                        <span>مكان القص — قسيمة نصف صفحة A4</span>
                        <span>✂</span>
                      </span>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
