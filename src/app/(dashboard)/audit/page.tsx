import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getDb, schema } from '@/db';
import { desc } from 'drizzle-orm';
import { Card, Badge } from '@/components/ui';
import { RBAC } from '@/lib/auth/rbac';
import { History, ShieldAlert } from 'lucide-react';

export default async function AuditLogPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!RBAC.canViewAuditLog(user.role)) {
    redirect('/');
  }

  const db = getDb();
  const logs = await db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.eventAt)).limit(100);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#15324F]">سجل العمليات والتدقيق الأمني (Audit Log)</h1>
          <p className="text-slate-500 text-sm mt-1">سجل غير قابل للتعديل (Append-Only) يوثق كافة الإجراءات الحساسة، التغييرات المالية، والاعتمادات</p>
        </div>
        <Badge variant="active" className="py-1 px-3">
          محمي من التعديل والحذف (Append-Only)
        </Badge>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4">التوقيت</th>
                <th className="py-3 px-4">المستخدم (الفاعل)</th>
                <th className="py-3 px-4">الدور</th>
                <th className="py-3 px-4">الجدول</th>
                <th className="py-3 px-4">نوع الإجراء</th>
                <th className="py-3 px-4">الحالة السابقة</th>
                <th className="py-3 px-4">الحالة الجديدة</th>
                <th className="py-3 px-4">معرف السجل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    لا توجد أحداث مسجلة في سجل التدقيق
                  </td>
                </tr>
              ) : (
                logs.map((l: any) => (
                  <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">
                      {new Date(l.eventAt).toLocaleString('ar-SA')}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{l.actorName}</td>
                    <td className="py-3 px-4">
                      <Badge variant="default">{l.actorRole}</Badge>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">{l.tableName}</td>
                    <td className="py-3 px-4 font-medium text-[#2169A6]">{l.action}</td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-500">{l.oldStatus || '-'}</td>
                    <td className="py-3 px-4 text-xs font-mono font-bold text-slate-800">{l.newStatus || '-'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-400">{l.recordId.slice(0, 8)}...</td>
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
