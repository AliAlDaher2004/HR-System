import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getDb, schema } from '@/db';
import { eq, desc } from 'drizzle-orm';
import { Card, Button, Badge } from '@/components/ui';
import { RBAC, UserRole } from '@/lib/auth/rbac';
import { UserCog, Plus, UserCheck, UserX } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { logAuditEvent } from '@/lib/auth/audit';
import { CreateUserModal } from '@/components/user/CreateUserModal';

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!RBAC.canManageUsers(user.role)) {
    redirect('/');
  }

  const db = getDb();
  const usersList = await db.select().from(schema.users).orderBy(desc(schema.users.createdAt));

  async function handleCreateUser(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser || !RBAC.canManageUsers(currentUser.role)) {
      throw new Error('غير مصرح');
    }

    const email = (formData.get('email') as string).trim().toLowerCase();
    const fullName = (formData.get('fullName') as string).trim();
    const role = formData.get('role') as UserRole;

    const currentDb = getDb();
    const [inserted] = await currentDb.insert(schema.users).values({
      email,
      fullName,
      role,
      active: true,
    }).returning();

    await logAuditEvent({
      actor: currentUser,
      tableName: 'users',
      recordId: inserted.id,
      action: 'CREATE_USER',
      newStatus: 'ACTIVE',
      metadata: { email, role },
    });

    revalidatePath('/users');
  }

  async function handleToggleActive(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser || !RBAC.canManageUsers(currentUser.role)) {
      throw new Error('غير مصرح');
    }

    const targetUserId = formData.get('userId') as string;
    const currentActive = formData.get('currentActive') === 'true';
    const newActive = !currentActive;

    const currentDb = getDb();
    await currentDb.update(schema.users)
      .set({
        active: newActive,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, targetUserId));

    await logAuditEvent({
      actor: currentUser,
      tableName: 'users',
      recordId: targetUserId,
      action: newActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      oldStatus: currentActive ? 'ACTIVE' : 'INACTIVE',
      newStatus: newActive ? 'ACTIVE' : 'INACTIVE',
    });

    revalidatePath('/users');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#15324F]">إدارة المستخدمين والصلاحيات</h1>
          <p className="text-slate-500 text-sm mt-1">إضافة مستخدمي النظام وتحديد أدوارهم (إدارة، موارد بشرية، محاسب، مشرف) وتفعيل/تعطيل الحسابات</p>
        </div>

        <CreateUserModal createUserAction={handleCreateUser} />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4">الاسم الكامل</th>
                <th className="py-3 px-4">البريد الإلكتروني</th>
                <th className="py-3 px-4">الدور / الصلاحية</th>
                <th className="py-3 px-4">حالة الحساب</th>
                <th className="py-3 px-4">تاريخ الإنشاء</th>
                <th className="py-3 px-4">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usersList.map((u: any) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-semibold text-[#15324F]">{u.fullName}</td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-600" dir="ltr">{u.email}</td>
                  <td className="py-3 px-4">
                    <Badge variant={u.role === 'ADMIN' ? 'active' : u.role === 'HR' ? 'approved' : u.role === 'ACCOUNTANT' ? 'pending' : 'draft'}>
                      {u.role === 'ADMIN' ? 'إدارة' : u.role === 'HR' ? 'موارد بشرية' : u.role === 'ACCOUNTANT' ? 'محاسب' : 'مشرف'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={u.active ? 'active' : 'rejected'}>
                      {u.active ? 'نشط' : 'معطل'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString('ar-SA')}
                  </td>
                  <td className="py-3 px-4">
                    {/* Cannot deactivate self */}
                    {u.id !== user.id && (
                      <form action={handleToggleActive}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="currentActive" value={u.active ? 'true' : 'false'} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          className={u.active ? 'text-rose-600 border-rose-200 hover:bg-rose-50' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}
                        >
                          {u.active ? (
                            <>
                              <UserX className="w-3.5 h-3.5 ml-1" />
                              تعطيل الحساب
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5 ml-1" />
                              تفعيل الحساب
                            </>
                          )}
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
