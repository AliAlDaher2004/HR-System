import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getLoans, createLoan, disburseLoan, addRepayment } from '@/lib/services/loan-service';
import { getEmployees } from '@/lib/services/employee-service';
import { Card, Button, Badge } from '@/components/ui';
import { CheckCircle } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { RBAC } from '@/lib/auth/rbac';
import { CreateLoanModal } from '@/components/loan/CreateLoanModal';
import { RepayLoanModal } from '@/components/loan/RepayLoanModal';

export default async function LoansPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!RBAC.canManageLoans(user.role)) {
    redirect('/');
  }

  const employees = await getEmployees(user);
  const loans = await getLoans(user);

  async function handleCreateLoan(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    await createLoan(currentUser, {
      employeeId: formData.get('employeeId') as string,
      date: formData.get('date') as string,
      amount: parseFloat(formData.get('amount') as string),
      notes: (formData.get('notes') as string) || undefined,
    });

    revalidatePath('/loans');
  }

  async function handleDisburseLoan(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    await disburseLoan(currentUser, formData.get('loanId') as string);
    revalidatePath('/loans');
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
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#15324F]">سلف الموظفين والمستحقات</h1>
          <p className="text-slate-500 text-sm mt-1">إدارة السلف، صرف الدفعات، وجدولة ومتابعة الأقساط والسدادات النقدية</p>
        </div>

        <CreateLoanModal employees={employees} createLoanAction={handleCreateLoan} />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4">اسم الموظف</th>
                <th className="py-3 px-4">تاريخ السلفة</th>
                <th className="py-3 px-4">مبلغ السلفة</th>
                <th className="py-3 px-4">المسدد فعلياً</th>
                <th className="py-3 px-4">المتبقي</th>
                <th className="py-3 px-4">الحالة</th>
                <th className="py-3 px-4">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    لا توجد سلف مسجلة
                  </td>
                </tr>
              ) : (
                loans.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#15324F]">{l.employeeName}</td>
                    <td className="py-3 px-4 font-mono">{l.date}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{parseFloat(l.amount).toFixed(3)} {l.currency}</td>
                    <td className="py-3 px-4 font-mono text-emerald-700 font-semibold">{l.paidTotal} {l.currency}</td>
                    <td className="py-3 px-4 font-mono text-rose-700 font-semibold">{l.remaining} {l.currency}</td>
                    <td className="py-3 px-4">
                      <Badge variant={l.status === 'DISBURSED' ? 'active' : l.status === 'PROPOSED' ? 'pending' : 'draft'}>
                        {l.status === 'DISBURSED' ? 'مصروفة' : l.status === 'PROPOSED' ? 'مقترحة' : 'ملغاة'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        {l.status === 'PROPOSED' && (
                          <form action={handleDisburseLoan}>
                            <input type="hidden" name="loanId" value={l.id} />
                            <Button type="submit" size="sm" variant="outline" className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 cursor-pointer">
                              <CheckCircle className="w-3.5 h-3.5 ml-1" />
                              صرف السلفة
                            </Button>
                          </form>
                        )}

                        {l.status === 'DISBURSED' && parseFloat(l.remaining) > 0 && (
                          <RepayLoanModal
                            loanId={l.id}
                            employeeName={l.employeeName}
                            remainingAmount={l.remaining}
                            currency={l.currency}
                            repayLoanAction={handleAddCashRepayment}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
