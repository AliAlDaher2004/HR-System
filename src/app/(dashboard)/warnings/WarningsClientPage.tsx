'use client';

import React, { useState } from 'react';
import { WarningDTO } from '@/lib/types/warning';
import { WarningsTable } from '@/components/warnings/WarningsTable';
import { CreateWarningModal } from '@/components/warnings/CreateWarningModal';
import { useRouter } from 'next/navigation';

interface EmployeeOption {
  id: string;
  name: string;
  employeeNo: string;
  department: string;
}

interface WarningsClientPageProps {
  warnings: WarningDTO[];
  employees: EmployeeOption[];
  userRole: string;
  createWarningAction: (formData: FormData) => Promise<void>;
  revokeWarningAction?: (id: string, reason?: string) => Promise<void>;
  deleteWarningAction?: (id: string) => Promise<void>;
}

export function WarningsClientPage({
  warnings,
  employees,
  userRole,
  createWarningAction,
  revokeWarningAction,
  deleteWarningAction,
}: WarningsClientPageProps) {
  const router = useRouter();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const canManage = ['ADMIN', 'HR'].includes(userRole);

  // Statistics
  const totalWarnings = warnings.length;
  const activeWarnings = warnings.filter((w) => w.status === 'ACTIVE').length;
  const verbalCount = warnings.filter((w) => w.warningLevel === 'VERBAL' && w.status === 'ACTIVE').length;
  const firstCount = warnings.filter((w) => w.warningLevel === 'FIRST' && w.status === 'ACTIVE').length;
  const criticalCount = warnings.filter(
    (w) => ['SECOND', 'FINAL', 'TERMINATION'].includes(w.warningLevel) && w.status === 'ACTIVE'
  ).length;
  const signedCount = warnings.filter((w) => w.signedByEmployee && w.status === 'ACTIVE').length;

  return (
    <div className="space-y-3 select-none">
      {/* Windows 2000 Classic Window Header */}
      <div className="win-raised p-2 bg-[#ECE9D8] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚠️</span>
          <div>
            <h1 className="font-bold text-sm text-black">سجل الإنذارات والمخالفات الإدارية</h1>
            <p className="text-[11px] text-slate-600">
              إدارة ومتابعة التنبيهات والإنذارات الخطية للموظفين وإرفاق المستندات الموقعة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {canManage && (
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="win-btn font-bold text-xs bg-[#0A246A] text-white px-3 py-1 flex items-center gap-1.5 shadow"
            >
              <span>➕</span>
              <span>إصدار إنذار جديد</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="win-btn text-xs px-2.5 py-1 flex items-center gap-1"
            title="طباعة الكشف الحالي"
          >
            <span>🖨</span>
            <span>طباعة الكشف</span>
          </button>

          <button
            type="button"
            onClick={() => router.refresh()}
            className="win-btn text-xs px-2.5 py-1 flex items-center gap-1"
            title="تحديث البيانات"
          >
            <span>🔄</span>
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
        {/* Total Active */}
        <div className="win-sunken bg-white p-2.5 border border-[#808080]">
          <span className="text-slate-500 block text-[11px]">الإنذارات السارية</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">{activeWarnings}</div>
          <span className="text-[10px] text-slate-400">إجمالي السجلات: {totalWarnings}</span>
        </div>

        {/* Verbal */}
        <div className="win-sunken bg-amber-50/50 p-2.5 border border-amber-300">
          <span className="text-amber-800 block text-[11px] font-semibold">تنبيهات شفوية</span>
          <div className="text-xl font-bold font-mono text-amber-700 mt-1">{verbalCount}</div>
          <span className="text-[10px] text-amber-600">تنبيه أولي</span>
        </div>

        {/* First Warning */}
        <div className="win-sunken bg-orange-50/50 p-2.5 border border-orange-300">
          <span className="text-orange-800 block text-[11px] font-semibold">إنذارات أولى</span>
          <div className="text-xl font-bold font-mono text-orange-700 mt-1">{firstCount}</div>
          <span className="text-[10px] text-orange-600">إنذار خطي أول</span>
        </div>

        {/* Critical / Final */}
        <div className="win-sunken bg-rose-50/60 p-2.5 border border-rose-300">
          <span className="text-rose-800 block text-[11px] font-semibold">إنذارات متقدمة / نهائية</span>
          <div className="text-xl font-bold font-mono text-rose-700 mt-1">{criticalCount}</div>
          <span className="text-[10px] text-rose-600">ثانٍ / نهائي / فصل</span>
        </div>

        {/* Signed */}
        <div className="win-sunken bg-emerald-50/50 p-2.5 border border-emerald-300">
          <span className="text-emerald-800 block text-[11px] font-semibold">موقعة من الموظف</span>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-1">{signedCount}</div>
          <span className="text-[10px] text-emerald-600">استلام معتمد رسمياً</span>
        </div>
      </div>

      {/* Main Table */}
      <WarningsTable
        warnings={warnings}
        userRole={userRole}
        revokeWarningAction={revokeWarningAction}
        deleteWarningAction={deleteWarningAction}
      />

      {/* Create Modal */}
      <CreateWarningModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        createWarningAction={createWarningAction}
        employees={employees}
      />
    </div>
  );
}
