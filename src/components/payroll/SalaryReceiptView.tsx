import React from 'react';
import { PayslipData } from '@/lib/services/payslip-service';

export function SmartLinesHeader() {
  return (
    <div className="w-full pb-2 mb-2.5 border-b-2 border-slate-900">
      <div className="flex justify-between items-center">
        {/* Left Side: Smart Lines Logo */}
        <div className="flex flex-col items-start" dir="ltr">
          <div className="flex items-baseline space-x-1 font-sans">
            <span className="text-2xl md:text-3xl font-black text-[#0088CC] tracking-tight leading-none">SMART</span>
          </div>
          <div className="flex items-center space-x-1.5 mt-[-2px]">
            <span className="text-sm md:text-base font-extrabold text-[#0088CC] tracking-widest leading-none">LINES</span>
            <div className="flex flex-col space-y-[2px] w-10">
              <div className="h-[2.5px] bg-[#C59B27] w-full rounded-full" />
              <div className="h-[2.5px] bg-[#C59B27] w-full rounded-full" />
              <div className="h-[2.5px] bg-[#C59B27] w-full rounded-full" />
            </div>
          </div>
        </div>

        {/* Center: Title Header */}
        <div className="text-center">
          <h2 className="text-base md:text-lg font-black text-slate-900 border-b-2 border-[#0A246A] pb-0.5 px-4 tracking-wide inline-block">
            سند استلام راتب
          </h2>
          <span className="text-[9.5px] text-slate-600 font-bold block mt-0.5 tracking-wider uppercase">
            Salary Receipt Voucher
          </span>
        </div>

        {/* Right Side: Arabic & English Company Name */}
        <div className="text-right" dir="rtl">
          <h1 className="text-sm md:text-base font-bold text-slate-900 tracking-tight leading-tight">
            شركة الخطوط الأذكى لصناعة المنظفات
          </h1>
          <h2 className="text-[9px] font-extrabold text-slate-600 tracking-wide mt-0.5" dir="ltr">
            SMART LINES DETERGENT MANUFACTURING CO.
          </h2>
          <span className="text-[9px] font-bold text-[#0088CC] block">
            ذات مسؤولية محدودة
          </span>
        </div>
      </div>
    </div>
  );
}

export function SalaryReceiptView({ payslip }: { payslip: PayslipData }) {
  const formatVal = (val: string | number | undefined) => {
    if (val === undefined || val === null || val === '') return '-';
    const num = Number(val);
    if (isNaN(num)) return '-';
    if (num === 0) return '-';
    return num.toFixed(2);
  };

  return (
    <div
      className="payslip-card w-full max-w-3xl mx-auto bg-white p-5 md:p-6 text-slate-900 border-2 border-slate-800 shadow-sm font-sans select-none text-xs leading-normal"
      dir="rtl"
    >
      {/* 1. Header */}
      <SmartLinesHeader />

      {/* 2. Structured Metadata Box (2 Rows, Never Wraps) */}
      <div className="border-2 border-slate-700 text-xs mb-3 divide-y divide-slate-300 rounded overflow-hidden">
        {/* Row 1: Employee No, Employee Name, Period */}
        <div className="grid grid-cols-12 divide-x divide-x-reverse divide-slate-300 bg-slate-50 p-2 items-center text-xs">
          <div className="col-span-3 px-2 flex items-center justify-between">
            <span className="font-bold text-slate-700 whitespace-nowrap">الرقم الوظيفي:</span>
            <span className="font-mono font-bold text-sm bg-white px-2 py-0.5 border border-slate-400 rounded">
              {payslip.employeeNo}
            </span>
          </div>
          <div className="col-span-4 px-3 flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-slate-700 whitespace-nowrap">اسم الموظف:</span>
            <span className="font-black text-slate-900 text-sm truncate">{payslip.employeeName}</span>
          </div>
          <div
            className="col-span-5 px-3 flex items-center justify-between gap-1"
            style={{ whiteSpace: 'nowrap' }}
          >
            <span className="font-bold text-slate-700 whitespace-nowrap">فترة الكشف:</span>
            <span
              className="font-mono font-bold text-xs bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200 text-blue-950 tracking-tight"
              style={{ whiteSpace: 'nowrap' }}
            >
              من {payslip.periodStart} إلى {payslip.periodEnd}
            </span>
          </div>
        </div>

        {/* Row 2: Worked Days, National ID, Insurance No, Social Security */}
        <div className="grid grid-cols-12 divide-x divide-x-reverse divide-slate-300 bg-white p-2 items-center text-xs">
          <div className="col-span-3 px-2 flex items-center justify-between">
            <span className="font-bold text-slate-700 whitespace-nowrap">أيام الدوام:</span>
            <span className="font-mono font-bold text-sm text-slate-900">{payslip.workedDays} يوم</span>
          </div>
          <div className="col-span-3 px-3 flex items-center justify-between">
            <span className="font-bold text-slate-700 whitespace-nowrap">رقم الهوية:</span>
            <span className="font-mono font-semibold text-slate-800">{payslip.nationalId || '-'}</span>
          </div>
          <div className="col-span-3 px-3 flex items-center justify-between">
            <span className="font-bold text-slate-700 whitespace-nowrap">رقم التأمين:</span>
            <span className="font-mono font-semibold text-slate-800">{payslip.insuranceNo || '-'}</span>
          </div>
          <div className="col-span-3 px-3 flex items-center justify-between">
            <span className="font-bold text-slate-700 whitespace-nowrap">نسبة الضمان:</span>
            <span className="font-mono font-bold text-blue-900">{payslip.socialSecurityRate || '0.00%'}</span>
          </div>
        </div>
      </div>

      {/* 3. Two-Column Itemized Additions & Deductions Tables */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* Additions Table (Right in RTL) */}
        <div className="border-2 border-slate-700 rounded-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-[#0A246A] text-white py-1.5 px-3 font-bold text-center text-xs tracking-wide">
              الإضافات
            </div>
            <table className="w-full text-right divide-y divide-slate-200">
              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-slate-50">
                  <td className="py-1 px-3 text-slate-800">الراتب الأساسي</td>
                  <td className="py-1 px-3 font-mono text-left font-semibold">{formatVal(payslip.basicEarned)}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-1 px-3 text-slate-800">مكافأة مواصلات أيام عمل</td>
                  <td className="py-1 px-3 font-mono text-left">{formatVal(payslip.allowancesEarned)}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-1 px-3 text-slate-800">بدل توصيل</td>
                  <td className="py-1 px-3 font-mono text-left">{formatVal(payslip.deliveryAllowance)}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-1 px-3 text-slate-800 font-bold">اكراميات</td>
                  <td className="py-1 px-3 font-mono text-left font-bold text-emerald-700">{formatVal(payslip.tipsGratuities)}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-1 px-3 text-slate-800">اضافات اخرى</td>
                  <td className="py-1 px-3 font-mono text-left">{formatVal(payslip.otherAdditions)}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-1 px-3 text-slate-800">ساعات عمل إضافي</td>
                  <td className="py-1 px-3 font-mono text-left">{payslip.otHours && Number(payslip.otHours) > 0 ? payslip.otHours : '-'}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-1 px-3 text-slate-800">بدل إضافي</td>
                  <td className="py-1 px-3 font-mono text-left font-semibold">{formatVal(payslip.otTotal)}</td>
                </tr>
                {/* Spacer rows to align perfectly with the 9 deduction rows */}
                <tr className="border-t border-slate-200">
                  <td className="py-1 px-3 text-transparent select-none">&nbsp;</td>
                  <td className="py-1 px-3 text-transparent select-none text-left">&nbsp;</td>
                </tr>
                <tr className="border-t border-slate-200">
                  <td className="py-1 px-3 text-transparent select-none">&nbsp;</td>
                  <td className="py-1 px-3 text-transparent select-none text-left">&nbsp;</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="bg-[#0A246A] text-white py-1.5 px-3 font-bold flex justify-between items-center text-xs border-t-2 border-slate-700">
            <span>اجمالي الإضافات (الراتب الإجمالي)</span>
            <span className="font-mono text-sm font-black">{parseFloat(payslip.totalEarnings).toFixed(2)}</span>
          </div>
        </div>

        {/* Deductions Table (Left in RTL) */}
        <div className="border-2 border-slate-700 rounded-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-[#0A246A] text-white py-1.5 px-3 font-bold text-center text-xs tracking-wide">
              الخصومات
            </div>
            <table className="w-full text-right divide-y divide-slate-200">
              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-slate-50">
                  <td className="py-1 px-3 text-slate-800">ضمان اجتماعي</td>
                  <td className="py-1 px-3 font-mono text-left">{formatVal(payslip.socialSecurityDeduction)}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-1 px-3 text-slate-800">السلف</td>
                  <td className="py-1 px-3 font-mono text-left font-semibold text-rose-800">{formatVal(payslip.loanDeduction)}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-1 px-3 text-slate-800">عدد أيام الغياب</td>
                  <td className="py-1 px-3 font-mono text-left">{payslip.unpaidDays && Number(payslip.unpaidDays) > 0 ? payslip.unpaidDays : '-'}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-1 px-3 text-slate-800">خصم الغياب</td>
                  <td className="py-1 px-3 font-mono text-left">{formatVal(payslip.unpaidDeduction)}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-1 px-3 text-slate-800">ساعات مغادرة</td>
                  <td className="py-1 px-3 font-mono text-left">{payslip.earlyDepartureHours && Number(payslip.earlyDepartureHours) > 0 ? payslip.earlyDepartureHours : '-'}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-1 px-3 text-slate-800">خصم مغادرة</td>
                  <td className="py-1 px-3 font-mono text-left">{formatVal(payslip.earlyDepartureDeduction)}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-1 px-3 text-slate-800">ساعات التأخير</td>
                  <td className="py-1 px-3 font-mono text-left">{payslip.lateHours && Number(payslip.lateHours) > 0 ? payslip.lateHours : '-'}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-1 px-3 text-slate-800">خصم تأخير</td>
                  <td className="py-1 px-3 font-mono text-left">{formatVal(payslip.lateDeduction)}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-1 px-3 text-slate-800">خصومات أخرى</td>
                  <td className="py-1 px-3 font-mono text-left">{formatVal(payslip.otherDeductions)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="bg-[#0A246A] text-white py-1.5 px-3 font-bold flex justify-between items-center text-xs border-t-2 border-slate-700">
            <span>اجمالي الخصومات</span>
            <span className="font-mono text-sm font-black">{parseFloat(payslip.totalDeductions).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* 4. Net Payable Box */}
      <div className="mt-3 bg-[#0A246A] text-white py-2 px-4 rounded font-bold flex justify-between items-center text-xs md:text-sm shadow-sm border border-slate-800">
        <span className="tracking-wide">اجمالي الراتب المستحق للصرف (الصافي النهائي)</span>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-base md:text-lg font-black text-amber-300">
            {parseFloat(payslip.netPay).toFixed(2)}
          </span>
          <span className="text-xs text-amber-200 font-bold">د.أ</span>
        </div>
      </div>

      {/* 5. Signatures Section */}
      <div className="mt-4 pt-3 border-t-2 border-slate-800 text-xs text-slate-800">
        <div className="grid grid-cols-3 text-center font-bold gap-4">
          <div className="space-y-2 bg-slate-50/60 p-2 rounded border border-slate-300">
            <div className="text-slate-900 font-extrabold">توقيع المستلم</div>
            <div className="border-b border-dotted border-slate-500 w-4/5 mx-auto pt-2" />
            <div className="text-[10px] text-slate-500 font-normal">الاسم: .......................................</div>
          </div>
          <div className="space-y-2 bg-slate-50/60 p-2 rounded border border-slate-300">
            <div className="text-slate-900 font-extrabold">تدقيق المحاسب</div>
            <div className="border-b border-dotted border-slate-500 w-4/5 mx-auto pt-2" />
            <div className="text-[10px] text-slate-500 font-normal">التاريخ: ____ / ____ / 2026</div>
          </div>
          <div className="space-y-2 bg-slate-50/60 p-2 rounded border border-slate-300">
            <div className="text-slate-900 font-extrabold">اعتماد الإدارة العامة</div>
            <div className="border-b border-dotted border-slate-500 w-4/5 mx-auto pt-2" />
            <div className="text-[10px] text-slate-500 font-normal">الختم والتوقيع الرسمي</div>
          </div>
        </div>
      </div>
    </div>
  );
}
