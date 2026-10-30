import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { RBAC, requireRole } from '@/lib/auth/rbac';
import {
  getWarnings,
  createWarning,
  revokeWarning,
  deleteWarning,
  WarningLevel,
} from '@/lib/services/warning-service';
import { getEmployees } from '@/lib/services/employee-service';
import { WarningsClientPage } from './WarningsClientPage';
import { revalidatePath } from 'next/cache';

export default async function WarningsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!RBAC.canViewWarnings(user.role)) {
    redirect('/');
  }

  // Fetch warnings and active employees in parallel
  const [warningsList, employeesList] = await Promise.all([
    getWarnings(user),
    getEmployees(user, { status: 'ACTIVE' }),
  ]);

  const employeesOptions = employeesList.map((emp) => ({
    id: emp.id,
    name: emp.name,
    employeeNo: emp.employeeNo,
    department: emp.department,
  }));

  // Server Actions
  async function handleCreateWarning(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');
    requireRole(currentUser, ['ADMIN', 'HR']);

    const employeeId = formData.get('employeeId') as string;
    const warningLevel = formData.get('warningLevel') as WarningLevel;
    const warningDate = formData.get('warningDate') as string;
    const title = formData.get('title') as string;
    const reason = formData.get('reason') as string;
    const administrativeAction = (formData.get('administrativeAction') as string) || null;
    const signedByEmployee = formData.get('signedByEmployee') === 'true';
    const notes = (formData.get('notes') as string) || null;

    const file = formData.get('attachment') as File | null;
    let fileBuffer: Buffer | undefined;
    let mimeType: string | undefined;
    let originalFilename: string | undefined;

    if (file && file.size > 0 && typeof file.arrayBuffer === 'function') {
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      mimeType = file.type;
      originalFilename = file.name;
    }

    await createWarning(currentUser, {
      employeeId,
      warningLevel,
      warningDate,
      title,
      reason,
      administrativeAction,
      signedByEmployee,
      notes,
      fileBuffer,
      mimeType,
      originalFilename,
    });

    revalidatePath('/warnings');
    revalidatePath(`/employees/${employeeId}`);
  }

  async function handleRevokeWarning(id: string, revokeReason?: string) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');
    requireRole(currentUser, ['ADMIN', 'HR']);

    await revokeWarning(currentUser, id, revokeReason);
    revalidatePath('/warnings');
  }

  async function handleDeleteWarning(id: string) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');
    requireRole(currentUser, ['ADMIN']);

    await deleteWarning(currentUser, id);
    revalidatePath('/warnings');
  }

  return (
    <WarningsClientPage
      warnings={warningsList}
      employees={employeesOptions}
      userRole={user.role}
      createWarningAction={handleCreateWarning}
      revokeWarningAction={handleRevokeWarning}
      deleteWarningAction={handleDeleteWarning}
    />
  );
}
