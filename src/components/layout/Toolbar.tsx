'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function Toolbar() {
  const router = useRouter();

  return (
    <div className="win-toolbar flex items-center justify-between bg-[#ECE9D8] border-b border-[#808080] px-2 py-1 select-none">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Link href="/employees" prefetch={true} className="win-btn text-xs font-semibold">
          <span>👤</span>
          <span>الموظفون</span>
        </Link>
        <Link href="/warnings" prefetch={true} className="win-btn text-xs font-semibold text-amber-950">
          <span>⚠️</span>
          <span>الإنذارات</span>
        </Link>
        <Link href="/attendance" prefetch={true} className="win-btn text-xs font-semibold">
          <span>⏱</span>
          <span>تسجيل الحضور اليومي</span>
        </Link>
        <Link href="/payroll" prefetch={true} className="win-btn text-xs font-semibold">
          <span>💵</span>
          <span>مسيرات الرواتب</span>
        </Link>
        <Link href="/leave" prefetch={true} className="win-btn text-xs font-semibold">
          <span>📅</span>
          <span>الإجازات</span>
        </Link>
        <Link href="/loans" prefetch={true} className="win-btn text-xs font-semibold">
          <span>💰</span>
          <span>السلف والأقساط</span>
        </Link>
        <Link href="/reports" prefetch={true} className="win-btn text-xs font-semibold">
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
    </div>
  );
}
