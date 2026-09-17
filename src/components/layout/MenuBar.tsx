'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserSession } from '@/lib/auth/rbac';

interface MenuBarProps {
  user: UserSession;
}

export function MenuBar({ user }: MenuBarProps) {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  function toggleMenu(menu: string) {
    setOpenMenu(openMenu === menu ? null : menu);
  }

  function handleLogout() {
    document.cookie = 'hr_dev_session_user=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="relative z-30 select-none">
      {/* Windows 2000 Top Window Header */}
      <div className="win-titlebar flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-xs">
          <span className="text-base">💼</span>
          <span>نظام إدارة الموارد البشرية والرواتب - Enterprise Edition [v2005.4]</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="win-box-btn" title="تصغير">_</button>
          <button type="button" className="win-box-btn" title="تكبير">□</button>
          <button
            type="button"
            onClick={handleLogout}
            className="win-box-btn font-bold text-red-900"
            title="تسجيل الخروج"
          >
            ×
          </button>
        </div>
      </div>

      {/* Classic Menu Bar */}
      <div className="win-menubar flex items-center gap-1 text-xs border-b border-[#808080] bg-[#ECE9D8]">
        {/* ملف */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('file')}
            className={`px-2 py-0.5 hover:bg-[#0A246A] hover:text-white ${openMenu === 'file' ? 'bg-[#0A246A] text-white' : 'text-black'}`}
          >
            ملف (<u>F</u>)
          </button>
          {openMenu === 'file' && (
            <div className="absolute right-0 top-full mt-0.5 w-44 win-raised p-1 shadow-lg z-50 text-black">
              <Link
                href="/"
                onClick={() => setOpenMenu(null)}
                className="block px-3 py-1 hover:bg-[#0A246A] hover:text-white text-xs"
              >
                الرئيسية
              </Link>
              <Link
                href="/settings"
                onClick={() => setOpenMenu(null)}
                className="block px-3 py-1 hover:bg-[#0A246A] hover:text-white text-xs"
              >
                إعدادات النظام
              </Link>
              <div className="my-1 border-t border-[#808080] border-b border-white" />
              <button
                type="button"
                onClick={() => { setOpenMenu(null); handleLogout(); }}
                className="w-full text-right px-3 py-1 hover:bg-[#0A246A] hover:text-white text-xs text-red-700 font-bold"
              >
                تسجيل الخروج
              </button>
            </div>
          )}
        </div>

        {/* الموظفون */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('employees')}
            className={`px-2 py-0.5 hover:bg-[#0A246A] hover:text-white ${openMenu === 'employees' ? 'bg-[#0A246A] text-white' : 'text-black'}`}
          >
            الموظفون (<u>E</u>)
          </button>
          {openMenu === 'employees' && (
            <div className="absolute right-0 top-full mt-0.5 w-48 win-raised p-1 shadow-lg z-50 text-black">
              <Link
                href="/employees"
                onClick={() => setOpenMenu(null)}
                className="block px-3 py-1 hover:bg-[#0A246A] hover:text-white text-xs"
              >
                دليل الموظفين
              </Link>
              <Link
                href="/documents"
                onClick={() => setOpenMenu(null)}
                className="block px-3 py-1 hover:bg-[#0A246A] hover:text-white text-xs"
              >
                وثائق وهويات الموظفين
              </Link>
            </div>
          )}
        </div>

        {/* الحضور */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('attendance')}
            className={`px-2 py-0.5 hover:bg-[#0A246A] hover:text-white ${openMenu === 'attendance' ? 'bg-[#0A246A] text-white' : 'text-black'}`}
          >
            الدوام والحضور (<u>A</u>)
          </button>
          {openMenu === 'attendance' && (
            <div className="absolute right-0 top-full mt-0.5 w-48 win-raised p-1 shadow-lg z-50 text-black">
              <Link
                href="/attendance"
                onClick={() => setOpenMenu(null)}
                className="block px-3 py-1 hover:bg-[#0A246A] hover:text-white text-xs font-bold"
              >
                جدول الحضور اليومي السريع
              </Link>
              <Link
                href="/leave"
                onClick={() => setOpenMenu(null)}
                className="block px-3 py-1 hover:bg-[#0A246A] hover:text-white text-xs"
              >
                إدارة الإجازات والأرصدة
              </Link>
            </div>
          )}
        </div>

        {/* الرواتب والمالية */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('payroll')}
            className={`px-2 py-0.5 hover:bg-[#0A246A] hover:text-white ${openMenu === 'payroll' ? 'bg-[#0A246A] text-white' : 'text-black'}`}
          >
            الرواتب والمالية (<u>P</u>)
          </button>
          {openMenu === 'payroll' && (
            <div className="absolute right-0 top-full mt-0.5 w-48 win-raised p-1 shadow-lg z-50 text-black">
              <Link
                href="/payroll"
                onClick={() => setOpenMenu(null)}
                className="block px-3 py-1 hover:bg-[#0A246A] hover:text-white text-xs font-bold"
              >
                كشوف الرواتب الشهرية
              </Link>
              <Link
                href="/loans"
                onClick={() => setOpenMenu(null)}
                className="block px-3 py-1 hover:bg-[#0A246A] hover:text-white text-xs"
              >
                سلف الموظفين والأقساط
              </Link>
            </div>
          )}
        </div>

        {/* التقارير */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('reports')}
            className={`px-2 py-0.5 hover:bg-[#0A246A] hover:text-white ${openMenu === 'reports' ? 'bg-[#0A246A] text-white' : 'text-black'}`}
          >
            التقارير (<u>R</u>)
          </button>
          {openMenu === 'reports' && (
            <div className="absolute right-0 top-full mt-0.5 w-48 win-raised p-1 shadow-lg z-50 text-black">
              <Link
                href="/reports"
                onClick={() => setOpenMenu(null)}
                className="block px-3 py-1 hover:bg-[#0A246A] hover:text-white text-xs"
              >
                مركز التقارير المجمعة
              </Link>
              <Link
                href="/audit"
                onClick={() => setOpenMenu(null)}
                className="block px-3 py-1 hover:bg-[#0A246A] hover:text-white text-xs"
              >
                سجل تدقيق العمليات (Audit)
              </Link>
            </div>
          )}
        </div>

        {/* مساعدة */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('help')}
            className={`px-2 py-0.5 hover:bg-[#0A246A] hover:text-white ${openMenu === 'help' ? 'bg-[#0A246A] text-white' : 'text-black'}`}
          >
            مساعدة (<u>H</u>)
          </button>
          {openMenu === 'help' && (
            <div className="absolute right-0 top-full mt-0.5 w-44 win-raised p-2 shadow-lg z-50 text-black text-xs">
              <div className="font-bold text-slate-800 mb-1">حول النظام</div>
              <div className="text-[11px] text-slate-600">إصدار الشركات 2005.4</div>
              <div className="text-[11px] text-slate-600">قاعدة البيانات: متصلة</div>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop to close menus on outside click */}
      {openMenu && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={() => setOpenMenu(null)}
        />
      )}
    </div>
  );
}
