'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserSession, RBAC } from '@/lib/auth/rbac';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  Coins,
  Receipt,
  FileText,
  BarChart3,
  History,
  Settings,
  UserCog,
} from 'lucide-react';
import { clsx } from 'clsx';

export function Sidebar({ user }: { user: UserSession }) {
  const pathname = usePathname();

  const navItems = [
    {
      title: 'الرئيسية',
      href: '/',
      icon: LayoutDashboard,
      show: true,
    },
    {
      title: 'الموظفون',
      href: '/employees',
      icon: Users,
      show: true,
    },
    {
      title: 'الحضور والدوام',
      href: '/attendance',
      icon: CalendarCheck,
      show: true,
    },
    {
      title: 'الإجازات',
      href: '/leave',
      icon: CalendarDays,
      show: ['ADMIN', 'HR', 'ACCOUNTANT'].includes(user.role),
    },
    {
      title: 'السلف والمستحقات',
      href: '/loans',
      icon: Coins,
      show: RBAC.canManageLoans(user.role),
    },
    {
      title: 'مسيرات الرواتب',
      href: '/payroll',
      icon: Receipt,
      show: RBAC.canManagePayroll(user.role),
    },
    {
      title: 'العقود والوثائق',
      href: '/documents',
      icon: FileText,
      show: false,
    },
    {
      title: 'التقارير الإدارية',
      href: '/reports',
      icon: BarChart3,
      show: true,
    },
    {
      title: 'سجل العمليات (Audit)',
      href: '/audit',
      icon: History,
      show: RBAC.canViewAuditLog(user.role),
    },
    {
      title: 'إدارة المستخدمين',
      href: '/users',
      icon: UserCog,
      show: RBAC.canManageUsers(user.role),
    },
    {
      title: 'إعدادات الشركة',
      href: '/settings',
      icon: Settings,
      show: RBAC.canManageSettings(user.role),
    },
  ];

  return (
    <aside className="w-56 bg-[#D4D0C8] border-l-2 border-[#808080] flex flex-col flex-shrink-0 select-none p-1">
      {/* Explorer Task Header */}
      <div className="win-raised p-1 mb-1">
        <div className="bg-gradient-to-r from-[#0A246A] to-[#A6CAF0] text-white font-bold text-xs px-2 py-1 flex items-center justify-between">
          <span>مهام النظام الرئيسية</span>
          <span>▼</span>
        </div>
        <div className="p-1 bg-[#FFFFFF] win-sunken mt-1 text-[11px] text-[#404040]">
          المستخدم: <strong className="text-black">{user.fullName}</strong>
        </div>
      </div>

      {/* Navigation Links - Classic Tree/Task items */}
      <div className="win-sunken bg-white flex-1 p-1 overflow-y-auto space-y-0.5">
        <div className="text-[10px] font-bold text-[#808080] px-2 py-1 uppercase tracking-wider">
          قائمة الوظائف
        </div>
        {navItems
          .filter((item) => item.show)
          .map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={clsx(
                  'flex items-center px-2 py-1 text-xs font-normal transition-none border',
                  isActive
                    ? 'bg-[#0A246A] text-white border-[#000080] font-bold'
                    : 'text-black hover:bg-[#B5CDE4] hover:text-[#0A246A] border-transparent'
                )}
              >
                <Icon className={clsx("w-4 h-4 ml-2 flex-shrink-0", isActive ? "text-white" : "text-[#0A246A]")} />
                <span className="truncate">{item.title}</span>
              </Link>
            );
          })}
      </div>

      {/* System info box */}
      <div className="win-raised p-1.5 mt-1 text-[10px] text-slate-700 bg-[#ECE9D8]">
        <div className="flex justify-between items-center">
          <span>البيئة: {process.env.NODE_ENV === 'production' ? 'الإنتاج' : 'محلي'}</span>
          <span className="text-emerald-700 font-bold">● متصل</span>
        </div>
      </div>
    </aside>
  );
}
