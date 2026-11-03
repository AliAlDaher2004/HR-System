'use client';

import React, { useState, useMemo, useTransition } from 'react';
import { Button, Badge, Card } from '@/components/ui';
import { CreateLoanModal } from './CreateLoanModal';
import { RepayLoanModal } from './RepayLoanModal';
import { CheckCircle, AlertCircle, FileSpreadsheet, PlusCircle, Check } from 'lucide-react';

export interface EmployeeForLoan {
  id: string;
  employeeNo: string;
  name: string;
  department: string;
  jobTitle: string;
  employmentType: 'PERMANENT' | 'PROBATIONARY' | 'DAILY_WORKER';
  basicSalary: number;
  currentLoanBalance: number;
}

export interface EnrichedLoan {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  department: string;
  date: string;
  amount: string;
  currency: string;
  installmentMonths: number;
  monthlyInstallment: string;
  startMonth: string;
  status: 'PROPOSED' | 'DISBURSED' | 'CANCELLED';
  notes: string | null;
  paidTotal: string;
  remaining: string;
  isDebt: boolean;
  createdAt: any;
}

interface RowLoanInput {
  amount: string;
  installmentMonths: number;
  monthlyInstallment: string;
  startMonth: string;
  notes: string;
}

interface LoansManagementClientProps {
  employees: EmployeeForLoan[];
  initialLoans: EnrichedLoan[];
  saveBulkLoansAction: (data: {
    date: string;
    startMonth: string;
    disburseImmediately: boolean;
    items: Array<{
      employeeId: string;
      amount: number;
      installmentMonths: number;
      monthlyInstallment: number;
      startMonth: string;
      notes?: string;
    }>;
  }) => Promise<{
    success: boolean;
    createdCount: number;
    totalAmount: number;
    errors: string[];
  }>;
  createSingleLoanAction: (formData: FormData) => Promise<void>;
  disburseLoanAction: (formData: FormData) => Promise<void>;
  addCashRepaymentAction: (formData: FormData) => Promise<void>;
}

export function LoansManagementClient({
  employees,
  initialLoans,
  saveBulkLoansAction,
  createSingleLoanAction,
  disburseLoanAction,
  addCashRepaymentAction,
}: LoansManagementClientProps) {
  const [activeTab, setActiveTab] = useState<'BULK' | 'HISTORY'>('BULK');
  const [isPending, startTransition] = useTransition();

  // Global settings for the bulk entry sheet
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const [globalDate, setGlobalDate] = useState<string>(todayStr);
  const [globalStartMonth, setGlobalStartMonth] = useState<string>(currentMonthStr);
  const [disburseImmediately, setDisburseImmediately] = useState<boolean>(true);

  // Filters for the bulk table
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [showOnlyWithBalance, setShowOnlyWithBalance] = useState<boolean>(false);

  // Feedback notifications
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Per-employee bulk loan inputs: employeeId -> RowLoanInput
  const [rowInputs, setRowInputs] = useState<Record<string, RowLoanInput>>({});

  // Departments list
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Handle row input change
  const handleAmountChange = (employeeId: string, value: string) => {
    setRowInputs((prev) => {
      const current = prev[employeeId] || {
        amount: '',
        installmentMonths: 1,
        monthlyInstallment: '',
        startMonth: globalStartMonth,
        notes: '',
      };

      const numAmount = parseFloat(value) || 0;
      const months = current.installmentMonths || 1;
      const autoInstallment = numAmount > 0 ? (Math.round((numAmount / months) * 1000) / 1000).toFixed(2) : '';

      return {
        ...prev,
        [employeeId]: {
          ...current,
          amount: value,
          monthlyInstallment: autoInstallment,
        },
      };
    });
  };

  const handleMonthsChange = (employeeId: string, months: number) => {
    setRowInputs((prev) => {
      const current = prev[employeeId] || {
        amount: '',
        installmentMonths: 1,
        monthlyInstallment: '',
        startMonth: globalStartMonth,
        notes: '',
      };

      const numAmount = parseFloat(current.amount) || 0;
      const validMonths = Math.max(1, months);
      const autoInstallment = numAmount > 0 ? (Math.round((numAmount / validMonths) * 1000) / 1000).toFixed(2) : '';

      return {
        ...prev,
        [employeeId]: {
          ...current,
          installmentMonths: validMonths,
          monthlyInstallment: autoInstallment,
        },
      };
    });
  };

  const handleMonthlyInstallmentChange = (employeeId: string, value: string) => {
    setRowInputs((prev) => {
      const current = prev[employeeId] || {
        amount: '',
        installmentMonths: 1,
        monthlyInstallment: '',
        startMonth: globalStartMonth,
        notes: '',
      };
      return {
        ...prev,
        [employeeId]: {
          ...current,
          monthlyInstallment: value,
        },
      };
    });
  };

  const handleStartMonthChange = (employeeId: string, value: string) => {
    setRowInputs((prev) => {
      const current = prev[employeeId] || {
        amount: '',
        installmentMonths: 1,
        monthlyInstallment: '',
        startMonth: globalStartMonth,
        notes: '',
      };
      return {
        ...prev,
        [employeeId]: {
          ...current,
          startMonth: value,
        },
      };
    });
  };

  const handleNotesChange = (employeeId: string, value: string) => {
    setRowInputs((prev) => {
      const current = prev[employeeId] || {
        amount: '',
        installmentMonths: 1,
        monthlyInstallment: '',
        startMonth: globalStartMonth,
        notes: '',
      };
      return {
        ...prev,
        [employeeId]: {
          ...current,
          notes: value,
        },
      };
    });
  };

  // Filtered employees for the bulk sheet
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = e.name.toLowerCase().includes(term);
        const matchesNo = e.employeeNo.toLowerCase().includes(term);
        const matchesJob = (e.jobTitle || '').toLowerCase().includes(term);
        if (!matchesName && !matchesNo && !matchesJob) return false;
      }
      if (selectedDept !== 'ALL' && e.department !== selectedDept) {
        return false;
      }
      if (selectedType !== 'ALL' && e.employmentType !== selectedType) {
        return false;
      }
      if (showOnlyWithBalance && e.currentLoanBalance <= 0) {
        return false;
      }
      return true;
    });
  }, [employees, searchTerm, selectedDept, selectedType, showOnlyWithBalance]);

  // Aggregate stats of current inputs
  const inputStats = useMemo(() => {
    let count = 0;
    let totalAmount = 0;
    let currentMonthDeductions = 0;

    Object.entries(rowInputs).forEach(([empId, item]) => {
      const amt = parseFloat(item.amount) || 0;
      if (amt > 0) {
        count++;
        totalAmount += amt;
        const inst = parseFloat(item.monthlyInstallment) || (amt / (item.installmentMonths || 1));
        currentMonthDeductions += inst;
      }
    });

    return {
      count,
      totalAmount: Math.round(totalAmount * 1000) / 1000,
      currentMonthDeductions: Math.round(currentMonthDeductions * 1000) / 1000,
    };
  }, [rowInputs]);

  // Handle Bulk Submit
  const handleBulkSubmit = () => {
    setSuccessMsg(null);
    setErrorMsg(null);

    const itemsToSave: Array<{
      employeeId: string;
      amount: number;
      installmentMonths: number;
      monthlyInstallment: number;
      startMonth: string;
      notes?: string;
    }> = [];

    Object.entries(rowInputs).forEach(([employeeId, item]) => {
      const amt = parseFloat(item.amount) || 0;
      if (amt > 0) {
        const months = item.installmentMonths && item.installmentMonths > 0 ? item.installmentMonths : 1;
        const monthlyInst = parseFloat(item.monthlyInstallment) || (amt / months);
        itemsToSave.push({
          employeeId,
          amount: amt,
          installmentMonths: months,
          monthlyInstallment: Math.round(monthlyInst * 1000) / 1000,
          startMonth: item.startMonth || globalStartMonth,
          notes: item.notes?.trim() || undefined,
        });
      }
    });

    if (itemsToSave.length === 0) {
      setErrorMsg('يرجى إدخال مبلغ السلفة لموظف واحد على الأقل قبل الترحيل.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await saveBulkLoansAction({
          date: globalDate,
          startMonth: globalStartMonth,
          disburseImmediately,
          items: itemsToSave,
        });

        if (res.success) {
          setSuccessMsg(
            `تم تسجيل وترحيل عدد (${res.createdCount}) سلفة بنجاح بمبلغ إجمالي (${res.totalAmount.toFixed(2)} د.أ)! تم ترحيل السلف فورياً لخصمها في مسيرات الرواتب وبيان الرواتب.`
          );
          // Clear inputs on success
          setRowInputs({});
        } else {
          setErrorMsg(res.errors?.join('\n') || 'حدث خطأ أثناء حفظ السلف.');
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'حدث خطأ أثناء حفظ وترحيل السلف.');
      }
    });
  };

  // Clear all entered inputs
  const handleClearInputs = () => {
    if (confirm('هل أنت متأكد من مسح جميع مبالغ السلف المدخلة في هذا الكشف؟')) {
      setRowInputs({});
      setSuccessMsg(null);
      setErrorMsg(null);
    }
  };

  // Summary statistics for existing loans
  const loanStats = useMemo(() => {
    let totalDisbursed = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let longTermCount = 0;

    initialLoans.forEach((l) => {
      const amt = parseFloat(l.amount) || 0;
      const paid = parseFloat(l.paidTotal) || 0;
      const rem = parseFloat(l.remaining) || 0;

      if (l.status === 'DISBURSED') {
        totalDisbursed += amt;
        totalPaid += paid;
        totalRemaining += rem;
        if (l.installmentMonths > 1) {
          longTermCount++;
        }
      }
    });

    return {
      totalDisbursed: Math.round(totalDisbursed * 1000) / 1000,
      totalPaid: Math.round(totalPaid * 1000) / 1000,
      totalRemaining: Math.round(totalRemaining * 1000) / 1000,
      longTermCount,
    };
  }, [initialLoans]);

  return (
    <div className="space-y-4 select-none font-sans" dir="rtl">
      {/* 1. Header Toolbar */}
      <div className="win-raised p-3 bg-[#ECE9D8] flex flex-wrap items-center justify-between gap-3 border border-[#7F9DB9]">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">💰</span>
          <div>
            <h1 className="text-base font-black text-[#0A246A]">
              إدارة وقيد سلف الموظفين والأقساط الشهرية
            </h1>
            <p className="text-[11.5px] text-slate-600">
              تسجيل السلف لجميع الموظفين دفعة واحدة، السلف طويلة الأمد، والترحيل التلقائي لمسيرات وبيان الرواتب
            </p>
          </div>
        </div>

        {/* Action Controls & Single Loan Modal */}
        <div className="flex items-center gap-2">
          <CreateLoanModal
            employees={employees.map((e) => ({ id: e.id, name: e.name, employeeNo: e.employeeNo }))}
            createLoanAction={createSingleLoanAction}
          />
        </div>
      </div>

      {/* 2. Notifications & Alerts */}
      {successMsg && (
        <div className="win-raised p-2.5 bg-emerald-50 border-emerald-500 text-emerald-950 text-xs font-bold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="win-box-btn px-2 py-0 text-slate-700 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="win-raised p-2.5 bg-rose-50 border-rose-500 text-rose-950 text-xs font-bold flex items-center justify-between whitespace-pre-line shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="win-box-btn px-2 py-0 text-slate-700 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* 3. Main Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#0A246A] pb-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('BULK')}
            className={`win-btn text-xs font-bold px-4 py-2 flex items-center gap-2 transition-all ${
              activeTab === 'BULK'
                ? 'bg-[#0A246A] text-white border-2 border-[#0A246A] shadow'
                : 'bg-white text-slate-800 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>كشف إدخال السلف السريع (كافة الموظفين)</span>
            {inputStats.count > 0 && (
              <span className="bg-emerald-500 text-white font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {inputStats.count}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            className={`win-btn text-xs font-bold px-4 py-2 flex items-center gap-2 transition-all ${
              activeTab === 'HISTORY'
                ? 'bg-[#0A246A] text-white border-2 border-[#0A246A] shadow'
                : 'bg-white text-slate-800 hover:bg-slate-100'
            }`}
          >
            <span>📊</span>
            <span>سجل ومتابعة السلف القائمة</span>
            <span className="bg-slate-200 text-slate-800 font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {initialLoans.length}
            </span>
          </button>
        </div>

        {/* Global Summary Badge */}
        <div className="flex items-center gap-2 text-xs bg-slate-100 px-3 py-1.5 rounded border border-slate-300 font-medium">
          <span className="text-slate-600">إجمالي ديون السلف القائمة:</span>
          <span className="font-mono font-black text-rose-700 text-sm">
            {loanStats.totalRemaining.toFixed(2)} د.أ
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-600">سلف مقسطة نشطة:</span>
          <span className="font-mono font-bold text-blue-900">{loanStats.longTermCount}</span>
        </div>
      </div>

      {/* TAB 1: BULK ENTRY TABLE (ALL EMPLOYEES) */}
      {activeTab === 'BULK' && (
        <div className="space-y-3">
          {/* Global Parameters Toolbar */}
          <div className="win-raised p-2.5 bg-[#ECE9D8] border border-[#7F9DB9] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Loan Date */}
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 border border-[#7F9DB9] rounded">
                <span className="text-xs font-bold text-slate-700">تاريخ قيد السلفة:</span>
                <input
                  type="date"
                  value={globalDate}
                  onChange={(e) => {
                    setGlobalDate(e.target.value);
                    if (e.target.value) {
                      setGlobalStartMonth(e.target.value.slice(0, 7));
                    }
                  }}
                  className="win-input text-xs font-mono font-bold px-1 py-0.5 border-none"
                />
              </div>

              {/* Default Start Month */}
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 border border-[#7F9DB9] rounded">
                <span className="text-xs font-bold text-slate-700">شهر بدء الخصم:</span>
                <input
                  type="month"
                  value={globalStartMonth}
                  onChange={(e) => setGlobalStartMonth(e.target.value)}
                  className="win-input text-xs font-mono font-bold px-1 py-0.5 border-none"
                />
              </div>

              {/* Immediate Disbursement & Payroll Sync Checkbox */}
              <label className="flex items-center gap-2 bg-emerald-50 px-3 py-1 border border-emerald-400 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={disburseImmediately}
                  onChange={(e) => setDisburseImmediately(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1">
                  <span>⚡</span>
                  <span>صرف السلف فورياً وترحيلها لمسيرات وبيان الرواتب</span>
                </span>
              </label>
            </div>

            {/* Top Action Button */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleBulkSubmit}
                disabled={isPending || inputStats.count === 0}
                className="win-btn font-black text-xs px-4 py-1.5 bg-[#008080] text-white hover:bg-[#006666] flex items-center gap-1.5 shadow"
                title="حفظ وترحيل السلف المدخلة لمسيرات الرواتب"
              >
                <span>{isPending ? '⏳ جاري الحفظ والترحيل...' : '💾 حفظ وترحيل السلف إلى الرواتب'}</span>
                {inputStats.count > 0 && (
                  <span className="bg-white/20 text-white font-mono px-1.5 py-0.2 rounded-full text-[10px]">
                    ({inputStats.count})
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Search & Filtering Toolbar */}
          <div className="win-raised p-2 bg-[#F5F3E9] flex flex-wrap items-center justify-between gap-2 border border-[#7F9DB9]">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-700">🔍 بحث:</span>
                <input
                  type="text"
                  placeholder="اسم الموظف أو رقمه..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="win-input text-xs px-2 py-1 w-48"
                />
              </div>

              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-700">القسم:</span>
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

              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-700">التعيين:</span>
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

              <label className="flex items-center gap-1 bg-white px-2 py-1 border border-slate-300 rounded cursor-pointer font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={showOnlyWithBalance}
                  onChange={(e) => setShowOnlyWithBalance(e.target.checked)}
                  className="rounded"
                />
                <span>عرض من لديهم سلف قائمة فقط</span>
              </label>
            </div>

            {/* Inputs Summary Pill */}
            {inputStats.count > 0 && (
              <div className="text-xs bg-white px-2.5 py-1 border border-emerald-400 rounded flex items-center gap-2 font-bold text-emerald-950">
                <span>تم إدخال: {inputStats.count} سلفة</span>
                <span className="text-slate-300">|</span>
                <span>إجمالي: {inputStats.totalAmount.toFixed(2)} د.أ</span>
                <span className="text-slate-300">|</span>
                <span>قسط الشهر: {inputStats.currentMonthDeductions.toFixed(2)} د.أ</span>
              </div>
            )}
          </div>

          {/* Main Bulk Table */}
          <div className="win-sunken overflow-x-auto bg-white border border-[#7F9DB9] max-h-[calc(100vh-320px)] overflow-y-auto">
            <table className="win-table w-full text-xs text-right border-collapse select-text">
              <thead className="sticky top-0 z-20 shadow-sm text-slate-800 text-[11px] bg-[#ECE9D8]">
                <tr className="border-b border-[#7F9DB9] text-slate-900 font-bold">
                  <th className="p-1.5 text-center w-8 border-l border-slate-300">#</th>
                  <th className="p-1.5 border-l border-slate-300 min-w-[70px] text-center">الرقم</th>
                  <th className="p-1.5 border-l border-slate-300 min-w-[140px]">اسم الموظف</th>
                  <th className="p-1.5 border-l border-slate-300 min-w-[90px]">القسم</th>
                  <th className="p-1.5 border-l border-slate-300 min-w-[75px] text-center">التعيين</th>
                  <th className="p-1.5 border-l border-slate-300 min-w-[80px] text-center">الراتب الأساسي</th>
                  <th className="p-1.5 border-l border-slate-300 min-w-[90px] text-center bg-rose-50/70">
                    السلف القائمة (رصيد سابق)
                  </th>
                  <th className="p-1.5 border-l border-slate-300 min-w-[100px] text-center bg-blue-50 font-black text-blue-950">
                    مبلغ السلفة الجديدة (د.أ)
                  </th>
                  <th className="p-1.5 border-l border-slate-300 min-w-[125px] text-center bg-blue-50 font-black text-blue-950">
                    خطة التقسيط (الأشهر)
                  </th>
                  <th className="p-1.5 border-l border-slate-300 min-w-[95px] text-center bg-blue-50 font-black text-blue-950">
                    القسط الشهري
                  </th>
                  <th className="p-1.5 border-l border-slate-300 min-w-[95px] text-center bg-blue-50">
                    بدء الخصم
                  </th>
                  <th className="p-1.5 min-w-[130px]">ملاحظات / السبب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-slate-400 font-bold">
                      لا يوجد موظفون يطابقون خيارات البحث المحددة.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp, idx) => {
                    const rowInput = rowInputs[emp.id] || {
                      amount: '',
                      installmentMonths: 1,
                      monthlyInstallment: '',
                      startMonth: globalStartMonth,
                      notes: '',
                    };

                    const hasAmount = parseFloat(rowInput.amount) > 0;
                    const isLongTerm = rowInput.installmentMonths > 1;

                    return (
                      <tr
                        key={emp.id}
                        className={`transition-colors ${
                          hasAmount
                            ? 'bg-blue-50/50 font-medium'
                            : idx % 2 === 0
                            ? 'bg-white'
                            : 'bg-slate-50/70'
                        } hover:bg-amber-50/60`}
                      >
                        {/* Index */}
                        <td className="p-1.5 text-center font-mono text-[10.5px] text-slate-500 border-l border-slate-200">
                          {idx + 1}
                        </td>

                        {/* Employee No */}
                        <td className="p-1.5 text-center font-mono font-bold text-slate-900 border-l border-slate-200">
                          {emp.employeeNo}
                        </td>

                        {/* Employee Name */}
                        <td className="p-1.5 font-bold text-slate-900 border-l border-slate-200 whitespace-nowrap">
                          {emp.name}
                        </td>

                        {/* Department */}
                        <td className="p-1.5 text-slate-700 border-l border-slate-200 text-[11px]">
                          {emp.department || '-'}
                        </td>

                        {/* Employment Type */}
                        <td className="p-1.5 text-center border-l border-slate-200">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] rounded font-bold ${
                              emp.employmentType === 'PERMANENT'
                                ? 'bg-blue-100 text-blue-800'
                                : emp.employmentType === 'PROBATIONARY'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-teal-100 text-teal-800'
                            }`}
                          >
                            {emp.employmentType === 'PERMANENT'
                              ? 'مثبت'
                              : emp.employmentType === 'PROBATIONARY'
                              ? 'تجربة'
                              : 'مياومة'}
                          </span>
                        </td>

                        {/* Basic Salary */}
                        <td className="p-1.5 text-center font-mono text-slate-800 border-l border-slate-200">
                          {emp.basicSalary > 0 ? emp.basicSalary.toFixed(2) : '-'}
                        </td>

                        {/* Current Existing Loan Balance */}
                        <td className="p-1.5 text-center font-mono font-bold border-l border-slate-200">
                          {emp.currentLoanBalance > 0 ? (
                            <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              {emp.currentLoanBalance.toFixed(2)} د.أ
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Input 1: Loan Amount */}
                        <td className="p-1 border-l border-slate-200 text-center bg-blue-50/40">
                          <input
                            type="number"
                            step="0.5"
                            placeholder="0.00"
                            value={rowInput.amount}
                            onChange={(e) => handleAmountChange(emp.id, e.target.value)}
                            className={`win-input w-24 text-center font-mono font-bold text-xs py-1 px-1.5 ${
                              hasAmount
                                ? 'border-2 border-blue-600 bg-white text-blue-900 shadow-sm'
                                : 'border-slate-300'
                            }`}
                          />
                        </td>

                        {/* Input 2: Installment Plan */}
                        <td className="p-1 border-l border-slate-200 text-center bg-blue-50/40">
                          <select
                            value={rowInput.installmentMonths}
                            disabled={!hasAmount}
                            onChange={(e) => handleMonthsChange(emp.id, parseInt(e.target.value, 10))}
                            className={`win-input text-[11px] py-1 px-1.5 w-32 ${
                              isLongTerm ? 'font-bold text-blue-900 border-blue-500 bg-blue-50' : ''
                            }`}
                          >
                            <option value="1">سلفة شهرية (شهر واحد)</option>
                            <option value="2">شهرين (2 قسط)</option>
                            <option value="3">3 أشهر (سلفة طويلة)</option>
                            <option value="4">4 أشهر</option>
                            <option value="5">5 أشهر</option>
                            <option value="6">6 أشهر</option>
                            <option value="10">10 أشهر</option>
                            <option value="12">12 شهراً (سنة كاملة)</option>
                          </select>
                        </td>

                        {/* Input 3: Monthly Installment */}
                        <td className="p-1 border-l border-slate-200 text-center bg-blue-50/40">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              step="0.1"
                              placeholder="0.00"
                              disabled={!hasAmount}
                              value={rowInput.monthlyInstallment}
                              onChange={(e) => handleMonthlyInstallmentChange(emp.id, e.target.value)}
                              className="win-input w-20 text-center font-mono font-bold text-xs py-1 px-1 text-emerald-800"
                              title="المبلغ الذي سيخصم شهرياً من الراتب"
                            />
                            {hasAmount && <span className="text-[10px] text-slate-500 font-bold">/شهر</span>}
                          </div>
                        </td>

                        {/* Input 4: Start Month */}
                        <td className="p-1 border-l border-slate-200 text-center bg-blue-50/40">
                          <input
                            type="month"
                            disabled={!hasAmount}
                            value={rowInput.startMonth}
                            onChange={(e) => handleStartMonthChange(emp.id, e.target.value)}
                            className="win-input text-[10.5px] font-mono text-center py-1 px-1 w-24"
                            title="الشهر الذي سيبدأ فيه خصم السلفة في مسير الرواتب"
                          />
                        </td>

                        {/* Input 5: Notes */}
                        <td className="p-1">
                          <input
                            type="text"
                            placeholder="سبب السلفة (اختياري)..."
                            value={rowInput.notes}
                            onChange={(e) => handleNotesChange(emp.id, e.target.value)}
                            className="win-input text-[11px] py-1 px-1.5 w-full"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Summary Bar & Save Actions */}
          <div className="win-raised p-2.5 bg-[#ECE9D8] border border-[#7F9DB9] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-700">
              <span className="font-bold text-[#0A246A]">تأكيد النظام: </span>
              <span>
                السلف المسجلة ستصرف فورياً وتدرج في عمود <strong className="font-bold text-blue-900">السلف</strong> بمسيرات الرواتب وبيان الرواتب وسند الراتب الفردي وفق شهر الخطة المحدد.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleClearInputs}
                disabled={isPending || inputStats.count === 0}
                className="win-btn text-xs font-bold px-3 py-1.5 bg-white text-slate-800 hover:bg-slate-100 border border-slate-400"
              >
                مسح المدخلات
              </Button>

              <Button
                type="button"
                onClick={handleBulkSubmit}
                disabled={isPending || inputStats.count === 0}
                className="win-btn font-black text-xs px-5 py-1.5 bg-[#008080] text-white hover:bg-[#006666] flex items-center gap-1.5 shadow"
              >
                <span>{isPending ? '⏳ جاري الحفظ والترحيل...' : '💾 حفظ وترحيل السلف إلى الرواتب'}</span>
                {inputStats.count > 0 && (
                  <span className="bg-white/20 text-white font-mono px-1.5 py-0.2 rounded-full text-[10px]">
                    ({inputStats.count})
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LOANS HISTORY & BALANCES */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-3">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="win-raised p-3 bg-white border border-slate-300">
              <div className="text-[11px] font-bold text-slate-600">إجمالي السلف المصروفة</div>
              <div className="text-lg font-mono font-black text-blue-900 mt-1">
                {loanStats.totalDisbursed.toFixed(2)} د.أ
              </div>
            </div>

            <div className="win-raised p-3 bg-white border border-slate-300">
              <div className="text-[11px] font-bold text-slate-600">إجمالي المسدد فعلياً (نقد/رواتب)</div>
              <div className="text-lg font-mono font-black text-emerald-700 mt-1">
                {loanStats.totalPaid.toFixed(2)} د.أ
              </div>
            </div>

            <div className="win-raised p-3 bg-white border border-slate-300">
              <div className="text-[11px] font-bold text-slate-600">المتبقي ديوناً على الكوادر</div>
              <div className="text-lg font-mono font-black text-rose-700 mt-1">
                {loanStats.totalRemaining.toFixed(2)} د.أ
              </div>
            </div>

            <div className="win-raised p-3 bg-white border border-slate-300">
              <div className="text-[11px] font-bold text-slate-600">السلف طويلة الأمد النشطة</div>
              <div className="text-lg font-mono font-black text-purple-900 mt-1">
                {loanStats.longTermCount} سلفة
              </div>
            </div>
          </div>

          {/* Existing Loans Table */}
          <div className="win-sunken overflow-x-auto bg-white border border-[#7F9DB9]">
            <table className="win-table w-full text-xs text-right border-collapse">
              <thead className="bg-[#ECE9D8] text-slate-900 font-bold border-b border-[#7F9DB9] text-[11px]">
                <tr>
                  <th className="p-2 border-l border-slate-300 min-w-[130px]">اسم الموظف</th>
                  <th className="p-2 border-l border-slate-300 text-center min-w-[70px]">الرقم</th>
                  <th className="p-2 border-l border-slate-300 text-center min-w-[85px]">تاريخ السلفة</th>
                  <th className="p-2 border-l border-slate-300 text-center min-w-[90px]">مبلغ السلفة</th>
                  <th className="p-2 border-l border-slate-300 min-w-[170px]">خطة التقسيط والأقساط</th>
                  <th className="p-2 border-l border-slate-300 text-center min-w-[85px]">المسدد فعلياً</th>
                  <th className="p-2 border-l border-slate-300 text-center min-w-[85px]">المتبقي</th>
                  <th className="p-2 border-l border-slate-300 text-center min-w-[70px]">الحالة</th>
                  <th className="p-2 border-l border-slate-300 min-w-[120px]">الملاحظات</th>
                  <th className="p-2 text-center min-w-[100px]">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {initialLoans.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 font-bold">
                      لا توجد سلف مسجلة في النظام حتى الآن.
                    </td>
                  </tr>
                ) : (
                  initialLoans.map((l) => {
                    const isLongTerm = l.installmentMonths > 1;
                    const remNum = parseFloat(l.remaining) || 0;
                    const isFullyPaid = remNum <= 0 && l.status === 'DISBURSED';

                    return (
                      <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2 font-bold text-[#0A246A] border-l border-slate-200">
                          {l.employeeName}
                        </td>
                        <td className="p-2 text-center font-mono font-bold text-slate-700 border-l border-slate-200">
                          {l.employeeNo}
                        </td>
                        <td className="p-2 text-center font-mono text-slate-700 border-l border-slate-200">
                          {l.date}
                        </td>
                        <td className="p-2 text-center font-mono font-bold text-slate-900 border-l border-slate-200">
                          {parseFloat(l.amount).toFixed(2)} د.أ
                        </td>
                        <td className="p-2 border-l border-slate-200">
                          {isLongTerm ? (
                            <div className="space-y-0.5">
                              <span className="font-bold text-purple-900 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 text-[10.5px]">
                                مقسطة على {l.installmentMonths} أشهر ({parseFloat(l.monthlyInstallment).toFixed(2)} د.أ/شهر)
                              </span>
                              <div className="text-[10px] text-slate-500 font-mono">
                                بدء الخصم: {l.startMonth}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-700 text-[11px] font-bold">
                              سلفة شهرية (شهر واحد)
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-center font-mono font-bold text-emerald-700 border-l border-slate-200">
                          {parseFloat(l.paidTotal).toFixed(2)} د.أ
                        </td>
                        <td className="p-2 text-center font-mono font-bold border-l border-slate-200">
                          {remNum > 0 ? (
                            <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 font-black">
                              {remNum.toFixed(2)} د.أ
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-bold">مسددة بالكامل ✅</span>
                          )}
                        </td>
                        <td className="p-2 text-center border-l border-slate-200">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] rounded font-bold ${
                              isFullyPaid
                                ? 'bg-emerald-100 text-emerald-800'
                                : l.status === 'DISBURSED'
                                ? 'bg-blue-100 text-blue-900'
                                : l.status === 'PROPOSED'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-200 text-slate-800'
                            }`}
                          >
                            {isFullyPaid
                              ? 'مسددة'
                              : l.status === 'DISBURSED'
                              ? 'مصروفة'
                              : l.status === 'PROPOSED'
                              ? 'مقترحة'
                              : 'ملغاة'}
                          </span>
                        </td>
                        <td className="p-2 text-slate-600 text-[11px] border-l border-slate-200">
                          {l.notes || '-'}
                        </td>
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {l.status === 'PROPOSED' && (
                              <form action={disburseLoanAction}>
                                <input type="hidden" name="loanId" value={l.id} />
                                <button
                                  type="submit"
                                  className="win-btn text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-400"
                                >
                                  صرف السلفة
                                </button>
                              </form>
                            )}

                            {l.status === 'DISBURSED' && remNum > 0 && (
                              <RepayLoanModal
                                loanId={l.id}
                                employeeName={l.employeeName}
                                remainingAmount={l.remaining}
                                currency={l.currency}
                                repayLoanAction={addCashRepaymentAction}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

