'use client';

import React, { useState, useMemo } from 'react';
import { Printer } from 'lucide-react';

export interface ConsolidatedPayrollRow {
  id: string;
  employeeNo: string;
  employeeName: string;
  employmentType: 'PERMANENT' | 'PROBATIONARY' | 'DAILY_WORKER';
  department?: string;
  basicEarned: number;
  transportationAllowance: number;
  deliveryAllowance: number;
  gratuities: number;
  otherAdditions: number;
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
  initialType = 'ALL',
}: {
  periodMonth: string;
  rows: ConsolidatedPayrollRow[];
  initialType?: 'ALL' | 'PERMANENT' | 'PROBATIONARY' | 'DAILY_WORKER';
}) {
  const [selectedType, setSelectedType] = useState<'ALL' | 'PERMANENT' | 'PROBATIONARY' | 'DAILY_WORKER'>(
    initialType
  );

  // Month navigation helpers
  const handleMonthChange = (newMonth: string) => {
    if (!newMonth) return;
    const typeParam = selectedType !== 'ALL' ? `&type=${selectedType}` : '';
    window.location.href = `/payroll/consolidated?month=${newMonth}${typeParam}`;
  };

  const prevMonthStr = useMemo(() => {
    const [y, m] = periodMonth.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }, [periodMonth]);

  const nextMonthStr = useMemo(() => {
    const [y, m] = periodMonth.split('-').map(Number);
    const date = new Date(y, m, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }, [periodMonth]);

  const handlePrevMonth = () => {
    handleMonthChange(prevMonthStr);
  };

  const handleNextMonth = () => {
    handleMonthChange(nextMonthStr);
  };

  const handleCurrentMonth = () => {
    const today = new Date();
    const cMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    handleMonthChange(cMonth);
  };

  const lastDay = useMemo(() => {
    const [y, m] = periodMonth.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }, [periodMonth]);

  // Group counts
  const allCount = rows.length;
  const permanentCount = rows.filter((r) => r.employmentType === 'PERMANENT').length;
  const probationaryCount = rows.filter((r) => r.employmentType === 'PROBATIONARY').length;
  const dailyCount = rows.filter((r) => r.employmentType === 'DAILY_WORKER').length;

  // Filtered rows for the selected sheet (sorted naturally by employeeNo)
  const displayedRows = useMemo(() => {
    const filtered = selectedType === 'ALL' ? rows : rows.filter((r) => r.employmentType === selectedType);
    return [...filtered].sort((a, b) => {
      return String(a.employeeNo || '').localeCompare(String(b.employeeNo || ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }, [rows, selectedType]);

  // Dynamic sheet title
  const sheetTitle = useMemo(() => {
    switch (selectedType) {
      case 'PERMANENT':
        return 'بيان رواتب الموظفين المثبتين';
      case 'PROBATIONARY':
        return 'بيان رواتب الموظفين تحت التجربة (التجريبيين)';
      case 'DAILY_WORKER':
        return 'بيان رواتب عمال المياومة';
      default:
        return 'بيان رواتب (كافة الموظفين)';
    }
  }, [selectedType]);

  const formatVal = (val: number) => (val > 0 ? val.toFixed(2) : '-');

  // Compute column totals for the displayed sheet
  const totals = useMemo(() => {
    return displayedRows.reduce(
      (acc, row) => ({
        basicEarned: acc.basicEarned + row.basicEarned,
        transportationAllowance: acc.transportationAllowance + row.transportationAllowance,
        deliveryAllowance: acc.deliveryAllowance + row.deliveryAllowance,
        gratuities: acc.gratuities + row.gratuities,
        otherAdditions: acc.otherAdditions + row.otherAdditions,
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
        deliveryAllowance: 0,
        gratuities: 0,
        otherAdditions: 0,
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
  }, [displayedRows]);

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
            font-size: 7.5pt !important;
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
            font-size: 6.5pt !important;
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
            font-size: 6.8pt !important;
            font-weight: 700 !important;
          }

          .consolidated-table tfoot td {
            font-size: 6.8pt !important;
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

      {/* Top Action Bar with Tabs, Month Controls & Print (hidden when printing) */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-[#ECE9D8] win-raised p-2.5 mb-4 gap-3 no-print">
        {/* Filter Tabs to Separate Sheets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedType('ALL')}
            className={`win-btn text-xs font-bold px-3 py-1.5 flex items-center gap-1.5 ${
              selectedType === 'ALL'
                ? 'bg-[#0A246A] text-white border-2 border-[#0A246A] shadow'
                : 'bg-white text-slate-800 hover:bg-slate-100'
            }`}
          >
            <span>📋 الكل</span>
            <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              selectedType === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
            }`}>
              {allCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('PERMANENT')}
            className={`win-btn text-xs font-bold px-3 py-1.5 flex items-center gap-1.5 ${
              selectedType === 'PERMANENT'
                ? 'bg-[#1D4ED8] text-white border-2 border-[#1D4ED8] shadow'
                : 'bg-white text-blue-900 hover:bg-blue-50 border border-blue-200'
            }`}
          >
            <span>💼 كشف رواتب المثبتين</span>
            <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              selectedType === 'PERMANENT' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-900'
            }`}>
              {permanentCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('PROBATIONARY')}
            className={`win-btn text-xs font-bold px-3 py-1.5 flex items-center gap-1.5 ${
              selectedType === 'PROBATIONARY'
                ? 'bg-amber-600 text-white border-2 border-amber-700 shadow'
                : 'bg-white text-amber-900 hover:bg-amber-50 border border-amber-200'
            }`}
          >
            <span>⏳ كشف رواتب التجريبيين</span>
            <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              selectedType === 'PROBATIONARY' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900'
            }`}>
              {probationaryCount}
            </span>
          </button>

          {dailyCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedType('DAILY_WORKER')}
              className={`win-btn text-xs font-bold px-3 py-1.5 flex items-center gap-1.5 ${
                selectedType === 'DAILY_WORKER'
                  ? 'bg-purple-700 text-white border-2 border-purple-800 shadow'
                  : 'bg-white text-purple-900 hover:bg-purple-50'
              }`}
            >
              <span>⚡ كشف المياومة</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedType === 'DAILY_WORKER' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-900'
              }`}>
                {dailyCount}
              </span>
            </button>
          )}
        </div>

        {/* Center: Month Selector Controls */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white px-2.5 py-1 border border-[#7F9DB9] rounded shadow-sm">
          <span className="text-xs font-bold text-slate-800">الشهر:</span>
          <button
            onClick={handlePrevMonth}
            type="button"
            className="win-box-btn px-2 py-0.5 text-xs font-bold hover:bg-slate-200 flex items-center gap-1"
            title={`الانتقال للشهر السابق (${prevMonthStr})`}
          >
            <span>◀</span>
            <span className="hidden sm:inline">السابق</span>
          </button>
          <input
            type="month"
            value={periodMonth}
            onChange={(e) => {
              if (e.target.value) handleMonthChange(e.target.value);
            }}
            className="win-input text-xs font-mono font-bold px-2 py-0.5 border border-[#7F9DB9] bg-amber-50 text-slate-900"
          />
          <button
            onClick={handleNextMonth}
            type="button"
            className="win-box-btn px-2 py-0.5 text-xs font-bold hover:bg-slate-200 flex items-center gap-1"
            title={`الانتقال للشهر التالي (${nextMonthStr})`}
          >
            <span className="hidden sm:inline">التالي</span>
            <span>▶</span>
          </button>
          <button
            onClick={handleCurrentMonth}
            type="button"
            className="win-btn text-[10px] px-2 py-0.5 font-bold"
            title="الانتقال للشهر الحالي"
          >
            الحالي
          </button>

          {/* Direct Quick-Switch Buttons for October & November */}
          <div className="flex items-center gap-1 mr-1 border-r border-slate-300 pr-1.5">
            <button
              onClick={() => handleMonthChange('2026-10')}
              type="button"
              className={`win-btn text-[11px] px-2.5 py-0.5 font-bold transition-all ${
                periodMonth === '2026-10'
                  ? 'bg-blue-700 text-white font-black shadow-inner border border-blue-900'
                  : 'bg-white text-blue-900 hover:bg-blue-50 border border-slate-300'
              }`}
              title="الانتقال مباشرة إلى بيان شهر 10"
            >
              ⭐ شهر 10 (2026-10)
            </button>
            <button
              onClick={() => handleMonthChange('2026-11')}
              type="button"
              className={`win-btn text-[11px] px-2.5 py-0.5 font-bold transition-all ${
                periodMonth === '2026-11'
                  ? 'bg-blue-700 text-white font-black shadow-inner border border-blue-900'
                  : 'bg-white text-blue-900 hover:bg-blue-50 border border-slate-300'
              }`}
              title="الانتقال مباشرة إلى بيان شهر 11"
            >
              شهر 11 (2026-11)
            </button>
          </div>
        </div>

        {/* Print Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="win-btn font-black text-xs px-4 py-1.5 flex items-center gap-2 bg-[#008080] text-white hover:bg-[#006666] shadow"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة {sheetTitle} (PDF)</span>
          </button>
        </div>
      </div>

      {/* Header Info Section (Always displayed on Screen and on Printed Sheet) */}
      <div className="company-header-info border-b-2 border-slate-900 pb-3 mb-3">
        <div className="flex justify-between items-start">
          {/* Right: Company Title & Dynamic Sheet Header */}
          <div>
            <h1 className="text-sm md:text-base font-bold text-slate-800">شركة الخطوط الأذكى لصناعة المنظفات</h1>
            <h2 className="text-base md:text-xl font-black text-slate-900 my-0.5 flex items-center gap-2">
              <span>{sheetTitle}</span>
              {selectedType === 'PERMANENT' && (
                <span className="text-[11px] font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded border border-blue-300">
                  الموظفون المثبتون
                </span>
              )}
              {selectedType === 'PROBATIONARY' && (
                <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                  الموظفون تحت التجربة
                </span>
              )}
            </h2>
            <div className="text-xs text-slate-700 font-medium">
              الفترة من: <span className="font-mono">{periodMonth}-01</span> الى:{' '}
              <span className="font-mono">{periodMonth}-{String(lastDay).padStart(2, '0')}</span> | عدد الموظفين:{' '}
              <span className="font-mono font-bold text-black">{displayedRows.length}</span> موظف
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
              <col key="1" style={{ width: '4.5%' }} />, // الرقم الوظيفي
              <col key="2" style={{ width: '11.0%' }} />, // الاسم
              <col key="3" style={{ width: '5.5%' }} />, // الراتب الأساسي
              <col key="4" style={{ width: '5.0%' }} />, // مكافأة مواصلات
              <col key="5" style={{ width: '4.5%' }} />, // بدل توصيل
              <col key="6" style={{ width: '4.5%' }} />, // اكراميات
              <col key="7" style={{ width: '4.5%' }} />, // اضافات اخرى
              <col key="8" style={{ width: '4.0%' }} />, // ساعات عمل إضافي
              <col key="9" style={{ width: '4.5%' }} />, // بدل إضافي
              <col key="10" style={{ width: '5.5%' }} />, // اجمالي الراتب (gross)
              <col key="11" style={{ width: '4.5%' }} />, // ضمان اجتماعي
              <col key="12" style={{ width: '4.0%' }} />, // السلف
              <col key="13" style={{ width: '3.5%' }} />, // عدد أيام الغياب
              <col key="14" style={{ width: '4.5%' }} />, // خصم الغياب
              <col key="15" style={{ width: '3.5%' }} />, // ساعات مغادرة
              <col key="16" style={{ width: '4.5%' }} />, // خصم مغادرة
              <col key="17" style={{ width: '3.5%' }} />, // ساعات التأخير
              <col key="18" style={{ width: '4.5%' }} />, // خصم تأخير
              <col key="19" style={{ width: '4.5%' }} />, // خصومات أخرى
              <col key="20" style={{ width: '5.5%' }} />, // اجمالي الخصومات
              <col key="21" style={{ width: '6.5%' }} />, // صافي الراتب
            ]}
          </colgroup>
          <thead>
            {/* Table Group Headers */}
            <tr className="bg-slate-800 text-white font-bold border-b border-slate-400">
              <th colSpan={2} className="py-1 px-1 border-r border-slate-600">بيانات الموظف</th>
              <th colSpan={8} className="py-1 px-1 border-r border-slate-600 bg-[#1D4ED8]">الإضافات</th>
              <th colSpan={10} className="py-1 px-1 border-r border-slate-600 bg-[#1D4ED8]">الخصومات</th>
              <th colSpan={1} className="py-1 px-1 bg-slate-900">الصافي النهائي</th>
            </tr>
            {/* Column Headers */}
            <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-400">
              <th className="py-1 px-1 border-r border-slate-300">الرقم الوظيفي</th>
              <th className="py-1 px-1 border-r border-slate-300">الاسم</th>
              <th className="py-1 px-1 border-r border-slate-300">الراتب الأساسي</th>
              {/* Earnings */}
              <th className="py-1 px-1 border-r border-slate-300">مكافأة مواصلات أيام عمل</th>
              <th className="py-1 px-1 border-r border-slate-300">بدل توصيل</th>
              <th className="py-1 px-1 border-r border-slate-300">اكراميات</th>
              <th className="py-1 px-1 border-r border-slate-300">اضافات اخرى</th>
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
            {displayedRows.length === 0 ? (
              <tr>
                <td colSpan={21} className="py-8 text-center text-slate-500 font-bold">
                  لا يوجد كشوف رواتب في تصنيف ({sheetTitle}) لهذا الشهر.
                </td>
              </tr>
            ) : (
              displayedRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="py-1 px-1 border-r border-slate-300 font-mono font-bold">{row.employeeNo}</td>
                  <td className="py-1 px-1 border-r border-slate-300 text-right font-medium truncate" title={row.employeeName}>
                    {row.employeeName}
                  </td>
                  <td className="py-1 px-1 border-r border-slate-300 font-mono">{formatVal(row.basicEarned)}</td>
                  <td className="py-1 px-1 border-r border-slate-300 font-mono">{formatVal(row.transportationAllowance)}</td>
                  <td className="py-1 px-1 border-r border-slate-300 font-mono">{formatVal(row.deliveryAllowance)}</td>
                  <td className="py-1 px-1 border-r border-slate-300 font-mono">{formatVal(row.gratuities)}</td>
                  <td className="py-1 px-1 border-r border-slate-300 font-mono">{formatVal(row.otherAdditions)}</td>
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
              ))
            )}
          </tbody>
          <tfoot>
            {/* Totals Summary Row for the Filtered Sheet */}
            <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-900">
              <td colSpan={2} className="py-1.5 px-1 border-r border-slate-700 text-center">
                إجمالي {sheetTitle} ({displayedRows.length} موظف)
              </td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono">{totals.basicEarned.toFixed(2)}</td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono">{totals.transportationAllowance.toFixed(2)}</td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono">{totals.deliveryAllowance.toFixed(2)}</td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono">{totals.gratuities.toFixed(2)}</td>
              <td className="py-1.5 px-1 border-r border-slate-700 font-mono">{totals.otherAdditions.toFixed(2)}</td>
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
