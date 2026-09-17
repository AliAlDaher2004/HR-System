import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getEmployeeDocuments, getDocumentExpirySummary, createDocument, DocumentType } from '@/lib/services/document-service';
import { getEmployees } from '@/lib/services/employee-service';
import { Card, Button, Badge, Alert } from '@/components/ui';
import { FileText, Plus, FileWarning, Download, AlertTriangle } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { RBAC } from '@/lib/auth/rbac';
import { uploadPrivateFile, PRIVATE_BUCKETS } from '@/lib/supabase/storage';
import { UploadDocumentModal } from '@/components/document/UploadDocumentModal';

export default async function DocumentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!RBAC.canViewDocuments(user.role)) {
    redirect('/');
  }

  const employees = await getEmployees(user);
  const documents = await getEmployeeDocuments(user);
  const expirySummary = await getDocumentExpirySummary(user);

  async function handleUploadDocument(formData: FormData) {
    'use server';
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('غير مصرح');

    const employeeId = formData.get('employeeId') as string;
    const type = formData.get('type') as DocumentType;
    const expiryDate = (formData.get('expiryDate') as string) || null;
    const notes = (formData.get('notes') as string) || undefined;
    const file = formData.get('file') as File;

    if (!file || file.size === 0) {
      throw new Error('يرجى تحديد ملف لرفعه');
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    const uploadRes = await uploadPrivateFile(
      PRIVATE_BUCKETS.DOCUMENTS,
      fileName,
      buffer,
      file.type || 'application/pdf'
    );

    if (!uploadRes.success) {
      throw new Error(uploadRes.error || 'فشل رفع الملف في وحدة التخزين الآمنة');
    }

    await createDocument(currentUser, {
      employeeId,
      type,
      expiryDate,
      filePath: fileName,
      notes,
    });

    revalidatePath('/documents');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#15324F]">إدارة الوثائق والمستندات</h1>
          <p className="text-slate-500 text-sm mt-1">تخزين آمن ومحمي لوثائق الموظفين (هويات، إقامات، تصاريح عمل) وتتبع مواعيد انتهائها</p>
        </div>

        {['ADMIN', 'HR'].includes(user.role) && (
          <UploadDocumentModal
            employees={employees}
            uploadDocumentAction={handleUploadDocument}
          />
        )}
      </div>

      {/* Expiry Alerts */}
      {(expirySummary.expiredCount > 0 || expirySummary.expiringSoonCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {expirySummary.expiredCount > 0 && (
            <Alert variant="error" title={`تنبيه: يوجد ${expirySummary.expiredCount} وثائق منتهية الصلاحية!`}>
              يرجى اتخاذ إجراءات التجديد فوراً للوثائق المنتهية للموظفين.
            </Alert>
          )}
          {expirySummary.expiringSoonCount > 0 && (
            <Alert variant="warning" title={`تنبيه: يوجد ${expirySummary.expiringSoonCount} وثائق تنتهي خلال 30 يوم:`}>
              {expirySummary.expiringSoonList.map((doc: any, idx: number) => (
                <div key={idx} className="text-xs mt-1">
                  • {doc.employeeName} ({doc.type}) - ينتهي بتاريخ: {doc.expiryDate}
                </div>
              ))}
            </Alert>
          )}
        </div>
      )}

      {/* Documents Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4">اسم الموظف</th>
                <th className="py-3 px-4">القسم</th>
                <th className="py-3 px-4">نوع الوثيقة</th>
                <th className="py-3 px-4">تاريخ الانتهاء</th>
                <th className="py-3 px-4">ملاحظات</th>
                <th className="py-3 px-4">رابط التحميل الآمن (Signed URL)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    لا توجد وثائق مرفوعة حتى الآن
                  </td>
                </tr>
              ) : (
                documents.map((doc: any) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#15324F]">{doc.employeeName}</td>
                    <td className="py-3 px-4 text-slate-600">{doc.department}</td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800">
                        {doc.type === 'IDENTITY' ? 'هوية وطنية' :
                         doc.type === 'RESIDENCY' ? 'إقامة' :
                         doc.type === 'WORK_PERMIT' ? 'تصريح عمل' :
                         doc.type === 'CERTIFICATE' ? 'شهادة ومؤهل' : 'أخرى'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {doc.expiryDate ? (
                        <span className={new Date(doc.expiryDate) < new Date() ? 'text-red-600 font-bold' : 'text-slate-700'}>
                          {doc.expiryDate}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">غير محدد</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs">{doc.notes || '-'}</td>
                    <td className="py-3 px-4">
                      {doc.signedUrl ? (
                        <a
                          href={doc.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs font-semibold text-[#2169A6] hover:text-[#1B5587]"
                        >
                          <Download className="w-3.5 h-3.5 ml-1" />
                          تحميل برابط مؤقت آمن
                        </a>
                      ) : (
                        <span className="text-slate-400 text-xs">غير متوفر</span>
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
