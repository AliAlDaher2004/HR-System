'use client';

import React from 'react';
import { PayslipData } from '@/lib/services/payslip-service';

export function SmartLinesHeader() {
  return (
    <div className="w-full pb-3 border-b-2 border-slate-900">
      <div className="flex justify-between items-center">
        {/* Left Side: Smart Lines Logo */}
        <div className="flex flex-col items-start" dir="ltr">
          <div className="flex items-baseline space-x-1 font-sans">
            <span className="text-3xl md:text-4xl font-black text-[#0088CC] tracking-tight">SMART</span>
          </div>
          <div className="flex items-center space-x-2 mt-[-6px]">
            <span className="text-xl md:text-2xl font-extrabold text-[#0088CC] tracking-widest">LINES</span>
            <div className="flex flex-col space-y-[3px] w-14">
              <div className="h-[3px] bg-[#C59B27] w-full rounded-full" />
              <div className="h-[3px] bg-[#C59B27] w-full rounded-full" />
              <div className="h-[3px] bg-[#C59B27] w-full rounded-full" />
            </div>
          </div>
        </div>

        {/* Right Side: Arabic & English Company Name */}
        <div className="text-right" dir="rtl">
          <h1 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">
            شركة الخطوط الأذكى لصناعة المنظفات
          </h1>
          <h2 className="text-xs md:text-sm font-extrabold text-slate-700 tracking-wide mt-0.5" dir="ltr">
            SMART LINES DETERGENT MANUFACTURING CO
          </h2>
          <span className="text-xs md:text-sm font-bold text-[#0088CC] block mt-0.5">
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
    <div className="w-full max-w-3xl mx-auto bg-white p-6 md:p-8 text-slate-900 border border-slate-300 shadow-md font-sans" dir="rtl">
      {/* 1. Header */}
      <SmartLinesHeader />

      {/* 2. Document Title */}
      <div className="text-center my-4">
        <h2 className="text-lg font-bold text-slate-900">سند استلام راتب</h2>
      </div>

      {/* 3. Metadata Table Grid */}
      <div className="border border-slate-400 text-xs mb-6 divide-y divide-slate-300">
        {/* Row 1: Employee No & Social Security Rate */}
        <div className="grid grid-cols-2 divide-x divide-x-reverse divide-slate-300 bg-slate-50 p-2 items-center">
          <div className="flex justify-between items-center px-2">
            <span className="font-bold text-slate-700">الرقم الوظيفي:</span>
            <span className="font-mono font-bold text-sm bg-white px-3 py-0.5 border border-slate-400 rounded">
              {payslip.employeeNo}
            </span>
          </div>
          <div className="flex justify-between items-center px-2">
            <span className="font-bold text-slate-700">نسبة تحمل الضمان الاجتماعي:</span>
            <span className="font-mono font-bold">{payslip.socialSecurityRate || '0.00%'}</span>
          </div>
        </div>

        {/* Row 2: Period & Worked Days */}
        <div className="grid grid-cols-2 divide-x divide-x-reverse divide-slate-300 bg-white p-2 items-center">
          <div className="flex items-center space-x-2 space-x-reverse px-2">
            <span className="font-bold text-slate-700">الفترة من:</span>
            <span className="font-mono">{payslip.periodStart}</span>
            <span className="font-bold text-slate-700">الى:</span>
            <span className="font-mono">{payslip.periodEnd}</span>
          </div>
          <div className="flex justify-between items-center px-2">
            <span className="font-bold text-slate-700">أيام الدوام:</span>
            <span className="font-mono font-bold">{payslip.workedDays}</span>
          </div>
        </div>

        {/* Row 3: Employee Name, Insurance No, National ID */}
        <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-300 bg-slate-50 p-2 items-center">
          <div className="px-2">
            <span className="font-bold text-slate-700 ml-1">الاسم:</span>
            <span className="font-bold text-slate-900">{payslip.employeeName}</span>
          </div>
          <div className="px-2 text-center">
            <span className="font-bold text-slate-700 ml-1">رقم التأمين:</span>
            <span className="font-mono">{payslip.insuranceNo || '0'}</span>
          </div>
          <div className="px-2 text-left">
            <span className="font-bold text-slate-700 ml-1">رقم الهوية:</span>
            <span className="font-mono">{payslip.nationalId || '0'}</span>
          </div>
        </div>
      </div>

      {/* 4. Two-Column Itemized Additions & Deductions Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Additions Table (Right side in RTL) */}
        <div className="border border-slate-400 rounded-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-[#1D4ED8] text-white py-2 px-3 font-bold text-center text-sm">
              الإضافات
            </div>
            <table className="w-full text-right divide-y divide-slate-200">
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-1.5 px-3 text-slate-800">الراتب الأساسي</td>
                  <td className="py-1.5 px-3 font-mono text-left">{formatVal(payslip.basicEarned)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 text-slate-800">مكافأة مواصلات</td>
                  <td className="py-1.5 px-3 font-mono text-left">{formatVal(payslip.allowancesEarned)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 text-slate-800">بدل توصيل</td>
                  <td className="py-1.5 px-3 font-mono text-left">{formatVal(payslip.deliveryAllowance)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 text-slate-800">اكراميات</td>
                  <td className="py-1.5 px-3 font-mono text-left">{formatVal(payslip.tipsGratuities)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 text-slate-800">اضافات اخرى</td>
                  <td className="py-1.5 px-3 font-mono text-left">{formatVal(payslip.otherAdditions)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 text-slate-800">بدل إضافي</td>
                  <td className="py-1.5 px-3 font-mono text-left">{formatVal(payslip.otTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="bg-[#1D4ED8] text-white py-2 px-3 font-bold flex justify-between items-center text-sm border-t border-slate-400">
            <span>اجمالي الإضافات</span>
            <span className="font-mono">{parseFloat(payslip.totalEarnings).toFixed(2)}</span>
          </div>
        </div>

        {/* Deductions Table (Left side in RTL) */}
        <div className="border border-slate-400 rounded-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-[#1D4ED8] text-white py-2 px-3 font-bold text-center text-sm">
              الاستقطاعات
            </div>
            <table className="w-full text-right divide-y divide-slate-200">
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-1.5 px-3 text-slate-800">ضمان اجتماعي</td>
                  <td className="py-1.5 px-3 font-mono text-left">{formatVal(payslip.socialSecurityDeduction)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 text-slate-800">السلف</td>
                  <td className="py-1.5 px-3 font-mono text-left">{formatVal(payslip.loanDeduction)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 text-slate-800">عدد أيام الغياب</td>
                  <td className="py-1.5 px-3 font-mono text-left">{payslip.unpaidDays && Number(payslip.unpaidDays) > 0 ? payslip.unpaidDays : '-'}</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 text-slate-800">خصم الغياب</td>
                  <td className="py-1.5 px-3 font-mono text-left">{formatVal(payslip.unpaidDeduction)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 text-slate-800">خصم تأخير</td>
                  <td className="py-1.5 px-3 font-mono text-left">{formatVal(payslip.lateDeduction)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 text-slate-800">خصومات أخرى</td>
                  <td className="py-1.5 px-3 font-mono text-left">{formatVal(payslip.otherDeductions)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 text-slate-800">خصم مغادرات</td>
                  <td className="py-1.5 px-3 font-mono text-left">{formatVal(payslip.earlyDepartureDeduction)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="bg-[#1D4ED8] text-white py-2 px-3 font-bold flex justify-between items-center text-sm border-t border-slate-400">
            <span>اجمالي الخصومات</span>
            <span className="font-mono">{parseFloat(payslip.totalDeductions).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* 5. Net Payable Block (Aligned with right additions column in RTL) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs">
        <div className="bg-[#1D4ED8] text-white py-2.5 px-4 font-bold rounded-sm flex justify-between items-center text-sm">
          <span>الراتب المستحق</span>
          <span className="font-mono text-base">{parseFloat(payslip.netPay).toFixed(2)}</span>
        </div>
        <div />
      </div>

      {/* 6. Footer Signatures Section */}
      <div className="mt-12 pt-4 border-t-2 border-slate-900 text-xs text-slate-800">
        <div className="grid grid-cols-3 text-center font-bold">
          <div>المستلم</div>
          <div>المحاسب</div>
          <div>الإدارة</div>
        </div>
      </div>
    </div>
  );
}
