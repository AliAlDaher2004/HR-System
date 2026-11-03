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
  ) => Promise<{
    success: boolean;
    savedCount: number;
    approvedCount?: number;
    errors?: string[];
    month: string;
  }>;
}

interface EditableFields {
  basicEarned: number;
  allowancesEarned: number;
  deliveryAllowance: number;
  bonus: number;
  bonusReason: string;
  otherAdditions: number;
  otHours: number;
  socialSecurity: number;
  loans: number;
  unpaidDays: number;
  earlyDepartureHours: number;
  lateHours: number;
  dailyPenalties: number;
  otherDeductions: number;
  deductionReason: string;
  notes: string;
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
  const [rowEdits, setRowEdits] = useState<Record<string, EditableFields>>(() => {
    const init: Record<string, EditableFields> = {};
    initialRows.forEach((r) => {
      init[r.employeeId] = {
        basicEarned: r.basicEarned,
        allowancesEarned: r.allowancesEarned,
        deliveryAllowance: r.deliveryAllowance,
        bonus: r.bonus,
        bonusReason: r.bonusReason || '',
        otherAdditions: r.otherAdditions || 0,
        otHours: r.otHours || 0,
        socialSecurity: r.socialSecurityDeduction || 0,
        loans: r.loanDeduction || 0,
        unpaidDays: r.unpaidDays || 0,
        earlyDepartureHours: r.earlyDepartureHours || 0,
        lateHours: r.lateHours || 0,
        dailyPenalties: r.dailyPenalties || 0,
        otherDeductions: r.otherDeductions || 0,
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
    field: keyof EditableFields,
    value: any
  ) => {
    setRowEdits((prev) => {
      const current = prev[empId];
      const updated = {
        ...current,
        [field]: value,
      };

      // Auto update social security if basic salary changed and employee is registered
      if (field === 'basicEarned') {
        const emp = initialRows.find((r) => r.employeeId === empId);
        if (emp?.socialSecurityRegistered) {
          const numBasic = Number(value) || 0;
          updated.socialSecurity = Math.round(numBasic * 0.075 * 1000) / 1000;
        }
      }

      return {
        ...prev,
        [empId]: updated,
      };
    });
  };

  // Reset row to attendance defaults
  const handleResetRow = (empId: string) => {
    const original = initialRows.find((r) => r.employeeId === empId);
    if (!original) return;
    setRowEdits((prev) => ({
      ...prev,
      [empId]: {
        basicEarned: original.basicEarned,
        allowancesEarned: original.allowancesEarned,
        deliveryAllowance: original.deliveryDetails.reduce((a, b) => a + b.amount, 0),
        bonus: 0,
        bonusReason: '',
        otherAdditions: 0,
        otHours: original.otHours,
        socialSecurity: original.socialSecurityDeduction,
        loans: original.loanDeduction,
        unpaidDays: original.unpaidDays,
        earlyDepartureHours: original.earlyDepartureHours,
        lateHours: original.lateHours,
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
        basicEarned: r.basicEarned,
        allowancesEarned: r.allowancesEarned,
        deliveryAllowance: r.deliveryAllowance,
        bonus: r.bonus,
        bonusReason: '',
        otherAdditions: r.otherAdditions,
        otHours: r.otHours,
        socialSecurity: r.socialSecurityDeduction,
        loans: r.loanDeduction,
        unpaidDays: r.unpaidDays,
        earlyDepartureHours: r.earlyDepartureHours,
        lateHours: r.lateHours,
        dailyPenalties: r.dailyPenalties,
        otherDeductions: r.otherDeductions,
        deductionReason: '',
        notes: '',
      };

      const basicEarned = Number(edit.basicEarned) || 0;
      const allowancesEarned = Number(edit.allowancesEarned) || 0;
      const deliveryAllowance = Number(edit.deliveryAllowance) || 0;
      const bonus = Number(edit.bonus) || 0;
      const otherAdditions = Number(edit.otherAdditions) || 0;
      const otHours = Number(edit.otHours) || 0;

      // Rate calculations
      const calculatedOtRate = r.employmentType === 'DAILY_WORKER'
        ? (r.otRate > 0 ? r.otRate : 0)
        : (basicEarned > 0 ? Math.round((basicEarned / 120) * 1000) / 1000 : 0);
      const otRate = r.otRate > 0 && r.employmentType === 'DAILY_WORKER' ? r.otRate : calculatedOtRate;
      const otTotal = Math.round(otHours * otRate * 1000) / 1000;

      // Gross additions
      const grossEarnings = Math.round((basicEarned + allowancesEarned + deliveryAllowance + bonus + otherAdditions + otTotal) * 1000) / 1000;

      // Deductions
      const socialSecurity = Number(edit.socialSecurity) || 0;
      const loans = Number(edit.loans) || 0;
      const unpaidDays = Number(edit.unpaidDays) || 0;
      const unpaidDeduction = r.employmentType === 'DAILY_WORKER' ? 0 : Math.round(unpaidDays * (basicEarned / 30) * 1000) / 1000;

      const hourlyRate = basicEarned > 0 ? (basicEarned / 240) : 0;
      const earlyDepartureHours = Number(edit.earlyDepartureHours) || 0;
      const earlyDepartureDeduction = Math.round(earlyDepartureHours * hourlyRate * 1000) / 1000;

      const lateHours = Number(edit.lateHours) || 0;
      const lateDeduction = Math.round(lateHours * hourlyRate * 1000) / 1000;

      const otherDeductions = Math.round(((Number(edit.dailyPenalties) || 0) + (Number(edit.otherDeductions) || 0)) * 1000) / 1000;

      const totalDeductions = Math.round(
        (socialSecurity + loans + unpaidDeduction + earlyDepartureDeduction + lateDeduction + otherDeductions) * 1000
      ) / 1000;

      const netPay = Math.round((grossEarnings - totalDeductions) * 1000) / 1000;

      // Check if modified
      const hasBasicChange = Math.abs(basicEarned - r.basicEarned) > 0.001;
      const hasAllowanceChange = Math.abs(allowancesEarned - r.allowancesEarned) > 0.001;
      const hasDelivery = deliveryAllowance > 0;
      const hasBonus = bonus > 0;
      const hasOtherAdditions = otherAdditions > 0;
      const hasOtChange = Math.abs(otHours - r.otHours) > 0.001;
      const hasLoanChange = Math.abs(loans - r.loanDeduction) > 0.001;
      const hasAbsenceChange = Math.abs(unpaidDays - r.unpaidDays) > 0.001;
      const hasEarlyDepChange = Math.abs(earlyDepartureHours - r.earlyDepartureHours) > 0.001;
      const hasLateChange = Math.abs(lateHours - r.lateHours) > 0.001;
      const hasPenalties = otherDeductions > 0;

      const hasAnyAdjustments =
        hasBasicChange ||
        hasAllowanceChange ||
        hasDelivery ||
        hasBonus ||
        hasOtherAdditions ||
        hasOtChange ||
        hasLoanChange ||
        hasAbsenceChange ||
        hasEarlyDepChange ||
        hasLateChange ||
        hasPenalties;

      return {
        ...r,
        basicEarned,
        allowancesEarned,
        deliveryAllowance,
        bonus,
        otherAdditions,
        otHours,
        otRate,
        otTotal,
        grossEarnings,
        socialSecurity,
        loans,
        unpaidDays,
        unpaidDeduction,
        earlyDepartureHours,
        earlyDepartureDeduction,
        lateHours,
        lateDeduction,
        otherDeductions,
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

  // Grand totals across all active employees
  const grandTotals = useMemo(() => {
    return calculatedRows.reduce(
      (acc, r) => ({
        count: acc.count + 1,
        basicEarned: acc.basicEarned + r.basicEarned,
        allowancesEarned: acc.allowancesEarned + r.allowancesEarned,
        deliveryAllowance: acc.deliveryAllowance + r.deliveryAllowance,
        bonus: acc.bonus + r.bonus,
        otherAdditions: acc.otherAdditions + r.otherAdditions,
        otHours: acc.otHours + r.otHours,
        otTotal: acc.otTotal + r.otTotal,
        grossEarnings: acc.grossEarnings + r.grossEarnings,
        socialSecurity: acc.socialSecurity + r.socialSecurity,
        loans: acc.loans + r.loans,
        unpaidDays: acc.unpaidDays + r.unpaidDays,
        unpaidDeduction: acc.unpaidDeduction + r.unpaidDeduction,
        earlyDepartureHours: acc.earlyDepartureHours + r.earlyDepartureHours,
        earlyDepartureDeduction: acc.earlyDepartureDeduction + r.earlyDepartureDeduction,
        lateHours: acc.lateHours + r.lateHours,
        lateDeduction: acc.lateDeduction + r.lateDeduction,
        otherDeductions: acc.otherDeductions + r.otherDeductions,
        totalDeductions: acc.totalDeductions + r.totalDeductions,
        netPay: acc.netPay + r.netPay,
      }),
      {
        count: 0,
        basicEarned: 0,
        allowancesEarned: 0,
        deliveryAllowance: 0,
        bonus: 0,
        otherAdditions: 0,
        otHours: 0,
        otTotal: 0,
        grossEarnings: 0,
        socialSecurity: 0,
        loans: 0,
        unpaidDays: 0,
        unpaidDeduction: 0,
        earlyDepartureHours: 0,
        earlyDepartureDeduction: 0,
        lateHours: 0,
        lateDeduction: 0,
        otherDeductions: 0,
        totalDeductions: 0,
        netPay: 0,
      }
    );
  }, [calculatedRows]);

  // Save handler (either draft or approved)
  const handleSave = (targetStatus: 'DRAFT' | 'APPROVED') => {
    setSaveErrorMsg(null);
    setSaveSuccessMsg(null);

    const payload: SaveAdjustmentItem[] = initialRows.map((r) => {
      const edit = rowEdits[r.employeeId] || {
        basicEarned: r.basicEarned,
        allowancesEarned: r.allowancesEarned,
        deliveryAllowance: r.deliveryAllowance,
        bonus: r.bonus,
        bonusReason: '',
        otherAdditions: r.otherAdditions,
        otHours: r.otHours,
        socialSecurity: r.socialSecurityDeduction,
        loans: r.loanDeduction,
        unpaidDays: r.unpaidDays,
        earlyDepartureHours: r.earlyDepartureHours,
        lateHours: r.lateHours,
        dailyPenalties: r.dailyPenalties,
        otherDeductions: r.otherDeductions,
        deductionReason: '',
        notes: '',
      };

      return {
        employeeId: r.employeeId,
        basicEarned: Number(edit.basicEarned) || 0,
        allowancesEarned: Number(edit.allowancesEarned) || 0,
        deliveryAllowance: Number(edit.deliveryAllowance) || 0,
        bonus: Number(edit.bonus) || 0,
        bonusReason: edit.bonusReason?.trim() || undefined,
        otherAdditions: Number(edit.otherAdditions) || 0,
        otHours: Number(edit.otHours) || 0,
        socialSecurityDeduction: Number(edit.socialSecurity) || 0,
        loanDeduction: Number(edit.loans) || 0,
        unpaidDays: Number(edit.unpaidDays) || 0,
        earlyDepartureHours: Number(edit.earlyDepartureHours) || 0,
        lateHours: Number(edit.lateHours) || 0,
        dailyPenalties: Number(edit.dailyPenalties) || 0,
        otherDeductions: Number(edit.otherDeductions) || 0,
        deductionReason: edit.deductionReason?.trim() || undefined,
        notes: edit.notes?.trim() || undefined,
        status: targetStatus,
      };
    });

    startTransition(async () => {
      try {
        const res = await saveAction(month, payload);
        if (res.success) {
          if (targetStatus === 'APPROVED') {
            setSaveSuccessMsg(
              `تم حفظ وترحيل واعتماد مسيرات الرواتب لشهر (${month}) بنجاح! تم حفظ (${res.savedCount}) مسير واعتماد (${res.approvedCount || 0}) كشف راتب نهائي.`
            );
          } else {
            setSaveSuccessMsg(
              `تم حفظ وترحيل مسيرات الرواتب كمسودات (DRAFT) لشهر (${month}) بنجاح لـ (${res.savedCount}) موظف.`
            );
          }

          if (res.errors && res.errors.length > 0) {
            setSaveErrorMsg(`ملاحظة أثناء الاعتماد:\n${res.errors.slice(0, 3).join('\n')}`);
          }
        } else {
          setSaveErrorMsg('حدث خطأ أثناء حفظ المسيرات.');
        }
      } catch (err: any) {
        setSaveErrorMsg(err.message || 'حدث خطأ أثناء حفظ المسيرات.');
      }
    });
  };

  // Cell helper for display
  const formatCell = (val: number) => {
    return val > 0 ? val.toFixed(2) : '-';
  };

  return (
    <div className="space-y-3 select-none font-sans" dir="rtl">
      {/* 1. Header Toolbar */}
      <div className="win-raised p-2.5 bg-[#ECE9D8] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">📑</span>
          <div>
            <h1 className="text-sm font-black text-[#0A246A]">
              إعداد ومراجعة متغيرات ومسيرات الرواتب
            </h1>
            <p className="text-[11px] text-slate-600">
              جدول الـ 21 عموداً الرسمي المطابق لبيان الرواتب مع الحفظ والترحيل والاعتماد اللحظي
            </p>
          </div>
        </div>

        {/* Month Selector Controls */}
        <div className="flex items-center gap-1.5 bg-white px-2 py-1 border border-[#7F9DB9] rounded">
          <span className="text-xs font-bold text-slate-700">الشهر المستهدف:</span>
          <button
            onClick={handlePrevMonth}
            className="win-box-btn px-2 py-0.5 text-xs font-bold hover:bg-slate-200"
            title="الشهر السابق"
          >
            ▶
          </button>
          <input
            type="month"
            value={month}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="win-input text-xs font-mono font-bold px-1.5 py-0.5 border-none"
          />
          <button
            onClick={handleNextMonth}
            className="win-box-btn px-2 py-0.5 text-xs font-bold hover:bg-slate-200"
            title="الشهر التالي"
          >
            ◀
          </button>
          <button
            onClick={handleCurrentMonth}
            className="win-btn text-[10px] px-2 py-0.5 font-bold"
          >
            الحالي
          </button>
        </div>

        {/* Quick Nav Links */}
        <div className="flex items-center gap-1.5">
          <Link
            href={`/payroll/consolidated?month=${month}`}
            className="win-btn text-xs font-bold px-3 py-1 bg-white hover:bg-blue-50 text-blue-900 flex items-center gap-1 border border-blue-300"
          >
            <span>📊</span>
            <span>عرض بيان الرواتب المجمع</span>
          </Link>
          <Link
            href="/payroll"
            className="win-btn text-xs font-bold px-3 py-1 bg-white hover:bg-slate-100 text-slate-800"
          >
            <span>قائمة الرواتب</span>
          </Link>
        </div>
      </div>

      {/* 2. Notifications & Status Alerts */}
      {saveSuccessMsg && (
        <div className="win-raised p-2 bg-emerald-50 border-emerald-500 text-emerald-950 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{saveSuccessMsg}</span>
          </div>
          <button
            onClick={() => setSaveSuccessMsg(null)}
            className="win-box-btn px-1.5 py-0 text-slate-700"
          >
            ×
          </button>
        </div>
      )}

      {saveErrorMsg && (
        <div className="win-raised p-2 bg-rose-50 border-rose-500 text-rose-950 text-xs font-bold flex items-center justify-between whitespace-pre-line">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{saveErrorMsg}</span>
          </div>
          <button
            onClick={() => setSaveErrorMsg(null)}
            className="win-box-btn px-1.5 py-0 text-slate-700"
          >
            ×
          </button>
        </div>
      )}

      {/* 3. Filter Toolbar & Dual Action Buttons */}
      <div className="win-raised p-2 bg-[#F5F3E9] flex flex-wrap items-center justify-between gap-2 border border-[#7F9DB9]">
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
            <span className="text-xs text-slate-700 font-bold">التعيين:</span>
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
            <span>عرض المعدّلين فقط</span>
          </label>
        </div>

        {/* Dual Save & Transfer & Approve Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleSave('DRAFT')}
            disabled={isPending}
            className="win-btn font-bold text-xs px-3 py-1.5 bg-[#ECE9D8] text-slate-900 hover:bg-slate-200 border border-slate-400 flex items-center gap-1"
            title="حفظ التعديلات كمسودات تمهيداً للمراجعة"
          >
            <span>{isPending ? '⏳ جاري الحفظ...' : '💾 حفظ وترحيل (مسودة DRAFT)'}</span>
          </Button>

          <Button
            onClick={() => handleSave('APPROVED')}
            disabled={isPending}
            className="win-btn font-black text-xs px-4 py-1.5 bg-[#008080] text-white hover:bg-[#006666] flex items-center gap-1.5 shadow"
            title="حفظ وترحيل واعتماد المسيرات رسمياً وتجميد الصافي المستحق"
          >
            <span>{isPending ? '⏳ جاري الترحيل والاعتماد...' : '✅ حفظ وترحيل واعتماد (APPROVED)'}</span>
          </Button>
        </div>
      </div>

      {/* 4. Main 21-Column Editable Table */}
      <div className="win-sunken overflow-x-auto bg-white border border-[#7F9DB9] max-h-[calc(100vh-270px)] overflow-y-auto">
        <table className="win-table w-full text-xs text-right border-collapse select-text">
          <thead className="sticky top-0 z-20 shadow-sm text-slate-800 text-[11px]">
            {/* Row 1: High Level Group Headers */}
            <tr className="border-b border-slate-400">
              <th colSpan={3} className="bg-slate-800 text-white font-bold p-1 border-l border-slate-600 text-center">
                بيانات الموظف
              </th>
              <th colSpan={8} className="bg-[#1D4ED8] text-white font-black p-1 border-l border-blue-400 text-center">
                الإضافات
              </th>
              <th colSpan={10} className="bg-[#1D4ED8] text-white font-black p-1 border-l border-blue-400 text-center">
                الخصومات
              </th>
              <th colSpan={1} className="bg-[#0A246A] text-white font-black p-1 border-l border-slate-900 text-center">
                الصافي النهائي
              </th>
              <th colSpan={2} className="bg-slate-700 text-white font-bold p-1 text-center">
                الحالة والإجراء
              </th>
            </tr>

            {/* Row 2: Specific 21 Columns matching official Excel sheet */}
            <tr className="bg-[#ECE9D8] text-slate-900 font-bold border-b border-[#7F9DB9] text-[10.5px]">
              <th className="p-1 text-center w-7 border-l border-slate-300">#</th>
              <th className="p-1 border-l border-slate-300 min-w-[70px] text-center">الرقم الوظيفي</th>
              <th className="p-1 border-l border-slate-300 min-w-[130px]">الإسم</th>

              {/* Additions (8 columns) */}
              <th className="p-1 border-l border-slate-300 min-w-[70px] text-center bg-blue-50/80">الراتب الأساسي</th>
              <th className="p-1 border-l border-slate-300 min-w-[75px] text-center bg-blue-50/80">مكافأة مواصلات أيام عمل</th>
              <th className="p-1 border-l border-slate-300 min-w-[65px] text-center bg-blue-50/80">بدل توصيل</th>
              <th className="p-1 border-l border-slate-300 min-w-[65px] text-center bg-blue-50/80">اكراميات</th>
              <th className="p-1 border-l border-slate-300 min-w-[65px] text-center bg-blue-50/80">اضافات اخرى</th>
              <th className="p-1 border-l border-slate-300 min-w-[65px] text-center bg-blue-50/80">ساعات عمل إضافي</th>
              <th className="p-1 border-l border-slate-300 min-w-[65px] text-center bg-blue-50/80">بدل إضافي</th>
              <th className="p-1 border-l border-slate-300 min-w-[75px] text-center bg-blue-100 font-black text-blue-950">اجمالي الراتب</th>

              {/* Deductions (10 columns) */}
              <th className="p-1 border-l border-slate-300 min-w-[65px] text-center bg-rose-50/60">ضمان اجتماعي</th>
              <th className="p-1 border-l border-slate-300 min-w-[60px] text-center bg-rose-50/60">السلف</th>
              <th className="p-1 border-l border-slate-300 min-w-[55px] text-center bg-rose-50/60">عدد أيام الغياب</th>
              <th className="p-1 border-l border-slate-300 min-w-[65px] text-center bg-rose-50/60">خصم الغياب</th>
              <th className="p-1 border-l border-slate-300 min-w-[55px] text-center bg-rose-50/60">ساعات مغادرة</th>
              <th className="p-1 border-l border-slate-300 min-w-[65px] text-center bg-rose-50/60">خصم مغادرة</th>
              <th className="p-1 border-l border-slate-300 min-w-[55px] text-center bg-rose-50/60">ساعات التاخير</th>
              <th className="p-1 border-l border-slate-300 min-w-[65px] text-center bg-rose-50/60">خصم تاخير</th>
              <th className="p-1 border-l border-slate-300 min-w-[65px] text-center bg-rose-50/60">خصومات أخرى</th>
              <th className="p-1 border-l border-slate-300 min-w-[75px] text-center bg-rose-100 font-black text-rose-950">اجمالي الخصومات</th>

              {/* Net (1 column) */}
              <th className="p-1 border-l border-slate-300 min-w-[85px] text-center bg-[#0A246A] text-white font-black">اجمالي الراتب</th>

              {/* Meta */}
              <th className="p-1 text-center min-w-[65px] border-l border-slate-300">الحالة</th>
              <th className="p-1 text-center w-14">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={23} className="p-8 text-center text-slate-500 font-bold">
                  لا يوجد موظفون يطابقون خيارات البحث والتصفية المحددة.
                </td>
              </tr>
            ) : (
              filteredRows.map((r, idx) => {
                const edit = rowEdits[r.employeeId] || {
                  basicEarned: r.basicEarned,
                  allowancesEarned: r.allowancesEarned,
                  deliveryAllowance: r.deliveryAllowance,
                  bonus: r.bonus,
                  bonusReason: '',
                  otherAdditions: r.otherAdditions,
                  otHours: r.otHours,
                  socialSecurity: r.socialSecurityDeduction,
                  loans: r.loanDeduction,
                  unpaidDays: r.unpaidDays,
                  earlyDepartureHours: r.earlyDepartureHours,
                  lateHours: r.lateHours,
                  dailyPenalties: r.dailyPenalties,
                  otherDeductions: r.otherDeductions,
                  deductionReason: '',
                  notes: '',
                };

                return (
                  <tr
                    key={r.employeeId}
                    className={`hover:bg-blue-50/50 transition-colors ${
                      r.hasAnyAdjustments ? 'bg-amber-50/25' : ''
                    }`}
                  >
                    {/* Index */}
                    <td className="p-1 text-center font-mono text-[10px] text-slate-500 border-l border-slate-200">
                      {idx + 1}
                    </td>

                    {/* Employee No */}
                    <td className="p-1 text-center font-mono font-bold text-slate-800 border-l border-slate-200 text-[11px]">
                      {r.employeeNo}
                    </td>

                    {/* Employee Name */}
                    <td className="p-1.5 border-l border-slate-200">
                      <div className="font-bold text-slate-900 leading-tight truncate max-w-[140px]" title={r.name}>
                        {r.name}
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-slate-500 mt-0.5">
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
                          className="text-[8px] px-1 py-0"
                        >
                          {r.employmentType === 'PERMANENT' ? 'مثبت' : r.employmentType === 'PROBATIONARY' ? 'تجريبي' : 'مياومة'}
                        </Badge>
                      </div>
                    </td>

                    {/* 1. Basic Salary (Editable) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono bg-blue-50/20">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={edit.basicEarned === 0 ? '' : edit.basicEarned}
                        placeholder="0.00"
                        onChange={(e) =>
                          handleFieldChange(
                            r.employeeId,
                            'basicEarned',
                            e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                          )
                        }
                        className={`win-input font-mono font-bold text-[11px] w-16 px-1 py-0.5 text-center border ${
                          Math.abs(edit.basicEarned - r.basicEarned) > 0.001
                            ? 'border-amber-500 bg-amber-50 text-amber-950 font-black'
                            : 'border-slate-300 bg-white text-slate-900'
                        }`}
                      />
                    </td>

                    {/* 2. Transportation Allowance (Editable) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono bg-blue-50/20">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        disabled={r.employmentType === 'DAILY_WORKER'}
                        value={edit.allowancesEarned === 0 && r.employmentType === 'DAILY_WORKER' ? '0' : (edit.allowancesEarned === 0 ? '' : edit.allowancesEarned)}
                        placeholder="0.00"
                        onChange={(e) =>
                          handleFieldChange(
                            r.employeeId,
                            'allowancesEarned',
                            e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                          )
                        }
                        className={`win-input font-mono font-bold text-[11px] w-14 px-1 py-0.5 text-center border ${
                          Math.abs(edit.allowancesEarned - r.allowancesEarned) > 0.001
                            ? 'border-amber-500 bg-amber-50 text-amber-950 font-black'
                            : 'border-slate-300 bg-white text-slate-900'
                        }`}
                      />
                    </td>

                    {/* 3. Delivery Allowance (Editable) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono bg-blue-50/20">
                      <div className="flex items-center justify-center gap-0.5">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={edit.deliveryAllowance === 0 ? '' : edit.deliveryAllowance}
                          placeholder="-"
                          onChange={(e) =>
                            handleFieldChange(
                              r.employeeId,
                              'deliveryAllowance',
                              e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                            )
                          }
                          className="win-input font-mono font-bold text-[11px] w-14 px-1 py-0.5 text-center border border-amber-300 bg-amber-50/40 text-amber-950"
                        />
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
                            className="text-[10px] text-amber-800 hover:text-amber-950 font-bold"
                            title="عرض تفاصيل مشاوير التوصيل اليومية"
                          >
                            ⛽
                          </button>
                        )}
                      </div>
                    </td>

                    {/* 4. Gratuities / Bonus (Editable) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono bg-blue-50/20">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={edit.bonus === 0 ? '' : edit.bonus}
                        placeholder="-"
                        onChange={(e) =>
                          handleFieldChange(
                            r.employeeId,
                            'bonus',
                            e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                          )
                        }
                        className="win-input font-mono font-bold text-[11px] w-14 px-1 py-0.5 text-center border border-emerald-300 bg-emerald-50/40 text-emerald-950"
                      />
                    </td>

                    {/* 5. Other Additions (Editable) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono bg-blue-50/20">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={edit.otherAdditions === 0 ? '' : edit.otherAdditions}
                        placeholder="-"
                        onChange={(e) =>
                          handleFieldChange(
                            r.employeeId,
                            'otherAdditions',
                            e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                          )
                        }
                        className="win-input font-mono font-bold text-[11px] w-14 px-1 py-0.5 text-center border border-blue-300 bg-blue-50/30 text-blue-950"
                      />
                    </td>

                    {/* 6. Overtime Hours (Editable) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono bg-blue-50/20">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={edit.otHours === 0 ? '' : edit.otHours}
                        placeholder="-"
                        onChange={(e) =>
                          handleFieldChange(
                            r.employeeId,
                            'otHours',
                            e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                          )
                        }
                        className="win-input font-mono font-bold text-[11px] w-14 px-1 py-0.5 text-center border border-indigo-300 bg-indigo-50/30 text-indigo-950"
                      />
                    </td>

                    {/* 7. Overtime Amount (Formula: otHours * otRate) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono font-bold text-emerald-700 bg-blue-50/30 text-[11px]">
                      {r.otTotal > 0 ? r.otTotal.toFixed(2) : '-'}
                    </td>

                    {/* 8. Total Earnings (Sum of columns 1..7) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono font-black text-blue-950 bg-blue-100 text-[11px]">
                      {r.grossEarnings.toFixed(2)}
                    </td>

                    {/* 9. Social Security (Editable / Auto) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono bg-rose-50/20">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={edit.socialSecurity === 0 ? '' : edit.socialSecurity}
                        placeholder="-"
                        onChange={(e) =>
                          handleFieldChange(
                            r.employeeId,
                            'socialSecurity',
                            e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                          )
                        }
                        className="win-input font-mono font-bold text-[11px] w-14 px-1 py-0.5 text-center border border-slate-300 bg-white text-slate-800"
                      />
                    </td>

                    {/* 10. Loans / Advances (Editable) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono bg-rose-50/20">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={edit.loans === 0 ? '' : edit.loans}
                        placeholder="-"
                        onChange={(e) =>
                          handleFieldChange(
                            r.employeeId,
                            'loans',
                            e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                          )
                        }
                        className="win-input font-mono font-bold text-[11px] w-14 px-1 py-0.5 text-center border border-slate-300 bg-white text-slate-800"
                      />
                    </td>

                    {/* 11. Absence Days (Editable) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono bg-rose-50/20">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={edit.unpaidDays === 0 ? '' : edit.unpaidDays}
                        placeholder="-"
                        onChange={(e) =>
                          handleFieldChange(
                            r.employeeId,
                            'unpaidDays',
                            e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                          )
                        }
                        className="win-input font-mono font-bold text-[11px] w-12 px-1 py-0.5 text-center border border-rose-300 bg-rose-50/30 text-rose-950"
                      />
                    </td>

                    {/* 12. Absence Deduction (Formula: unpaidDays * basic / 30) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono font-bold text-rose-700 bg-rose-50/30 text-[11px]">
                      {r.unpaidDeduction > 0 ? r.unpaidDeduction.toFixed(2) : '-'}
                    </td>

                    {/* 13. Early Departure Hours (Editable) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono bg-rose-50/20">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={edit.earlyDepartureHours === 0 ? '' : edit.earlyDepartureHours}
                        placeholder="-"
                        onChange={(e) =>
                          handleFieldChange(
                            r.employeeId,
                            'earlyDepartureHours',
                            e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                          )
                        }
                        className="win-input font-mono font-bold text-[11px] w-12 px-1 py-0.5 text-center border border-slate-300 bg-white text-slate-800"
                      />
                    </td>

                    {/* 14. Early Departure Deduction (Formula: earlyDepHours * basic / 240) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono font-bold text-rose-700 bg-rose-50/30 text-[11px]">
                      {r.earlyDepartureDeduction > 0 ? r.earlyDepartureDeduction.toFixed(2) : '-'}
                    </td>

                    {/* 15. Late Hours (Editable) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono bg-rose-50/20">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={edit.lateHours === 0 ? '' : edit.lateHours}
                        placeholder="-"
                        onChange={(e) =>
                          handleFieldChange(
                            r.employeeId,
                            'lateHours',
                            e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                          )
                        }
                        className="win-input font-mono font-bold text-[11px] w-12 px-1 py-0.5 text-center border border-slate-300 bg-white text-slate-800"
                      />
                    </td>

                    {/* 16. Late Deduction (Formula: lateHours * basic / 240) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono font-bold text-rose-700 bg-rose-50/30 text-[11px]">
                      {r.lateDeduction > 0 ? r.lateDeduction.toFixed(2) : '-'}
                    </td>

                    {/* 17. Other Deductions (Editable) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono bg-rose-50/20">
                      <div className="flex items-center justify-center gap-0.5">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={edit.otherDeductions === 0 ? '' : edit.otherDeductions}
                          placeholder="-"
                          onChange={(e) =>
                            handleFieldChange(
                              r.employeeId,
                              'otherDeductions',
                              e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                            )
                          }
                          className="win-input font-mono font-bold text-[11px] w-14 px-1 py-0.5 text-center border border-rose-300 bg-rose-50/40 text-rose-950"
                        />
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
                            className="text-[10px] text-rose-800 hover:text-rose-950 font-bold"
                            title="عرض تفاصيل المخالفات المسجلة من الحضور"
                          >
                            🚨
                          </button>
                        )}
                      </div>
                    </td>

                    {/* 18. Total Deductions (Sum of columns 9..17) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono font-black text-rose-900 bg-rose-100 text-[11px]">
                      {r.totalDeductions.toFixed(2)}
                    </td>

                    {/* 19. Net Pay (Formula: Gross Earnings - Total Deductions) */}
                    <td className="p-1 border-l border-slate-200 text-center font-mono font-black text-emerald-950 bg-emerald-100 text-xs">
                      {r.netPay.toFixed(2)}
                    </td>

                    {/* Status Badge */}
                    <td className="p-1 border-l border-slate-200 text-center">
                      <Badge
                        variant={
                          r.payrollStatus === 'APPROVED' || r.payrollStatus === 'PAID'
                            ? 'approved'
                            : r.payrollStatus === 'DRAFT'
                            ? 'draft'
                            : 'default'
                        }
                        className="text-[9px] px-1 py-0"
                      >
                        {r.payrollStatus === 'APPROVED'
                          ? 'معتمد'
                          : r.payrollStatus === 'PAID'
                          ? 'مدفوع'
                          : r.payrollStatus === 'DRAFT'
                          ? 'مسودة'
                          : 'غير منشأ'}
                      </Badge>
                    </td>

                    {/* Row Actions: Receipt Link + Reset */}
                    <td className="p-1 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {r.payrollId && (
                          <Link
                            href={`/payroll/${r.payrollId}/receipt`}
                            className="win-btn text-[9px] px-1 py-0.5 text-blue-900"
                            title="عرض سند استلام الراتب (بيان الراتب الفردي)"
                          >
                            📄
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => handleResetRow(r.employeeId)}
                          className="win-btn text-[9px] px-1 py-0.5 text-slate-700"
                          title="إعادة تعيين إلى قيم الحضور الافتراضية"
                        >
                          ↺
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* 5. Totals Footer Row */}
          <tfoot className="sticky bottom-0 z-10 bg-slate-900 text-white font-black text-[11px] border-t-2 border-slate-900 shadow-md">
            <tr>
              <td colSpan={3} className="p-1.5 text-center border-l border-slate-700">
                المجموع الكلي ({grandTotals.count} موظف)
              </td>
              <td className="p-1.5 text-center font-mono border-l border-slate-700">{grandTotals.basicEarned.toFixed(2)}</td>
              <td className="p-1.5 text-center font-mono border-l border-slate-700">{grandTotals.allowancesEarned.toFixed(2)}</td>
              <td className="p-1.5 text-center font-mono border-l border-slate-700">{formatCell(grandTotals.deliveryAllowance)}</td>
              <td className="p-1.5 text-center font-mono border-l border-slate-700">{formatCell(grandTotals.bonus)}</td>
              <td className="p-1.5 text-center font-mono border-l border-slate-700">{formatCell(grandTotals.otherAdditions)}</td>
              <td className="p-1.5 text-center font-mono border-l border-slate-700">{formatCell(grandTotals.otHours)}</td>
              <td className="p-1.5 text-center font-mono border-l border-slate-700 text-emerald-400">{formatCell(grandTotals.otTotal)}</td>
              <td className="p-1.5 text-center font-mono border-l border-slate-700 bg-blue-900 text-white">{grandTotals.grossEarnings.toFixed(2)}</td>
              <td className="p-1.5 text-center font-mono border-l border-slate-700">{formatCell(grandTotals.socialSecurity)}</td>
              <td className="p-1.5 text-center font-mono border-l border-slate-700">{formatCell(grandTotals.loans)}</td>
              <td className="p-1.5 text-center font-mono border-l border-slate-700">{formatCell(grandTotals.unpaidDays)}</td>
              <td className="p-1.5 text-center font-mono border-l border-slate-700 text-rose-300">{formatCell(grandTotals.unpaidDeduction)}</td>
              <td className="p-1.5 text-center font-mono border-l border-slate-700">{formatCell(grandTotals.earlyDepartureHours)}</td>
              <td className="p-1.5 text-center font-mono border-l border-slate-700 text-rose-300">{formatCell(grandTotals.earlyDepartureDeduction)}</td>
              <td className="p-1.5 text-center font-mono border-l border-slate-700">{formatCell(grandTotals.lateHours)}</td>
              <td className="p-1.5 text-center font-mono border-l border-slate-700 text-rose-300">{formatCell(grandTotals.lateDeduction)}</td>
              <td className="p-1.5 text-center font-mono border-l border-slate-700">{formatCell(grandTotals.otherDeductions)}</td>
              <td className="p-1.5 text-center font-mono border-l border-slate-700 bg-rose-950 text-white">{grandTotals.totalDeductions.toFixed(2)}</td>
              <td className="p-1.5 text-center font-mono border-l border-slate-700 bg-emerald-950 text-emerald-300 text-xs font-black">{grandTotals.netPay.toFixed(2)}</td>
              <td colSpan={2} className="p-1.5 text-center text-[10px] text-slate-400 font-normal">
                مطابق 100%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 6. Footer Information & Bottom Buttons */}
      <div className="win-raised p-2 bg-[#ECE9D8] flex flex-col sm:flex-row items-center justify-between gap-2 border border-[#7F9DB9]">
        <div className="text-xs text-slate-700">
          <span>المعادلات الحسابية: الإضافي (ساعتان/ساعة) = الراتب / 120 | خصم اليوم = الراتب / 30 | خصم الساعة = الراتب / 240.</span>{' '}
          <span className="font-bold text-blue-900">
            كافة المبالغ المعدّلة يتم حفظها وترحيلها لحظياً لبيان الرواتب وسند استلام الراتب الفردي.
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleSave('DRAFT')}
            disabled={isPending}
            className="win-btn font-bold text-xs px-3 py-1.5 bg-[#ECE9D8] text-slate-900 hover:bg-slate-200 border border-slate-400"
          >
            <span>💾 حفظ وترحيل (مسودة)</span>
          </Button>

          <Button
            onClick={() => handleSave('APPROVED')}
            disabled={isPending}
            className="win-btn font-black text-xs px-4 py-1.5 bg-[#008080] text-white hover:bg-[#006666] flex items-center gap-1.5 shadow"
          >
            <span>✅ حفظ وترحيل واعتماد المسيرات (نهائي)</span>
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
