'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Printer, FileSpreadsheet } from 'lucide-react';

interface PrintEmployeesModalProps {
  departments: string[];
  currentShift?: string;
  currentDepartment?: string;
  activeCount: number;
  morningCount: number;
  eveningCount: number;
}

export function PrintEmployeesModal({
  departments,
  currentShift = '',
  currentDepartment = '',
  activeCount,
  morningCount,
  eveningCount,
}: PrintEmployeesModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<string>(currentShift || 'ALL');
  const [selectedDept, setSelectedDept] = useState<string>(currentDepartment || '');
  const [selectedEmpType, setSelectedEmpType] = useState<string>('');

  function handleOpenPrintPage() {
    const params = new URLSearchParams();
    if (selectedShift && selectedShift !== 'ALL') params.set('shift', selectedShift);
    if (selectedDept) params.set('department', selectedDept);
    if (selectedEmpType) params.set('employmentType', selectedEmpType);

    const url = `/employees/print?${params.toString()}`;
    window.open(url, '_blank');
    setIsOpen(false);
  }

  function handleExportCsv() {
    const params = new URLSearchParams({ type: 'employees' });
    if (selectedShift && selectedShift !== 'ALL') params.set('shift', selectedShift);
    if (selectedDept) params.set('department', selectedDept);
    if (selectedEmpType) params.set('employmentType', selectedEmpType);

    window.open(`/api/reports/export?${params.toString()}`, '_blank');
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSelectedShift(currentShift || 'ALL');
          setSelectedDept(currentDepartment || '');
          setIsOpen(true);
        }}
        className="win-btn text-xs font-bold py-1 px-3 flex items-center gap-1.5 shadow-sm text-black"
        title="طباعة كشف بأسماء الموظفين النشطين حسب الوردية أو القسم"
      >
        <Printer className="w-3.5 h-3.5 text-blue-900" />
        <span>طباعة كشف الموظفين</span>
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="طباعة وتصدير كشف الموظفين على رأس العمل"
        maxWidth="md"
      >
        <div className="space-y-3 text-xs select-none">
          {/* Header Description */}
          <div className="win-sunken p-2 bg-[#F5F3EC]">
            <div className="font-bold text-black flex items-center gap-1.5">
              <span>🖨️</span>
              <span>تخصيص كشف الموظفين المطلوب طباعته:</span>
            </div>
            <p className="text-[#505050] text-[11px] mt-0.5">
              يمكنك تخصيص الوردية، القسم، ونوع التوظيف لتجهيز الكشف بحجم ورقة A4 رسمي مع توقيعات الاعتماد.
            </p>
          </div>

          {/* Option 1: Shift Filter */}
          <div className="win-raised p-2.5 bg-white space-y-1.5 border border-[#808080]">
            <label className="block text-xs font-bold text-black flex items-center gap-1">
              <span>⏱️</span>
              <span>تحديد الوردية (الدوام):</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedShift('ALL')}
                className={`py-1.5 px-2 rounded border text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-none ${
                  selectedShift === 'ALL' || !selectedShift
                    ? 'bg-[#0A246A] text-white border-[#0A246A] shadow-inner'
                    : 'bg-[#ECE9D8] text-slate-800 border-slate-300 hover:bg-[#F0EEE5]'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span>🔘</span>
                  <span>جميع الورديات</span>
                </div>
                <span className="font-mono text-[10px] opacity-80">({activeCount} موظف)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedShift('MORNING')}
                className={`py-1.5 px-2 rounded border text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-none ${
                  selectedShift === 'MORNING'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-inner'
                    : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span>☀️</span>
                  <span>الوردية الصباحية</span>
                </div>
                <span className="font-mono text-[10px] opacity-90">({morningCount} موظف)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedShift('EVENING')}
                className={`py-1.5 px-2 rounded border text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-none ${
                  selectedShift === 'EVENING'
                    ? 'bg-indigo-700 text-white border-indigo-800 shadow-inner'
                    : 'bg-indigo-50 text-indigo-900 border-indigo-300 hover:bg-indigo-100'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span>🌙</span>
                  <span>الوردية المسائية</span>
                </div>
                <span className="font-mono text-[10px] opacity-90">({eveningCount} موظف)</span>
              </button>
            </div>
          </div>

          {/* Option 2: Department and Employment Type */}
          <div className="win-raised p-2.5 bg-white grid grid-cols-1 sm:grid-cols-2 gap-2 border border-[#808080]">
            <div>
              <label className="block text-[11px] font-bold text-black mb-0.5">القسم / الإدارة:</label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="win-input w-full py-1 px-2"
              >
                <option value="">جميع الأقسام ({departments.length})</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-black mb-0.5">نوع التوظيف:</label>
              <select
                value={selectedEmpType}
                onChange={(e) => setSelectedEmpType(e.target.value)}
                className="win-input w-full py-1 px-2"
              >
                <option value="">جميع الأنواع (مثبت / تجريبي / مياومة)</option>
                <option value="PERMANENT">مثبت</option>
                <option value="PROBATIONARY">تجريبي</option>
                <option value="DAILY_WORKER">مياومة</option>
              </select>
            </div>
          </div>

          {/* Summary Preview Indicator */}
          <div className="win-sunken p-2 bg-[#F0F8FF] text-[11px] text-[#0A246A] flex items-center justify-between">
            <span>
              📄 التقرير: <strong>كشف موظفي {selectedShift === 'MORNING' ? 'الوردية الصباحية ☀️' : selectedShift === 'EVENING' ? 'الوردية المسائية 🌙' : 'جميع الورديات 🔘'}</strong>
            </span>
            <span className="font-semibold text-slate-600">
              {selectedDept ? `القسم: ${selectedDept}` : 'كافة الأقسام'}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-[#808080]">
            <button
              type="button"
              onClick={handleExportCsv}
              className="win-btn px-3 py-1 text-slate-800 flex items-center gap-1.5 font-bold"
              title="تصدير كملف إكسل / CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>تصدير Excel / CSV</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="win-btn px-3 py-1 text-black"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleOpenPrintPage}
                className="win-btn px-4 py-1 font-bold text-[#0A246A] flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>فتح الكشف والطباعة</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
