'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function Toolbar() {
  const router = useRouter();

  return (
    <div className="win-toolbar flex items-center justify-between bg-[#ECE9D8] border-b border-[#808080] px-2 py-1 select-none">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Link href="/employees" className="win-btn text-xs font-semibold">
          <span>👤</span>
          <span>الموظفون</span>
        </Link>
        <Link href="/attendance" className="win-btn text-xs font-semibold">
          <span>⏱</span>
          <span>تسجيل الحضور اليومي</span>
        </Link>
        <Link href="/payroll" className="win-btn text-xs font-semibold">
          <span>💵</span>
          <span>مسيرات الرواتب</span>
        </Link>
        <Link href="/leave" className="win-btn text-xs font-semibold">
          <span>📅</span>
          <span>الإجازات</span>
        </Link>
        <Link href="/loans" className="win-btn text-xs font-semibold">
          <span>💰</span>
          <span>السلف والأقساط</span>
        </Link>
        <Link href="/reports" className="win-btn text-xs font-semibold">
          <span>📊</span>
          <span>التقارير</span>
        </Link>

        <div className="h-5 w-[2px] bg-[#808080] border-r border-white mx-1" />

        <button
          type="button"
          onClick={() => router.refresh()}
          className="win-btn text-xs"
          title="تحديث البيانات"
        >
          <span>🔄</span>
          <span>تحديث</span>
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="win-btn text-xs"
          title="طباعة الشاشة الحالية"
        >
          <span>🖨</span>
          <span>طباعة</span>
        </button>
      </div>

      <div className="text-[11px] text-[#404040] hidden md:block">
        نظام رواتب وموظفين كلاسيكي v2005
      </div>
    </div>
  );
}
