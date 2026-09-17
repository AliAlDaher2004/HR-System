import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getBatchPayslipData } from '@/lib/services/payslip-service';
import { BatchPayslipsPrintView } from '@/components/payroll/BatchPayslipsPrintView';
import { RBAC } from '@/lib/auth/rbac';

export default async function BatchPayslipsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; employeeId?: string; status?: 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED' }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!RBAC.canViewFinancials(user.role)) {
    redirect('/');
  }

  const resolvedParams = await searchParams;
  const payslips = await getBatchPayslipData(user, {
    month: resolvedParams.month,
    employeeId: resolvedParams.employeeId,
    status: resolvedParams.status,
  });

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white print:min-h-0">
      <BatchPayslipsPrintView payslips={payslips} />
    </div>
  );
}
