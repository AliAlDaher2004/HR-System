'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Printer, ArrowRight } from 'lucide-react';

interface PrintToolbarProps {
  currentShift: 'ALL' | 'MORNING' | 'EVENING';
  currentDept: string;
  currentEmpType: string;
  totalActiveCount: number;
  morningActiveCount: number;
  eveningActiveCount: number;
  departments: string[];
}

export function PrintToolbar({
  currentShift,
  currentDept,
  currentEmpType,
  totalActiveCount,
  morningActiveCount,
  eveningActiveCount,
  departments,
}: PrintToolbarProps) {
  const router = useRouter();

  function handleDeptChange(dept: string) {
    const params = new URLSearchParams();
    if (currentShift && currentShift !== 'ALL') params.set('shift', currentShift);
    if (dept) params.set('department', dept);
    if (currentEmpType) params.set('employmentType', currentEmpType);
    router.push(`/employees/print?${params.toString()}`);
  }

  return (
    <div className="w-full max-w-[1300px] bg-[#ECE9D8] win-raised p-2.5 mb-4 no-print flex flex-wrap items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-2">
        <Link
          href="/employees"
          className="win-btn px-3 py-1 font-bold text-black flex items-center gap-1"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>العودة لدليل الموظفين</span>
        </Link>
        <span className="text-[#808080]">|</span>
        <span className="font-bold text-black flex items-center gap-1">
          <span>🖨️</span>
          <span>تجهيز طباعة كشف الموظفين النشطين</span>
        </span>
      </div>

      {/* Filter Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded border border-[#808080] bg-[#D4D0C8] p-0.5 gap-1">
          <Link
            href={`/employees/print?${new URLSearchParams({
              ...(currentDept ? { department: currentDept } : {}),
              ...(currentEmpType ? { employmentType: currentEmpType } : {}),
              shift: 'ALL',
            }).toString()}`}
            className={`px-2.5 py-0.5 rounded text-xs font-bold transition-none ${
              currentShift === 'ALL'
                ? 'bg-[#0A246A] text-white shadow-inner'
                : 'bg-[#ECE9D8] text-slate-800 hover:bg-[#F0EEE5]'
            }`}
          >
            🔘 الكل ({totalActiveCount})
          </Link>

          <Link
            href={`/employees/print?${new URLSearchParams({
              ...(currentDept ? { department: currentDept } : {}),
              ...(currentEmpType ? { employmentType: currentEmpType } : {}),
              shift: 'MORNING',
            }).toString()}`}
            className={`px-2.5 py-0.5 rounded text-xs font-bold transition-none ${
              currentShift === 'MORNING'
                ? 'bg-amber-600 text-white shadow-inner'
                : 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
            }`}
          >
            ☀️ الصباحي ({morningActiveCount})
          </Link>

          <Link
            href={`/employees/print?${new URLSearchParams({
              ...(currentDept ? { department: currentDept } : {}),
              ...(currentEmpType ? { employmentType: currentEmpType } : {}),
              shift: 'EVENING',
            }).toString()}`}
            className={`px-2.5 py-0.5 rounded text-xs font-bold transition-none ${
              currentShift === 'EVENING'
                ? 'bg-indigo-700 text-white shadow-inner'
                : 'bg-indigo-50 text-indigo-900 border border-indigo-300 hover:bg-indigo-100'
            }`}
          >
            🌙 المسائي ({eveningActiveCount})
          </Link>
        </div>

        <select
          name="department"
          value={currentDept}
          className="win-input py-1 px-2 text-xs"
          onChange={(e) => handleDeptChange(e.target.value)}
        >
          <option value="">جميع الأقسام</option>
          {departments.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>

        {/* Trigger Print */}
        <button
          type="button"
          className="win-btn px-4 py-1.5 font-bold text-[#0A246A] flex items-center gap-1.5 shadow"
          onClick={() => {
            if (typeof window !== 'undefined') window.print();
          }}
        >
          <Printer className="w-4 h-4 text-blue-900" />
          <span>طباعة الكشف الآن (A4 / PDF)</span>
        </button>
      </div>
    </div>
  );
}
