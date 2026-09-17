'use client';

import React from 'react';
import { UserSession } from '@/lib/auth/rbac';
import { Badge } from '@/components/ui';
import { Bell, ShieldCheck, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function Header({ user }: { user: UserSession }) {
  const router = useRouter();

  const roleLabels: Record<string, { label: string; variant: 'active' | 'approved' | 'pending' | 'draft' }> = {
    ADMIN: { label: 'إدارة', variant: 'active' },
    HR: { label: 'موارد بشرية', variant: 'approved' },
    ACCOUNTANT: { label: 'محاسب', variant: 'pending' },
    SUPERVISOR: { label: 'مشرف', variant: 'draft' },
  };

  const roleMeta = roleLabels[user.role] || { label: user.role, variant: 'default' };

  async function handleLogout() {
    // Clear session cookies and redirect to login
    document.cookie = 'hr_dev_session_user=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center space-x-3 space-x-reverse">
        <h2 className="text-lg font-bold text-[#15324F]">نظام إدارة الموارد البشرية والرواتب</h2>
      </div>

      <div className="flex items-center space-x-4 space-x-reverse">
        <div className="flex items-center space-x-2 space-x-reverse bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          <ShieldCheck className="w-4 h-4 text-[#2169A6]" />
          <span className="text-sm font-medium text-slate-700">{user.fullName}</span>
          <Badge variant={roleMeta.variant}>{roleMeta.label}</Badge>
        </div>

        <button
          onClick={handleLogout}
          title="تسجيل الخروج"
          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
