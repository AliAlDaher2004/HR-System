import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import {
  getEmployeeById,
  updateSocialSecurity,
  uploadIdentityImage,
  getEmployeeIdentityImages,
  updateEmployee,
} from '@/lib/services/employee-service';
import { getContractsByEmployeeId, createContract } from '@/lib/services/contract-service';
import { getAttendanceRecords } from '@/lib/services/attendance-service';
import { getLeaveBalances, getLeaveRequests } from '@/lib/services/leave-service';
import { getLoans } from '@/lib/services/loan-service';
import { getPayrolls } from '@/lib/services/payroll-service';
import { getEmployeeDocuments } from '@/lib/services/document-service';
import { Badge } from '@/components/ui';
import { RBAC } from '@/lib/auth/rbac';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { EmployeeDetailTabs } from '@/components/employee/EmployeeDetailTabs';

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const employeeId = resolvedParams.id;
  const initialTab = resolvedSearchParams.tab || 'basic';

  const employee = await getEmployeeById(user, employeeId);

  // Fetch all authorized tab data in parallel for zero tab switching latency
  const [
    contracts,
    attendances,
    leaveBalances,
    leaveRequests,
    loans,
    payrolls,
    documents,
    identityImages,
  ] = await Promise.all([
    RBAC.canViewContracts(user.role) ? getContractsByEmployeeId(user, employeeId) : Promise.resolve([]),
    getAttendanceRecords(user, { employeeId }),
    ['ADMIN', 'HR', 'ACCOUNTANT'].includes(user.role) ? getLeaveBalances(employeeId) : Promise.resolve([]),
    ['ADMIN', 'HR', 'ACCOUNTANT'].includes(user.role) ? getLeaveRequests(user, { employeeId }) : Promise.resolve([]),
    RBAC.canManageLoans(user.role) ? getLoans(user, employeeId) : Promise.resolve([]),
    RBAC.canViewFinancials(user.role) ? getPayrolls(user, { employeeId }) : Promise.resolve([]),
    RBAC.canViewDocuments(user.role) ? getEmployeeDocuments(user, employeeId) : Promise.resolve([]),
    ['ADMIN', 'HR'].includes(user.role)
      ? getEmployeeIdentityImages(user, employeeId).catch(() => ({ frontUrl: null, backUrl: null }))
      : Promise.resolve({ frontUrl: null, backUrl: null }),
  ]);

  async function handleCreateContract(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    const contractSigned = formData.get('contractSigned') === 'true';
    const contractSignedDate = formData.get('contractSignedDate') as string;

    await createContract(currentUser, {
      employeeId,
      startDate: formData.get('startDate') as string,
      endDate: (formData.get('endDate') as string) || undefined,
      monthlyBasic: parseFloat(formData.get('monthlyBasic') as string),
      monthlyAllowances: parseFloat((formData.get('monthlyAllowances') as string) || '0'),
      unpaidDayRate: parseFloat(formData.get('unpaidDayRate') as string),
      otRate: parseFloat(formData.get('otRate') as string),
      contractSigned,
      contractSignedDate: contractSigned ? (contractSignedDate || null) : null,
    });

    revalidatePath(`/employees/${employeeId}`);
  }

  async function handleUpdateSocialSecurity(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    const isRegistered = formData.get('socialSecurityRegistered') === 'true';
    const regDate = (formData.get('socialSecurityRegistrationDate') as string) || null;

    await updateSocialSecurity(currentUser, employeeId, {
      socialSecurityRegistered: isRegistered,
      socialSecurityRegistrationDate: isRegistered ? regDate : null,
    });

    revalidatePath(`/employees/${employeeId}`);
  }

  async function handleUploadIdentityImage(side: 'front' | 'back', formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    const file = formData.get('image') as File;
    if (!file) throw new Error('الملف مفقود');

    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadIdentityImage(
      currentUser,
      employeeId,
      side,
      buffer,
      file.type,
      file.name
    );

    revalidatePath(`/employees/${employeeId}`);
  }

  async function handleUpdateSchedule(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    const startTime = formData.get('workStartTime') as string;
    const endTime = formData.get('workEndTime') as string;
    const breakMinsRaw = formData.get('breakMinutes') as string;
    const minDeductionRaw = formData.get('minuteDeductionRate') as string;

    await updateEmployee(currentUser, employeeId, {
      workStartTime: startTime || null,
      workEndTime: endTime || null,
      breakMinutes: breakMinsRaw ? parseInt(breakMinsRaw, 10) : null,
      minuteDeductionRate: minDeductionRaw ? parseFloat(minDeductionRaw) : null,
    });

    revalidatePath(`/employees/${employeeId}`);
  }

  async function handleUpdateStatus(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    const newStatus = formData.get('status') as 'ACTIVE' | 'TERMINATED';
    const endDateRaw = (formData.get('endDate') as string) || null;

    await updateEmployee(currentUser, employeeId, {
      status: newStatus,
      endDate: newStatus === 'TERMINATED' ? endDateRaw : null,
    });

    revalidatePath('/employees');
    revalidatePath(`/employees/${employeeId}`);
  }

  async function handleToggleContractSigned(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    const contractId = formData.get('contractId') as string;
    const isSigned = formData.get('contractSigned') === 'true';
    const signedDate = (formData.get('contractSignedDate') as string) || null;

    const { updateContract } = await import('@/lib/services/contract-service');
    await updateContract(currentUser, contractId, {
      contractSigned: isSigned,
      contractSignedDate: isSigned ? (signedDate || new Date().toISOString().slice(0, 10)) : null,
    });

    revalidatePath(`/employees/${employeeId}`);
  }

  async function handleUpdateEmployee(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    const empType = (formData.get('employmentType') as 'PERMANENT' | 'PROBATIONARY' | 'DAILY_WORKER') || 'PERMANENT';
    const ssRegistered = formData.get('socialSecurityRegistered') === 'true';
    const ssDate = formData.get('socialSecurityRegistrationDate') as string;
    const dailyRateRaw = formData.get('dailyRate') as string;
    const minDeductionRaw = formData.get('minuteDeductionRate') as string;
    const breakMinsRaw = formData.get('breakMinutes') as string;

    await updateEmployee(currentUser, employeeId, {
      name: formData.get('name') as string,
      department: formData.get('department') as string,
      jobTitle: formData.get('jobTitle') as string,
      phone: (formData.get('phone') as string) || undefined,
      startDate: formData.get('startDate') as string,
      endDate: (formData.get('endDate') as string) || null,
      employmentType: empType,
      socialSecurityRegistered: ssRegistered,
      socialSecurityRegistrationDate: ssRegistered ? (ssDate || null) : null,
      dailyRate: dailyRateRaw ? parseFloat(dailyRateRaw) : null,
      minuteDeductionRate: minDeductionRaw ? parseFloat(minDeductionRaw) : null,
      workStartTime: (formData.get('workStartTime') as string) || null,
      workEndTime: (formData.get('workEndTime') as string) || null,
      breakMinutes: breakMinsRaw ? parseInt(breakMinsRaw, 10) : null,
    });

    revalidatePath('/employees');
    revalidatePath(`/employees/${employeeId}`);
  }

  return (
    <div className="space-y-2">
      {/* Titlebar in Windows 2000 style */}
      <div className="win-raised p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#ECE9D8]">
        <div className="flex items-center gap-2">
          <Link
            href="/employees"
            prefetch={true}
            className="win-btn text-xs font-bold px-2 py-0.5"
            title="العودة لقائمة الموظفين"
          >
            ◄ عودة
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-black">{employee.name}</span>
              <span className="font-mono text-xs font-bold text-[#0A246A]">({employee.employeeNo})</span>
              <Badge variant={employee.status === 'ACTIVE' ? 'active' : 'rejected'}>
                {employee.status === 'ACTIVE' ? 'نشط' : 'منتهي'}
              </Badge>
            </div>
            <div className="text-[11px] text-[#505050]">
              القسم: {employee.department} | المسمى: {employee.jobTitle}
            </div>
          </div>
        </div>
      </div>

      <EmployeeDetailTabs
        employee={employee}
        userRole={user.role}
        initialTab={initialTab}
        contracts={contracts}
        attendances={attendances}
        leaveBalances={leaveBalances}
        leaveRequests={leaveRequests}
        loans={loans}
        payrolls={payrolls}
        documents={documents}
        identityImages={identityImages}
        createContractAction={handleCreateContract}
        updateSocialSecurityAction={handleUpdateSocialSecurity}
        uploadIdentityImageAction={handleUploadIdentityImage}
        updateScheduleAction={handleUpdateSchedule}
        updateEmployeeAction={handleUpdateEmployee}
        updateStatusAction={handleUpdateStatus}
        toggleContractSignedAction={handleToggleContractSigned}
      />
    </div>
  );
}
