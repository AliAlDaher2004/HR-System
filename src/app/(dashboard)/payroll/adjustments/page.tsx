import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { RBAC } from '@/lib/auth/rbac';
import {
  getMonthlyPayrollAdjustmentSheet,
  saveMonthlyPayrollAdjustments,
  SaveAdjustmentItem,
} from '@/lib/services/payroll-service';
import { PayrollAdjustmentsClient } from '@/components/payroll/PayrollAdjustmentsClient';
import { revalidatePath } from 'next/cache';

export default async function PayrollAdjustmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!RBAC.canManagePayroll(user.role)) {
    redirect('/');
  }

  const resolvedParams = await searchParams;
  const currentMonth = resolvedParams.month || new Date().toISOString().slice(0, 7);

  const sheetData = await getMonthlyPayrollAdjustmentSheet(user, currentMonth);

  async function handleSaveAdjustments(
    month: string,
    adjustments: SaveAdjustmentItem[]
  ) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح لك بتنفيذ هذه العملية');

    const res = await saveMonthlyPayrollAdjustments(currentUser, month, adjustments);

    revalidatePath('/payroll');
    revalidatePath('/payroll/adjustments');
    revalidatePath('/payroll/consolidated');
    return res;
  }

  return (
    <PayrollAdjustmentsClient
      month={sheetData.month}
      periodStart={sheetData.periodStart}
      periodEnd={sheetData.periodEnd}
      initialRows={sheetData.rows}
      saveAction={handleSaveAdjustments}
    />
  );
}
