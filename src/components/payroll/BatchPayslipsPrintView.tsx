'use client';

import React from 'react';
import { PayslipData } from '@/lib/services/payslip-service';
import { Printer, ShieldCheck } from 'lucide-react';

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
              className="bg-white border border-slate-300 rounded-2xl shadow-lg p-6 md:p-8 text-slate-800 print:shadow-none print:border-slate-400 print:rounded-none print:p-4 print:mb-0 print:break-after-page page-break-always"
              dir="rtl"
            >
              {/* Header */}
              <div className="flex justify-between items-start pb-4 border-b-2 border-[#15324F]">
                <div>
                  <h1 className="text-xl font-black text-[#15324F] tracking-tight">{payslip.companyName}</h1>
                  <span className="text-xs text-slate-500 block mt-0.5">{payslip.country}</span>
                  <span className="text-xs text-slate-400 block mt-0.5">إدارة الموارد البشرية والعمليات المالية</span>
                </div>
                <div className="text-left" dir="ltr">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">PAYSLIP / قسيمة راتب</div>
                  <div className="text-xs font-mono font-bold text-[#2169A6] mt-1">{payslip.periodStart.slice(0, 7)}</div>
                </div>
              </div>

              {/* Employee Information Summary Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-3 bg-slate-50 rounded-xl px-4 mt-4 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">اسم الموظف</span>
                  <span className="font-bold text-slate-800">{payslip.employeeName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">الرقم الوظيفي</span>
                  <span className="font-bold text-slate-800 font-mono">{payslip.employeeNo}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">القسم</span>
                  <span className="font-bold text-slate-800">{payslip.department}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">المسمى الوظيفي</span>
                  <span className="font-bold text-slate-800">{payslip.jobTitle}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">فترة الاستحقاق</span>
                  <span className="font-semibold text-slate-700 font-mono text-[11px]">
                    {payslip.periodStart} إلى {payslip.periodEnd}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">عملة الراتب</span>
                  <span className="font-semibold text-slate-700">{payslip.currency}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">حالة الكشف</span>
                  <span className="font-bold text-emerald-700">
                    {payslip.status === 'PAID' ? 'مدفوع' : payslip.status === 'APPROVED' ? 'معتمد' : 'مسودة'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">تاريخ الاعتماد</span>
                  <span className="font-semibold text-slate-700 font-mono text-[11px]">{payslip.approvedAt || '-'}</span>
                </div>
              </div>

              {/* Earnings vs Deductions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {/* Earnings Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-[#15324F] text-white py-1.5 px-3 text-xs font-bold flex justify-between">
                    <span>الاستحقاقات والبدلات</span>
                    <span>المبلغ ({payslip.currency})</span>
                  </div>
                  <div className="divide-y divide-slate-100 text-xs p-2.5 space-y-1.5">
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-600">الراتب الأساسي / أجر المياومة:</span>
                      <span className="font-mono font-semibold">{payslip.basicEarned}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-600">البدلات الشهرية:</span>
                      <span className="font-mono font-semibold">{payslip.allowancesEarned}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-600">
                        العمل الإضافي ({payslip.otHours} س × {payslip.otRate}):
                      </span>
                      <span className="font-mono font-semibold text-emerald-700">+{payslip.otTotal}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-600">مكافآت وإضافات أخرى:</span>
                      <span className="font-mono font-semibold text-emerald-700">+{payslip.otherAdditions}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 border-t border-slate-200 py-2 px-3 text-xs font-bold flex justify-between">
                    <span>إجمالي الاستحقاقات:</span>
                    <span className="font-mono text-emerald-700">{payslip.totalEarnings}</span>
                  </div>
                </div>

                {/* Deductions Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-700 text-white py-1.5 px-3 text-xs font-bold flex justify-between">
                    <span>الاستقطاعات والخصومات</span>
                    <span>المبلغ ({payslip.currency})</span>
                  </div>
                  <div className="divide-y divide-slate-100 text-xs p-2.5 space-y-1.5">
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-600">
                        خصم الغياب ({payslip.unpaidDays} ي × {payslip.unpaidDayRate}):
                      </span>
                      <span className="font-mono font-semibold text-rose-700">-{payslip.unpaidDeduction}</span>
                    </div>
                    {payslip.lateDeduction && Number(payslip.lateDeduction) > 0 && (
                      <div className="flex justify-between py-0.5">
                        <span className="text-slate-600">خصم التأخير:</span>
                        <span className="font-mono font-semibold text-rose-700">-{payslip.lateDeduction}</span>
                      </div>
                    )}
                    {payslip.earlyDepartureDeduction && Number(payslip.earlyDepartureDeduction) > 0 && (
                      <div className="flex justify-between py-0.5">
                        <span className="text-slate-600">خصم المغادرة المبكرة:</span>
                        <span className="font-mono font-semibold text-rose-700">-{payslip.earlyDepartureDeduction}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-600">استقطاع أقساط السلف:</span>
                      <span className="font-mono font-semibold text-rose-700">-{payslip.loanDeduction}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-600">استقطاعات أخرى:</span>
                      <span className="font-mono font-semibold text-rose-700">-{payslip.otherDeductions}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 border-t border-slate-200 py-2 px-3 text-xs font-bold flex justify-between">
                    <span>إجمالي الاستقطاعات:</span>
                    <span className="font-mono text-rose-700">-{payslip.totalDeductions}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay Banner */}
              <div className="mt-4 bg-[#15324F] text-white rounded-xl p-4 flex justify-between items-center">
                <div>
                  <span className="text-[11px] text-slate-300 block">صافي الراتب المستحق للصرف</span>
                  <span className="text-xl md:text-2xl font-black font-mono tracking-tight text-white mt-0.5 block">
                    {payslip.netPay} <span className="text-xs font-normal text-slate-300">{payslip.currency}</span>
                  </span>
                </div>
                {payslip.paymentReference && (
                  <div className="text-left text-[11px] text-slate-300" dir="ltr">
                    <div>Ref: {payslip.paymentReference}</div>
                    <div>Method: {payslip.paymentMethod}</div>
                  </div>
                )}
              </div>

              {/* Signatures & Receipt Acknowledgment */}
              <div className="grid grid-cols-2 gap-6 mt-8 pt-4 border-t border-slate-200 text-xs text-slate-600">
                <div>
                  <span className="font-bold block mb-1 text-slate-800">اعتماد إدارة الموارد البشرية والمالية:</span>
                  <span>المعزز: {payslip.approvedBy}</span>
                  <div className="mt-2 flex items-center text-emerald-700 text-[11px] font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 ml-1" />
                    مطابق لسجلات الحضور والإنتاجية ومسير الاعتماد
                  </div>
                </div>
                <div className="text-left" dir="ltr">
                  <span className="font-bold block mb-1 text-slate-800">Employee Receipt Signature:</span>
                  <div className="h-8 border-b border-dashed border-slate-400 w-44 mt-1" />
                  <span className="text-[10px] text-slate-400 mt-1 block">توقيع واستلام قسيمة الراتب</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
