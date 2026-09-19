import { getDb, schema } from '../../db';
import { eq, and } from 'drizzle-orm';
import { UserSession, assertCanViewFinancials } from '../auth/rbac';
import { computeNetPayroll } from './payroll-service';
import { getSystemSettings } from './settings-service';

export interface PayslipData {
  companyName: string;
  country: string;
  currency: string;
  employeeNo: string;
  employeeName: string;
  department: string;
  jobTitle: string;
  periodStart: string;
  periodEnd: string;
  workedDays: number;
  socialSecurityRate: string;
  insuranceNo: string;
  nationalId: string;
  basicEarned: string;
  allowancesEarned: string;
  deliveryAllowance: string;
  tipsGratuities: string;
  otHours: string;
  otRate: string;
  otTotal: string;
  otherAdditions: string;
  socialSecurityDeduction: string;
  unpaidDays: string;
  unpaidDayRate: string;
  unpaidDeduction: string;
  lateDeduction?: string;
  earlyDepartureDeduction?: string;
  otherDeductions: string;
  loanDeduction: string;
  totalEarnings: string;
  totalDeductions: string;
  netPay: string;
  status: string;
  approvedBy: string;
  approvedAt: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
}

export async function getPayslipData(actor: UserSession, payrollId: string): Promise<PayslipData> {
  assertCanViewFinancials(actor);
  const db = getDb();

  const [record] = await db.select({
    id: schema.payroll.id,
    employeeId: schema.payroll.employeeId,
    periodStart: schema.payroll.periodStart,
    periodEnd: schema.payroll.periodEnd,
    currency: schema.payroll.currency,
    basicEarned: schema.payroll.basicEarned,
    allowancesEarned: schema.payroll.allowancesEarned,
    gratuities: schema.payroll.gratuities,
    workedDays: schema.payroll.workedDays,
    otHours: schema.payroll.otHours,
    otRate: schema.payroll.otRate,
    unpaidDays: schema.payroll.unpaidDays,
    unpaidDayRate: schema.payroll.unpaidDayRate,
    lateDeduction: schema.payroll.lateDeduction,
    earlyDepartureDeduction: schema.payroll.earlyDepartureDeduction,
    otherAdditions: schema.payroll.otherAdditions,
    otherDeductions: schema.payroll.otherDeductions,
    loanDeduction: schema.payroll.loanDeduction,
    netPay: schema.payroll.netPay,
    status: schema.payroll.status,
    approvedBy: schema.payroll.approvedBy,
    approvedAt: schema.payroll.approvedAt,
    paymentMethod: schema.payroll.paymentMethod,
    paymentReference: schema.payroll.paymentReference,
  })
  .from(schema.payroll)
  .where(eq(schema.payroll.id, payrollId));

  if (!record) throw new Error('كشف الراتب غير موجود');
  if (record.status !== 'APPROVED' && record.status !== 'PAID') {
    throw new Error('لا يمكن إصدار قسيمة راتب إلا بعد اعتماد كشف الراتب (APPROVED أو PAID).');
  }

  const [employee] = await db.select().from(schema.employees).where(eq(schema.employees.id, record.employeeId));
  const settings = await getSystemSettings();
  let approverName = 'مدير النظام';
  if (record.approvedBy) {
    const [approver] = await db.select().from(schema.users).where(eq(schema.users.id, record.approvedBy));
    if (approver) approverName = approver.fullName;
  }

  const calc = computeNetPayroll({
    employmentType: employee?.employmentType || 'PERMANENT',
    basicEarned: parseFloat(record.basicEarned),
    allowancesEarned: parseFloat(record.allowancesEarned),
    gratuities: parseFloat(record.gratuities || '0'),
    otHours: parseFloat(record.otHours),
    otRate: parseFloat(record.otRate),
    otherAdditions: parseFloat(record.otherAdditions),
    unpaidDays: parseFloat(record.unpaidDays),
    unpaidDayRate: parseFloat(record.unpaidDayRate),
    socialSecurityRegistered: employee?.socialSecurityRegistered,
    lateDeduction: parseFloat(record.lateDeduction || '0'),
    earlyDepartureDeduction: parseFloat(record.earlyDepartureDeduction || '0'),
    otherDeductions: parseFloat(record.otherDeductions),
    loanDeduction: parseFloat(record.loanDeduction),
  });

  const isSocialSecurity = employee?.socialSecurityRegistered || false;
  const ssRateNum = isSocialSecurity ? 7.5 : 0;
  const socialSecurityDeductionVal = isSocialSecurity ? Math.round(calc.basicEarned * 0.075 * 100) / 100 : 0;

  const totalEarnings = calc.basicEarned + calc.allowancesEarned + calc.gratuities + calc.otTotal + calc.otherAdditions;
  const totalDeductions = calc.unpaidDeduction + calc.lateDeduction + calc.earlyDepartureDeduction + calc.otherDeductions + calc.loanDeduction + socialSecurityDeductionVal;

  return {
    companyName: settings?.companyName || 'شركة الخطوط الأذكى لصناعة المنظفات',
    country: settings?.country || 'المملكة الأردنية الهاشمية',
    currency: record.currency,
    employeeNo: employee?.employeeNo || 'N/A',
    employeeName: employee?.name || 'N/A',
    department: employee?.department || 'N/A',
    jobTitle: employee?.jobTitle || 'N/A',
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    workedDays: record.workedDays || 30,
    socialSecurityRate: `${ssRateNum.toFixed(2)}%`,
    insuranceNo: employee?.phone || '0',
    nationalId: '0',
    basicEarned: calc.basicEarned.toFixed(3),
    allowancesEarned: calc.allowancesEarned.toFixed(3),
    deliveryAllowance: '0.000',
    tipsGratuities: calc.gratuities.toFixed(3),
    otHours: calc.otHours.toFixed(2),
    otRate: calc.otRate.toFixed(3),
    otTotal: calc.otTotal.toFixed(3),
    otherAdditions: calc.otherAdditions.toFixed(3),
    socialSecurityDeduction: socialSecurityDeductionVal.toFixed(3),
    unpaidDays: calc.unpaidDays.toFixed(2),
    unpaidDayRate: calc.unpaidDayRate.toFixed(3),
    unpaidDeduction: calc.unpaidDeduction.toFixed(3),
    lateDeduction: calc.lateDeduction.toFixed(3),
    earlyDepartureDeduction: calc.earlyDepartureDeduction.toFixed(3),
    otherDeductions: calc.otherDeductions.toFixed(3),
    loanDeduction: calc.loanDeduction.toFixed(3),
    totalEarnings: totalEarnings.toFixed(3),
    totalDeductions: totalDeductions.toFixed(3),
    netPay: record.netPay ? parseFloat(record.netPay).toFixed(3) : (totalEarnings - totalDeductions).toFixed(3),
    status: record.status,
    approvedBy: approverName,
    approvedAt: record.approvedAt ? record.approvedAt.toISOString().slice(0, 10) : null,
    paymentMethod: record.paymentMethod,
    paymentReference: record.paymentReference,
  };
}

export async function getBatchPayslipData(
  actor: UserSession,
  filters?: {
    month?: string;
    employeeId?: string;
    status?: 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED';
  }
): Promise<PayslipData[]> {
  assertCanViewFinancials(actor);
  const db = getDb();
  const settings = await getSystemSettings();

  const conditions = [];
  if (filters?.employeeId) conditions.push(eq(schema.payroll.employeeId, filters.employeeId));
  if (filters?.status) conditions.push(eq(schema.payroll.status, filters.status));
  if (filters?.month) {
    const start = `${filters.month}-01`;
    conditions.push(eq(schema.payroll.periodStart, start));
  }

  const query = db
    .select({
      id: schema.payroll.id,
      employeeId: schema.payroll.employeeId,
      employeeName: schema.employees.name,
      employeeNo: schema.employees.employeeNo,
      department: schema.employees.department,
      jobTitle: schema.employees.jobTitle,
      employmentType: schema.employees.employmentType,
      socialSecurityRegistered: schema.employees.socialSecurityRegistered,
      phone: schema.employees.phone,
      periodStart: schema.payroll.periodStart,
      periodEnd: schema.payroll.periodEnd,
      currency: schema.payroll.currency,
      basicEarned: schema.payroll.basicEarned,
      allowancesEarned: schema.payroll.allowancesEarned,
      gratuities: schema.payroll.gratuities,
      workedDays: schema.payroll.workedDays,
      dailyRate: schema.payroll.dailyRate,
      otHours: schema.payroll.otHours,
      otRate: schema.payroll.otRate,
      unpaidDays: schema.payroll.unpaidDays,
      unpaidDayRate: schema.payroll.unpaidDayRate,
      lateMinutes: schema.payroll.lateMinutes,
      lateDeduction: schema.payroll.lateDeduction,
      earlyDepartureMinutes: schema.payroll.earlyDepartureMinutes,
      earlyDepartureDeduction: schema.payroll.earlyDepartureDeduction,
      otherAdditions: schema.payroll.otherAdditions,
      otherDeductions: schema.payroll.otherDeductions,
      loanDeduction: schema.payroll.loanDeduction,
      netPay: schema.payroll.netPay,
      status: schema.payroll.status,
      approvedBy: schema.payroll.approvedBy,
      approvedAt: schema.payroll.approvedAt,
      paymentMethod: schema.payroll.paymentMethod,
      paymentReference: schema.payroll.paymentReference,
    })
    .from(schema.payroll)
    .innerJoin(schema.employees, eq(schema.payroll.employeeId, schema.employees.id));

  const records = conditions.length > 0
    ? await query.where(and(...conditions))
    : await query;

  const allUsers = await db.select().from(schema.users);
  const userMap = new Map(allUsers.map((u: any) => [u.id, u.fullName]));

  return records.map((record: any) => {
    const isDailyWorker = record.employmentType === 'DAILY_WORKER';
    const workedDays = record.workedDays || 30;
    const dailyRate = parseFloat(record.dailyRate || '0');
    const basicEarned = isDailyWorker ? Math.round(workedDays * dailyRate * 1000) / 1000 : parseFloat(record.basicEarned || '0');
    const allowancesEarned = parseFloat(record.allowancesEarned || '0');
    const gratuities = parseFloat(record.gratuities || '0');
    const otHours = parseFloat(record.otHours || '0');
    const calculatedOtRate = basicEarned > 0 ? ((basicEarned / 26) / 9) * 2 : 0;
    const otRate = parseFloat(record.otRate || '0') > 0 && parseFloat(record.otRate || '0') !== 2.5 ? parseFloat(record.otRate || '0') : calculatedOtRate;
    const otTotal = Math.round(otHours * otRate * 1000) / 1000;
    const otherAdditions = parseFloat(record.otherAdditions || '0');
    const unpaidDays = parseFloat(record.unpaidDays || '0');
    const unpaidDayRate = parseFloat(record.unpaidDayRate || '0');
    const unpaidDeduction = isDailyWorker ? 0 : Math.round(unpaidDays * unpaidDayRate * 1000) / 1000;
    const lateDeduction = parseFloat(record.lateDeduction || '0');
    const earlyDepartureDeduction = parseFloat(record.earlyDepartureDeduction || '0');
    const otherDeductions = parseFloat(record.otherDeductions || '0');
    const loanDeduction = parseFloat(record.loanDeduction || '0');

    const isSocialSecurity = record.socialSecurityRegistered || false;
    const ssRateNum = isSocialSecurity ? 7.5 : 0;
    const socialSecurityDeductionVal = isSocialSecurity ? Math.round(basicEarned * 0.075 * 1000) / 1000 : 0;

    const totalEarnings = basicEarned + allowancesEarned + gratuities + otTotal + otherAdditions;
    const totalDeductions = unpaidDeduction + lateDeduction + earlyDepartureDeduction + otherDeductions + loanDeduction + socialSecurityDeductionVal;

    const netPayVal = record.netPay
      ? parseFloat(record.netPay)
      : Math.round((totalEarnings - totalDeductions) * 1000) / 1000;

    const approverName = record.approvedBy ? userMap.get(record.approvedBy) || 'مدير النظام' : 'مدير النظام';

    return {
      companyName: settings?.companyName || 'شركة الخطوط الأذكى لصناعة المنظفات',
      country: settings?.country || 'المملكة الأردنية الهاشمية',
      currency: record.currency || 'JOD',
      employeeNo: record.employeeNo || 'N/A',
      employeeName: record.employeeName || 'N/A',
      department: record.department || 'N/A',
      jobTitle: record.jobTitle || 'N/A',
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      workedDays: workedDays,
      socialSecurityRate: `${ssRateNum.toFixed(2)}%`,
      insuranceNo: record.phone || '0',
      nationalId: '0',
      basicEarned: basicEarned.toFixed(3),
      allowancesEarned: allowancesEarned.toFixed(3),
      deliveryAllowance: '0.000',
      tipsGratuities: gratuities.toFixed(3),
      otHours: otHours.toFixed(2),
      otRate: otRate.toFixed(3),
      otTotal: otTotal.toFixed(3),
      otherAdditions: otherAdditions.toFixed(3),
      socialSecurityDeduction: socialSecurityDeductionVal.toFixed(3),
      unpaidDays: unpaidDays.toFixed(2),
      unpaidDayRate: unpaidDayRate.toFixed(3),
      unpaidDeduction: unpaidDeduction.toFixed(3),
      lateDeduction: lateDeduction.toFixed(3),
      earlyDepartureDeduction: earlyDepartureDeduction.toFixed(3),
      otherDeductions: otherDeductions.toFixed(3),
      loanDeduction: loanDeduction.toFixed(3),
      totalEarnings: totalEarnings.toFixed(3),
      totalDeductions: totalDeductions.toFixed(3),
      netPay: netPayVal.toFixed(3),
      status: record.status,
      approvedBy: approverName,
      approvedAt: record.approvedAt ? record.approvedAt.toISOString().slice(0, 10) : null,
      paymentMethod: record.paymentMethod,
      paymentReference: record.paymentReference,
    };
  });
}
