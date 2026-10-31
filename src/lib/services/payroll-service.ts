import { getDb, schema } from '../../db';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { UserSession, RBAC, AuthorizationError, requireRole, assertCanApprovePayroll, assertCanViewFinancials } from '../auth/rbac';
import { logAuditEvent } from '../auth/audit';
import { getSystemSettings } from './settings-service';

export interface NetCalculationResult {
  employmentType?: 'PERMANENT' | 'PROBATIONARY' | 'DAILY_WORKER';
  workedDays: number;
  dailyRate: number;
  dailyEarnings: number;
  basicEarned: number;
  allowancesEarned: number;
  gratuities: number;
  otHours: number;
  otRate: number;
  otTotal: number;
  unpaidDays: number;
  unpaidDayRate: number;
  unpaidDeduction: number;
  lateMinutes: number;
  lateDeduction: number;
  earlyDepartureMinutes: number;
  earlyDepartureDeduction: number;
  socialSecurityDeduction: number;
  otherAdditions: number;
  otherDeductions: number;
  loanDeduction: number;
  grossPay: number;
  totalDeductions: number;
  netPreview: number;
}

export function isLegacyOtRate(rate: number): boolean {
  if (!rate || rate <= 0) return true;
  if (rate === 2.5) return true;
  if (Math.abs(rate - 1.813) < 0.005) return true;
  if (Math.abs(rate - 1.812) < 0.005) return true;
  return false;
}

export function computeNetPayroll(values: {
  employmentType?: 'PERMANENT' | 'PROBATIONARY' | 'DAILY_WORKER';
  workedDays?: number;
  dailyRate?: number;
  basicEarned?: number;
  allowancesEarned?: number;
  gratuities?: number;
  otHours?: number;
  otRate?: number;
  otherAdditions?: number;
  unpaidDays?: number;
  unpaidDayRate?: number;
  lateMinutes?: number;
  lateDeduction?: number;
  earlyDepartureMinutes?: number;
  earlyDepartureDeduction?: number;
  otherDeductions?: number;
  loanDeduction?: number;
  socialSecurityRegistered?: boolean;
}): NetCalculationResult {
  const isDailyWorker = values.employmentType === 'DAILY_WORKER';

  const basicEarned = values.basicEarned ?? 0;
  const otHours = values.otHours ?? 0;
  // Dynamic OT rate: 1 OT hour = 2 normal hours based on basic salary (30 days * 8 hours = 240 hours) -> basic / 120
  // For daily workers (8 hours/day) -> 2 * (dailyRate / 8) = dailyRate / 4
  const calculatedOtRate = isDailyWorker
    ? (values.dailyRate && values.dailyRate > 0 ? (values.dailyRate / 4) : 0)
    : (basicEarned > 0 ? (basicEarned / 120) : 0);
  const otRate = (values.otRate && values.otRate > 0 && !isLegacyOtRate(values.otRate)) ? values.otRate : Math.round(calculatedOtRate * 1000) / 1000;
  const gratuities = values.gratuities ?? 0;
  const otherAdditions = values.otherAdditions ?? 0;
  const unpaidDays = values.unpaidDays ?? 0;
  const unpaidDayRate = values.unpaidDayRate ?? 0;
  const otherDeductions = values.otherDeductions ?? 0;
  const loanDeduction = values.loanDeduction ?? 0;
  const lateDeduction = values.lateDeduction ?? 0;
  const earlyDepartureDeduction = values.earlyDepartureDeduction ?? 0;
  const workedDays = values.workedDays ?? 0;
  const dailyRate = values.dailyRate ?? 0;

  // Transportation Allowance: 30 JOD monthly fixed, minus 1 JOD for each absence day
  let allowancesEarned = values.allowancesEarned !== undefined
    ? values.allowancesEarned
    : (isDailyWorker ? 0 : Math.max(0, 30 - unpaidDays));

  // Validate non-negative numbers
  if (basicEarned < 0) throw new Error('الراتب الأساسي لا يمكن أن يكون سالباً');
  if (allowancesEarned < 0) throw new Error('البدلات لا يمكن أن تكون سالبة');
  if (gratuities < 0) throw new Error('الإكراميات لا يمكن أن تكون سالبة');
  if (otHours < 0) throw new Error('ساعات العمل الإضافي لا يمكن أن تكون سالبة');
  if (otRate < 0) throw new Error('معدل الساعة الإضافية لا يمكن أن يكون سالباً');
  if (otherAdditions < 0) throw new Error('الإضافات الأخرى لا يمكن أن تكون سالبة');
  if (unpaidDays < 0) throw new Error('أيام الغياب غير المدفوعة لا يمكن أن تكون سالبة');
  if (unpaidDayRate < 0) throw new Error('معدل اليوم غير المدفوع لا يمكن أن يكون سالباً');
  if (otherDeductions < 0) throw new Error('الخصومات الأخرى لا يمكن أن تكون سالبة');
  if (loanDeduction < 0) throw new Error('خصم السلفة لا يمكن أن يكون سالباً');
  if (lateDeduction < 0) throw new Error('خصم التأخير لا يمكن أن يكون سالباً');
  if (earlyDepartureDeduction < 0) throw new Error('خصم المغادرة المبكرة لا يمكن أن يكون سالباً');
  if (dailyRate < 0) throw new Error('أجرة المياومة لا يمكن أن تكون سالبة');
  if (workedDays < 0) throw new Error('أيام العمل لا يمكن أن تكون سالبة');

  const otTotal = Math.round(otHours * otRate * 1000) / 1000;
  const unpaidDeduction = isDailyWorker ? 0 : Math.round(unpaidDays * unpaidDayRate * 1000) / 1000;
  const dailyEarnings = isDailyWorker ? Math.round(workedDays * dailyRate * 1000) / 1000 : 0;

  // Social Security: 7.5% of basic salary if registered
  const isSocialSecurity = values.socialSecurityRegistered || false;
  const socialSecurityDeduction = isSocialSecurity ? Math.round(basicEarned * 0.075 * 1000) / 1000 : 0;

  const totalEarnings = isDailyWorker
    ? dailyEarnings + gratuities + otTotal + otherAdditions
    : basicEarned + allowancesEarned + gratuities + otTotal + otherAdditions;

  const totalDeductions = socialSecurityDeduction + unpaidDeduction + lateDeduction + earlyDepartureDeduction + otherDeductions + loanDeduction;
  const netPreview = Math.round((totalEarnings - totalDeductions) * 1000) / 1000;

  return {
    employmentType: values.employmentType || 'PERMANENT',
    workedDays,
    dailyRate,
    dailyEarnings,
    basicEarned,
    allowancesEarned,
    gratuities,
    otHours,
    otRate,
    otTotal,
    unpaidDays,
    unpaidDayRate,
    unpaidDeduction,
    lateMinutes: values.lateMinutes ?? 0,
    lateDeduction,
    earlyDepartureMinutes: values.earlyDepartureMinutes ?? 0,
    earlyDepartureDeduction,
    socialSecurityDeduction,
    otherAdditions,
    otherDeductions,
    loanDeduction,
    grossPay: Math.round(totalEarnings * 1000) / 1000,
    totalDeductions: Math.round(totalDeductions * 1000) / 1000,
    netPreview,
  };
}

export async function getPayrolls(
  actor: UserSession,
  filters?: {
    month?: string; // YYYY-MM
    employeeId?: string;
    status?: 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED';
  }
) {
  assertCanViewFinancials(actor);
  const db = getDb();

  let query = db.select({
    id: schema.payroll.id,
    employeeId: schema.payroll.employeeId,
    employeeName: schema.employees.name,
    employeeNo: schema.employees.employeeNo,
    department: schema.employees.department,
    employmentType: schema.employees.employmentType,
    socialSecurityRegistered: schema.employees.socialSecurityRegistered,
    contractId: schema.payroll.contractId,
    periodStart: schema.payroll.periodStart,
    periodEnd: schema.payroll.periodEnd,
    currency: schema.payroll.currency,
    basicEarned: schema.payroll.basicEarned,
    allowancesEarned: schema.payroll.allowancesEarned,
    gratuities: schema.payroll.gratuities,
    otHours: schema.payroll.otHours,
    otRate: schema.payroll.otRate,
    unpaidDays: schema.payroll.unpaidDays,
    unpaidDayRate: schema.payroll.unpaidDayRate,
    workedDays: schema.payroll.workedDays,
    workedMinutes: schema.payroll.workedMinutes,
    lateMinutes: schema.payroll.lateMinutes,
    lateDeduction: schema.payroll.lateDeduction,
    earlyDepartureMinutes: schema.payroll.earlyDepartureMinutes,
    earlyDepartureDeduction: schema.payroll.earlyDepartureDeduction,
    dailyRate: schema.payroll.dailyRate,
    otherAdditions: schema.payroll.otherAdditions,
    otherDeductions: schema.payroll.otherDeductions,
    loanDeduction: schema.payroll.loanDeduction,
    netPay: schema.payroll.netPay,
    status: schema.payroll.status,
    paymentMethod: schema.payroll.paymentMethod,
    paymentReference: schema.payroll.paymentReference,
    approvedAt: schema.payroll.approvedAt,
    paidAt: schema.payroll.paidAt,
    notes: schema.payroll.notes,
    createdAt: schema.payroll.createdAt,
  })
  .from(schema.payroll)
  .innerJoin(schema.employees, eq(schema.payroll.employeeId, schema.employees.id));

  const conditions = [];
  if (filters?.employeeId) conditions.push(eq(schema.payroll.employeeId, filters.employeeId));
  if (filters?.status) conditions.push(eq(schema.payroll.status, filters.status));
  if (filters?.month) {
    const start = `${filters.month}-01`;
    conditions.push(eq(schema.payroll.periodStart, start));
  }

  const rows = conditions.length > 0
    ? await query.where(and(...conditions)).orderBy(desc(schema.payroll.periodStart))
    : await query.orderBy(desc(schema.payroll.periodStart));

  return rows.map((p: any) => {
    const calc = computeNetPayroll({
      employmentType: p.employmentType,
      workedDays: p.workedDays,
      dailyRate: parseFloat(p.dailyRate || '0'),
      basicEarned: parseFloat(p.basicEarned || '0'),
      allowancesEarned: parseFloat(p.allowancesEarned || '0'),
      gratuities: parseFloat(p.gratuities || '0'),
      otHours: parseFloat(p.otHours || '0'),
      otRate: parseFloat(p.otRate || '0'),
      otherAdditions: parseFloat(p.otherAdditions || '0'),
      unpaidDays: parseFloat(p.unpaidDays || '0'),
      unpaidDayRate: parseFloat(p.unpaidDayRate || '0'),
      socialSecurityRegistered: p.socialSecurityRegistered,
      lateMinutes: p.lateMinutes,
      lateDeduction: parseFloat(p.lateDeduction || '0'),
      earlyDepartureMinutes: p.earlyDepartureMinutes,
      earlyDepartureDeduction: parseFloat(p.earlyDepartureDeduction || '0'),
      otherDeductions: parseFloat(p.otherDeductions || '0'),
      loanDeduction: parseFloat(p.loanDeduction || '0'),
    });

    return {
      ...p,
      grossPay: calc.grossPay.toFixed(3),
      totalDeductions: calc.totalDeductions.toFixed(3),
      netPreview: calc.netPreview.toFixed(3),
      otTotal: calc.otTotal.toFixed(3),
      unpaidDeduction: calc.unpaidDeduction.toFixed(3),
      dailyEarnings: calc.dailyEarnings.toFixed(3),
      socialSecurityDeduction: calc.socialSecurityDeduction.toFixed(3),
    };
  });
}

export async function getPayrollById(actor: UserSession, payrollId: string) {
  assertCanViewFinancials(actor);
  const db = getDb();

  const [record] = await db.select({
    id: schema.payroll.id,
    employeeId: schema.payroll.employeeId,
    employeeName: schema.employees.name,
    employeeNo: schema.employees.employeeNo,
    department: schema.employees.department,
    jobTitle: schema.employees.jobTitle,
    employmentType: schema.employees.employmentType,
    socialSecurityRegistered: schema.employees.socialSecurityRegistered,
    contractId: schema.payroll.contractId,
    periodStart: schema.payroll.periodStart,
    periodEnd: schema.payroll.periodEnd,
    currency: schema.payroll.currency,
    basicEarned: schema.payroll.basicEarned,
    allowancesEarned: schema.payroll.allowancesEarned,
    gratuities: schema.payroll.gratuities,
    otHours: schema.payroll.otHours,
    otRate: schema.payroll.otRate,
    unpaidDays: schema.payroll.unpaidDays,
    unpaidDayRate: schema.payroll.unpaidDayRate,
    workedDays: schema.payroll.workedDays,
    workedMinutes: schema.payroll.workedMinutes,
    lateMinutes: schema.payroll.lateMinutes,
    lateDeduction: schema.payroll.lateDeduction,
    earlyDepartureMinutes: schema.payroll.earlyDepartureMinutes,
    earlyDepartureDeduction: schema.payroll.earlyDepartureDeduction,
    dailyRate: schema.payroll.dailyRate,
    otherAdditions: schema.payroll.otherAdditions,
    otherDeductions: schema.payroll.otherDeductions,
    loanDeduction: schema.payroll.loanDeduction,
    netPay: schema.payroll.netPay,
    status: schema.payroll.status,
    paymentMethod: schema.payroll.paymentMethod,
    paymentReference: schema.payroll.paymentReference,
    approvedBy: schema.payroll.approvedBy,
    approvedAt: schema.payroll.approvedAt,
    paidAt: schema.payroll.paidAt,
    notes: schema.payroll.notes,
  })
  .from(schema.payroll)
  .innerJoin(schema.employees, eq(schema.payroll.employeeId, schema.employees.id))
  .where(eq(schema.payroll.id, payrollId));

  if (!record) throw new Error('كشف الراتب غير موجود');

  const calc = computeNetPayroll({
    employmentType: record.employmentType,
    workedDays: record.workedDays,
    dailyRate: parseFloat(record.dailyRate || '0'),
    basicEarned: parseFloat(record.basicEarned || '0'),
    allowancesEarned: parseFloat(record.allowancesEarned || '0'),
    gratuities: parseFloat(record.gratuities || '0'),
    otHours: parseFloat(record.otHours || '0'),
    otRate: parseFloat(record.otRate || '0'),
    otherAdditions: parseFloat(record.otherAdditions || '0'),
    unpaidDays: parseFloat(record.unpaidDays || '0'),
    unpaidDayRate: parseFloat(record.unpaidDayRate || '0'),
    socialSecurityRegistered: record.socialSecurityRegistered,
    lateMinutes: record.lateMinutes,
    lateDeduction: parseFloat(record.lateDeduction || '0'),
    earlyDepartureMinutes: record.earlyDepartureMinutes,
    earlyDepartureDeduction: parseFloat(record.earlyDepartureDeduction || '0'),
    otherDeductions: parseFloat(record.otherDeductions || '0'),
    loanDeduction: parseFloat(record.loanDeduction || '0'),
  });

  return {
    ...record,
    grossPay: calc.grossPay.toFixed(3),
    totalDeductions: calc.totalDeductions.toFixed(3),
    netPreview: calc.netPreview.toFixed(3),
    otTotal: calc.otTotal.toFixed(3),
    unpaidDeduction: calc.unpaidDeduction.toFixed(3),
    dailyEarnings: calc.dailyEarnings.toFixed(3),
    socialSecurityDeduction: calc.socialSecurityDeduction.toFixed(3),
  };
}

export async function syncEmployeeLoanRepaymentsForPayroll(
  db: any,
  employeeId: string,
  payrollId: string,
  periodEnd: string,
  actorId?: string
): Promise<number> {
  const activeLoans = await db.select().from(schema.loans).where(
    and(
      eq(schema.loans.employeeId, employeeId),
      eq(schema.loans.status, 'DISBURSED')
    )
  );

  let totalLoanDeduction = 0;

  for (const loan of activeLoans) {
    const loanAmount = parseFloat(loan.amount);

    const existingRepayments = await db.select({
      id: schema.repayments.id,
      amount: schema.repayments.amount,
      method: schema.repayments.method,
      status: schema.repayments.status,
      payrollId: schema.repayments.payrollId,
      payrollStatus: schema.payroll.status,
    })
    .from(schema.repayments)
    .leftJoin(schema.payroll, eq(schema.repayments.payrollId, schema.payroll.id))
    .where(eq(schema.repayments.loanId, loan.id));

    let paidTotal = 0;
    let currentPayrollRepayment = null;

    for (const rep of existingRepayments) {
      if (rep.payrollId === payrollId) {
        currentPayrollRepayment = rep;
      } else {
        const repAmount = parseFloat(rep.amount);
        if (rep.method === 'CASH' && rep.status === 'PAID') {
          paidTotal += repAmount;
        } else if (rep.method === 'PAYROLL' && (rep.payrollStatus === 'PAID' || rep.payrollStatus === 'APPROVED' || rep.payrollStatus === 'DRAFT')) {
          paidTotal += repAmount;
        }
      }
    }

    const remainingForThisDraft = Math.max(0, Math.round((loanAmount - paidTotal) * 1000) / 1000);

    if (currentPayrollRepayment) {
      totalLoanDeduction += parseFloat(currentPayrollRepayment.amount);
    } else if (remainingForThisDraft > 0) {
      await db.insert(schema.repayments).values({
        loanId: loan.id,
        date: periodEnd,
        amount: remainingForThisDraft.toFixed(3),
        method: 'PAYROLL',
        payrollId,
        status: 'SCHEDULED',
        createdBy: actorId || null,
      });

      totalLoanDeduction += remainingForThisDraft;
    }
  }

  return Math.round(totalLoanDeduction * 1000) / 1000;
}

export async function createPayrollDraft(
  actor: UserSession,
  data: {
    employeeId: string;
    year: number;
    month: number; // 1-12
    basicEarned?: number;
    allowancesEarned?: number;
    gratuities?: number;
    otherAdditions?: number;
    otherDeductions?: number;
    notes?: string;
  }
) {
  requireRole(actor, ['ADMIN', 'ACCOUNTANT']);
  const db = getDb();

  const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, data.employeeId));
  if (!emp) throw new Error('الموظف غير موجود');

  const settings = await getSystemSettings();

  const monthStr = data.month < 10 ? `0${data.month}` : `${data.month}`;
  const periodStart = `${data.year}-${monthStr}-01`;
  
  const lastDay = new Date(data.year, data.month, 0).getDate();
  const periodEnd = `${data.year}-${monthStr}-${lastDay}`;

  // Check unique active payroll per employee/month
  const existingActive = await db.select().from(schema.payroll).where(
    and(
      eq(schema.payroll.employeeId, data.employeeId),
      eq(schema.payroll.periodStart, periodStart),
      sql`status != 'CANCELLED'`
    )
  );

  if (existingActive.length > 0) {
    throw new Error('يوجد كشف راتب نشط بالفعل لهذا الموظف في هذا الشهر.');
  }

  const isDailyWorker = emp.employmentType === 'DAILY_WORKER';

  let contractId: string | null = null;
  let activeContract: any = null;
  let basicEarned = 0;
  let allowancesEarned = 0;
  let otRate = 0;
  let unpaidDayRate = 0;
  let dailyRate = 0;
  const currency = settings?.currency || 'JOD';

  if (isDailyWorker) {
    const historyRates = await db.select().from(schema.dailyRateHistory).where(
      and(
        eq(schema.dailyRateHistory.employeeId, data.employeeId),
        lte(schema.dailyRateHistory.effectiveFrom, periodEnd),
        sql`(${schema.dailyRateHistory.effectiveTo} IS NULL OR ${schema.dailyRateHistory.effectiveTo} >= ${periodStart})`
      )
    ).orderBy(desc(schema.dailyRateHistory.effectiveFrom));

    if (historyRates.length > 0) {
      dailyRate = parseFloat(historyRates[0].dailyRate);
    } else {
      dailyRate = emp.dailyRate ? parseFloat(emp.dailyRate) : 0;
    }
  } else {
    // Permanent employee requires an active contract
    const contracts = await db.select().from(schema.contracts).where(
      and(
        eq(schema.contracts.employeeId, data.employeeId),
        lte(schema.contracts.startDate, periodEnd),
        sql`(end_date IS NULL OR end_date >= ${periodStart})`
      )
    ).orderBy(desc(schema.contracts.startDate));

    if (contracts.length === 0) {
      throw new Error('لا يوجد عقد عمل ساري المفعول يغطي فترة كشف الراتب المحددة.');
    }

    activeContract = contracts[0];
    contractId = activeContract.id;

    // Proration for partial-month tenure (mid-month hire or mid-month termination)
    const effectiveStart = emp.startDate > periodStart ? emp.startDate : periodStart;
    const effectiveEnd = emp.endDate && emp.endDate < periodEnd ? emp.endDate : periodEnd;
    const isPartialMonth = effectiveStart > periodStart || Boolean(emp.endDate && emp.endDate < periodEnd);

    const fullMonthlyBasic = parseFloat(activeContract.monthlyBasic);
    let activeServiceDays = 30;
    if (isPartialMonth) {
      const startMs = new Date(effectiveStart).getTime();
      const endMs = new Date(effectiveEnd).getTime();
      activeServiceDays = Math.max(0, Math.min(30, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1));
    }

    if (data.basicEarned !== undefined) {
      basicEarned = data.basicEarned;
    } else if (isPartialMonth) {
      basicEarned = Math.round((fullMonthlyBasic / 30) * activeServiceDays * 1000) / 1000;
    } else {
      basicEarned = fullMonthlyBasic;
    }

    // Dynamic OT rate: 1 OT hour = 2 normal hours based on basic salary (30 days * 8 hours = 240 hours) -> fullMonthlyBasic / 120
    const calculatedOtRate = fullMonthlyBasic > 0 ? (fullMonthlyBasic / 120) : 0;
    const contractOtRate = activeContract.otRate ? parseFloat(activeContract.otRate) : 0;
    otRate = (contractOtRate > 0 && !isLegacyOtRate(contractOtRate))
      ? contractOtRate
      : Math.round(calculatedOtRate * 1000) / 1000;
    unpaidDayRate = parseFloat(activeContract.unpaidDayRate || '0') > 0
      ? parseFloat(activeContract.unpaidDayRate)
      : Math.round((fullMonthlyBasic / 30) * 1000) / 1000;
  }

  if (isDailyWorker) {
    const calculatedDailyOt = dailyRate > 0 ? (dailyRate / 4) : 0;
    otRate = Math.round(calculatedDailyOt * 1000) / 1000;
  }

  const effectiveStart = emp.startDate > periodStart ? emp.startDate : periodStart;
  const effectiveEnd = emp.endDate && emp.endDate < periodEnd ? emp.endDate : periodEnd;

  // Fetch attendance records within effective service period to snapshot metrics
  const attendances = await db.select().from(schema.attendance).where(
    and(
      eq(schema.attendance.employeeId, data.employeeId),
      gte(schema.attendance.workDate, effectiveStart),
      lte(schema.attendance.workDate, effectiveEnd)
    )
  );

  const workedDays = attendances.filter((a: any) => a.attendanceType === 'PRESENT').length;
  const workedMinutes = attendances.reduce((acc: number, a: any) => acc + (a.workedMinutes || 0), 0);
  const lateMinutes = attendances.reduce((acc: number, a: any) => acc + (a.lateMinutes || 0), 0);
  const earlyDepartureMinutes = attendances.reduce((acc: number, a: any) => acc + (a.earlyDepartureMinutes || 0), 0);
  const totalOtHours = attendances.reduce((acc: number, a: any) => acc + parseFloat(a.approvedOtHours || '0'), 0);
  const totalUnpaidDays = attendances.reduce((acc: number, a: any) => acc + parseFloat(a.unpaidDays || '0'), 0);

  if (isDailyWorker) {
    basicEarned = workedDays * dailyRate;
    allowancesEarned = 0;
  } else {
    const fullMonthlyAllowances = activeContract?.monthlyAllowances && parseFloat(activeContract.monthlyAllowances) > 0
      ? parseFloat(activeContract.monthlyAllowances)
      : 30;
    const dailyAllowanceRate = fullMonthlyAllowances > 0 ? (fullMonthlyAllowances / 30) : 1;

    const effectiveStart = emp.startDate > periodStart ? emp.startDate : periodStart;
    const effectiveEnd = emp.endDate && emp.endDate < periodEnd ? emp.endDate : periodEnd;
    const isPartialMonth = effectiveStart > periodStart || Boolean(emp.endDate && emp.endDate < periodEnd);

    if (data.allowancesEarned !== undefined) {
      allowancesEarned = data.allowancesEarned;
    } else if (isPartialMonth) {
      const startMs = new Date(effectiveStart).getTime();
      const endMs = new Date(effectiveEnd).getTime();
      const activeServiceDays = Math.max(0, Math.min(30, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1));
      const proratedAllowances = Math.round(dailyAllowanceRate * activeServiceDays * 1000) / 1000;
      allowancesEarned = Math.max(0, proratedAllowances - (totalUnpaidDays * dailyAllowanceRate));
    } else {
      allowancesEarned = Math.max(0, fullMonthlyAllowances - (totalUnpaidDays * dailyAllowanceRate));
    }
  }

  // Dynamic minute deduction rate: basic / (30 * 8 * 60) = basic / 14400. For daily workers: dailyRate / 480
  let dynamicMinuteRate = 0;
  if (isDailyWorker) {
    dynamicMinuteRate = dailyRate > 0 ? (dailyRate / 480) : 0;
  } else {
    const fullBasic = activeContract ? parseFloat(activeContract.monthlyBasic) : 0;
    dynamicMinuteRate = fullBasic > 0 ? (fullBasic / 14400) : 0;
  }

  const minuteDeductionRate = emp.minuteDeductionRate
    ? parseFloat(emp.minuteDeductionRate)
    : (dynamicMinuteRate > 0 ? dynamicMinuteRate : (settings?.defaultMinuteDeductionRate ? parseFloat(settings.defaultMinuteDeductionRate) : 0));

  const lateDeduction = Math.round(lateMinutes * minuteDeductionRate * 1000) / 1000;
  const earlyDepartureDeduction = Math.round(earlyDepartureMinutes * minuteDeductionRate * 1000) / 1000;

  const [inserted] = await db.insert(schema.payroll).values({
    employeeId: data.employeeId,
    contractId: contractId || null,
    periodStart,
    periodEnd,
    currency,
    basicEarned: basicEarned.toFixed(3),
    allowancesEarned: allowancesEarned.toFixed(3),
    gratuities: (data.gratuities ?? 0).toFixed(3),
    otHours: totalOtHours.toFixed(2),
    otRate: otRate.toFixed(3),
    unpaidDays: totalUnpaidDays.toFixed(2),
    unpaidDayRate: unpaidDayRate.toFixed(3),
    workedDays,
    workedMinutes,
    lateMinutes,
    lateDeduction: lateDeduction.toFixed(3),
    earlyDepartureMinutes,
    earlyDepartureDeduction: earlyDepartureDeduction.toFixed(3),
    dailyRate: dailyRate.toFixed(3),
    otherAdditions: (data.otherAdditions ?? 0).toFixed(3),
    otherDeductions: (data.otherDeductions ?? 0).toFixed(3),
    loanDeduction: '0.000',
    netPay: null,
    status: 'DRAFT',
    preparedBy: actor.id,
    notes: data.notes || null,
  }).returning();

  const autoLoanDeduction = await syncEmployeeLoanRepaymentsForPayroll(db, data.employeeId, inserted.id, periodEnd, actor.id);

  if (autoLoanDeduction > 0) {
    await db.update(schema.payroll)
      .set({ loanDeduction: autoLoanDeduction.toFixed(3) })
      .where(eq(schema.payroll.id, inserted.id));
    inserted.loanDeduction = autoLoanDeduction.toFixed(3);
  }

  await logAuditEvent({
    actor,
    tableName: 'payroll',
    recordId: inserted.id,
    action: 'CREATE_PAYROLL_DRAFT',
    newStatus: 'DRAFT',
    metadata: { employeeId: data.employeeId, periodStart, periodEnd, isDailyWorker },
  });

  const calc = computeNetPayroll({
    employmentType: emp.employmentType,
    workedDays,
    dailyRate,
    basicEarned,
    allowancesEarned,
    gratuities: data.gratuities ?? 0,
    otHours: totalOtHours,
    otRate,
    otherAdditions: data.otherAdditions ?? 0,
    unpaidDays: totalUnpaidDays,
    unpaidDayRate,
    socialSecurityRegistered: emp.socialSecurityRegistered,
    lateMinutes,
    lateDeduction,
    earlyDepartureMinutes,
    earlyDepartureDeduction,
    otherDeductions: data.otherDeductions ?? 0,
    loanDeduction: autoLoanDeduction,
  });

  return {
    ...inserted,
    employmentType: emp.employmentType,
    lateDeductions: inserted.lateDeduction,
    earlyDepartureDeductions: inserted.earlyDepartureDeduction,
    grossPay: calc.grossPay.toFixed(3),
    netPreview: calc.netPreview.toFixed(3),
  };
}

export async function refreshPayrollDraft(actor: UserSession, payrollId: string) {
  requireRole(actor, ['ADMIN', 'ACCOUNTANT']);
  const db = getDb();

  const [payrollRecord] = await db.select().from(schema.payroll).where(eq(schema.payroll.id, payrollId));
  if (!payrollRecord) throw new Error('كشف الراتب غير موجود');
  if (payrollRecord.status !== 'DRAFT') {
    throw new Error('تحديث المسودة متاح فقط لكشوف الرواتب التي في حالة مسودة (DRAFT).');
  }

  const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, payrollRecord.employeeId));
  const settings = await getSystemSettings();

  const effectiveStart = emp ? (emp.startDate > payrollRecord.periodStart ? emp.startDate : payrollRecord.periodStart) : payrollRecord.periodStart;
  const effectiveEnd = emp && emp.endDate && emp.endDate < payrollRecord.periodEnd ? emp.endDate : payrollRecord.periodEnd;

  // Refresh attendance snapshots within effective service period
  const attendances = await db.select().from(schema.attendance).where(
    and(
      eq(schema.attendance.employeeId, payrollRecord.employeeId),
      gte(schema.attendance.workDate, effectiveStart),
      lte(schema.attendance.workDate, effectiveEnd)
    )
  );

  const workedDays = attendances.filter((a: any) => a.attendanceType === 'PRESENT').length;
  const workedMinutes = attendances.reduce((acc: number, a: any) => acc + (a.workedMinutes || 0), 0);
  const lateMinutes = attendances.reduce((acc: number, a: any) => acc + (a.lateMinutes || 0), 0);
  const earlyDepartureMinutes = attendances.reduce((acc: number, a: any) => acc + (a.earlyDepartureMinutes || 0), 0);
  const totalOtHours = attendances.reduce((acc: number, a: any) => acc + parseFloat(a.approvedOtHours || '0'), 0);
  const totalUnpaidDays = attendances.reduce((acc: number, a: any) => acc + parseFloat(a.unpaidDays || '0'), 0);

  // Refresh linked loan repayments
  const totalLoanDeduction = await syncEmployeeLoanRepaymentsForPayroll(db, payrollRecord.employeeId, payrollId, payrollRecord.periodEnd, actor.id);

  let basicEarned = parseFloat(payrollRecord.basicEarned);
  let allowancesEarned = parseFloat(payrollRecord.allowancesEarned || '0');
  let fullMonthlyBasic = 0;
  let dailyRate = parseFloat(payrollRecord.dailyRate || '0');
  let activeContract: any = null;

  if (emp?.employmentType === 'DAILY_WORKER') {
    const historyRates = await db.select().from(schema.dailyRateHistory).where(
      and(
        eq(schema.dailyRateHistory.employeeId, payrollRecord.employeeId),
        lte(schema.dailyRateHistory.effectiveFrom, payrollRecord.periodEnd),
        sql`(${schema.dailyRateHistory.effectiveTo} IS NULL OR ${schema.dailyRateHistory.effectiveTo} >= ${payrollRecord.periodStart})`
      )
    ).orderBy(desc(schema.dailyRateHistory.effectiveFrom));

    dailyRate = historyRates.length > 0 ? parseFloat(historyRates[0].dailyRate) : parseFloat(payrollRecord.dailyRate || '0');
    basicEarned = workedDays * dailyRate;
    allowancesEarned = 0;
  } else if (emp && payrollRecord.contractId) {
    const [contract] = await db.select().from(schema.contracts).where(eq(schema.contracts.id, payrollRecord.contractId));
    if (contract) {
      activeContract = contract;
      fullMonthlyBasic = parseFloat(contract.monthlyBasic);
      const fullMonthlyAllowances = contract.monthlyAllowances && parseFloat(contract.monthlyAllowances) > 0
        ? parseFloat(contract.monthlyAllowances)
        : 30;
      const dailyAllowanceRate = fullMonthlyAllowances > 0 ? (fullMonthlyAllowances / 30) : 1;

      const effectiveStart = emp.startDate > payrollRecord.periodStart ? emp.startDate : payrollRecord.periodStart;
      const effectiveEnd = emp.endDate && emp.endDate < payrollRecord.periodEnd ? emp.endDate : payrollRecord.periodEnd;
      const isPartialMonth = effectiveStart > payrollRecord.periodStart || Boolean(emp.endDate && emp.endDate < payrollRecord.periodEnd);

      if (isPartialMonth) {
        const startMs = new Date(effectiveStart).getTime();
        const endMs = new Date(effectiveEnd).getTime();
        const activeServiceDays = Math.max(0, Math.min(30, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1));
        basicEarned = Math.round((fullMonthlyBasic / 30) * activeServiceDays * 1000) / 1000;
        const proratedAllowances = Math.round(dailyAllowanceRate * activeServiceDays * 1000) / 1000;
        allowancesEarned = Math.max(0, proratedAllowances - (totalUnpaidDays * dailyAllowanceRate));
      } else {
        basicEarned = fullMonthlyBasic;
        allowancesEarned = Math.max(0, fullMonthlyAllowances - (totalUnpaidDays * dailyAllowanceRate));
      }
    }
  }

  // Dynamic minute deduction rate: basic / (30 * 8 * 60) = basic / 14400. For daily workers: dailyRate / 480
  let dynamicMinuteRate = 0;
  if (emp?.employmentType === 'DAILY_WORKER') {
    dynamicMinuteRate = dailyRate > 0 ? (dailyRate / 480) : 0;
  } else {
    const bSalary = fullMonthlyBasic > 0 ? fullMonthlyBasic : basicEarned;
    dynamicMinuteRate = bSalary > 0 ? (bSalary / 14400) : 0;
  }

  const minuteDeductionRate = emp?.minuteDeductionRate
    ? parseFloat(emp.minuteDeductionRate)
    : (dynamicMinuteRate > 0 ? dynamicMinuteRate : (settings?.defaultMinuteDeductionRate ? parseFloat(settings.defaultMinuteDeductionRate) : 0));

  const lateDeduction = Math.round(lateMinutes * minuteDeductionRate * 1000) / 1000;
  const earlyDepartureDeduction = Math.round(earlyDepartureMinutes * minuteDeductionRate * 1000) / 1000;

  // Dynamic OT rate: 1 OT hour = 2 normal hours based on basic salary (30 * 8 = 240 hrs) -> fullMonthlyBasic / 120
  const calculatedOtRate = emp?.employmentType === 'DAILY_WORKER'
    ? (dailyRate > 0 ? (dailyRate / 4) : 0)
    : (fullMonthlyBasic > 0 ? (fullMonthlyBasic / 120) : (basicEarned > 0 ? (basicEarned / 120) : 0));
  let otRate = parseFloat(payrollRecord.otRate || '0');
  let unpaidDayRate = parseFloat(payrollRecord.unpaidDayRate || '0');
  if (activeContract) {
    const contractOtRate = activeContract.otRate ? parseFloat(activeContract.otRate) : 0;
    otRate = (contractOtRate > 0 && !isLegacyOtRate(contractOtRate))
      ? contractOtRate
      : Math.round(calculatedOtRate * 1000) / 1000;
    unpaidDayRate = parseFloat(activeContract.unpaidDayRate || '0') > 0
      ? parseFloat(activeContract.unpaidDayRate)
      : Math.round(((fullMonthlyBasic > 0 ? fullMonthlyBasic : basicEarned) / 30) * 1000) / 1000;
  } else if (isLegacyOtRate(otRate)) {
    otRate = Math.round(calculatedOtRate * 1000) / 1000;
  }

  const [updated] = await db.update(schema.payroll)
    .set({
      basicEarned: basicEarned.toFixed(3),
      allowancesEarned: allowancesEarned.toFixed(3),
      workedDays,
      workedMinutes,
      lateMinutes,
      lateDeduction: lateDeduction.toFixed(3),
      earlyDepartureMinutes,
      earlyDepartureDeduction: earlyDepartureDeduction.toFixed(3),
      otHours: totalOtHours.toFixed(2),
      otRate: otRate.toFixed(3),
      unpaidDays: totalUnpaidDays.toFixed(2),
      unpaidDayRate: unpaidDayRate.toFixed(3),
      loanDeduction: totalLoanDeduction.toFixed(3),
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.payroll.id, payrollId))
    .returning();

  return {
    ...updated,
    employmentType: emp?.employmentType,
    lateDeductions: updated.lateDeduction,
    earlyDepartureDeductions: updated.earlyDepartureDeduction,
  };
}


export async function validatePayrollCompleteness(payrollId: string): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
  expectedDays: number;
  actualDays: number;
}> {
  const db = getDb();
  const errors: string[] = [];
  const warnings: string[] = [];

  const [payrollRecord] = await db.select().from(schema.payroll).where(eq(schema.payroll.id, payrollId));
  if (!payrollRecord) {
    return { isValid: false, errors: ['كشف الراتب غير موجود'], warnings: [], expectedDays: 0, actualDays: 0 };
  }

  // 1. Check PayrollPolicyConfirmed
  const settings = await getSystemSettings();
  if (!settings || !settings.payrollPolicyConfirmed) {
    errors.push('لم يتم تأكيد سياسة الرواتب والأجور في إعدادات الشركة.');
  }

  // 2. Check Employee and Service Period Coverage
  const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, payrollRecord.employeeId));
  if (!emp) {
    errors.push('بيانات الموظف غير متوفرة');
    return { isValid: false, errors, warnings: [], expectedDays: 0, actualDays: 0 };
  }

  const isDailyWorker = emp.employmentType === 'DAILY_WORKER';
  const periodStart = payrollRecord.periodStart;
  const periodEnd = payrollRecord.periodEnd;

  // Mid-month hire / termination logic:
  const effectiveStart = emp.startDate > periodStart ? emp.startDate : periodStart;
  const effectiveEnd = emp.endDate && emp.endDate < periodEnd ? emp.endDate : periodEnd;

  // 3. Fetch all attendance records inside service window
  const attendances = await db.select().from(schema.attendance).where(
    and(
      eq(schema.attendance.employeeId, emp.id),
      gte(schema.attendance.workDate, effectiveStart),
      lte(schema.attendance.workDate, effectiveEnd)
    )
  );

  const recordedDates = new Set(attendances.map((a: any) => a.workDate));
  let expectedWorkingDays = 0;
  const missingDates: string[] = [];

  if (!isDailyWorker) {
    const startD = new Date(effectiveStart + 'T00:00:00Z');
    const endD = new Date(effectiveEnd + 'T00:00:00Z');
    for (let d = new Date(startD); d <= endD; d.setUTCDate(d.getUTCDate() + 1)) {
      // Friday is weekly rest day - attendance not required unless worked OT
      const isFriday = d.getUTCDay() === 5;
      if (!isFriday) {
        expectedWorkingDays++;
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        if (!recordedDates.has(dateStr)) {
          missingDates.push(dateStr);
        }
      }
    }

    if (missingDates.length > 0) {
      errors.push(`توجد أيام عمل غير مسجلة في كشف الحضور والغياب (${missingDates.length} يوماً: ${missingDates.slice(0, 3).join(', ')}${missingDates.length > 3 ? '...' : ''}).`);
    }
  }

  const expectedDays = isDailyWorker ? payrollRecord.workedDays : expectedWorkingDays;
  const actualDays = attendances.length;

  const draftAttendances = attendances.filter((a: any) => a.status === 'DRAFT');
  if (draftAttendances.length > 0) {
    warnings.push(`يوجد ${draftAttendances.length} سجل حضور بحالة مسودة (سيتم اعتماده تلقائياً عند اعتماد هذا الكشف).`);
  }

  const workDates = attendances.map((a: any) => a.workDate);
  const uniqueDates = new Set(workDates);
  if (uniqueDates.size !== workDates.length) {
    errors.push('يوجد تكرار في تواريخ سجلات الحضور لنفس الموظف.');
  }

  // 4. Validate Calculations
  const calc = computeNetPayroll({
    employmentType: emp.employmentType,
    workedDays: payrollRecord.workedDays,
    dailyRate: parseFloat(payrollRecord.dailyRate || '0'),
    basicEarned: parseFloat(payrollRecord.basicEarned || '0'),
    allowancesEarned: parseFloat(payrollRecord.allowancesEarned || '0'),
    otHours: parseFloat(payrollRecord.otHours || '0'),
    otRate: parseFloat(payrollRecord.otRate || '0'),
    otherAdditions: parseFloat(payrollRecord.otherAdditions || '0'),
    unpaidDays: parseFloat(payrollRecord.unpaidDays || '0'),
    unpaidDayRate: parseFloat(payrollRecord.unpaidDayRate || '0'),
    lateMinutes: payrollRecord.lateMinutes,
    lateDeduction: parseFloat(payrollRecord.lateDeduction || '0'),
    earlyDepartureMinutes: payrollRecord.earlyDepartureMinutes,
    earlyDepartureDeduction: parseFloat(payrollRecord.earlyDepartureDeduction || '0'),
    otherDeductions: parseFloat(payrollRecord.otherDeductions || '0'),
    loanDeduction: parseFloat(payrollRecord.loanDeduction || '0'),
  });

  if (calc.netPreview < 0) {
    errors.push(`صافي الراتب المتوقع (${calc.netPreview.toFixed(3)}) لا يمكن أن يكون سالباً.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    expectedDays,
    actualDays,
  };
}

export async function approvePayroll(actor: UserSession, payrollId: string) {
  // ONLY ADMIN can approve payroll
  assertCanApprovePayroll(actor);
  const db = getDb();

  const [payrollRecord] = await db.select().from(schema.payroll).where(eq(schema.payroll.id, payrollId));
  if (!payrollRecord) throw new Error('كشف الراتب غير موجود');
  if (payrollRecord.status !== 'DRAFT') {
    throw new Error(`لا يمكن اعتماد كشف راتب بحالة (${payrollRecord.status}). الاعتماد متاح فقط للمسودات.`);
  }

  // Perform completeness verification
  const verification = await validatePayrollCompleteness(payrollId);
  if (!verification.isValid) {
    throw new Error(`تعذر اعتماد الراتب للأسباب التالية:\n• ${verification.errors.join('\n• ')}`);
  }

  const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, payrollRecord.employeeId));

  // Auto-approve all DRAFT attendances for this employee in the period upon approval
  await db.update(schema.attendance)
    .set({
      status: 'APPROVED',
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.attendance.employeeId, payrollRecord.employeeId),
        gte(schema.attendance.workDate, payrollRecord.periodStart),
        lte(schema.attendance.workDate, payrollRecord.periodEnd),
        eq(schema.attendance.status, 'DRAFT')
      )
    );

  const calc = computeNetPayroll({
    employmentType: emp?.employmentType || 'PERMANENT',
    workedDays: payrollRecord.workedDays,
    dailyRate: parseFloat(payrollRecord.dailyRate || '0'),
    basicEarned: parseFloat(payrollRecord.basicEarned || '0'),
    allowancesEarned: parseFloat(payrollRecord.allowancesEarned || '0'),
    otHours: parseFloat(payrollRecord.otHours || '0'),
    otRate: parseFloat(payrollRecord.otRate || '0'),
    otherAdditions: parseFloat(payrollRecord.otherAdditions || '0'),
    unpaidDays: parseFloat(payrollRecord.unpaidDays || '0'),
    unpaidDayRate: parseFloat(payrollRecord.unpaidDayRate || '0'),
    lateMinutes: payrollRecord.lateMinutes,
    lateDeduction: parseFloat(payrollRecord.lateDeduction || '0'),
    earlyDepartureMinutes: payrollRecord.earlyDepartureMinutes,
    earlyDepartureDeduction: parseFloat(payrollRecord.earlyDepartureDeduction || '0'),
    otherDeductions: parseFloat(payrollRecord.otherDeductions || '0'),
    loanDeduction: parseFloat(payrollRecord.loanDeduction || '0'),
  });

  // Transaction: Freeze NetPay = NetPreview and change status to APPROVED
  const [approved] = await db.update(schema.payroll)
    .set({
      netPay: calc.netPreview.toFixed(3),
      status: 'APPROVED',
      approvedBy: actor.id,
      approvedAt: new Date(),
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.payroll.id, payrollId))
    .returning();

  await logAuditEvent({
    actor,
    tableName: 'payroll',
    recordId: payrollId,
    action: 'APPROVE_PAYROLL',
    oldStatus: 'DRAFT',
    newStatus: 'APPROVED',
    metadata: {
      netPay: approved.netPay,
      employeeId: approved.employeeId,
      periodStart: approved.periodStart,
    },
  });

  return approved;
}

export async function confirmPayrollPayment(
  actor: UserSession,
  data: {
    payrollId: string;
    paymentMethod: 'BANK_TRANSFER' | 'CASH' | 'CHEQUE';
    paymentReference: string;
  }
) {
  requireRole(actor, ['ADMIN', 'ACCOUNTANT']);
  const db = getDb();

  const [payrollRecord] = await db.select().from(schema.payroll).where(eq(schema.payroll.id, data.payrollId));
  if (!payrollRecord) throw new Error('كشف الراتب غير موجود');
  if (payrollRecord.status !== 'APPROVED') {
    throw new Error('تأكيد الدفع متاح فقط لكشوف الرواتب المعتمدة (APPROVED).');
  }

  if (!data.paymentReference?.trim()) {
    throw new Error('المرجع المالي أو رقم التحويل مطلوب لتأكيد الدفع.');
  }

  const [paid] = await db.update(schema.payroll)
    .set({
      status: 'PAID',
      paymentMethod: data.paymentMethod,
      paymentReference: data.paymentReference.trim(),
      paidAt: new Date(),
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.payroll.id, data.payrollId))
    .returning();

  await logAuditEvent({
    actor,
    tableName: 'payroll',
    recordId: data.payrollId,
    action: 'CONFIRM_PAYROLL_PAYMENT',
    oldStatus: 'APPROVED',
    newStatus: 'PAID',
    metadata: {
      paymentMethod: data.paymentMethod,
      paymentReference: data.paymentReference,
    },
  });

  return paid;
}

export async function cancelPayrollDraft(actor: UserSession, payrollId: string) {
  requireRole(actor, ['ADMIN', 'ACCOUNTANT']);
  const db = getDb();

  const [payrollRecord] = await db.select().from(schema.payroll).where(eq(schema.payroll.id, payrollId));
  if (!payrollRecord) throw new Error('كشف الراتب غير موجود');
  if (payrollRecord.status !== 'DRAFT') {
    throw new Error('لا يمكن إلغاء إلا كشوف الرواتب التي ما تزال في حالة مسودة (DRAFT).');
  }

  // Release/cancel any scheduled loan repayments attached to this payroll
  await db.update(schema.repayments)
    .set({ status: 'CANCELLED' })
    .where(eq(schema.repayments.payrollId, payrollId));

  const [cancelled] = await db.update(schema.payroll)
    .set({
      status: 'CANCELLED',
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.payroll.id, payrollId))
    .returning();

  await logAuditEvent({
    actor,
    tableName: 'payroll',
    recordId: payrollId,
    action: 'CANCEL_PAYROLL_DRAFT',
    oldStatus: 'DRAFT',
    newStatus: 'CANCELLED',
  });

  return cancelled;
}

export async function generateBulkPayrollDrafts(
  actor: UserSession,
  data: { year: number; month: number }
) {
  requireRole(actor, ['ADMIN', 'ACCOUNTANT']);
  const db = getDb();

  const paddedMonth = String(data.month).padStart(2, '0');
  const periodStart = `${data.year}-${paddedMonth}-01`;
  const lastDay = new Date(Date.UTC(data.year, data.month, 0)).getUTCDate();
  const periodEnd = `${data.year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;

  const eligibleEmployees = await db
    .select()
    .from(schema.employees)
    .where(
      and(
        lte(schema.employees.startDate, periodEnd),
        sql`(${schema.employees.endDate} IS NULL OR ${schema.employees.endDate} >= ${periodStart})`,
        sql`(${schema.employees.status} = 'ACTIVE' OR (${schema.employees.endDate} IS NOT NULL AND ${schema.employees.endDate} >= ${periodStart}))`
      )
    );

  let successCount = 0;
  let skippedCount = 0;
  const errors: { employeeId: string; employeeName: string; reason: string }[] = [];

  for (const emp of eligibleEmployees) {
    try {
      await createPayrollDraft(actor, {
        employeeId: emp.id,
        year: data.year,
        month: data.month,
      });
      successCount++;
    } catch (err: any) {
      if (err.message && err.message.includes('يوجد كشف راتب نشط بالفعل')) {
        skippedCount++;
      } else {
        errors.push({
          employeeId: emp.id,
          employeeName: emp.name,
          reason: err.message || 'خطأ غير معروف أثناء توليد كشف الراتب',
        });
      }
    }
  }

  await logAuditEvent({
    actor,
    tableName: 'payroll',
    recordId: `BULK_${data.year}_${data.month}`,
    action: 'BULK_CREATE_PAYROLL_DRAFT',
    metadata: {
      year: data.year,
      month: data.month,
      totalActive: eligibleEmployees.length,
      successCount,
      skippedCount,
      errorCount: errors.length,
    },
  });

  return {
    totalActiveCount: eligibleEmployees.length,
    successCount,
    skippedCount,
    errors,
  };
}

export async function updatePayrollDraft(
  actor: UserSession,
  data: {
    payrollId: string;
    gratuities?: number;
    otherAdditions?: number;
    otherDeductions?: number;
    unpaidDays?: number;
    earlyDepartureMinutes?: number;
    lateMinutes?: number;
    otHours?: number;
    notes?: string;
  }
) {
  requireRole(actor, ['ADMIN', 'ACCOUNTANT']);
  const db = getDb();

  const [payrollRecord] = await db.select().from(schema.payroll).where(eq(schema.payroll.id, data.payrollId));
  if (!payrollRecord) throw new Error('كشف الراتب غير موجود');
  if (payrollRecord.status !== 'DRAFT') {
    throw new Error('تعديل كشف الراتب متاح فقط لكشوف الرواتب التي في حالة مسودة (DRAFT).');
  }

  const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, payrollRecord.employeeId));
  const settings = await getSystemSettings();

  // Dynamic minute deduction rate: basic / (30 * 8 * 60) = basic / 14400. For daily workers: dailyRate / 480
  let dynamicMinuteRate = 0;
  if (emp?.employmentType === 'DAILY_WORKER') {
    const dRate = parseFloat(payrollRecord.dailyRate || '0');
    dynamicMinuteRate = dRate > 0 ? (dRate / 480) : 0;
  } else {
    let bSalary = parseFloat(payrollRecord.basicEarned || '0');
    if (payrollRecord.contractId) {
      const [contract] = await db.select().from(schema.contracts).where(eq(schema.contracts.id, payrollRecord.contractId));
      if (contract && parseFloat(contract.monthlyBasic) > 0) {
        bSalary = parseFloat(contract.monthlyBasic);
      }
    }
    dynamicMinuteRate = bSalary > 0 ? (bSalary / 14400) : 0;
  }

  const minuteDeductionRate = emp?.minuteDeductionRate
    ? parseFloat(emp.minuteDeductionRate)
    : (dynamicMinuteRate > 0 ? dynamicMinuteRate : (settings?.defaultMinuteDeductionRate ? parseFloat(settings.defaultMinuteDeductionRate) : 0));

  const updatedGratuities = data.gratuities !== undefined ? data.gratuities : parseFloat(payrollRecord.gratuities || '0');
  const updatedOtherAdditions = data.otherAdditions !== undefined ? data.otherAdditions : parseFloat(payrollRecord.otherAdditions);
  const updatedOtherDeductions = data.otherDeductions !== undefined ? data.otherDeductions : parseFloat(payrollRecord.otherDeductions);
  const updatedUnpaidDays = data.unpaidDays !== undefined ? data.unpaidDays : parseFloat(payrollRecord.unpaidDays);
  const updatedEarlyDepartureMinutes = data.earlyDepartureMinutes !== undefined ? data.earlyDepartureMinutes : (payrollRecord.earlyDepartureMinutes || 0);
  const updatedLateMinutes = data.lateMinutes !== undefined ? data.lateMinutes : (payrollRecord.lateMinutes || 0);
  const updatedOtHours = data.otHours !== undefined ? data.otHours : parseFloat(payrollRecord.otHours);
  const updatedNotes = data.notes !== undefined ? data.notes : (payrollRecord.notes || undefined);

  if (updatedGratuities < 0) throw new Error('الإكراميات لا يمكن أن تكون سالبة');
  if (updatedOtherAdditions < 0) throw new Error('الإضافات الأخرى لا يمكن أن تكون سالبة');
  if (updatedOtherDeductions < 0) throw new Error('الخصومات الأخرى لا يمكن أن تكون سالبة');
  if (updatedUnpaidDays < 0) throw new Error('أيام الغياب لا يمكن أن تكون سالبة');
  if (updatedEarlyDepartureMinutes < 0) throw new Error('دقائق المغادرة المبكرة لا يمكن أن تكون سالبة');
  if (updatedLateMinutes < 0) throw new Error('دقائق التأخير لا يمكن أن تكون سالبة');
  if (updatedOtHours < 0) throw new Error('ساعات الإضافي لا يمكن أن تكون سالبة');

  const lateDeduction = Math.round(updatedLateMinutes * minuteDeductionRate * 1000) / 1000;
  const earlyDepartureDeduction = Math.round(updatedEarlyDepartureMinutes * minuteDeductionRate * 1000) / 1000;

  // Update allowances earned: 30 JOD minus 1 JOD per absence day for permanent workers (prorated for partial tenure)
  const isDailyWorker = emp?.employmentType === 'DAILY_WORKER';
  let updatedAllowancesEarned = 0;
  if (!isDailyWorker) {
    const effectiveStart = emp ? (emp.startDate > payrollRecord.periodStart ? emp.startDate : payrollRecord.periodStart) : payrollRecord.periodStart;
    const effectiveEnd = emp && emp.endDate && emp.endDate < payrollRecord.periodEnd ? emp.endDate : payrollRecord.periodEnd;
    const isPartial = effectiveStart > payrollRecord.periodStart || Boolean(emp?.endDate && emp.endDate < payrollRecord.periodEnd);
    if (isPartial) {
      const startMs = new Date(effectiveStart).getTime();
      const endMs = new Date(effectiveEnd).getTime();
      const activeDays = Math.max(0, Math.min(30, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1));
      updatedAllowancesEarned = Math.max(0, activeDays - updatedUnpaidDays);
    } else {
      updatedAllowancesEarned = Math.max(0, 30 - updatedUnpaidDays);
    }
  }

  const totalLoanDeduction = await syncEmployeeLoanRepaymentsForPayroll(db, payrollRecord.employeeId, data.payrollId, payrollRecord.periodEnd, actor.id);

  const [updated] = await db.update(schema.payroll)
    .set({
      allowancesEarned: updatedAllowancesEarned.toFixed(3),
      gratuities: updatedGratuities.toFixed(3),
      otherAdditions: updatedOtherAdditions.toFixed(3),
      otherDeductions: updatedOtherDeductions.toFixed(3),
      loanDeduction: totalLoanDeduction.toFixed(3),
      unpaidDays: updatedUnpaidDays.toFixed(2),
      lateMinutes: updatedLateMinutes,
      lateDeduction: lateDeduction.toFixed(3),
      earlyDepartureMinutes: updatedEarlyDepartureMinutes,
      earlyDepartureDeduction: earlyDepartureDeduction.toFixed(3),
      otHours: updatedOtHours.toFixed(2),
      notes: updatedNotes || null,
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.payroll.id, data.payrollId))
    .returning();

  await logAuditEvent({
    actor,
    tableName: 'payroll',
    recordId: data.payrollId,
    action: 'UPDATE_PAYROLL_DRAFT',
    metadata: {
      otherAdditions: updatedOtherAdditions,
      otherDeductions: updatedOtherDeductions,
      unpaidDays: updatedUnpaidDays,
      earlyDepartureMinutes: updatedEarlyDepartureMinutes,
      lateMinutes: updatedLateMinutes,
      otHours: updatedOtHours,
    },
  });

  return updated;
}

export async function deletePayrollRun(
  actor: UserSession,
  payrollId: string
) {
  requireRole(actor, ['ADMIN', 'HR', 'ACCOUNTANT', 'SUPERVISOR']);
  const db = getDb();

  const [existing] = await db.select().from(schema.payroll).where(eq(schema.payroll.id, payrollId));
  if (!existing) {
    throw new Error('مسير الراتب غير موجود أو تم حذفه مسبقاً');
  }

  // Delete/unlink linked repayments if any exist
  await db.delete(schema.repayments).where(eq(schema.repayments.payrollId, payrollId));

  // Delete payroll record
  const [deleted] = await db.delete(schema.payroll)
    .where(eq(schema.payroll.id, payrollId))
    .returning();

  await logAuditEvent({
    actor,
    tableName: 'payroll',
    recordId: payrollId,
    action: 'DELETE_PAYROLL_RUN',
    oldStatus: existing.status,
    metadata: {
      employeeId: existing.employeeId,
      periodStart: existing.periodStart,
      periodEnd: existing.periodEnd,
    },
  });

  return deleted;
}

export async function approveBulkPayrollForMonth(
  actor: UserSession,
  month: string
): Promise<{ approvedCount: number; errors: string[] }> {
  assertCanApprovePayroll(actor);
  const db = getDb();
  const start = `${month}-01`;

  const drafts = await db.select().from(schema.payroll).where(
    and(
      eq(schema.payroll.periodStart, start),
      eq(schema.payroll.status, 'DRAFT')
    )
  );

  let approvedCount = 0;
  const errors: string[] = [];

  for (const draft of drafts) {
    try {
      await approvePayroll(actor, draft.id);
      approvedCount++;
    } catch (err: any) {
      errors.push(`كشف الموظف (${draft.employeeId}): ${err.message}`);
    }
  }

  await logAuditEvent({
    actor,
    tableName: 'payroll',
    recordId: `month_${month}`,
    action: 'APPROVE_BULK_MONTHLY_PAYROLL',
    metadata: {
      month,
      approvedCount,
      errorCount: errors.length,
    },
  });

  return { approvedCount, errors };
}




