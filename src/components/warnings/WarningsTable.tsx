'use client';

import React, { useState } from 'react';
import { WarningDTO, WARNING_LEVELS, WarningLevel } from '@/lib/types/warning';
import { WarningDetailModal } from './WarningDetailModal';
import { PrintWarningModal } from './PrintWarningModal';
import Link from 'next/link';

interface WarningsTableProps {
  warnings: WarningDTO[];
  userRole: string;
  revokeWarningAction?: (id: string, reason?: string) => Promise<void>;
  deleteWarningAction?: (id: string) => Promise<void>;
  hideEmployeeColumn?: boolean;
}

export function WarningsTable({
  warnings,
  userRole,
  revokeWarningAction,
  deleteWarningAction,
  hideEmployeeColumn = false,
}: WarningsTableProps) {
  const [selectedWarning, setSelectedWarning] = useState<WarningDTO | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printWarning, setPrintWarning] = useState<WarningDTO | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filteredWarnings = warnings.filter((w) => {
    if (levelFilter !== 'ALL' && w.warningLevel !== levelFilter) return false;
    if (statusFilter !== 'ALL' && w.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchEmp =
        w.employee.name.toLowerCase().includes(q) ||
        w.employee.employeeNo.toLowerCase().includes(q) ||
        w.employee.department.toLowerCase().includes(q);
      const matchTitle = w.title.toLowerCase().includes(q);
      const matchReason = w.reason.toLowerCase().includes(q);
      const matchAction = w.administrativeAction ? w.administrativeAction.toLowerCase().includes(q) : false;
      if (!matchEmp && !matchTitle && !matchReason && !matchAction) return false;
    }
    return true;
  });

  function openDetail(w: WarningDTO) {
    setSelectedWarning(w);
    setDetailModalOpen(true);
  }

  function openPrint(w: WarningDTO) {
    setPrintWarning(w);
    setPrintModalOpen(true);
  }

  return (
    <div className="space-y-2 select-none">
      {/* Filter and Search Bar */}
      <div className="win-raised p-2 bg-[#ECE9D8] flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم، الرقم، الموضوع، السبب..."
            className="win-input px-2 py-1 text-xs w-60"
          />

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="win-input px-2 py-1 text-xs"
          >
            <option value="ALL">جميع درجات الإنذارات</option>
            {(Object.keys(WARNING_LEVELS) as WarningLevel[]).map((lvl) => (
              <option key={lvl} value={lvl}>
                {WARNING_LEVELS[lvl].label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="win-input px-2 py-1 text-xs"
          >
            <option value="ALL">جميع الحالات</option>
            <option value="ACTIVE">السارية فقط</option>
            <option value="REVOKED">الملغاة</option>
          </select>
        </div>

        <div className="text-[11px] font-bold text-slate-700">
          العدد: {filteredWarnings.length} من أصل {warnings.length}
        </div>
      </div>

      {/* Warnings Data Table */}
      <div className="win-sunken bg-white overflow-x-auto max-h-[550px]">
        <table className="w-full text-right border-collapse text-xs">
          <thead className="bg-[#ECE9D8] text-black font-bold sticky top-0 border-b border-[#808080] z-10 shadow-sm">
            <tr>
              <th className="p-2 border-l border-[#808080] whitespace-nowrap">تاريخ الإنذار</th>
              {!hideEmployeeColumn && (
                <th className="p-2 border-l border-[#808080] whitespace-nowrap">الموظف المعني</th>
              )}
              <th className="p-2 border-l border-[#808080] whitespace-nowrap text-center">الدرجة</th>
              <th className="p-2 border-l border-[#808080]">موضوع الإنذار والمخالفة</th>
              <th className="p-2 border-l border-[#808080]">الإجراء الإداري</th>
              <th className="p-2 border-l border-[#808080] whitespace-nowrap text-center">توقيع الاستلام</th>
              <th className="p-2 border-l border-[#808080] whitespace-nowrap text-center">كتاب الإنذار</th>
              <th className="p-2 text-center whitespace-nowrap">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredWarnings.length === 0 ? (
              <tr>
                <td
                  colSpan={hideEmployeeColumn ? 7 : 8}
                  className="p-8 text-center text-slate-500 font-medium"
                >
                  لا توجد أي إنذارات مسجلة تطابق خيارات البحث الحالية.
                </td>
              </tr>
            ) : (
              filteredWarnings.map((w) => {
                const lvl = WARNING_LEVELS[w.warningLevel] || {
                  label: w.warningLevel,
                  bgClass: 'bg-slate-100',
                  textClass: 'text-slate-800',
                };
                const isRevoked = w.status === 'REVOKED';

                return (
                  <tr
                    key={w.id}
                    className={`hover:bg-[#EBF3FB] transition-none ${
                      isRevoked ? 'opacity-60 bg-slate-50' : ''
                    }`}
                  >
                    {/* Date */}
                    <td className="p-2 border-l border-slate-200 font-mono text-[11px] whitespace-nowrap">
                      {w.warningDate}
                    </td>

                    {/* Employee */}
                    {!hideEmployeeColumn && (
                      <td className="p-2 border-l border-slate-200 whitespace-nowrap">
                        <Link
                          href={`/employees/${w.employee.id}?tab=warnings`}
                          className="font-bold text-[#0A246A] hover:underline flex items-center gap-1.5"
                        >
                          <span>{w.employee.name}</span>
                          <span className="font-mono text-[10px] text-slate-500 font-normal">
                            ({w.employee.employeeNo})
                          </span>
                        </Link>
                        <div className="text-[10px] text-slate-500">{w.employee.department}</div>
                      </td>
                    )}

                    {/* Level Badge */}
                    <td className="p-2 border-l border-slate-200 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${lvl.bgClass} ${lvl.textClass}`}
                      >
                        {lvl.label}
                      </span>
                      {isRevoked && (
                        <span className="block text-[9px] text-slate-500 font-bold mt-0.5">
                          (ملغى)
                        </span>
                      )}
                    </td>

                    {/* Title & Reason */}
                    <td className="p-2 border-l border-slate-200 max-w-xs">
                      <button
                        type="button"
                        onClick={() => openDetail(w)}
                        className="text-right font-bold text-slate-900 hover:text-[#0A246A] hover:underline block truncate w-full"
                      >
                        {w.title}
                      </button>
                      <div className="text-[11px] text-slate-600 line-clamp-1">{w.reason}</div>
                    </td>

                    {/* Administrative Action */}
                    <td className="p-2 border-l border-slate-200 max-w-xs text-[11px] text-slate-700">
                      {w.administrativeAction || <span className="text-slate-400">-</span>}
                    </td>

                    {/* Signed by Employee */}
                    <td className="p-2 border-l border-slate-200 text-center whitespace-nowrap">
                      {w.signedByEmployee ? (
                        <span className="text-emerald-700 font-bold text-[11px] inline-flex items-center gap-1">
                          <span>✓</span> تم التوقيع
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">غير موقع</span>
                      )}
                    </td>

                    {/* Attachment Icon */}
                    <td className="p-2 border-l border-slate-200 text-center whitespace-nowrap">
                      {w.attachmentPath ? (
                        <a
                          href={`/api/warnings/${w.id}/attachment`}
                          target="_blank"
                          rel="noreferrer"
                          className="win-btn px-2 py-0.5 text-[10px] font-semibold text-blue-900 inline-flex items-center gap-1"
                          title="عرض كتاب الإنذار الموقع"
                        >
                          <span>📎</span>
                          <span>معاينة</span>
                        </a>
                      ) : (
                        <span className="text-slate-300 text-[10px]">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openDetail(w)}
                          className="win-btn text-[11px] px-2 py-0.5 font-semibold"
                          title="عرض التفاصيل الكاملة"
                        >
                          تفاصيل
                        </button>
                        <button
                          type="button"
                          onClick={() => openPrint(w)}
                          className="win-btn text-[11px] px-2 py-0.5 font-semibold text-blue-900"
                          title="طباعة كتاب الإنذار الرسمي"
                        >
                          🖨 طباعة
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      <WarningDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        warning={selectedWarning}
        userRole={userRole}
        revokeWarningAction={revokeWarningAction}
        deleteWarningAction={deleteWarningAction}
      />

      {/* Print Modal */}
      <PrintWarningModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        warning={printWarning}
      />
    </div>
  );
}
