import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { Card, Button } from '@/components/ui';
import { RBAC } from '@/lib/auth/rbac';
import { Download, FileSpreadsheet } from 'lucide-react';

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#15324F]">التقارير الإدارية والتصدير</h1>
        <p className="text-slate-500 text-sm mt-1">توليد وتصدير بيانات الحضور، الإجازات، السلف، ومسيرات الرواتب بصيغة CSV المتوافقة مع Excel</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Attendance Report Card */}
        <Card className="flex flex-col justify-between p-5 border-slate-200">
          <div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#2169A6] flex items-center justify-center mb-3">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#15324F]">تقرير الحضور والانصراف الشهري</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              سجل كامل لكافة أيام الحضور، الغياب، الإجازات المدفوعة وغير المدفوعة مع ساعات العمل الفعلي لكل موظف.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">{currentMonth}</span>
            <a href={`/api/reports/export?type=attendance&month=${currentMonth}`} download>
              <Button size="sm" variant="outline" className="flex items-center">
                <Download className="w-3.5 h-3.5 ml-1" />
                تصدير CSV
              </Button>
            </a>
          </div>
        </Card>

        {/* Leave Balances Report Card */}
        {['ADMIN', 'HR', 'ACCOUNTANT'].includes(user.role) && (
          <Card className="flex flex-col justify-between p-5 border-slate-200">
            <div>
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[#15324F]">تقرير أرصدة وإجازات الموظفين</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                ملخص سنوي للأيام الافتتاحية، المستحقة، المستهلكة، والمتبقية من الإجازات السنوية والمرضية.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400">2026</span>
              <a href="/api/reports/export?type=leave" download>
                <Button size="sm" variant="outline" className="flex items-center">
                  <Download className="w-3.5 h-3.5 ml-1" />
                  تصدير CSV
                </Button>
              </a>
            </div>
          </Card>
        )}

        {/* Loans Report Card */}
        {RBAC.canManageLoans(user.role) && (
          <Card className="flex flex-col justify-between p-5 border-slate-200">
            <div>
              <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[#15324F]">تقرير السلف والمستحقات المالية</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                كشف إجمالي بالسلف المصروفة، إجمالي الأقساط المسددة (نقداً أو عبر الرواتب)، والمتبقي غير المسدد.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400">شامل</span>
              <a href="/api/reports/export?type=loans" download>
                <Button size="sm" variant="outline" className="flex items-center">
                  <Download className="w-3.5 h-3.5 ml-1" />
                  تصدير CSV
                </Button>
              </a>
            </div>
          </Card>
        )}

        {/* Payroll Register Report Card (Admin & Accountant only!) */}
        {RBAC.canViewFinancials(user.role) && (
          <Card className="flex flex-col justify-between p-5 border-slate-200">
            <div>
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[#15324F]">مسير الرواتب الشهري (Payroll Register)</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                جدول مالي مفصل للرواتب الأساسية، البدلات، الإضافي، خصومات الغياب، أقساط السلف، وصافي الرواتب.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400">{currentMonth}</span>
              <a href={`/api/reports/export?type=payroll&month=${currentMonth}`} download>
                <Button size="sm" variant="outline" className="flex items-center">
                  <Download className="w-3.5 h-3.5 ml-1" />
                  تصدير CSV
                </Button>
              </a>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
