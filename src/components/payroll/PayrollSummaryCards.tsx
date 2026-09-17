import React from 'react';

export interface PayrollSummaryTotals {
  totalBasicAndAllowances: number;
  totalOvertimeAndAdditions: number;
  totalDeductions: number;
  grandTotalNetPay: number;
  currency: string;
  totalEmployeesCount: number;
}

export function PayrollSummaryCards({ totals }: { totals: PayrollSummaryTotals }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
      {/* 1. Basic Salaries & Allowances */}
      <div className="win-raised p-2.5 bg-gradient-to-b from-[#F7F9FC] to-[#ECE9D8] border border-[#7F9DB9]">
        <div className="flex items-center justify-between text-[#505050] text-[11px] font-bold">
          <span>إجمالي الأسس والبدلات</span>
          <span>💼</span>
        </div>
        <div className="mt-1 text-base font-extrabold font-mono text-[#0A246A]">
          {totals.totalBasicAndAllowances.toFixed(3)}{' '}
          <span className="text-[10px] font-normal text-slate-600">{totals.currency}</span>
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">
          الرواتب الأساسية + البدلات الشهرية
        </div>
      </div>

      {/* 2. Overtime & Additions */}
      <div className="win-raised p-2.5 bg-gradient-to-b from-[#F0FDF4] to-[#ECE9D8] border border-[#7F9DB9]">
        <div className="flex items-center justify-between text-emerald-800 text-[11px] font-bold">
          <span>إجمالي الإضافي والمكافآت</span>
          <span>⚡</span>
        </div>
        <div className="mt-1 text-base font-extrabold font-mono text-emerald-800">
          +{totals.totalOvertimeAndAdditions.toFixed(3)}{' '}
          <span className="text-[10px] font-normal text-slate-600">{totals.currency}</span>
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">
          مستحقات الساعات الإضافية والمكافآت
        </div>
      </div>

      {/* 3. Deductions */}
      <div className="win-raised p-2.5 bg-gradient-to-b from-[#FFF1F2] to-[#ECE9D8] border border-[#7F9DB9]">
        <div className="flex items-center justify-between text-rose-800 text-[11px] font-bold">
          <span>إجمالي الخصومات والاستقطاعات</span>
          <span>🔻</span>
        </div>
        <div className="mt-1 text-base font-extrabold font-mono text-rose-800">
          -{totals.totalDeductions.toFixed(3)}{' '}
          <span className="text-[10px] font-normal text-slate-600">{totals.currency}</span>
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">
          تأخيرات، مغادرات، غياب، وأقساط سلف
        </div>
      </div>

      {/* 4. Grand Total Net Pay */}
      <div className="win-raised p-2.5 bg-[#15324F] text-white border border-[#0A246A] shadow-md">
        <div className="flex items-center justify-between text-slate-200 text-[11px] font-bold">
          <span>الإجمالي الكلي لصافي الرواتب</span>
          <span className="text-emerald-400">💵</span>
        </div>
        <div className="mt-1 text-lg font-black font-mono text-emerald-400 tracking-tight">
          {totals.grandTotalNetPay.toFixed(3)}{' '}
          <span className="text-xs font-normal text-slate-300">{totals.currency}</span>
        </div>
        <div className="text-[10px] text-slate-300 mt-0.5 flex justify-between">
          <span>صافي الكشف المستحق للصرف</span>
          <span className="font-bold">({totals.totalEmployeesCount} مسير)</span>
        </div>
      </div>
    </div>
  );
}
