'use client';

import React from 'react';
import { PayslipData } from '@/lib/services/payslip-service';

export function SmartLinesHeader() {
  return (
    <div className="w-full pb-1.5 mb-1.5 border-b border-slate-800">
      <div className="flex justify-between items-center">
        {/* Left Side: Smart Lines Logo */}
        <div className="flex flex-col items-start" dir="ltr">
          <div className="flex items-baseline space-x-1 font-sans">
            <span className="text-xl md:text-2xl font-black text-[#0088CC] tracking-tight leading-none">SMART</span>
          </div>
          <div className="flex items-center space-x-1 mt-[-2px]">
            <span className="text-xs md:text-sm font-extrabold text-[#0088CC] tracking-widest leading-none">LINES</span>
            <div className="flex flex-col space-y-[2px] w-8">
              <div className="h-[2px] bg-[#C59B27] w-full rounded-full" />
              <div className="h-[2px] bg-[#C59B27] w-full rounded-full" />
              <div className="h-[2px] bg-[#C59B27] w-full rounded-full" />
            </div>
          </div>
        </div>

        {/* Center: Title */}
        <div className="text-center">
          <h2 className="text-sm md:text-base font-black text-slate-900 border-b-2 border-blue-900 pb-0.5 px-3">
            سند استلام راتب
          </h2>
          <span className="text-[8.5px] text-slate-600 font-bold block mt-0.5">
            قسيمة الأجر الشهري الرسمية
          </span>
        </div>

        {/* Right Side: Arabic & English Company Name */}
        <div className="text-right" dir="rtl">
          <h1 className="text-xs md:text-sm font-bold text-slate-900 tracking-tight leading-tight">
            شركة الخطوط الأذكى لصناعة المنظفات
          </h1>
          <h2 className="text-[8px] font-extrabold text-slate-600 tracking-wide" dir="ltr">
            SMART LINES DETERGENT MFG CO
          </h2>
          <span className="text-[8px] font-bold text-[#0088CC] block">
            ذات مسؤولية محدودة
          </span>
        </div>
      </div>
    </div>
  );
}

export function SalaryReceiptView({ payslip }: { payslip: PayslipData }) {
  // Format numeric helpers
  const formatVal = (val: string | number | undefined) => {
    if (val === undefined || val === null || val === '' || val === '0' || val === '0.00' || val === '0.000') {
      return '-';
    }
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num) || num === 0) return '-';
    return num.toFixed(2);
  };

  return (
    <div className="payslip-card w-full max-w-3xl mx-auto bg-white p-2.5 md:p-3 text-slate-900 border border-slate-300 font-sans select-none text-[9px] md:text-[9.5px] leading-tight" dir="rtl">
      {/* 1. Header */}
      <SmartLinesHeader />

      {/* 2. Compact Metadata Table Grid (2 Rows) */}
      <div className="border border-slate-400 text-[8.5px] md:text-[9px] mb-2 divide-y divide-slate-300 rounded-sm overflow-hidden">
        {/* Row 1: Employee No, Name, Period, Social Security */}
        <div className="grid grid-cols-4 divide-x divide-x-reverse divide-slate-300 bg-slate-50 p-1 items-center">
          <div className="px-1.5 flex items-center justify-between">
            <span className="font-bold text-slate-700">الرقم الوظيفي:</span>
            <span className="font-mono font-bold text-[10px] bg-white px-1.5 py-0.2 border border-slate-400 rounded">
              {payslip.employeeNo}
            </span>
          </div>
          <div className="px-1.5 col-span-1 truncate">
            <span className="font-bold text-slate-700 ml-1">الاسم:</span>
            <span className="font-black text-slate-900">{payslip.employeeName}</span>
          </div>
          <div className="px-1.5 flex items-center justify-between">
            <span className="font-bold text-slate-700">الفترة:</span>
            <span className="font-mono text-[8px] font-semibold">{payslip.periodStart} إلى {payslip.periodEnd}</span>
          </div>
          <div className="px-1.5 flex items-center justify-between">
            <span className="font-bold text-slate-700">نسبة الضمان:</span>
            <span className="font-mono font-bold">{payslip.socialSecurityRate || '0.00%'}</span>
          </div>
        </div>

        {/* Row 2: Worked Days, National ID, Insurance No, Status */}
        <div className="grid grid-cols-4 divide-x divide-x-reverse divide-slate-300 bg-white p-1 items-center">
          <div className="px-1.5 flex items-center justify-between">
            <span className="font-bold text-slate-700">أيام الدوام:</span>
            <span className="font-mono font-bold text-[10px]">{payslip.workedDays}</span>
          </div>
          <div className="px-1.5 flex items-center justify-between">
            <span className="font-bold text-slate-700">رقم الهوية:</span>
            <span className="font-mono font-semibold">{payslip.nationalId || '-'}</span>
          </div>
          <div className="px-1.5 flex items-center justify-between">
            <span className="font-bold text-slate-700">رقم التأمين:</span>
            <span className="font-mono font-semibold">{payslip.insuranceNo || '-'}</span>
          </div>
          <div className="px-1.5 flex items-center justify-between">
            <span className="font-bold text-slate-700">الحالة:</span>
            <span className="font-bold text-blue-950">
              {payslip.status === 'APPROVED' ? 'معتمد' : payslip.status === 'PAID' ? 'مدفوع' : 'مسودة'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Two-Column Itemized Additions & Deductions Tables */}
      <div className="grid grid-cols-2 gap-2 text-[8.5px] md:text-[9px]">
        {/* Additions Table (Right side in RTL) */}
        <div className="border border-slate-400 rounded-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-[#1D4ED8] text-white py-0.5 px-2 font-bold text-center text-[10px]">
              الإضافات
            </div>
            <table className="w-full text-right divide-y divide-slate-200">
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-0.5 px-2 text-slate-800">الراتب الأساسي</td>
                  <td className="py-0.5 px-2 font-mono text-left font-semibold">{formatVal(payslip.basicEarned)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-slate-800">مكافأة مواصلات أيام عمل</td>
                  <td className="py-0.5 px-2 font-mono text-left">{formatVal(payslip.allowancesEarned)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-slate-800">بدل توصيل</td>
                  <td className="py-0.5 px-2 font-mono text-left">{formatVal(payslip.deliveryAllowance)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-slate-800">اكراميات</td>
                  <td className="py-0.5 px-2 font-mono text-left font-bold text-emerald-800">{formatVal(payslip.tipsGratuities)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-slate-800">اضافات اخرى</td>
                  <td className="py-0.5 px-2 font-mono text-left">{formatVal(payslip.otherAdditions)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-slate-800">ساعات عمل إضافي</td>
                  <td className="py-0.5 px-2 font-mono text-left">{payslip.otHours && Number(payslip.otHours) > 0 ? payslip.otHours : '-'}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-slate-800">بدل إضافي</td>
                  <td className="py-0.5 px-2 font-mono text-left">{formatVal(payslip.otTotal)}</td>
                </tr>
                {/* Spacer rows to balance the 9 rows of deductions */}
                <tr className="text-slate-300">
                  <td className="py-0.5 px-2">-</td>
                  <td className="py-0.5 px-2 text-left">-</td>
                </tr>
                <tr className="text-slate-300">
                  <td className="py-0.5 px-2">-</td>
                  <td className="py-0.5 px-2 text-left">-</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="bg-[#1D4ED8] text-white py-0.5 px-2 font-bold flex justify-between items-center text-[9.5px] border-t border-slate-400">
            <span>اجمالي الإضافات (الراتب الإجمالي)</span>
            <span className="font-mono font-black">{parseFloat(payslip.totalEarnings).toFixed(2)}</span>
          </div>
        </div>

        {/* Deductions Table (Left side in RTL) */}
        <div className="border border-slate-400 rounded-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-[#1D4ED8] text-white py-0.5 px-2 font-bold text-center text-[10px]">
              الخصومات
            </div>
            <table className="w-full text-right divide-y divide-slate-200">
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-0.5 px-2 text-slate-800">ضمان اجتماعي</td>
                  <td className="py-0.5 px-2 font-mono text-left">{formatVal(payslip.socialSecurityDeduction)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-slate-800">السلف</td>
                  <td className="py-0.5 px-2 font-mono text-left">{formatVal(payslip.loanDeduction)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-slate-800">عدد أيام الغياب</td>
                  <td className="py-0.5 px-2 font-mono text-left">{payslip.unpaidDays && Number(payslip.unpaidDays) > 0 ? payslip.unpaidDays : '-'}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-slate-800">خصم الغياب</td>
                  <td className="py-0.5 px-2 font-mono text-left">{formatVal(payslip.unpaidDeduction)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-slate-800">ساعات مغادرة</td>
                  <td className="py-0.5 px-2 font-mono text-left">{payslip.earlyDepartureHours && Number(payslip.earlyDepartureHours) > 0 ? payslip.earlyDepartureHours : '-'}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-slate-800">خصم مغادرة</td>
                  <td className="py-0.5 px-2 font-mono text-left">{formatVal(payslip.earlyDepartureDeduction)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-slate-800">ساعات التأخير</td>
                  <td className="py-0.5 px-2 font-mono text-left">{payslip.lateHours && Number(payslip.lateHours) > 0 ? payslip.lateHours : '-'}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-slate-800">خصم تأخير</td>
                  <td className="py-0.5 px-2 font-mono text-left">{formatVal(payslip.lateDeduction)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-2 text-slate-800">خصومات أخرى</td>
                  <td className="py-0.5 px-2 font-mono text-left">{formatVal(payslip.otherDeductions)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="bg-[#1D4ED8] text-white py-0.5 px-2 font-bold flex justify-between items-center text-[9.5px] border-t border-slate-400">
            <span>اجمالي الخصومات</span>
            <span className="font-mono font-black">{parseFloat(payslip.totalDeductions).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* 4. Combined Net Payable & Signatures Bar */}
      <div className="mt-2 pt-1 border-t border-slate-400 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-[9px]">
        {/* Net Pay Badge */}
        <div className="bg-[#0A246A] text-white py-1 px-3 rounded flex items-center justify-between sm:justify-start gap-2 font-bold shadow-sm whitespace-nowrap">
          <span>اجمالي الراتب المستحق (الصافي النهائي):</span>
          <span className="font-mono text-xs font-black text-amber-300">
            {parseFloat(payslip.netPay).toFixed(2)} د.أ
          </span>
        </div>

        {/* Signatures */}
        <div className="flex-1 flex justify-around items-center border border-slate-300 bg-slate-50 py-1 px-2 rounded font-bold text-slate-800">
          <div className="flex items-center gap-1">
            <span>المستلم:</span>
            <span className="inline-block w-14 border-b border-dotted border-slate-600" />
          </div>
          <div className="flex items-center gap-1">
            <span>المحاسب:</span>
            <span className="inline-block w-14 border-b border-dotted border-slate-600" />
          </div>
          <div className="flex items-center gap-1">
            <span>الإدارة:</span>
            <span className="inline-block w-14 border-b border-dotted border-slate-600" />
          </div>
        </div>
      </div>
    </div>
  );
}
