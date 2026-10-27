'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Printer, ArrowRight } from 'lucide-react';

interface PrintAttendanceToolbarProps {
  currentDate: string;
  currentShift: 'ALL' | 'MORNING' | 'EVENING';
  currentDept: string;
  totalCount: number;
  morningCount: number;
  eveningCount: number;
  departments: string[];
}

export function PrintAttendanceToolbar({
  currentDate,
  currentShift,
  currentDept,
  totalCount,
  morningCount,
  eveningCount,
  departments,
}: PrintAttendanceToolbarProps) {
  const router = useRouter();

  function handleFilterChange(date: string, shift: string, dept: string) {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (shift && shift !== 'ALL') params.set('shift', shift);
    if (dept) params.set('department', dept);
    router.push(`/attendance/print?${params.toString()}`);
  }

  function handlePrevDay() {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    const prev = d.toISOString().split('T')[0];
    handleFilterChange(prev, currentShift, currentDept);
  }

  function handleNextDay() {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    const next = d.toISOString().split('T')[0];
    handleFilterChange(next, currentShift, currentDept);
  }

  function handleToday() {
    const today = new Date().toISOString().split('T')[0];
    handleFilterChange(today, currentShift, currentDept);
  }

  return (
    <div className="w-full max-w-[900px] bg-[#ECE9D8] win-raised p-2.5 mb-4 no-print flex flex-wrap items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href={`/attendance?date=${currentDate}`}
          className="win-btn px-3 py-1 font-bold text-black flex items-center gap-1"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>العودة لكشف الحضور</span>
        </Link>
        <span className="text-[#808080]">|</span>
        <span className="font-bold text-black flex items-center gap-1">
          <span>🖨️</span>
          <span>تجهيز طباعة سجل الحضور والغياب اليومي</span>
        </span>
      </div>

      {/* Date & Filter Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Date Selector */}
        <div className="flex items-center gap-1">
          <label className="font-bold text-black text-[11px]">التاريخ:</label>
          <input
            type="date"
            value={currentDate}
            onChange={(e) => handleFilterChange(e.target.value, currentShift, currentDept)}
            className="win-input text-xs py-1 px-2 font-mono font-bold"
          />
          <button
            type="button"
            onClick={handlePrevDay}
            className="win-btn text-xs py-0.5 px-2"
            title="اليوم السابق"
          >
            ◄
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="win-btn text-xs py-0.5 px-2 font-bold"
            title="تاريخ اليوم"
          >
            اليوم
          </button>
          <button
            type="button"
            onClick={handleNextDay}
            className="win-btn text-xs py-0.5 px-2"
            title="اليوم التالي"
          >
            ►
          </button>
        </div>

        {/* Shift Filter */}
        <div className="inline-flex rounded border border-[#808080] bg-[#D4D0C8] p-0.5 gap-1">
          <button
            type="button"
            onClick={() => handleFilterChange(currentDate, 'ALL', currentDept)}
            className={`px-2.5 py-0.5 rounded text-xs font-bold transition-none ${
              currentShift === 'ALL'
                ? 'bg-[#0A246A] text-white shadow-inner'
                : 'bg-[#ECE9D8] text-slate-800 hover:bg-[#F0EEE5]'
            }`}
          >
            🔘 الكل ({totalCount})
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange(currentDate, 'MORNING', currentDept)}
            className={`px-2.5 py-0.5 rounded text-xs font-bold transition-none ${
              currentShift === 'MORNING'
                ? 'bg-amber-600 text-white shadow-inner'
                : 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
            }`}
          >
            ☀️ الصباحي ({morningCount})
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange(currentDate, 'EVENING', currentDept)}
            className={`px-2.5 py-0.5 rounded text-xs font-bold transition-none ${
              currentShift === 'EVENING'
                ? 'bg-indigo-700 text-white shadow-inner'
                : 'bg-indigo-50 text-indigo-900 border border-indigo-300 hover:bg-indigo-100'
            }`}
          >
            🌙 المسائي ({eveningCount})
          </button>
        </div>

        {/* Department Filter */}
        <select
          value={currentDept}
          onChange={(e) => handleFilterChange(currentDate, currentShift, e.target.value)}
          className="win-input py-1 px-2 text-xs"
        >
          <option value="">جميع الأقسام</option>
          {departments.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>

        {/* Trigger Print Button */}
        <button
          type="button"
          className="win-btn px-4 py-1.5 font-bold text-[#0A246A] flex items-center gap-1.5 shadow"
          onClick={() => {
            if (typeof window !== 'undefined') window.print();
          }}
        >
          <Printer className="w-4 h-4 text-blue-900" />
          <span>طباعة السجل الآن (A4 / PDF)</span>
        </button>
      </div>
    </div>
  );
}
