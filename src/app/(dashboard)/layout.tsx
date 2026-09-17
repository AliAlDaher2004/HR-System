import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { MenuBar } from '@/components/layout/MenuBar';
import { Toolbar } from '@/components/layout/Toolbar';
import { StatusBar } from '@/components/layout/StatusBar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#ECE9D8] text-black">
      {/* Top Windows 2000 Titlebar & Menu */}
      <MenuBar user={user} />

      {/* Windows 2000 Classic Toolbar */}
      <Toolbar />

      {/* Main Container: Explorer Tasks Sidebar + Workspace Content */}
      <div className="flex flex-1 min-h-0 pb-7">
        <Sidebar user={user} />
        <main className="flex-1 p-3 overflow-y-auto bg-[#ECE9D8]">
          {children}
        </main>
      </div>

      {/* Windows 2000 Bottom Status Bar */}
      <StatusBar user={user} />
    </div>
  );
}
