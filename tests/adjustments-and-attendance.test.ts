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
import { saveBulkLoans, getLoans } from '../src/lib/services/loan-service';
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

  it('4. saveMonthlyPayrollAdjustments allows custom transportation allowance override and updates payslip statement accurately', async () => {
    // Override transportation allowance to 50 JOD (instead of default 30 JOD)
    const res = await saveMonthlyPayrollAdjustments(adminUser, testMonth, [
      {
        employeeId: testEmpId,
        allowancesEarned: 50,
        deliveryAllowance: 5,
        bonus: 30,
        bonusReason: 'مكافأة إضافية',
        dailyPenalties: 10,
        otherDeductions: 0,
        notes: 'تعديل بدل المواصلات إلى 50',
      },
    ]);
    expect(res.success).toBe(true);

    // Verify payroll record has updated allowancesEarned = 50
    const db = getDb();
    const [draft] = await db.select().from(schema.payroll).where(
      eq(schema.payroll.employeeId, testEmpId)
    );
    expect(draft).toBeDefined();
    expect(parseFloat(draft.allowancesEarned)).toBe(50);
    expect(parseFloat(draft.gratuities || '0')).toBe(30);

    // Verify sheet reloads with the edited 50 JOD transportation allowance
    const sheet = await getMonthlyPayrollAdjustmentSheet(adminUser, testMonth);
    const row = sheet.rows.find((r) => r.employeeId === testEmpId);
    expect(row).toBeDefined();
    expect(row!.allowancesEarned).toBe(50);
    expect(row!.bonus).toBe(30);

    // Verify individual payslip data (بيان الراتب) receives updated transportation allowance & bonus
    const payslip = await getPayslipData(adminUser, draft.id);
    expect(payslip).toBeDefined();
    expect(parseFloat(payslip.allowancesEarned)).toBe(50);
    expect(parseFloat(payslip.tipsGratuities)).toBe(30);
    expect(parseFloat(payslip.deliveryAllowance)).toBe(5);
    expect(parseFloat(payslip.otherDeductions)).toBe(10); // daily penalty only

    // basic (400) + transport (50) + delivery (5) + bonus (30) = 485 earnings
    // deductions = 10 (penalties)
    // net = 485 - 10 = 475
    expect(parseFloat(payslip.totalEarnings)).toBe(485);
    expect(parseFloat(payslip.totalDeductions)).toBe(10);
    expect(parseFloat(payslip.netPay)).toBe(475);
  });

  it('5. should support full 21-column payroll adjustments: basic, overtime, other additions, early departure, late deductions, loans', async () => {
    // Save comprehensive 21-column adjustments matching user Excel sheet:
    // basic: 290.00
    // transport: 30.00
    // delivery: 3.00
    // gratuities (bonus): 15.00
    // otherAdditions: 10.00
    // otHours: 15.00 (at basic 290, otRate = 290/120 = 2.41666 -> otTotal = 36.25)
    // loan: 20.00
    // earlyDepartureHours: 2.00 (rate = 290/240 = 1.20833 -> 2.42 deduction)
    // lateHours: 1.00 (rate = 290/240 = 1.20833 -> 1.21 deduction)
    // unpaidDays: 0
    // otherDeductions: 5.00
    const res = await saveMonthlyPayrollAdjustments(adminUser, testMonth, [
      {
        employeeId: testEmpId,
        basicEarned: 290,
        allowancesEarned: 30,
        deliveryAllowance: 3,
        bonus: 15,
        otherAdditions: 10,
        otHours: 15,
        loanDeduction: 20,
        earlyDepartureHours: 2,
        lateHours: 1,
        dailyPenalties: 0,
        otherDeductions: 5,
        notes: 'تعديل شامل لبيان الرواتب',
      },
    ]);
    expect(res.success).toBe(true);

    const db = getDb();
    const [draft] = await db.select().from(schema.payroll).where(
      eq(schema.payroll.employeeId, testEmpId)
    );
    expect(draft).toBeDefined();
    expect(parseFloat(draft.basicEarned)).toBe(290);
    expect(parseFloat(draft.allowancesEarned)).toBe(30);
    expect(parseFloat(draft.deliveryAllowance || '0')).toBe(3);
    expect(parseFloat(draft.gratuities || '0')).toBe(15);
    expect(parseFloat(draft.otherAdditions || '0')).toBe(10);
    expect(parseFloat(draft.otHours || '0')).toBe(15);
    expect(parseFloat(draft.loanDeduction || '0')).toBe(20);
    expect(draft.earlyDepartureMinutes).toBe(120); // 2 hours * 60
    expect(draft.lateMinutes).toBe(60); // 1 hour * 60
    expect(parseFloat(draft.otherDeductions || '0')).toBe(5);

    // Verify individual payslip (بيان الراتب) reflects all 21 items
    const payslip = await getPayslipData(adminUser, draft.id);
    expect(payslip).toBeDefined();
    expect(parseFloat(payslip.basicEarned)).toBe(290);
    expect(parseFloat(payslip.allowancesEarned)).toBe(30);
    expect(parseFloat(payslip.deliveryAllowance)).toBe(3);
    expect(parseFloat(payslip.tipsGratuities)).toBe(15);
    expect(parseFloat(payslip.otherAdditions)).toBe(10);
    expect(parseFloat(payslip.otHours)).toBe(15);
    expect(parseFloat(payslip.otTotal)).toBeCloseTo(36.25, 1);
    expect(parseFloat(payslip.loanDeduction)).toBe(20);
    expect(parseFloat(payslip.earlyDepartureHours || '0')).toBe(2);
    expect(parseFloat(payslip.lateHours || '0')).toBe(1);

    // Check gross: 290 + 30 + 3 + 15 + 10 + otTotal
    expect(parseFloat(payslip.totalEarnings)).toBeCloseTo(384.25, 1);
  });

  it('6. should support bulk loan registration and multi-month long-term loan installments deducting accurately per month in payroll', async () => {
    // 1. Create a second employee for testing bulk entry
    const emp2 = await createEmployee(adminUser, {
      employeeNo: 'EMP-BULK-002',
      name: 'عامل سلف تجريبي',
      department: 'المصنع',
      jobTitle: 'عامل خط إنتاج',
      startDate: '2026-01-01',
      employmentType: 'PERMANENT',
    });
    await createContract(adminUser, {
      employeeId: emp2.id,
      startDate: '2026-01-01',
      monthlyBasic: 290,
      monthlyAllowances: 30,
      unpaidDayRate: 9.667,
      otRate: 2.417,
    });

    // 2. Perform bulk loan registration:
    // Emp 1: 300 JOD long-term loan over 3 months (100 JOD/month) starting in 2026-11
    // Emp 2: 50 JOD single-month advance in 2026-11
    const bulkRes = await saveBulkLoans(adminUser, {
      date: '2026-11-01',
      startMonth: '2026-11',
      disburseImmediately: true,
      items: [
        {
          employeeId: testEmpId,
          amount: 300,
          installmentMonths: 3,
          monthlyInstallment: 100,
          startMonth: '2026-11',
          notes: 'سلفة طويلة الأمد 300 دينار',
        },
        {
          employeeId: emp2.id,
          amount: 50,
          installmentMonths: 1,
          monthlyInstallment: 50,
          startMonth: '2026-11',
          notes: 'سلفة شهرية عادية',
        },
      ],
    });

    expect(bulkRes.success).toBe(true);
    expect(bulkRes.createdCount).toBe(2);
    expect(bulkRes.totalAmount).toBe(350);

    // 3. Verify getLoans returns installment plans
    const allLoans = await getLoans(adminUser);
    const loanEmp1 = allLoans.find((l) => l.employeeId === testEmpId && parseFloat(l.amount) === 300);
    const loanEmp2 = allLoans.find((l) => l.employeeId === emp2.id);

    expect(loanEmp1).toBeDefined();
    expect(loanEmp1?.installmentMonths).toBe(3);
    expect(parseFloat(loanEmp1?.monthlyInstallment || '0')).toBe(100);
    expect(loanEmp1?.status).toBe('DISBURSED');

    expect(loanEmp2).toBeDefined();
    expect(loanEmp2?.installmentMonths).toBe(1);
    expect(parseFloat(loanEmp2?.monthlyInstallment || '0')).toBe(50);

    // 4. Check monthly adjustment sheet for 2026-11:
    // Emp 2 should automatically have loanDeduction = 50 in 2026-11
    const sheetData11 = await getMonthlyPayrollAdjustmentSheet(adminUser, '2026-11');
    const rowEmp2 = sheetData11.rows.find((r) => r.employeeId === emp2.id);
    expect(rowEmp2).toBeDefined();
    expect(rowEmp2?.loanDeduction).toBe(50);

    // 5. Save/generate payroll for Emp 2 in 2026-11 and check loan deduction is 50
    await saveMonthlyPayrollAdjustments(adminUser, '2026-11', [
      {
        employeeId: emp2.id,
        loanDeduction: 50,
        status: 'APPROVED',
      },
    ]);

    // 6. Next month 2026-12:
    // Emp 2 should have 0 loan deduction because the 50 JOD was fully repaid!
    const sheetData12 = await getMonthlyPayrollAdjustmentSheet(adminUser, '2026-12');
    const rowEmp2Month12 = sheetData12.rows.find((r) => r.employeeId === emp2.id);
    expect(rowEmp2Month12).toBeDefined();
    expect(rowEmp2Month12?.loanDeduction).toBe(0);

    // Emp 1 should have installment of 100 in 2026-12 (month 2 of 3)
    const rowEmp1Month12 = sheetData12.rows.find((r) => r.employeeId === testEmpId);
    expect(rowEmp1Month12).toBeDefined();
    expect(rowEmp1Month12?.loanDeduction).toBe(100);
  });
});
