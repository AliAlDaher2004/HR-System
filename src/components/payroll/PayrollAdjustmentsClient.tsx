'use client';

import React, { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge, Button } from '@/components/ui';
import { MonthlyAdjustmentRow, SaveAdjustmentItem } from '@/lib/services/payroll-service';

interface PayrollAdjustmentsClientProps {
  month: string;
  periodStart: string;
  periodEnd: string;
  initialRows: MonthlyAdjustmentRow[];
  saveAction: (
    month: string,
    adjustments: SaveAdjustmentItem[]
  ) => Promise<{ success: boolean; savedCount: number; month: string }>;
}

export function PayrollAdjustmentsClient({
  month,
  periodStart,
  periodEnd,
  initialRows,
  saveAction,
}: PayrollAdjustmentsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Selected details modal state
  const [inspectModal, setInspectModal] = useState<{
    type: 'DELIVERY' | 'PENALTY';
    employeeName: string;
    items: Array<{ date: string; amount: number; reason: string }>;
  } | null>(null);

  // Search & Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [onlyWithAdjustments, setOnlyWithAdjustments] = useState<boolean>(false);

  // Success alert state
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // Local adjustments state per employee
  const [rowEdits, setRowEdits] = useState<
    Record<
      string,
      {
        allowancesEarned: number;
        deliveryAllowance: number;
        bonus: number;
        bonusReason: string;
        dailyPenalties: number;
        otherDeductions: number;
        deductionReason: string;
        notes: string;
      }
    >
  >(() => {
    const init: Record<string, any> = {};
    initialRows.forEach((r) => {
      init[r.employeeId] = {
        allowancesEarned: r.allowancesEarned,
        deliveryAllowance: r.deliveryAllowance,
        bonus: r.bonus,
        bonusReason: r.bonusReason || '',
        dailyPenalties: r.dailyPenalties,
        otherDeductions: r.otherDeductions,
        deductionReason: r.deductionReason || '',
        notes: r.notes || '',
      };
    });
    return init;
  });

  // Extract unique departments for filter dropdown
  const departments = useMemo(() => {
    const set = new Set<string>();
    initialRows.forEach((r) => {
      if (r.department) set.add(r.department);
    });
    return Array.from(set).sort();
  }, [initialRows]);

  // Handle month navigation
  const handleMonthChange = (newMonth: string) => {
    if (!newMonth) return;
    router.push(`/payroll/adjustments?month=${newMonth}`);
  };

  const handlePrevMonth = () => {
    const [y, m] = month.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    const pMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    handleMonthChange(pMonth);
  };

  const handleNextMonth = () => {
    const [y, m] = month.split('-').map(Number);
    const date = new Date(y, m, 1);
    const nMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    handleMonthChange(nMonth);
  };

  const handleCurrentMonth = () => {
    const today = new Date();
    const cMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    handleMonthChange(cMonth);
  };

  // Update specific field for an employee
  const handleFieldChange = (
    empId: string,
    field: 'allowancesEarned' | 'deliveryAllowance' | 'bonus' | 'bonusReason' | 'dailyPenalties' | 'otherDeductions' | 'deductionReason' | 'notes',
    value: any
  ) => {
    setRowEdits((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [field]: value,
      },
    }));
  };

  // Reset row to attendance defaults
  const handleResetRow = (empId: string) => {
    const original = initialRows.find((r) => r.employeeId === empId);
    if (!original) return;
    setRowEdits((prev) => ({
      ...prev,
      [empId]: {
        allowancesEarned: original.allowancesEarned,
        deliveryAllowance: original.deliveryDetails.reduce((a, b) => a + b.amount, 0),
        bonus: 0,
        bonusReason: '',
        dailyPenalties: original.penaltyDetails.reduce((a, b) => a + b.amount, 0),
        otherDeductions: 0,
        deductionReason: '',
        notes: '',
      },
    }));
  };

  // Calculate live row metrics and totals
  const calculatedRows = useMemo(() => {
    return initialRows.map((r) => {
      const edit = rowEdits[r.employeeId] || {
        allowancesEarned: r.allowancesEarned,
        deliveryAllowance: r.deliveryAllowance,
        bonus: r.bonus,
        bonusReason: '',
        dailyPenalties: r.dailyPenalties,
        otherDeductions: r.otherDeductions,
        deductionReason: '',
        notes: '',
      };

      const allowancesVal = edit.allowancesEarned !== undefined ? Number(edit.allowancesEarned) : r.allowancesEarned;
      const deliveryVal = Number(edit.deliveryAllowance) || 0;
      const bonusVal = Number(edit.bonus) || 0;
      const dailyPenaltiesVal = Number(edit.dailyPenalties) || 0;
      const otherDeductionsVal = Number(edit.otherDeductions) || 0;

      const totalEarnings = r.basicEarned + allowancesVal + r.otTotal + deliveryVal + bonusVal;
      const totalAttendanceDeductions = r.unpaidDeduction + r.lateDeduction + r.earlyDepartureDeduction;
      const totalStatutoryDeductions = r.socialSecurityDeduction + r.loanDeduction;
      const totalPenalties = dailyPenaltiesVal + otherDeductionsVal;
      const totalDeductions = totalAttendanceDeductions + totalStatutoryDeductions + totalPenalties;

      const netPay = Math.max(0, Math.round((totalEarnings - totalDeductions) * 1000) / 1000);

      // Check if this employee has changes
      const hasAllowanceChange = Math.abs(allowancesVal - r.allowancesEarned) > 0.001;
      const hasDelivery = deliveryVal > 0;
      const hasBonus = bonusVal > 0;
      const hasPenalties = dailyPenaltiesVal > 0 || otherDeductionsVal > 0;
      const hasAnyAdjustments = hasAllowanceChange || hasDelivery || hasBonus || hasPenalties;

      return {
        ...r,
        allowancesVal,
        deliveryVal,
        bonusVal,
        dailyPenaltiesVal,
        otherDeductionsVal,
        totalEarnings,
        totalAttendanceDeductions,
        totalStatutoryDeductions,
        totalPenalties,
        totalDeductions,
        netPay,
        hasAnyAdjustments,
      };
    });
  }, [initialRows, rowEdits]);

  // Filter rows based on search, dept, type, adjustments
  const filteredRows = useMemo(() => {
    return calculatedRows.filter((r) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = r.name.toLowerCase().includes(term);
        const matchesNo = r.employeeNo.toLowerCase().includes(term);
        const matchesTitle = (r.jobTitle || '').toLowerCase().includes(term);
        if (!matchesName && !matchesNo && !matchesTitle) return false;
      }
      if (selectedDept !== 'ALL' && r.department !== selectedDept) {
        return false;
      }
      if (selectedType !== 'ALL' && r.employmentType !== selectedType) {
        return false;
      }
      if (onlyWithAdjustments && !r.hasAnyAdjustments) {
        return false;
      }
      return true;
    });
  }, [calculatedRows, searchTerm, selectedDept, selectedType, onlyWithAdjustments]);

  // Grand totals across all active employees (not only filtered)
  const grandTotals = useMemo(() => {
    return calculatedRows.reduce(
      (acc, r) => ({
        count: acc.count + 1,
        basicAndAllowances: acc.basicAndAllowances + r.basicEarned + r.allowancesVal,
        otTotal: acc.otTotal + r.otTotal,
        deliveryTotal: acc.deliveryTotal + r.deliveryVal,
        bonusTotal: acc.bonusTotal + r.bonusVal,
        attendanceDeductions: acc.attendanceDeductions + r.totalAttendanceDeductions,
        penaltiesTotal: acc.penaltiesTotal + r.totalPenalties,
        statutoryDeductions: acc.statutoryDeductions + r.totalStatutoryDeductions,
        netTotal: acc.netTotal + r.netPay,
      }),
      {
        count: 0,
        basicAndAllowances: 0,
        otTotal: 0,
        deliveryTotal: 0,
        bonusTotal: 0,
        attendanceDeductions: 0,
        penaltiesTotal: 0,
        statutoryDeductions: 0,
        netTotal: 0,
      }
    );
  }, [calculatedRows]);

  // Save handler
  const handleSaveAndTransfer = () => {
    setSaveErrorMsg(null);
    setSaveSuccessMsg(null);

    const payload: SaveAdjustmentItem[] = initialRows.map((r) => {
      const edit = rowEdits[r.employeeId] || {
        allowancesEarned: r.allowancesEarned,
        deliveryAllowance: r.deliveryAllowance,
        bonus: r.bonus,
        bonusReason: '',
        dailyPenalties: r.dailyPenalties,
        otherDeductions: r.otherDeductions,
        deductionReason: '',
        notes: '',
      };

      return {
        employeeId: r.employeeId,
        allowancesEarned: edit.allowancesEarned !== undefined ? Number(edit.allowancesEarned) : r.allowancesEarned,
        deliveryAllowance: Number(edit.deliveryAllowance) || 0,
        bonus: Number(edit.bonus) || 0,
        bonusReason: edit.bonusReason?.trim() || undefined,
        dailyPenalties: Number(edit.dailyPenalties) || 0,
        otherDeductions: Number(edit.otherDeductions) || 0,
        deductionReason: edit.deductionReason?.trim() || undefined,
        notes: edit.notes?.trim() || undefined,
      };
    });

    startTransition(async () => {
      try {
        const res = await saveAction(month, payload);
        if (res.success) {
          setSaveSuccessMsg(
            `تم حفظ وترحيل مسيرات الرواتب لشهر (${month}) بنجاح! تم تحديث وإنشاء مسيرات لـ (${res.savedCount}) موظف.`
          );
        } else {
          setSaveErrorMsg('حدث خطأ أثناء حفظ المسيرات.');
        }
      } catch (err: any) {
        setSaveErrorMsg(err.message || 'حدث خطأ أثناء حفظ المسيرات.');
      }
    });
  };

  return (
    <div className="space-y-3 select-none font-sans" dir="rtl">
      {/* 1. Header Toolbar */}
      <div className="win-raised p-2.5 bg-[#ECE9D8] flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <h1 className="text-sm font-bold text-black">
              إعداد ومراجعة متغيرات الرواتب الشهرية (المكافآت، العقوبات، وبدلات التوصيل)
            </h1>
          </div>
          <p className="text-[#505050] text-[11px] mt-0.5">
            صفحة مركزية لمراجعة ساعات واستحقاقات الدوام، ترحيل مشاوير الديزل والمخالفات اليومية، وتثبيت المكافآت والعقوبات قبل ترحيل الرواتب
          </p>
        </div>

        {/* Month selector & quick action links */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 bg-white border border-[#7F9DB9] px-2 py-0.5 rounded-none shadow-inner">
            <span className="text-xs font-bold text-[#0A246A]">الشهر المستهدف:</span>
            <button
              onClick={handlePrevMonth}
              className="win-btn px-1.5 py-0.5 text-xs font-bold"
              title="الشهر السابق"
            >
              ◀
            </button>
            <input
              type="month"
              value={month}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="win-input text-xs font-mono font-bold px-1 py-0.5 border border-slate-300"
            />
            <button
              onClick={handleNextMonth}
              className="win-btn px-1.5 py-0.5 text-xs font-bold"
              title="الشهر التالي"
            >
              ▶
            </button>
            <button
              onClick={handleCurrentMonth}
              className="win-btn px-2 py-0.5 text-xs font-bold text-blue-900"
            >
              الشهر الحالي
            </button>
          </div>

          <Link
            href={`/payroll?month=${month}`}
            className="win-btn px-2.5 py-1 text-xs font-bold flex items-center gap-1 text-[#0A246A]"
          >
            <span>💵</span>
            <span>مسيرات الرواتب</span>
          </Link>

          <Link
            href="/attendance"
            className="win-btn px-2.5 py-1 text-xs font-bold flex items-center gap-1 text-slate-800"
          >
            <span>📋</span>
            <span>كشف الحضور اليومي</span>
          </Link>
        </div>
      </div>

      {/* 2. Success / Error Feedback Alert */}
      {saveSuccessMsg && (
        <div className="win-sunken p-3 bg-[#EBFBEE] border-2 border-[#40C057] text-[#2B8A3E] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">✅</span>
            <span className="text-xs font-bold">{saveSuccessMsg}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/payroll?month=${month}`}
              className="win-btn font-bold text-xs px-3 py-1 bg-[#2B8A3E] text-white hover:bg-[#237032]"
            >
              الانتقال إلى جدول المسيرات المعتمدة لهذا الشهر ⬅
            </Link>
            <button
              onClick={() => setSaveSuccessMsg(null)}
              className="win-btn px-2 py-0.5 text-xs font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {saveErrorMsg && (
        <div className="win-sunken p-3 bg-[#FFF5F5] border-2 border-[#FA5252] text-[#C92A2A] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span className="text-xs font-bold">{saveErrorMsg}</span>
          </div>
          <button
            onClick={() => setSaveErrorMsg(null)}
            className="win-btn px-2 py-0.5 text-xs font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* 3. KPI Summary Bar (7 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
        {/* Card 1: Total Employees */}
        <div className="win-raised p-2 text-center bg-[#ECE9D8]">
          <div className="text-[10px] text-[#505050] font-bold">الموظفون الفعالون</div>
          <div className="text-base font-extrabold text-[#0A246A] mt-0.5">
            {grandTotals.count}{' '}
            <span className="text-[10px] font-normal text-slate-600">موظف</span>
          </div>
        </div>

        {/* Card 2: Basic & Allowances */}
        <div className="win-raised p-2 text-center bg-blue-50/50">
          <div className="text-[10px] text-blue-900 font-bold">الأساسي والمواصلات</div>
          <div className="text-sm font-extrabold text-blue-950 font-mono mt-0.5">
            {grandTotals.basicAndAllowances.toFixed(3)}{' '}
            <span className="text-[10px] font-normal">د.أ</span>
          </div>
        </div>

        {/* Card 3: Overtime Amount */}
        <div className="win-raised p-2 text-center bg-indigo-50/50">
          <div className="text-[10px] text-indigo-900 font-bold">العمل الإضافي (ساعتان/ساعة)</div>
          <div className="text-sm font-extrabold text-indigo-950 font-mono mt-0.5">
            {grandTotals.otTotal.toFixed(3)}{' '}
            <span className="text-[10px] font-normal">د.أ</span>
          </div>
        </div>

        {/* Card 4: Delivery Allowances (Fuel / Errands) */}
        <div className="win-raised p-2 text-center bg-amber-50 border-t-2 border-amber-600">
          <div className="text-[10px] text-amber-900 font-bold flex items-center justify-center gap-1">
            <span>⛽</span>
            <span>بدلات التوصيل (ديزل)</span>
          </div>
          <div className="text-sm font-extrabold text-amber-950 font-mono mt-0.5">
            +{grandTotals.deliveryTotal.toFixed(3)}{' '}
            <span className="text-[10px] font-normal">د.أ</span>
          </div>
        </div>

        {/* Card 5: Bonuses / Gratuities */}
        <div className="win-raised p-2 text-center bg-emerald-50 border-t-2 border-emerald-600">
          <div className="text-[10px] text-emerald-900 font-bold flex items-center justify-center gap-1">
            <span>🎁</span>
            <span>المكافآت والإكراميات</span>
          </div>
          <div className="text-sm font-extrabold text-emerald-950 font-mono mt-0.5">
            +{grandTotals.bonusTotal.toFixed(3)}{' '}
            <span className="text-[10px] font-normal">د.أ</span>
          </div>
        </div>

        {/* Card 6: Penalties & Extra Deductions */}
        <div className="win-raised p-2 text-center bg-rose-50 border-t-2 border-rose-600">
          <div className="text-[10px] text-rose-900 font-bold flex items-center justify-center gap-1">
            <span>🚨</span>
            <span>المخالفات والخصومات</span>
          </div>
          <div className="text-sm font-extrabold text-rose-950 font-mono mt-0.5">
            -{grandTotals.penaltiesTotal.toFixed(3)}{' '}
            <span className="text-[10px] font-normal">د.أ</span>
          </div>
        </div>

        {/* Card 7: Grand Net Payable */}
        <div className="win-raised p-2 text-center bg-emerald-100 border-2 border-emerald-600">
          <div className="text-[10px] text-emerald-950 font-extrabold">صافي الرواتب المستحقة</div>
          <div className="text-base font-black text-emerald-900 font-mono mt-0.5">
            {grandTotals.netTotal.toFixed(3)}{' '}
            <span className="text-[10px] font-normal">د.أ</span>
          </div>
        </div>
      </div>

      {/* 4. Filter Toolbar & Save Button */}
      <div className="win-raised p-2 bg-[#F5F3E9] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-700 font-bold">🔍 بحث:</span>
            <input
              type="text"
              placeholder="اسم الموظف أو رقمه..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="win-input text-xs px-2 py-1 w-44"
            />
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-700 font-bold">القسم:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="win-input text-xs px-1.5 py-1"
            >
              <option value="ALL">جميع الأقسام</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-700 font-bold">نوع التعيين:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="win-input text-xs px-1.5 py-1"
            >
              <option value="ALL">الكل</option>
              <option value="PERMANENT">مثبت</option>
              <option value="PROBATIONARY">تحت التجربة</option>
              <option value="DAILY_WORKER">مياومة</option>
            </select>
          </div>

          {/* Toggle only with adjustments */}
          <label className="flex items-center gap-1 text-xs text-slate-800 font-bold cursor-pointer bg-white px-2 py-1 border border-slate-300">
            <input
              type="checkbox"
              checked={onlyWithAdjustments}
              onChange={(e) => setOnlyWithAdjustments(e.target.checked)}
              className="rounded"
            />
            <span>عرض المتغيرات فقط (بدل / مكافأة / مخالفة)</span>
          </label>
        </div>

        {/* Primary Save & Dispatch Button */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSaveAndTransfer}
            disabled={isPending}
            className="win-btn font-black text-xs px-4 py-1.5 bg-[#008080] text-white hover:bg-[#006666] flex items-center gap-1.5 shadow"
          >
            <span>{isPending ? '⏳ جاري الحفظ والترحيل...' : '💾 حفظ وترحيل مسيرات الرواتب الشهرية'}</span>
          </Button>
        </div>
      </div>

      {/* 5. Main Editable Table */}
      <div className="win-sunken overflow-x-auto bg-white border border-[#7F9DB9] max-h-[calc(100vh-320px)] overflow-y-auto">
        <table className="win-table w-full text-xs text-right border-collapse select-text">
          <thead className="sticky top-0 bg-[#ECE9D8] z-10 shadow-sm text-slate-800 text-[11px]">
            <tr className="border-b border-[#7F9DB9]">
              <th className="p-1.5 w-8 text-center border-l border-slate-300">#</th>
              <th className="p-1.5 border-l border-slate-300 min-w-[150px]">الموظف</th>
              <th className="p-1.5 border-l border-slate-300 text-center min-w-[90px]">
                الدوام والغياب
              </th>
              <th className="p-1.5 border-l border-slate-300 text-center min-w-[130px] bg-blue-50/70">
                <div className="font-bold text-slate-800">الأساسي</div>
                <div className="flex items-center justify-center gap-1 text-blue-900 font-bold text-[10px] mt-0.5">
                  <span>🚌</span>
                  <span>بدل مواصلات</span>
                </div>
              </th>
              <th className="p-1.5 border-l border-slate-300 text-center min-w-[100px]">
                العمل الإضافي
              </th>
              <th className="p-1.5 border-l border-slate-300 text-center min-w-[140px] bg-amber-50/80">
                <div className="flex items-center justify-center gap-1 text-amber-950 font-bold">
                  <span>⛽</span>
                  <span>بدل توصيل (ديزل)</span>
                </div>
              </th>
              <th className="p-1.5 border-l border-slate-300 text-center min-w-[170px] bg-emerald-50/80">
                <div className="flex items-center justify-center gap-1 text-emerald-950 font-bold">
                  <span>🎁</span>
                  <span>مكافأة شهرية</span>
                </div>
              </th>
              <th className="p-1.5 border-l border-slate-300 text-center min-w-[90px]">
                خصومات الحضور
              </th>
              <th className="p-1.5 border-l border-slate-300 text-center min-w-[130px] bg-rose-50/80">
                <div className="flex items-center justify-center gap-1 text-rose-950 font-bold">
                  <span>🚨</span>
                  <span>مخالفات يومية</span>
                </div>
              </th>
              <th className="p-1.5 border-l border-slate-300 text-center min-w-[170px] bg-rose-50/80">
                <div className="flex items-center justify-center gap-1 text-rose-950 font-bold">
                  <span>🛑</span>
                  <span>خصم عقابي إضافي</span>
                </div>
              </th>
              <th className="p-1.5 border-l border-slate-300 text-center min-w-[95px]">
                الضمان والسلف
              </th>
              <th className="p-1.5 border-l border-slate-300 text-center min-w-[105px] bg-emerald-100">
                صافي الراتب
              </th>
              <th className="p-1.5 text-center min-w-[70px]">حالة المسير</th>
              <th className="p-1.5 text-center w-10">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={14} className="p-8 text-center text-slate-500 font-bold">
                  لا يوجد موظفون يطابقون خيارات البحث والتصفية المحددة.
                </td>
              </tr>
            ) : (
              filteredRows.map((r, idx) => {
                const edit = rowEdits[r.employeeId] || {
                  allowancesEarned: r.allowancesEarned,
                  deliveryAllowance: r.deliveryAllowance,
                  bonus: r.bonus,
                  bonusReason: '',
                  dailyPenalties: r.dailyPenalties,
                  otherDeductions: r.otherDeductions,
                  deductionReason: '',
                  notes: '',
                };

                return (
                  <tr
                    key={r.employeeId}
                    className={`hover:bg-blue-50/40 transition-colors ${
                      r.hasAnyAdjustments ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    {/* Index */}
                    <td className="p-1 text-center font-mono text-[11px] text-slate-500 border-l border-slate-200">
                      {idx + 1}
                    </td>

                    {/* Employee Info */}
                    <td className="p-1.5 border-l border-slate-200">
                      <div className="font-bold text-slate-900 leading-tight">{r.name}</div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                        <span className="font-mono font-bold text-blue-900">#{r.employeeNo}</span>
                        <span>•</span>
                        <span>{r.department}</span>
                        <span>•</span>
                        <Badge
                          variant={
                            r.employmentType === 'PERMANENT'
                              ? 'active'
                              : r.employmentType === 'PROBATIONARY'
                              ? 'pending'
                              : 'default'
                          }
                          className="text-[9px] px-1 py-0"
                        >
                          {r.employmentType === 'PERMANENT'
                            ? 'مثبت'
                            : r.employmentType === 'PROBATIONARY'
                            ? 'تجريبي'
                            : 'مياومة'}
                        </Badge>
                      </div>
                    </td>

                    {/* Attendance stats */}
                    <td className="p-1 border-l border-slate-200 text-center">
                      <div className="font-mono font-bold text-slate-800 text-[11px]">
                        {r.workedDays} يوم
                      </div>
                      {r.unpaidDays > 0 && (
                        <div className="text-[10px] text-red-600 font-mono">
                          غياب: {r.unpaidDays} يوم
                        </div>
                      )}
                      {(r.lateMinutes > 0 || r.earlyDepartureMinutes > 0) && (
                        <div className="text-[9px] text-slate-500 font-mono">
                          تأخير: {r.lateMinutes + r.earlyDepartureMinutes} د
                        </div>
                      )}
                    </td>

                    {/* Basic & Allowances (Editable Transportation) */}
                    <td className="p-1.5 border-l border-slate-200 text-center font-mono text-[11px] bg-blue-50/20">
                      <div className="font-bold text-slate-800 text-[11px]" title="الراتب الأساسي المستحق">{r.basicEarned.toFixed(3)}</div>
                      <div className="flex items-center justify-center gap-1 mt-1" title="بدل المواصلات الشهري (قابل للتعديل)">
                        <span className="text-[10px] text-slate-500 font-sans">مواصلات:</span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          disabled={r.employmentType === 'DAILY_WORKER'}
                          value={edit.allowancesEarned === 0 && r.employmentType === 'DAILY_WORKER' ? '0' : (edit.allowancesEarned ?? '')}
                          placeholder="0.000"
                          onChange={(e) =>
                            handleFieldChange(
                              r.employeeId,
                              'allowancesEarned',
                              e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                            )
                          }
                          className={`win-input font-mono font-bold text-[11px] w-16 px-1 py-0.5 text-center border ${
                            Math.abs((edit.allowancesEarned ?? r.allowancesEarned) - r.allowancesEarned) > 0.001
                              ? 'border-amber-500 bg-amber-50 text-amber-950 font-black'
                              : 'border-blue-300 bg-white text-blue-950'
                          }`}
                        />
                        <span className="text-[10px] text-slate-500">د.أ</span>
                      </div>
                    </td>

                    {/* Overtime */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono text-[11px]">
                      {r.otHours > 0 ? (
                        <>
                          <div className="font-bold text-indigo-700">+{r.otTotal.toFixed(3)}</div>
                          <div className="text-[10px] text-slate-500">
                            {r.otHours.toFixed(1)} س × {r.otRate.toFixed(2)}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* ⛽ Delivery Allowance (Editable) */}
                    <td className="p-1.5 border-l border-slate-200 bg-amber-50/40">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={edit.deliveryAllowance === 0 ? '' : edit.deliveryAllowance}
                          placeholder="0.000"
                          onChange={(e) =>
                            handleFieldChange(
                              r.employeeId,
                              'deliveryAllowance',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="win-input font-mono font-bold text-xs text-amber-950 w-20 px-1 py-0.5 text-left border border-amber-300"
                        />
                        <span className="text-[10px] text-slate-500">د.أ</span>
                      </div>
                      {/* Show link to inspect daily attendance delivery entries if any */}
                      {r.deliveryDetails.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setInspectModal({
                              type: 'DELIVERY',
                              employeeName: r.name,
                              items: r.deliveryDetails,
                            })
                          }
                          className="text-[10px] text-amber-800 hover:underline flex items-center gap-0.5 mt-0.5"
                          title="عرض تفاصيل مشاوير إحضار الديزل والطلبات المسجلة بالحضور"
                        >
                          <span>⛽</span>
                          <span>({r.deliveryDetails.length} مشوار مسجل)</span>
                        </button>
                      )}
                    </td>

                    {/* 🎁 Monthly Bonus (Editable) */}
                    <td className="p-1.5 border-l border-slate-200 bg-emerald-50/40">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={edit.bonus === 0 ? '' : edit.bonus}
                          placeholder="0.000"
                          onChange={(e) =>
                            handleFieldChange(
                              r.employeeId,
                              'bonus',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="win-input font-mono font-bold text-xs text-emerald-950 w-20 px-1 py-0.5 text-left border border-emerald-300"
                        />
                        <span className="text-[10px] text-slate-500">د.أ</span>
                      </div>
                      <input
                        type="text"
                        value={edit.bonusReason}
                        placeholder="سبب المكافأة (مثال: إنجاز متميز)..."
                        onChange={(e) =>
                          handleFieldChange(r.employeeId, 'bonusReason', e.target.value)
                        }
                        className="win-input text-[10px] w-full px-1 py-0.5 mt-0.5 border border-emerald-200"
                      />
                    </td>

                    {/* Attendance Deductions (Absence + Late + Early) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono text-[11px]">
                      {r.totalAttendanceDeductions > 0 ? (
                        <div className="text-red-700 font-bold">
                          -{r.totalAttendanceDeductions.toFixed(3)}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* 🚨 Daily Penalties from Attendance (Editable) */}
                    <td className="p-1.5 border-l border-slate-200 bg-rose-50/40">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={edit.dailyPenalties === 0 ? '' : edit.dailyPenalties}
                          placeholder="0.000"
                          onChange={(e) =>
                            handleFieldChange(
                              r.employeeId,
                              'dailyPenalties',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="win-input font-mono font-bold text-xs text-rose-950 w-20 px-1 py-0.5 text-left border border-rose-300"
                        />
                        <span className="text-[10px] text-slate-500">د.أ</span>
                      </div>
                      {/* Show link to inspect daily attendance violations if any */}
                      {r.penaltyDetails.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setInspectModal({
                              type: 'PENALTY',
                              employeeName: r.name,
                              items: r.penaltyDetails,
                            })
                          }
                          className="text-[10px] text-rose-800 hover:underline flex items-center gap-0.5 mt-0.5"
                          title="عرض تفاصيل المخالفات المسجلة في كشف الحضور لهذا الشهر"
                        >
                          <span>🚨</span>
                          <span>({r.penaltyDetails.length} مخالفة مسجلة)</span>
                        </button>
                      )}
                    </td>

                    {/* 🛑 Extra Disciplinary Deductions (Editable) */}
                    <td className="p-1.5 border-l border-slate-200 bg-rose-50/40">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={edit.otherDeductions === 0 ? '' : edit.otherDeductions}
                          placeholder="0.000"
                          onChange={(e) =>
                            handleFieldChange(
                              r.employeeId,
                              'otherDeductions',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="win-input font-mono font-bold text-xs text-rose-950 w-20 px-1 py-0.5 text-left border border-rose-300"
                        />
                        <span className="text-[10px] text-slate-500">د.أ</span>
                      </div>
                      <input
                        type="text"
                        value={edit.deductionReason}
                        placeholder="سبب الخصم العقابي..."
                        onChange={(e) =>
                          handleFieldChange(r.employeeId, 'deductionReason', e.target.value)
                        }
                        className="win-input text-[10px] w-full px-1 py-0.5 mt-0.5 border border-rose-200"
                      />
                    </td>

                    {/* Statutory Deductions (Social Security & Loans) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono text-[11px]">
                      {r.totalStatutoryDeductions > 0 ? (
                        <>
                          <div className="text-slate-800 font-bold">
                            -{r.totalStatutoryDeductions.toFixed(3)}
                          </div>
                          <div className="text-[9px] text-slate-500">
                            ضمان: {r.socialSecurityDeduction.toFixed(2)} | سلف: {r.loanDeduction.toFixed(2)}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Live Net Pay */}
                    <td className="p-1 border-l border-slate-200 text-center bg-emerald-50">
                      <div className="font-mono font-black text-sm text-emerald-950">
                        {r.netPay.toFixed(3)}
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">
                        إجمالي: {r.totalEarnings.toFixed(2)} - استقطاع: {r.totalDeductions.toFixed(2)}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-1 border-l border-slate-200 text-center">
                      <Badge
                        variant={
                          r.payrollStatus === 'APPROVED' || r.payrollStatus === 'PAID'
                            ? 'approved'
                            : r.payrollStatus === 'DRAFT'
                            ? 'draft'
                            : 'default'
                        }
                        className="text-[10px] px-1"
                      >
                        {r.payrollStatus === 'APPROVED'
                          ? 'معتمد'
                          : r.payrollStatus === 'PAID'
                          ? 'مدفوع'
                          : r.payrollStatus === 'DRAFT'
                          ? 'مسودة'
                          : 'لم يولد'}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="p-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleResetRow(r.employeeId)}
                        className="win-btn text-[10px] px-1 py-0.5 text-slate-700"
                        title="إعادة تعيين إلى القيم الافتراضية المحسوبة"
                      >
                        ↺
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 6. Footer Action Bar */}
      <div className="win-raised p-2 bg-[#ECE9D8] flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="text-xs text-slate-700">
          <span>يتم احتساب الراتب الإضافي تلقائياً (الساعة بساعتين بناءً على الراتب الأساسي).</span>{' '}
          <span className="font-bold text-amber-900">
            بدلات التوصيل والمخالفات اليومية المسجلة من كشف الحضور تم جلبها تلقائياً مع إمكانية تعديلها.
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSaveAndTransfer}
            disabled={isPending}
            className="win-btn font-black text-xs px-5 py-2 bg-[#008080] text-white hover:bg-[#006666] flex items-center gap-1.5 shadow-md"
          >
            <span>{isPending ? '⏳ جاري الحفظ والترحيل...' : '💾 حفظ وترحيل مسيرات الرواتب الشهرية'}</span>
          </Button>
        </div>
      </div>

      {/* 7. Modal for inspecting Daily Penalty or Delivery items */}
      {inspectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="win-raised bg-[#ECE9D8] w-full max-w-md shadow-2xl border-2 border-white">
            <div className="win-titlebar flex justify-between items-center p-1.5 bg-[#0A246A] text-white">
              <span className="font-bold text-xs flex items-center gap-1">
                <span>{inspectModal.type === 'DELIVERY' ? '⛽' : '🚨'}</span>
                <span>
                  {inspectModal.type === 'DELIVERY'
                    ? `تفاصيل مشاوير إحضار الديزل / التوصيل: ${inspectModal.employeeName}`
                    : `تفاصيل المخالفات المسجلة: ${inspectModal.employeeName}`}
                </span>
              </span>
              <button
                onClick={() => setInspectModal(null)}
                className="win-box-btn px-1.5 py-0 text-white font-bold"
              >
                ×
              </button>
            </div>

            <div className="p-3 space-y-2 text-xs">
              <p className="text-slate-700 text-[11px]">
                {inspectModal.type === 'DELIVERY'
                  ? 'هذه المشاوير تم تسجيلها مباشرة من كشف الحضور اليومي للمصنع أثناء إرسال العامل لإحضار الديزل للرافعة الشوكية:'
                  : 'هذه المخالفات تم قيدها على العامل في كشف الحضور اليومي:'}
              </p>

              <div className="win-sunken bg-white p-2 max-h-60 overflow-y-auto space-y-1.5 border border-slate-300">
                {inspectModal.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-1.5 bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div>
                      <div className="font-bold font-mono text-blue-900">{item.date}</div>
                      <div className="text-slate-600 text-[11px] mt-0.5">{item.reason}</div>
                    </div>
                    <div className="font-bold font-mono text-sm text-slate-900">
                      {item.amount.toFixed(3)} د.أ
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-300">
                <span className="font-bold text-slate-800">
                  إجمالي المبلغ المسجل في كشف الحضور:
                </span>
                <span className="font-mono font-black text-sm text-blue-900">
                  {inspectModal.items.reduce((a, b) => a + b.amount, 0).toFixed(3)} د.أ
                </span>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={() => setInspectModal(null)}
                  className="win-btn font-bold text-xs px-4 py-1"
                >
                  إغلاق
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
