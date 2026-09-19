import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getPayslipData } from '@/lib/services/payslip-service';
import { Button } from '@/components/ui';
import { Printer, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { RBAC } from '@/lib/auth/rbac';
import { SalaryReceiptView } from '@/components/payroll/SalaryReceiptView';

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

      {/* Printable Salary Receipt View */}
      <SalaryReceiptView payslip={payslip} />
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
