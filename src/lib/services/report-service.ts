import { getDb, schema } from '../../db';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { UserSession, RBAC, AuthorizationError, assertCanViewFinancials } from '../auth/rbac';
import { computeNetPayroll } from './payroll-service';

export function convertToCSV(headers: string[], rows: (string | number)[][]): string {
  const headerLine = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',');
  const rowLines = rows.map((row) =>
    row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
  );
  // Add UTF-8 BOM so Excel opens Arabic text correctly
  return '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
}

export async function getAttendanceReport(actor: UserSession, month: string) {
  const db = getDb();
  const startDate = `${month}-01`;
  const [year, m] = month.split('-').map(Number);
  const lastDay = new Date(year, m, 0).getDate();
  const endDate = `${month}-${lastDay}`;

  const records = await db.select({
    employeeNo: schema.employees.employeeNo,
    employeeName: schema.employees.name,
    department: schema.employees.department,
    employmentType: schema.employees.employmentType,
    workDate: schema.attendance.workDate,
    attendanceType: schema.attendance.attendanceType,
    workedMinutes: schema.attendance.workedMinutes,
    lateMinutes: schema.attendance.lateMinutes,
    earlyDeparture: schema.attendance.earlyDeparture,
    earlyDepartureMinutes: schema.attendance.earlyDepartureMinutes,
    unpaidDays: schema.attendance.unpaidDays,
    approvedOtHours: schema.attendance.approvedOtHours,
    status: schema.attendance.status,
  })
  .from(schema.attendance)
  .innerJoin(schema.employees, eq(schema.attendance.employeeId, schema.employees.id))
  .where(and(gte(schema.attendance.workDate, startDate), lte(schema.attendance.workDate, endDate)))
  .orderBy(schema.employees.employeeNo, schema.attendance.workDate);

  return records;
}

export async function getPayrollRegisterReport(actor: UserSession, month: string) {
  assertCanViewFinancials(actor);
  const db = getDb();
  const startDate = `${month}-01`;

  const rows = await db.select({
    employeeNo: schema.employees.employeeNo,
    employeeName: schema.employees.name,
    department: schema.employees.department,
    jobTitle: schema.employees.jobTitle,
    employmentType: schema.employees.employmentType,
    currency: schema.payroll.currency,
    basicEarned: schema.payroll.basicEarned,
    allowancesEarned: schema.payroll.allowancesEarned,
    workedDays: schema.payroll.workedDays,
    workedMinutes: schema.payroll.workedMinutes,
    dailyRate: schema.payroll.dailyRate,
    lateMinutes: schema.payroll.lateMinutes,
    lateDeduction: schema.payroll.lateDeduction,
    earlyDepartureMinutes: schema.payroll.earlyDepartureMinutes,
    earlyDepartureDeduction: schema.payroll.earlyDepartureDeduction,
    otHours: schema.payroll.otHours,
    otRate: schema.payroll.otRate,
    unpaidDays: schema.payroll.unpaidDays,
    unpaidDayRate: schema.payroll.unpaidDayRate,
    otherAdditions: schema.payroll.otherAdditions,
    otherDeductions: schema.payroll.otherDeductions,
    loanDeduction: schema.payroll.loanDeduction,
    netPay: schema.payroll.netPay,
    status: schema.payroll.status,
    paymentMethod: schema.payroll.paymentMethod,
    paymentReference: schema.payroll.paymentReference,
    paidAt: schema.payroll.paidAt,
  })
  .from(schema.payroll)
  .innerJoin(schema.employees, eq(schema.payroll.employeeId, schema.employees.id))
  .where(eq(schema.payroll.periodStart, startDate))
  .orderBy(schema.employees.employeeNo);

  return rows.map((r: any) => {
    const calc = computeNetPayroll({
      employmentType: r.employmentType,
      workedDays: r.workedDays,
      dailyRate: parseFloat(r.dailyRate || '0'),
      basicEarned: parseFloat(r.basicEarned || '0'),
      allowancesEarned: parseFloat(r.allowancesEarned || '0'),
      otHours: parseFloat(r.otHours || '0'),
      otRate: parseFloat(r.otRate || '0'),
      otherAdditions: parseFloat(r.otherAdditions || '0'),
      unpaidDays: parseFloat(r.unpaidDays || '0'),
      unpaidDayRate: parseFloat(r.unpaidDayRate || '0'),
      lateMinutes: r.lateMinutes,
      lateDeduction: parseFloat(r.lateDeduction || '0'),
      earlyDepartureMinutes: r.earlyDepartureMinutes,
      earlyDepartureDeduction: parseFloat(r.earlyDepartureDeduction || '0'),
      otherDeductions: parseFloat(r.otherDeductions || '0'),
      loanDeduction: parseFloat(r.loanDeduction || '0'),
    });

    const netFinal = r.netPay ? Number(r.netPay) : calc.netPreview;

    return {
      ...r,
      otTotal: calc.otTotal.toFixed(3),
      unpaidDeduction: calc.unpaidDeduction.toFixed(3),
      grossPay: calc.grossPay.toFixed(3),
      totalDeductions: calc.totalDeductions.toFixed(3),
      netCalculated: netFinal.toFixed(3),
    };
  });
}


