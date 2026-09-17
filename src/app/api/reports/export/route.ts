import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { RBAC } from '@/lib/auth/rbac';
import { convertToCSV, getAttendanceReport, getPayrollRegisterReport } from '@/lib/services/report-service';
import { getLeaveBalances } from '@/lib/services/leave-service';
import { getLoans } from '@/lib/services/loan-service';
import { getEmployees } from '@/lib/services/employee-service';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse('يجب تسجيل الدخول', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

  try {
    let csvData = '';
    let fileName = 'report.csv';

    if (type === 'attendance') {
      const records = await getAttendanceReport(user, month);
      const headers = ['الرقم الوظيفي', 'اسم الموظف', 'القسم', 'تاريخ العمل', 'نوع الحضور', 'أيام الغياب', 'ساعات الإضافي', 'الحالة'];
      const rows = records.map((r: any) => [
        r.employeeNo,
        r.employeeName,
        r.department,
        r.workDate,
        r.attendanceType,
        r.unpaidDays,
        r.approvedOtHours,
        r.status,
      ]);
      csvData = convertToCSV(headers, rows);
      fileName = `attendance_${month}.csv`;
    } else if (type === 'payroll') {
      // Strict role check: Supervisor and HR cannot export payroll!
      if (!RBAC.canViewFinancials(user.role)) {
        return new NextResponse('غير مصرح لك بتصدير كشوف الرواتب', { status: 403 });
      }
      const records = await getPayrollRegisterReport(user, month);
      const headers = [
        'الرقم الوظيفي',
        'اسم الموظف',
        'القسم',
        'المسمى الوظيفي',
        'نوع التوظيف',
        'الأساسي / الأجر',
        'البدلات',
        'ساعات الإضافي',
        'معدل الإضافي',
        'مبلغ الإضافي',
        'دقائق التأخير',
        'خصم التأخير',
        'دقائق المغادرة',
        'خصم المغادرة',
        'أيام الغياب',
        'خصم الغياب',
        'إضافات أخرى',
        'خصومات أخرى',
        'خصم السلف',
        'إجمالي المستحقات',
        'إجمالي الخصومات',
        'صافي الراتب',
        'حالة المسير'
      ];
      const rows = records.map((r: any) => [
        r.employeeNo,
        r.employeeName,
        r.department,
        r.jobTitle,
        r.employmentType === 'DAILY_WORKER' ? 'مياومة' : 'مثبت',
        r.employmentType === 'DAILY_WORKER'
          ? `${Number(r.dailyRate || 0).toFixed(3)} × ${r.workedDays || 0}ي`
          : Number(r.basicEarned || 0).toFixed(3),
        Number(r.allowancesEarned || 0).toFixed(3),
        r.otHours,
        r.otRate,
        r.otTotal,
        r.lateMinutes || 0,
        Number(r.lateDeduction || 0).toFixed(3),
        r.earlyDepartureMinutes || 0,
        Number(r.earlyDepartureDeduction || 0).toFixed(3),
        r.unpaidDays,
        r.unpaidDeduction,
        Number(r.otherAdditions || 0).toFixed(3),
        Number(r.otherDeductions || 0).toFixed(3),
        Number(r.loanDeduction || 0).toFixed(3),
        r.grossPay,
        r.totalDeductions,
        r.netCalculated,
        r.status === 'PAID' ? 'مدفوع' : r.status === 'APPROVED' ? 'معتمد' : r.status === 'DRAFT' ? 'مسودة' : 'ملغى',
      ]);
      csvData = convertToCSV(headers, rows);
      fileName = `payroll_register_${month}.csv`;
    } else if (type === 'loans') {
      if (!RBAC.canManageLoans(user.role)) {
        return new NextResponse('غير مصرح لك بتصدير تقرير السلف', { status: 403 });
      }
      const loans = await getLoans(user);
      const headers = ['الموظف', 'الرقم الوظيفي', 'القسم', 'تاريخ السلفة', 'المبلغ', 'العملة', 'المسدد', 'المتبقي', 'الحالة'];
      const rows = loans.map((l) => [
        l.employeeName,
        l.employeeNo,
        l.department,
        l.date,
        l.amount,
        l.currency,
        l.paidTotal,
        l.remaining,
        l.status,
      ]);
      csvData = convertToCSV(headers, rows);
      fileName = `loans_summary.csv`;
    } else if (type === 'leave') {
      if (user.role === 'SUPERVISOR') {
        return new NextResponse('غير مصرح للمشرف بتصدير بيانات الإجازات', { status: 403 });
      }
      const employees = await getEmployees(user);
      const headers = ['الموظف', 'الرقم الوظيفي', 'نوع الإجازة', 'السنة', 'الرصيد الافتتاحي', 'الممنوح', 'المستهلك', 'المتبقي'];
      const rows: any[] = [];
      for (const emp of employees) {
        const balances = await getLeaveBalances(emp.id);
        for (const b of balances) {
          rows.push([
            emp.name,
            emp.employeeNo,
            b.leaveType,
            b.year,
            b.openingDays,
            b.grantedDays,
            b.usedDays,
            b.remainingDays,
          ]);
        }
      }
      csvData = convertToCSV(headers, rows);
      fileName = `leave_balances.csv`;
    } else {
      return new NextResponse('نوع التقرير غير محدد أو غير صالح', { status: 400 });
    }

    return new NextResponse(csvData, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    return new NextResponse(err.message || 'فشل توليد التقرير', { status: 500 });
  }
}
