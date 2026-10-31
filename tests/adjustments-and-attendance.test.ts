import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../src/db/migrate';
import { getDb, schema } from '../src/db';
import { createEmployee } from '../src/lib/services/employee-service';
import { createContract } from '../src/lib/services/contract-service';
import {
  markPresent,
  recordDailyPenalty,
  recordDeliveryAllowance,
} from '../src/lib/services/attendance-service';
import {
  getMonthlyPayrollAdjustmentSheet,
  saveMonthlyPayrollAdjustments,
  getPayrollById,
  computeNetPayroll,
  approvePayroll,
} from '../src/lib/services/payroll-service';
import { getPayslipData, getBatchPayslipData } from '../src/lib/services/payslip-service';
import { UserSession } from '../src/lib/auth/rbac';
import { eq } from 'drizzle-orm';

describe('Daily Penalties, Delivery Allowances, and Monthly Payroll Adjustments', () => {
  const adminUser: UserSession = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@test.local',
    fullName: 'Admin User',
    role: 'ADMIN',
    active: true,
  };

  let testEmpId: string;
  const testMonth = '2026-11';
  const testDate1 = '2026-11-05';
  const testDate2 = '2026-11-12';

  beforeAll(async () => {
    const { getPglite } = await import('../src/db');
    const pglite = getPglite();
    await runMigrations(pglite);
    const db = getDb();

    // Ensure admin user in db
    await db.insert(schema.users).values({
      id: adminUser.id,
      email: adminUser.email,
      fullName: adminUser.fullName,
      role: 'ADMIN',
      passwordHash: 'dummy',
    }).onConflictDoNothing();

    // Ensure settings
    const existing = await db.select().from(schema.settings).limit(1);
    if (existing.length === 0) {
      await db.insert(schema.settings).values({
        companyName: 'شركة الخطوط الأذكى لصناعة المنظفات',
        currency: 'JOD',
        payrollPolicyConfirmed: true,
        defaultWorkStartTime: '08:00:00',
        defaultWorkEndTime: '17:00:00',
        defaultBreakMinutes: 60,
        defaultMinuteDeductionRate: '0.500',
      });
    }

    // Create an active employee
    const emp = await createEmployee(adminUser, {
      employeeNo: `EMP-ADJ-${Date.now().toString().slice(-4)}`,
      name: 'محمود سائق وموظف مصنع',
      department: 'الإنتاج',
      jobTitle: 'سائق رافعة',
      employmentType: 'PERMANENT',
      startDate: '2026-01-01',
      socialSecurityRegistered: false,
    });
    testEmpId = emp.id;

    // Create contract with basic 400 JOD
    await createContract(adminUser, {
      employeeId: testEmpId,
      contractType: 'PERMANENT',
      startDate: '2026-01-01',
      monthlyBasic: 400,
      monthlyAllowances: 0,
      unpaidDayRate: 13.333,
      otRate: 3.333,
    });
  });

  it('1. should record daily penalty and delivery allowance in attendance record', async () => {
    // Mark present on day 1
    await markPresent(adminUser, testEmpId, testDate1, '08:00');

    // Add delivery allowance on day 1 (e.g. 5 JOD for fetching diesel with personal car)
    const deliveryAtt = await recordDeliveryAllowance(
      adminUser,
      testEmpId,
      testDate1,
      5,
      'إحضار ديزل للرافعة الشوكية بسيارته الخاصة'
    );
    expect(parseFloat(deliveryAtt.deliveryAllowance || '0')).toBe(5);
    expect(deliveryAtt.deliveryReason).toContain('إحضار ديزل للرافعة');

    // Mark present on day 2
    await markPresent(adminUser, testEmpId, testDate2, '08:00');

    // Record violation / penalty on day 2 (e.g. 10 JOD penalty)
    const penaltyAtt = await recordDailyPenalty(
      adminUser,
      testEmpId,
      testDate2,
      10,
      'عدم ارتداء خوذة السلامة ومخالفة التعليمات'
    );
    expect(parseFloat(penaltyAtt.penaltyAmount || '0')).toBe(10);
    expect(penaltyAtt.penaltyReason).toContain('خوذة السلامة');
  });

  it('2. getMonthlyPayrollAdjustmentSheet aggregates daily delivery allowances and penalties correctly', async () => {
    const sheet = await getMonthlyPayrollAdjustmentSheet(adminUser, testMonth);
    const row = sheet.rows.find((r) => r.employeeId === testEmpId);
    expect(row).toBeDefined();

    // Check delivery allowance rollup
    expect(row!.deliveryAllowance).toBe(5);
    expect(row!.deliveryDetails.length).toBe(1);
    expect(row!.deliveryDetails[0].amount).toBe(5);
    expect(row!.deliveryDetails[0].reason).toContain('إحضار ديزل');

    // Check daily penalties rollup
    expect(row!.dailyPenalties).toBe(10);
    expect(row!.penaltyDetails.length).toBe(1);
    expect(row!.penaltyDetails[0].amount).toBe(10);
    expect(row!.penaltyDetails[0].reason).toContain('خوذة السلامة');
  });

  it('3. saveMonthlyPayrollAdjustments creates/updates payroll draft with bonuses, delivery, and deductions', async () => {
    // Save adjustments: add 25 JOD bonus and 5 JOD extra disciplinary deduction
    const res = await saveMonthlyPayrollAdjustments(adminUser, testMonth, [
      {
        employeeId: testEmpId,
        deliveryAllowance: 5,
        bonus: 25,
        bonusReason: 'مكافأة تميز في تفريغ الحاويات',
        dailyPenalties: 10,
        otherDeductions: 5,
        deductionReason: 'إتلاف صندوق كرتون إضافي',
        notes: 'تمت المراجعة والاعتماد من قبل الإدارة',
      },
    ]);

    expect(res.success).toBe(true);
    expect(res.savedCount).toBeGreaterThanOrEqual(1);

    // Verify created payroll record in database
    const db = getDb();
    const [draft] = await db.select().from(schema.payroll).where(
      eq(schema.payroll.employeeId, testEmpId)
    );

    expect(draft).toBeDefined();
    expect(parseFloat(draft.deliveryAllowance || '0')).toBe(5);
    expect(parseFloat(draft.gratuities || '0')).toBe(25);
    // otherDeductions must equal dailyPenalties (10) + extra deductions (5) = 15
    expect(parseFloat(draft.otherDeductions || '0')).toBe(15);
    expect(draft.notes).toContain('بدل توصيل: 5.000 د.أ');
    expect(draft.notes).toContain('مكافأة: 25.000 د.أ');
    expect(draft.notes).toContain('مخالفات حضور: 10.000 د.أ');
    expect(draft.notes).toContain('خصومات عقابية: 5.000 د.أ');

    // Verify net preview calculation:
    // basic = 400
    // transport = 30
    // otTotal = 0
    // delivery = 5
    // bonus = 25
    // gross = 400 + 30 + 5 + 25 = 460
    // otherDeductions = 15
    // net = 460 - 15 = 445
    const calc = computeNetPayroll({
      employmentType: 'PERMANENT',
      basicEarned: parseFloat(draft.basicEarned),
      allowancesEarned: parseFloat(draft.allowancesEarned),
      deliveryAllowance: parseFloat(draft.deliveryAllowance || '0'),
      gratuities: parseFloat(draft.gratuities || '0'),
      otHours: parseFloat(draft.otHours),
      otRate: parseFloat(draft.otRate),
      otherAdditions: parseFloat(draft.otherAdditions || '0'),
      unpaidDays: parseFloat(draft.unpaidDays),
      unpaidDayRate: parseFloat(draft.unpaidDayRate),
      socialSecurityRegistered: false,
      lateDeduction: parseFloat(draft.lateDeduction || '0'),
      earlyDepartureDeduction: parseFloat(draft.earlyDepartureDeduction || '0'),
      otherDeductions: parseFloat(draft.otherDeductions || '0'),
      loanDeduction: parseFloat(draft.loanDeduction || '0'),
    });
    expect(calc.netPreview).toBe(445);

    // Verify batch payslip data mapping extracts deliveryAllowance and deductions correctly
    const [payslip] = await getBatchPayslipData(adminUser, {
      month: testMonth,
      employeeId: testEmpId,
      status: 'DRAFT',
    });
    expect(payslip).toBeDefined();
    expect(parseFloat(payslip.deliveryAllowance)).toBe(5);
    expect(parseFloat(payslip.tipsGratuities)).toBe(25);
    expect(parseFloat(payslip.otherDeductions)).toBe(15);
    expect(parseFloat(payslip.netPay)).toBe(445);
  });
});
