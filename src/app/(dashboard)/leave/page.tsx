import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getLeaveRequests, createLeaveRequest, approveLeaveRequest, rejectLeaveRequest, getLeaveBalances } from '@/lib/services/leave-service';
import { getEmployees } from '@/lib/services/employee-service';
import { Card, Button, Badge, Alert } from '@/components/ui';
import { CalendarDays, Plus, CheckCircle, XCircle } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { CreateLeaveModal } from '@/components/leave/CreateLeaveModal';

export default async function LeavePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (user.role === 'SUPERVISOR') {
    redirect('/');
  }

  const employees = await getEmployees(user);
  const requests = await getLeaveRequests(user);

  async function handleCreateRequest(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    await createLeaveRequest(currentUser, {
      employeeId: formData.get('employeeId') as string,
      balanceId: (formData.get('balanceId') as string) || null,
      startDate: formData.get('startDate') as string,
      endDate: formData.get('endDate') as string,
      chargeDays: parseFloat(formData.get('chargeDays') as string),
      paid: formData.get('paid') === 'true',
      reason: (formData.get('reason') as string) || undefined,
    });

    revalidatePath('/leave');
  }

  async function handleApprove(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    const leaveId = formData.get('leaveId') as string;
    await approveLeaveRequest(currentUser, leaveId);
    revalidatePath('/leave');
  }

  async function handleReject(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    const leaveId = formData.get('leaveId') as string;
    await rejectLeaveRequest(currentUser, leaveId);
    revalidatePath('/leave');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#15324F]">إدارة الإجازات والأرصدة</h1>
          <p className="text-slate-500 text-sm mt-1">متابعة طلبات الإجازات السنوية والمرضية، التحقق من الأرصدة، واعتماد الإجازات</p>
        </div>

        {['ADMIN', 'HR'].includes(user.role) && (
          <CreateLeaveModal employees={employees} createLeaveAction={handleCreateRequest} />
        )}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4">اسم الموظف</th>
                <th className="py-3 px-4">من تاريخ</th>
                <th className="py-3 px-4">إلى تاريخ</th>
                <th className="py-3 px-4">الأيام</th>
                <th className="py-3 px-4">النوع</th>
                <th className="py-3 px-4">السبب</th>
                <th className="py-3 px-4">الحالة</th>
                <th className="py-3 px-4">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    لا توجد طلبات إجازة مسجلة
                  </td>
                </tr>
              ) : (
                requests.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#15324F]">{r.employeeName}</td>
                    <td className="py-3 px-4 font-mono">{r.startDate}</td>
                    <td className="py-3 px-4 font-mono">{r.endDate}</td>
                    <td className="py-3 px-4 font-mono font-bold">{r.chargeDays} يوم</td>
                    <td className="py-3 px-4">
                      <span className={r.paid ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                        {r.paid ? 'مدفوعة' : 'بدون راتب'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{r.reason || '-'}</td>
                    <td className="py-3 px-4">
                      <Badge variant={r.status === 'APPROVED' ? 'approved' : r.status === 'PENDING' ? 'pending' : 'rejected'}>
                        {r.status === 'APPROVED' ? 'معتمد' : r.status === 'PENDING' ? 'معلق' : r.status === 'REJECTED' ? 'مرفوض' : 'ملغى'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      {r.status === 'PENDING' && ['ADMIN', 'HR'].includes(user.role) && (
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <form action={handleApprove}>
                            <input type="hidden" name="leaveId" value={r.id} />
                            <Button type="submit" size="sm" variant="outline" className="text-emerald-700 border-emerald-300 hover:bg-emerald-50">
                              <CheckCircle className="w-3.5 h-3.5 ml-1" />
                              اعتماد
                            </Button>
                          </form>
                          <form action={handleReject}>
                            <input type="hidden" name="leaveId" value={r.id} />
                            <Button type="submit" size="sm" variant="outline" className="text-rose-700 border-rose-300 hover:bg-rose-50">
                              <XCircle className="w-3.5 h-3.5 ml-1" />
                              رفض
                            </Button>
                          </form>
                        </div>
                      )}
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
