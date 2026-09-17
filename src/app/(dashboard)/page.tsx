import React from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getDb, schema } from '@/db';
import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { RBAC } from '@/lib/auth/rbac';
import Link from 'next/link';
import { getSystemSettings } from '@/lib/services/settings-service';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const db = getDb();
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7);

  // Parallelize all database queries to run in a single concurrent network roundtrip
  const [
    activeEmployees,
    todayAttendance,
    allContracts,
    pendingLeaves,
    monthlyPayrolls,
    settings,
  ] = await Promise.all([
    db.select().from(schema.employees).where(eq(schema.employees.status, 'ACTIVE')),
    db.select().from(schema.attendance).where(eq(schema.attendance.workDate, todayStr)),
    db.select().from(schema.contracts),
    ['ADMIN', 'HR', 'ACCOUNTANT'].includes(user.role)
      ? db.select().from(schema.leaveRequests).where(eq(schema.leaveRequests.status, 'PENDING'))
      : Promise.resolve([]),
    RBAC.canViewFinancials(user.role)
      ? db.select().from(schema.payroll).where(
          and(
            eq(schema.payroll.periodStart, `${currentMonthStr}-01`),
            sql`status != 'CANCELLED'`
          )
        )
      : Promise.resolve([]),
    getSystemSettings().catch(() => ({ currency: 'JOD' })),
  ]);

  // 1. Employee statistics
  const permanentCount = activeEmployees.filter((e: any) => e.employmentType === 'PERMANENT').length;
  const dailyWorkerCount = activeEmployees.filter((e: any) => e.employmentType === 'DAILY_WORKER').length;
  const unregisteredSSCount = activeEmployees.filter((e: any) => !e.socialSecurityRegistered).length;

  // 2. Attendance stats for today
  const presentOnTimeCount = todayAttendance.filter((a: any) => a.attendanceType === 'PRESENT' && (a.lateMinutes ?? 0) === 0).length;
  const lateCount = todayAttendance.filter((a: any) => a.attendanceType === 'PRESENT' && (a.lateMinutes ?? 0) > 0).length;
  const absentCount = todayAttendance.filter((a: any) => a.attendanceType === 'ABSENT' || a.attendanceType === 'UNEXCUSED_ABSENCE').length;
  const earlyDepartureCount = todayAttendance.filter((a: any) => a.earlyDeparture).length;

  // 3. Unsigned active contracts
  const unsignedContractsCount = allContracts.filter((c: any) => !c.contractSigned).length;

  // 4. Pending items
  const pendingLeavesCount = pendingLeaves.length;

  // 5. Payroll metrics
  const monthlyPayrollCount = monthlyPayrolls.length;
  const approvedPayrollCount = monthlyPayrolls.filter((p: any) => p.status === 'APPROVED' || p.status === 'PAID').length;

  // 6. Company settings
  const isPolicyConfirmed = settings?.payrollPolicyConfirmed ?? false;

  return (
    <div className="space-y-3 select-none text-xs">
      {/* Windows 2000 System Welcome Header */}
      <div className="win-raised p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#ECE9D8]">
        <div>
          <div className="flex items-center gap-1.5 font-bold text-black text-sm">
            <span>💼</span>
            <span>نظام إدارة الموارد البشرية والرواتب - لوحة القيادة المركزية</span>
          </div>
          <div className="text-[11px] text-[#505050] mt-0.5">
            المستخدم: <strong className="text-black">{user.fullName}</strong> | الصلاحية: <strong>{user.role}</strong> | التاريخ: <strong>{todayStr}</strong>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Link href="/attendance" className="win-btn text-xs font-bold px-2.5 py-1 text-emerald-800">
            ⏱ تسجيل حضور اليوم
          </Link>
          <Link href="/payroll" className="win-btn text-xs font-bold px-2.5 py-1 text-[#0A246A]">
            💵 مسيرات الرواتب
          </Link>
        </div>
      </div>

      {/* Policy Alert if not confirmed */}
      {user.role === 'ADMIN' && !isPolicyConfirmed && (
        <div className="win-sunken p-2 bg-amber-50 border border-amber-400 text-amber-950 flex items-center justify-between">
          <span>⚠ تنبيه: لم يتم تأكيد سياسة الرواتب والأجور في الإعدادات حتى الآن. لا يمكن اعتماد كشوف الرواتب.</span>
          <Link href="/settings" className="win-btn text-[11px] px-2 py-0.5 font-bold text-amber-900">
            تأكيد السياسة الآن
          </Link>
        </div>
      )}

      {/* KPI Tiles Section (Windows 2000 Sunken Metric Panels) */}
      <div className="win-raised p-2 bg-[#ECE9D8]">
        <div className="text-[11px] font-bold text-black mb-1.5 flex items-center gap-1">
          <span>📊</span>
          <span>مؤشرات الحضور اليومية ({todayStr})</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="win-sunken bg-white p-2 text-center border-r-2 border-emerald-600">
            <div className="text-[11px] text-emerald-800">حاضر في الموعد</div>
            <div className="text-xl font-bold font-mono text-emerald-700">{presentOnTimeCount}</div>
            <div className="text-[10px] text-slate-500">0 دقيقة تأخير</div>
          </div>

          <div className="win-sunken bg-white p-2 text-center border-r-2 border-amber-500">
            <div className="text-[11px] text-amber-800">متأخرون عن الموعد</div>
            <div className="text-xl font-bold font-mono text-amber-700">{lateCount}</div>
            <div className="text-[10px] text-slate-500">تم احتساب دقائق التأخير</div>
          </div>

          <div className="win-sunken bg-white p-2 text-center border-r-2 border-rose-600">
            <div className="text-[11px] text-rose-800">غياب كامل</div>
            <div className="text-xl font-bold font-mono text-rose-700">{absentCount}</div>
            <div className="text-[10px] text-slate-500">يوم غياب غير مدفوع</div>
          </div>

          <div className="win-sunken bg-white p-2 text-center border-r-2 border-blue-600">
            <div className="text-[11px] text-blue-800">مغادرة مبكرة</div>
            <div className="text-xl font-bold font-mono text-blue-700">{earlyDepartureCount}</div>
            <div className="text-[10px] text-slate-500">تم تسجيل الانصراف المبكر</div>
          </div>
        </div>
      </div>

      {/* Personnel & Compliance KPIs */}
      <div className="win-raised p-2 bg-[#ECE9D8]">
        <div className="text-[11px] font-bold text-black mb-1.5 flex items-center gap-1">
          <span>👥</span>
          <span>مؤشرات الكادر الوظيفي والامتثال التعاقدي</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="win-sunken bg-white p-2 text-center border-r-2 border-[#0A246A]">
            <div className="text-[11px] text-[#0A246A]">موظفون مثبتون (دائمون)</div>
            <div className="text-xl font-bold font-mono text-black">{permanentCount}</div>
            <div className="text-[10px] text-slate-500">عقود ورواتب شهرية</div>
          </div>

          <div className="win-sunken bg-white p-2 text-center border-r-2 border-amber-600">
            <div className="text-[11px] text-amber-800">عمال مياومة (مؤقتون)</div>
            <div className="text-xl font-bold font-mono text-amber-900">{dailyWorkerCount}</div>
            <div className="text-[10px] text-slate-500">احتساب حسب أيام العمل</div>
          </div>

          <div className="win-sunken bg-white p-2 text-center border-r-2 border-rose-500">
            <div className="text-[11px] text-rose-800">غير مسجلين في الضمان</div>
            <div className="text-xl font-bold font-mono text-rose-700">{unregisteredSSCount}</div>
            <div className="text-[10px] text-slate-500">بحاجة لاستكمال التسجيل</div>
          </div>

          <div className="win-sunken bg-white p-2 text-center border-r-2 border-purple-600">
            <div className="text-[11px] text-purple-800">عقود غير موقعة</div>
            <div className="text-xl font-bold font-mono text-purple-700">{unsignedContractsCount}</div>
            <div className="text-[10px] text-slate-500">عقود نشطة بانتظار التوقيع</div>
          </div>
        </div>
      </div>

      {/* Quick Launchpad */}
      <div className="win-raised p-2 bg-[#ECE9D8]">
        <div className="text-[11px] font-bold text-black mb-1.5">اختصارات المهام السريعة</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Link href="/attendance" className="win-btn p-2 text-center font-bold text-xs flex flex-col items-center gap-1">
            <span className="text-base">⏱</span>
            <span>جدول الحضور اليومي السريع</span>
          </Link>
          <Link href="/employees" className="win-btn p-2 text-center font-bold text-xs flex flex-col items-center gap-1">
            <span className="text-base">👤</span>
            <span>دليل الموظفين وعقودهم</span>
          </Link>
          <Link href="/payroll" className="win-btn p-2 text-center font-bold text-xs flex flex-col items-center gap-1">
            <span className="text-base">💵</span>
            <span>مسيرات الرواتب للشهر الحالي</span>
          </Link>
          <Link href="/settings" className="win-btn p-2 text-center font-bold text-xs flex flex-col items-center gap-1">
            <span className="text-base">⚙</span>
            <span>مواعيد الدوام وسعر خصم الدقيقة</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
