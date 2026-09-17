'use client';

import React from 'react';
import { FileSpreadsheet } from 'lucide-react';

interface ExportPayrollExcelButtonProps {
  currentMonth?: string;
}

export function ExportPayrollExcelButton({ currentMonth }: ExportPayrollExcelButtonProps) {
  const targetMonth = currentMonth || new Date().toISOString().slice(0, 7);

  function handleExport() {
    const exportUrl = `/api/reports/export?type=payroll&month=${encodeURIComponent(targetMonth)}`;
    window.open(exportUrl, '_blank');
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="win-btn bg-[#107C41] hover:bg-[#0E6C38] text-white flex items-center font-bold px-3 py-1 text-xs cursor-pointer shadow-sm transition-colors"
      title="تصدير تفاصيل رواتب الشهر إلى ملف Excel شامل لاعتماد المدير العام"
    >
      <FileSpreadsheet className="w-3.5 h-3.5 ml-1.5 text-emerald-100" />
      <span>تصدير إلى إكسل (اعتماد المدير العام)</span>
    </button>
  );
}
