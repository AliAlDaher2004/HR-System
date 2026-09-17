import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getPayslipData } from '@/lib/services/payslip-service';
import { Button } from '@/components/ui';
import { Printer, Download, ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { RBAC } from '@/lib/auth/rbac';

export default async function PayslipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!RBAC.canViewFinancials(user.role)) {
    redirect('/');
  }

  const resolvedParams = await params;
  const payslip = await getPayslipData(user, resolvedParams.id);

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 flex flex-col items-center">
      {/* Top action bar (hidden during print) */}
      <div className="w-full max-w-3xl flex justify-between items-center mb-6 no-print">
        <Link
          href={`/payroll/${resolvedParams.id}`}
          className="text-sm font-semibold text-[#2169A6] hover:text-[#1B5587] flex items-center"
        >
          <ArrowRight className="w-4 h-4 ml-1.5" />
          العودة لتفاصيل كشف الراتب
        </Link>

        <div className="flex items-center space-x-3 space-x-reverse">
          <PrintButton />
        </div>
      </div>

      {/* Printable Payslip Document Card */}
      <div
        id="payslip-document"
        className="w-full max-w-3xl bg-white border border-slate-300 rounded-2xl shadow-xl p-8 md:p-10 text-slate-800"
        dir="rtl"
      >
        {/* Company Header */}
        <div className="flex justify-between items-start pb-6 border-b-2 border-[#15324F]">
          <div>
            <h1 className="text-2xl font-black text-[#15324F] tracking-tight">{payslip.companyName}</h1>
            <span className="text-xs text-slate-500 block mt-0.5">{payslip.country}</span>
            <span className="text-xs text-slate-400 block mt-0.5">إدارة الموارد البشرية والعمليات المالية</span>
          </div>
          <div className="text-left" dir="ltr">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">PAYSLIP / قسيمة راتب</div>
            <div className="text-sm font-mono font-bold text-[#2169A6] mt-1">{payslip.periodStart.slice(0, 7)}</div>
          </div>
        </div>

        {/* Employee & Period Summary Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-5 bg-slate-50 rounded-xl px-4 mt-6 border border-slate-200 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">اسم الموظف</span>
            <span className="font-bold text-slate-800 text-sm">{payslip.employeeName}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">الرقم الوظيفي</span>
            <span className="font-bold text-slate-800 font-mono text-sm">{payslip.employeeNo}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">القسم</span>
            <span className="font-bold text-slate-800">{payslip.department}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">المسمى الوظيفي</span>
            <span className="font-bold text-slate-800">{payslip.jobTitle}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">فترة الاستحقاق</span>
            <span className="font-semibold text-slate-700 font-mono">{payslip.periodStart} إلى {payslip.periodEnd}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">عملة الراتب</span>
            <span className="font-semibold text-slate-700">{payslip.currency}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">حالة الكشف</span>
            <span className="font-bold text-emerald-700">{payslip.status === 'PAID' ? 'مدفوع' : 'معتمد'}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">تاريخ الاعتماد</span>
            <span className="font-semibold text-slate-700 font-mono">{payslip.approvedAt || '-'}</span>
          </div>
        </div>

        {/* Financial Earnings vs Deductions Table */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Earnings Column */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-[#15324F] text-white py-2 px-4 text-xs font-bold flex justify-between">
              <span>الاستحقاقات والبدلات</span>
              <span>المبلغ ({payslip.currency})</span>
            </div>
            <div className="divide-y divide-slate-100 text-xs p-3 space-y-2">
              <div className="flex justify-between py-1">
                <span className="text-slate-600">الراتب الأساسي:</span>
                <span className="font-mono font-semibold">{payslip.basicEarned}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">البدلات الشهرية:</span>
                <span className="font-mono font-semibold">{payslip.allowancesEarned}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">
                  العمل الإضافي ({payslip.otHours} س × {payslip.otRate}):
                </span>
                <span className="font-mono font-semibold text-emerald-700">+{payslip.otTotal}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">مكافآت وإضافات أخرى:</span>
                <span className="font-mono font-semibold text-emerald-700">+{payslip.otherAdditions}</span>
              </div>
            </div>
            <div className="bg-slate-50 border-t border-slate-200 py-2.5 px-4 text-xs font-bold flex justify-between">
              <span>إجمالي الاستحقاقات:</span>
              <span className="font-mono text-emerald-700">{payslip.totalEarnings}</span>
            </div>
          </div>

          {/* Deductions Column */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-700 text-white py-2 px-4 text-xs font-bold flex justify-between">
              <span>الاستقطاعات والخصومات</span>
              <span>المبلغ ({payslip.currency})</span>
            </div>
            <div className="divide-y divide-slate-100 text-xs p-3 space-y-2">
              <div className="flex justify-between py-1">
                <span className="text-slate-600">
                  خصم الغياب ({payslip.unpaidDays} ي × {payslip.unpaidDayRate}):
                </span>
                <span className="font-mono font-semibold text-rose-700">-{payslip.unpaidDeduction}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">استقطاع أقساط السلف:</span>
                <span className="font-mono font-semibold text-rose-700">-{payslip.loanDeduction}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">استقطاعات أخرى:</span>
                <span className="font-mono font-semibold text-rose-700">-{payslip.otherDeductions}</span>
              </div>
            </div>
            <div className="bg-slate-50 border-t border-slate-200 py-2.5 px-4 text-xs font-bold flex justify-between">
              <span>إجمالي الاستقطاعات:</span>
              <span className="font-mono text-rose-700">-{payslip.totalDeductions}</span>
            </div>
          </div>
        </div>

        {/* Net Pay Highlight Card */}
        <div className="mt-6 bg-[#15324F] text-white rounded-xl p-5 flex justify-between items-center">
          <div>
            <span className="text-xs text-slate-300 block">صافي الراتب المستحق للصرف</span>
            <span className="text-2xl md:text-3xl font-black font-mono tracking-tight text-white mt-0.5 block">
              {payslip.netPay} <span className="text-base font-normal text-slate-300">{payslip.currency}</span>
            </span>
          </div>
          {payslip.paymentReference && (
            <div className="text-left text-xs text-slate-300" dir="ltr">
              <div>Ref: {payslip.paymentReference}</div>
              <div>Method: {payslip.paymentMethod}</div>
            </div>
          )}
        </div>

        {/* Signatures and Seals Section */}
        <div className="grid grid-cols-2 gap-8 mt-12 pt-6 border-t border-slate-200 text-xs text-slate-600">
          <div>
            <span className="font-bold block mb-1 text-slate-800">اعتماد إدارة الموارد البشرية والمالية:</span>
            <span>الاسم: {payslip.approvedBy}</span>
            <div className="mt-4 flex items-center text-emerald-700 font-semibold">
              <ShieldCheck className="w-4 h-4 ml-1" />
              تم الاعتماد إلكترونياً ومطابقة سجلات الحضور
            </div>
          </div>
          <div className="text-left" dir="ltr">
            <span className="font-bold block mb-1 text-slate-800">Employee Signature:</span>
            <div className="h-10 border-b border-dashed border-slate-300 w-48 mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PrintButton() {
  'use client';
  return (
    <Button onClick={() => window.print()} className="flex items-center">
      <Printer className="w-4 h-4 ml-1.5" />
      طباعة قسيمة الراتب (PDF)
    </Button>
  );
}
