'use client';

import React, { useEffect, useState } from 'react';
import { UserSession } from '@/lib/auth/rbac';

export function StatusBar({ user }: { user: UserSession }) {
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const d = new Date();
    setCurrentDate(
      d.toLocaleDateString('ar-SA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    );
  }, []);

  const roleNames: Record<string, string> = {
    ADMIN: 'مدير النظام (كامل الصلاحيات)',
    HR: 'مسؤول الموارد البشرية',
    ACCOUNTANT: 'محاسب مالي',
    SUPERVISOR: 'مشرف دوام',
  };

  return (
    <footer className="win-statusbar fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between text-[11px] select-none">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="win-status-panel flex-1 truncate">
          المستخدم النشط: <strong className="text-black">{user.fullName}</strong>
        </div>
        <div className="win-status-panel w-56 truncate hidden sm:block">
          الصلاحية: <span className="font-semibold text-blue-900">{roleNames[user.role] || user.role}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="win-status-panel hidden md:block">
          قاعدة البيانات: <span className="text-emerald-700 font-bold">● متصلة</span>
        </div>
        <div className="win-status-panel min-w-[140px] text-center">
          {currentDate || 'اليوم'}
        </div>
        <div className="win-status-panel w-20 text-center font-bold text-[#0A246A]">
          جاهز (Ready)
        </div>
      </div>
    </footer>
  );
}
