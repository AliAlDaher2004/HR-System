import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import {
  getLoans,
  createLoan,
  disburseLoan,
  addRepayment,
  saveBulkLoans,
} from '@/lib/services/loan-service';
import { getEmployees } from '@/lib/services/employee-service';
import { getDb, schema } from '@/db';
import { revalidatePath } from 'next/cache';
import { RBAC } from '@/lib/auth/rbac';
import {
  LoansManagementClient,
  EmployeeForLoan,
  EnrichedLoan,
} from '@/components/loan/LoansManagementClient';

export default async function LoansPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!RBAC.canManageLoans(user.role)) {
    redirect('/');
  }

  const db = getDb();
  const [rawEmployees, loans, activeContracts] = await Promise.all([
    getEmployees(user),
    getLoans(user),
    db.select().from(schema.contracts),
  ]);

  const contractMap = new Map<string, any>();
  activeContracts.forEach((c: any) => {
    // Pick the most recent contract for each employee
    if (!contractMap.has(c.employeeId)) {
      contractMap.set(c.employeeId, c);
    }
  });

  // Calculate current unpaid loan balance per employee
  const loanBalanceMap = new Map<string, number>();
  loans.forEach((l) => {
    if (l.status === 'DISBURSED') {
      const rem = parseFloat(l.remaining) || 0;
      if (rem > 0) {
        loanBalanceMap.set(l.employeeId, (loanBalanceMap.get(l.employeeId) || 0) + rem);
      }
    }
  });

  // Map employees for loan entry table (both ACTIVE and TERMINATED/Archived for retroactive loan entry)
  const employeesForLoan: EmployeeForLoan[] = rawEmployees.map((e) => {
    const contract = contractMap.get(e.id);
    let basicSalary = 0;
    if (e.employmentType === 'DAILY_WORKER') {
      basicSalary = parseFloat(e.dailyRate || '0') * 30;
    } else if (contract) {
      basicSalary = parseFloat(contract.monthlyBasic || '0');
    } else {
      basicSalary = 290;
    }

    return {
      id: e.id,
      employeeNo: e.employeeNo,
      name: e.name,
      department: e.department || '',
      jobTitle: e.jobTitle || '',
      employmentType: e.employmentType,
      status: e.status,
      basicSalary: Math.round(basicSalary * 1000) / 1000,
      currentLoanBalance: Math.round((loanBalanceMap.get(e.id) || 0) * 1000) / 1000,
    };
  });

  async function handleSaveBulkLoans(data: {
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
  }) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح لك بتسجيل السلف');

    const res = await saveBulkLoans(currentUser, data);
    revalidatePath('/loans');
    revalidatePath('/payroll');
    revalidatePath('/payroll/adjustments');
    revalidatePath('/payroll/consolidated');
    return res;
  }

  async function handleCreateSingleLoan(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح لك بإنشاء السلفة');

    const amount = parseFloat(formData.get('amount') as string);
    const installmentMonths = parseInt((formData.get('installmentMonths') as string) || '1', 10);
    const startMonth = (formData.get('startMonth') as string) || undefined;
    const disburseImmediately = formData.get('disburseImmediately') === 'true';

    await createLoan(currentUser, {
      employeeId: formData.get('employeeId') as string,
      date: formData.get('date') as string,
      amount,
      installmentMonths,
      startMonth,
      disburseImmediately,
      notes: (formData.get('notes') as string) || undefined,
    });

    revalidatePath('/loans');
    revalidatePath('/payroll');
    revalidatePath('/payroll/adjustments');
    revalidatePath('/payroll/consolidated');
  }

  async function handleDisburseLoan(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    await disburseLoan(currentUser, formData.get('loanId') as string);
    revalidatePath('/loans');
    revalidatePath('/payroll');
    revalidatePath('/payroll/adjustments');
    revalidatePath('/payroll/consolidated');
  }

  async function handleAddCashRepayment(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    await addRepayment(currentUser, {
      loanId: formData.get('loanId') as string,
      amount: parseFloat(formData.get('amount') as string),
      date: formData.get('date') as string,
      method: 'CASH',
    });

    revalidatePath('/loans');
    revalidatePath('/payroll');
    revalidatePath('/payroll/adjustments');
    revalidatePath('/payroll/consolidated');
  }

  return (
    <LoansManagementClient
      employees={employeesForLoan}
      initialLoans={loans as EnrichedLoan[]}
      saveBulkLoansAction={handleSaveBulkLoans}
      createSingleLoanAction={handleCreateSingleLoan}
      disburseLoanAction={handleDisburseLoan}
      addCashRepaymentAction={handleAddCashRepayment}
    />
  );
}
