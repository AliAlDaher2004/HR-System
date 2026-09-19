'use client';

import React from 'react';
import { Printer } from 'lucide-react';

export interface ConsolidatedPayrollRow {
  id: string;
  employeeNo: string;
  employeeName: string;
  basicEarned: number;
  transportationAllowance: number;
  gratuities: number;
  otHours: number;
  otTotal: number;
  grossPay: number;
  socialSecurity: number;
  loans: number;
  unpaidDays: number;
  unpaidDeduction: number;
  earlyDepartureHours: number;
  earlyDepartureDeduction: number;
  lateHours: number;
  lateDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
}

export function ConsolidatedPayrollSheet({
  periodMonth,
  rows,
}: {
  periodMonth: string;
  rows: ConsolidatedPayrollRow[];
}) {
  const formatVal = (val: number) => (val > 0 ? val.toFixed(2) : '-');

  // Compute column totals
  const totals = rows.reduce(
    (acc, row) => ({
      basicEarned: acc.basicEarned + row.basicEarned,
      transportationAllowance: acc.transportationAllowance + row.transportationAllowance,
      gratuities: acc.gratuities + row.gratuities,
      otHours: acc.otHours + row.otHours,
      otTotal: acc.otTotal + row.otTotal,
      grossPay: acc.grossPay + row.grossPay,
      socialSecurity: acc.socialSecurity + row.socialSecurity,
      loans: acc.loans + row.loans,
      unpaidDays: acc.unpaidDays + row.unpaidDays,
      unpaidDeduction: acc.unpaidDeduction + row.unpaidDeduction,
      earlyDepartureHours: acc.earlyDepartureHours + row.earlyDepartureHours,
      earlyDepartureDeduction: acc.earlyDepartureDeduction + row.earlyDepartureDeduction,
      lateHours: acc.lateHours + row.lateHours,
      lateDeduction: acc.lateDeduction + row.lateDeduction,
      otherDeductions: acc.otherDeductions + row.otherDeductions,
      totalDeductions: acc.totalDeductions + row.totalDeductions,
      netPay: acc.netPay + row.netPay,
    }),
    {
      basicEarned: 0,
      transportationAllowance: 0,
      gratuities: 0,
      otHours: 0,
      otTotal: 0,
      grossPay: 0,
      socialSecurity: 0,
      loans: 0,
      unpaidDays: 0,
      unpaidDeduction: 0,
      earlyDepartureHours: 0,
      earlyDepartureDeduction: 0,
      lateHours: 0,
      lateDeduction: 0,
      otherDeductions: 0,
      totalDeductions: 0,
      netPay: 0,
    }
  );

  return (
    <div className="consolidated-sheet-container w-full bg-white text-slate-900 p-4 md:p-6 select-none font-sans" dir="rtl">
      {/* Print Styles for A4 Landscape Fitting */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
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

          .consolidated-sheet-container {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }

          .overflow-x-auto {
            overflow: visible !important;
          }

          .consolidated-table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            font-size: 6.8pt !important;
            line-height: 1.15 !important;
          }

          .consolidated-table th, 
          .consolidated-table td {
            padding: 2.5px 1px !important;
            border: 0.5pt solid #334155 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }

          .consolidated-table th {
            font-size: 7pt !important;
            font-weight: 700 !important;
          }

          .consolidated-table tfoot td {
            font-size: 7pt !important;
            font-weight: 800 !important;
          }

          .company-header-info {
            margin-bottom: 6px !important;
            padding-bottom: 4px !important;
            border-bottom: 1.5pt solid #0f172a !important;
          }

          .file-badge-grid {
            gap: 4px !important;
          }

          .file-badge {
            font-size: 6.5pt !important;
            padding: 2px 4px !important;
          }
        }
      `}</style>

      {/* Top Action Bar (hidden when printing) */}
      <div className="flex justify-between items-center bg-[#ECE9D8] win-raised p-3 mb-4 no-print">
        <div>
          <h2 className="text-sm font-bold text-black flex items-center gap-1.5">
            <span>📊</span>
            <span>بيان الرواتب المجمع (Consolidated Payroll Sheet)</span>
          </h2>
          <p className="text-[#505050] text-xs mt-0.5">
            فترة الكشف: <span className="font-bold text-black">{periodMonth}</span> | عدد الموظفين:{' '}
            <span className="font-bold text-black">{rows.length}</span>
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="win-btn font-bold text-xs px-4 py-1.5 flex items-center gap-2 text-[#0A246A]"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة البيان المجمع (PDF)</span>
        </button>
      </div>

      {/* Header Info Section */}
      <div className="company-header-info border-b-2 border-slate-900 pb-4 mb-4">
        <div className="flex justify-between items-start">
          {/* Right: Company Title */}
          <div>
            <h1 className="text-base md:text-lg font-bold text-slate-900">شركة الخطوط الأذكى لصناعة المنظفات</h1>
            <h2 className="text-lg md:text-xl font-black text-slate-900 my-0.5">بيان رواتب</h2>
            <div className="text-xs text-slate-700 font-medium">
              الفترة من: <span className="font-mono">{periodMonth}-01</span> الى:{' '}
              <span className="font-mono">{periodMonth}-31</span>
            </div>
          </div>

          {/* Center/Left: Registration Files Numbers */}
          <div className="file-badge-grid grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-semibold text-slate-800" dir="rtl">
            <div className="file-badge bg-slate-100 p-1.5 border border-slate-300 rounded text-center">
              <span className="text-slate-500 block text-[10px]">ملف تأمينات رقم</span>
              <span className="font-mono font-bold">16860400</span>
            </div>
            <div className="file-badge bg-slate-100 p-1.5 border border-slate-300 rounded text-center">
              <span className="text-slate-500 block text-[10px]">ملف ضريبي رقم</span>
              <span className="font-mono font-bold">300009054</span>
            </div>
            <div className="file-badge bg-slate-100 p-1.5 border border-slate-300 rounded text-center">
              <span className="text-slate-500 block text-[10px]">سجل رقم</span>
              <span className="font-mono font-bold">65106</span>
            </div>
            <div className="file-badge bg-slate-100 p-1.5 border border-slate-300 rounded text-center">
              <span className="text-slate-500 block text-[10px]">سجل رقم</span>
              <span className="font-mono font-bold">200189726</span>
            </div>
          </div>
        </div>
      </div>

      {/* Consolidated Table View */}
      <div className="overflow-hidden w-full border border-slate-400">
        <table className="consolidated-table w-full text-center text-[8.5px] md:text-[9.5px] border-collapse table-fixed tracking-tighter">
          <colgroup>
            {[
              <col key="1" style={{ width: '4.5%' }} />,
              <col key="2" style={{ width: '11.5%' }} />,
              <col key="3" style={{ width: '5.5%' }} />,
              <col key="4" style={{ width: '5.5%' }} />,
              <col key="5" style={{ width: '4.5%' }} />,
              <col key="6" style={{ width: '4.0%' }} />,
              <col key="7" style={{ width: '4.5%' }} />,
              <col key="8" style={{ width: '6.0%' }} />,
              <col key="9" style={{ width: '5.0%' }} />,
              <col key="10" style={{ width: '4.5%' }} />,
              <col key="11" style={{ width: '4.0%' }} />,
              <col key="12" style={{ width: '5.0%' }} />,
              <col key="13" style={{ width: '4.0%' }} />,
              <col key="14" style={{ width: '5.0%' }} />,
              <col key="15" style={{ width: '4.0%' }} />,
              <col key="16" style={{ width: '5.0%' }} />,
              <col key="17" style={{ width: '4.5%' }} />,
              <col key="18" style={{ width: '6.0%' }} />,
              <col key="19" style={{ width: '6.5%' }} />,
            ]}
          </colgroup>
          <thead>
            {/* Table Group Headers */}
            <tr className="bg-slate-800 text-white font-bold border-b border-slate-400">
              <th colSpan={3} className="py-1 px-1 border-r border-slate-600">بيانات الموظف</th>
              <th colSpan={5} className="py-1 px-1 border-r border-slate-600 bg-[#1D4ED8]">الإضافات</th>
              <th colSpan={10} className="py-1 px-1 border-r border-slate-600 bg-[#1D4ED8]">الاستقطاعات</th>
              <th colSpan={1} className="py-1 px-1 bg-slate-900">الصافي النهائي</th>
            </tr>
            {/* Column Headers */}
            <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-400">
              <th className="py-1 px-1 border-r border-slate-300">الرقم الوظيفي</th>
              <th className="py-1 px-1 border-r border-slate-300">الاسم</th>
              <th className="py-1 px-1 border-r border-slate-300">الراتب الأساسي</th>
              {/* Earnings */}
              <th className="py-1 px-1 border-r border-slate-300">مكافأة مواصلات أيام عمل</th>
              <th className="py-1 px-1 border-r border-slate-300">اكراميات</th>
              <th className="py-1 px-1 border-r border-slate-300">ساعات عمل إضافي</th>
              <th className="py-1 px-1 border-r border-slate-300">بدل إضافي</th>
              <th className="py-1 px-1 border-r border-slate-300 bg-blue-100 font-black text-slate-900">اجمالي الراتب</th>
              {/* Deductions */}
              <th className="py-1 px-1 border-r border-slate-300">ضمان اجتماعي</th>
              <th className="py-1 px-1 border-r border-slate-300">السلف</th>
              <th className="py-1 px-1 border-r border-slate-300">عدد أيام الغياب</th>
              <th className="py-1 px-1 border-r border-slate-300">خصم الغياب</th>
              <th className="py-1 px-1 border-r border-slate-300">ساعات مغادرة</th>
              <th className="py-1 px-1 border-r border-slate-300">خصم مغادرة</th>
              <th className="py-1 px-1 border-r border-slate-300">ساعات التأخير</th>
              <th className="py-1 px-1 border-r border-slate-300">خصم تأخير</th>
              <th className="py-1 px-1 border-r border-slate-300">خصومات أخرى</th>
              <th className="py-1 px-1 border-r border-slate-300 bg-amber-100 font-black text-slate-900">اجمالي الخصومات</th>
              {/* Net */}
              <th className="py-1 px-1 border-r border-slate-300 bg-slate-900 text-white font-black">صافي الراتب</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="py-1 px-1 border-r border-slate-300 font-mono font-bold">{row.employeeNo}</td>
                <td className="py-1 px-1 border-r border-slate-300 text-right font-medium truncate" title={row.employeeName}>{row.employeeName}</td>
                <td className="py-1 px-1 border-r border-slate-300 font-mono">{formatVal(row.basicEarned)}</td>
                <td className="py-1 px-1 border-r border-slate-300 font-mono">{formatVal(row.transportationAllowance)}</td>
                <td className="py-1 px-1 border-r border-slate-300 font-mono">{formatVal(row.gratuities)}</td>
                <td className="py-1 px-1 border-r border-slate-300 font-mono">{row.otHours > 0 ? row.otHours.toFixed(2) : '-'}</td>
                <td className="py-1 px-1 border-r border-slate-300 font-mono text-emerald-700">{formatVal(row.otTotal)}</td>
                <td className="py-1 px-1 border-r border-slate-300 font-mono font-bold bg-blue-50">{formatVal(row.grossPay)}</td>
                <td className="py-1 px-1 border-r border-slate-300 font-mono">{formatVal(row.socialSecurity)}</td>
                <td className="py-1 px-1 border-r border-slate-300 font-mono">{formatVal(row.loans)}</td>
                <td className="py-1 px-1 border-r border-slate-300 font-mono">{row.unpaidDays > 0 ? row.unpaidDays : '-'}</td>
                <td className="py-1 px-1 border-r border-slate-300 font-mono text-rose-700">{formatVal(row.unpaidDeduction)}</td>
                <td className="py-1 px-1 border-r border-slate-300 font-mono">{row.earlyDepartureHours > 0 ? row.earlyDepartureHours.toFixed(2) : '-'}</td>
                <td className="py-1 px-1 border-r border-slate-300 font-mono text-rose-700">{formatVal(row.earlyDepartureDeduction)}</td>
                <td className="py-1 px-1 border-r border-slate-300 font-mono">{row.lateHours > 0 ? row.lateHours.toFixed(2) : '-'}</td>
                <td className="py-1 px-1 border-r border-slate-300 font-mono text-rose-700">{formatVal(row.lateDeduction)}</td>
                <td className="py-1 px-1 border-r border-slate-300 font-mono">{formatVal(row.otherDeductions)}</td>
                <td className="py-1 px-1 border-r border-slate-300 font-mono font-bold bg-amber-50 text-rose-800">{formatVal(row.totalDeductions)}</td>
                <td className="py-1 px-1 border-r border-slate-300 font-mono font-black text-slate-900 bg-slate-100">{formatVal(row.netPay)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {/* Totals Summary Row */}
            <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-900">
              <td colSpan={2} className="py-1.5 px-1 border-r border-slate-700 text-center">الاجمالي</td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono">{totals.basicEarned.toFixed(2)}</td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono">{totals.transportationAllowance.toFixed(2)}</td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono">{totals.gratuities.toFixed(2)}</td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono">{totals.otHours.toFixed(2)}</td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono">{totals.otTotal.toFixed(2)}</td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono bg-blue-900 text-white">{totals.grossPay.toFixed(2)}</td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono">{totals.socialSecurity.toFixed(2)}</td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono">{totals.loans.toFixed(2)}</td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono">{totals.unpaidDays.toFixed(2)}</td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono">{totals.unpaidDeduction.toFixed(2)}</td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono">{totals.earlyDepartureHours.toFixed(2)}</td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono">{totals.earlyDepartureDeduction.toFixed(2)}</td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono">{totals.lateHours.toFixed(2)}</td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono">{totals.lateDeduction.toFixed(2)}</td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono">{totals.otherDeductions.toFixed(2)}</td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono bg-amber-900 text-white">{totals.totalDeductions.toFixed(2)}</td>
              <td className="py-1.5 px-1 font-mono text-emerald-400 bg-black">{totals.netPay.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
