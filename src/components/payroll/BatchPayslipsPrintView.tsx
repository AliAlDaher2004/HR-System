'use client';

import React from 'react';
import { PayslipData } from '@/lib/services/payslip-service';
import { Printer } from 'lucide-react';
import { SalaryReceiptView } from './SalaryReceiptView';

export function BatchPayslipsPrintView({ payslips }: { payslips: PayslipData[] }) {
  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4">
      {/* Printable Control Bar (Hidden when printing) */}
      <div className="flex justify-between items-center bg-[#ECE9D8] win-raised p-3 mb-6 no-print">
        <div>
          <h2 className="text-sm font-bold text-black flex items-center gap-1.5">
            <span>🖨️</span>
            <span>طباعة مسير / قسائم الرواتب للجميع</span>
          </h2>
          <p className="text-[#505050] text-xs mt-0.5">
            إجمالي عدد القسائم الشاملة: <span className="font-bold text-black">{payslips.length}</span> موظف
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="win-btn font-bold text-xs px-4 py-1.5 flex items-center gap-2 text-[#0A246A]"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة كافة القسائم (PDF)</span>
        </button>
      </div>

      {/* Payslips Container */}
      <div className="space-y-8 print:space-y-0">
        {payslips.length === 0 ? (
          <div className="bg-white p-8 text-center text-slate-500 rounded-xl border border-slate-300">
            لا توجد قسائم رواتب مطابقة لشروط الفحص للطباعة
          </div>
        ) : (
          payslips.map((payslip, idx) => (
            <div
              key={`${payslip.employeeNo}-${idx}`}
              className="print:break-after-page page-break-always mb-8 print:mb-0"
            >
              <SalaryReceiptView payslip={payslip} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
