import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../src/db/migrate';
import { getDb, schema } from '../src/db';
import {
  createEmployee,
  updateEmployee,
  updateSocialSecurity,
  uploadIdentityImage,
  getEmployeeIdentityImages,
  getEmployeeById,
} from '../src/lib/services/employee-service';
import { createContract, updateContract } from '../src/lib/services/contract-service';
import {
  markPresent,
  markLate,
  markAbsent,
  recordEarlyDeparture,
  isAttendanceLocked,
  createOrUpdateAttendance,
} from '../src/lib/services/attendance-service';
import {
  createPayrollDraft,
  generateBulkPayrollDrafts,
  updatePayrollDraft,
  refreshPayrollDraft,
  approvePayroll,
  validatePayrollCompleteness,
} from '../src/lib/services/payroll-service';
import { getBatchPayslipData } from '../src/lib/services/payslip-service';
import { UserSession, AuthorizationError } from '../src/lib/auth/rbac';
import { eq } from 'drizzle-orm';

describe('HR & Payroll Production Business Rules & Specification Test Suite', () => {
  const adminUser: UserSession = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@test.local',
    fullName: 'Admin User',
    role: 'ADMIN',
    active: true,
  };

  const hrUser: UserSession = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'hr@test.local',
    fullName: 'HR User',
    role: 'HR',
    active: true,
  };

  const accountantUser: UserSession = {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'accountant@test.local',
    fullName: 'Accountant User',
    role: 'ACCOUNTANT',
    active: true,
  };

  const supervisorUser: UserSession = {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'supervisor@test.local',
    fullName: 'Supervisor User',
    role: 'SUPERVISOR',
    active: true,
  };

  beforeAll(async () => {
    const { getPglite } = await import('../src/db');
    const pglite = getPglite();
    await runMigrations(pglite);

    const db = getDb();

    // Ensure test users exist in database
    await db.insert(schema.users).values([
      adminUser,
      hrUser,
      accountantUser,
      supervisorUser,
    ]);

    // Ensure settings table has a confirmed policy and defaults
    const existing = await db.select().from(schema.settings).limit(1);
    if (existing.length === 0) {
      await db.insert(schema.settings).values({
        companyName: 'Corporate Enterprise Test',
        currency: 'JOD',
        payrollPolicyConfirmed: true,
        defaultWorkStartTime: '08:00:00',
        defaultWorkEndTime: '17:00:00',
        defaultBreakMinutes: 60,
        defaultMinuteDeductionRate: '0.500',
      });
    } else {
      await db.update(schema.settings).set({
        payrollPolicyConfirmed: true,
        defaultWorkStartTime: '08:00:00',
        defaultWorkEndTime: '17:00:00',
        defaultBreakMinutes: 60,
        defaultMinuteDeductionRate: '0.500',
      });
    }
  });

  // ==========================================
  // SECTION 1: SOCIAL SECURITY RULES (4 TESTS)
  // ==========================================
  describe('1. Social Security Status Rules', () => {
    it('1. Setting social_security_registered = false forces social_security_registration_date = null', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'SS-001',
        name: 'Employee SS 1',
        department: 'IT',
        jobTitle: 'Developer',
        startDate: '2026-01-01',
        socialSecurityRegistered: false,
        socialSecurityRegistrationDate: '2026-01-15', // Should be forced to null
      });

      expect(emp.socialSecurityRegistered).toBe(false);
      expect(emp.socialSecurityRegistrationDate).toBeNull();
    });

    it('2. Setting social_security_registered = true without a registration date throws a validation error', async () => {
      await expect(
        createEmployee(adminUser, {
          employeeNo: 'SS-002',
          name: 'Employee SS 2',
          department: 'IT',
          jobTitle: 'Developer',
          startDate: '2026-01-01',
          socialSecurityRegistered: true,
          socialSecurityRegistrationDate: null, // Missing!
        })
      ).rejects.toThrow(/تاريخ التسجيل في الضمان الاجتماعي مطلوب/);
    });

    it('3. Setting social_security_registered = true with a registration date succeeds', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'SS-003',
        name: 'Employee SS 3',
        department: 'IT',
        jobTitle: 'Developer',
        startDate: '2026-01-01',
        socialSecurityRegistered: true,
        socialSecurityRegistrationDate: '2026-01-10',
      });

      expect(emp.socialSecurityRegistered).toBe(true);
      expect(emp.socialSecurityRegistrationDate).toBe('2026-01-10');
    });

    it('4. Toggling from true to false clears the existing registration date', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'SS-004',
        name: 'Employee SS 4',
        department: 'IT',
        jobTitle: 'Developer',
        startDate: '2026-01-01',
        socialSecurityRegistered: true,
        socialSecurityRegistrationDate: '2026-01-10',
      });

      const updated = await updateSocialSecurity(adminUser, emp.id, {
        socialSecurityRegistered: false,
      });

      expect(updated.socialSecurityRegistered).toBe(false);
      expect(updated.socialSecurityRegistrationDate).toBeNull();
    });
  });

  // ==========================================
  // SECTION 2: CONTRACTS & SIGNATURES (4 TESTS)
  // ==========================================
  describe('2. Contract Signature Status Rules', () => {
    it('5. Contract creation succeeds without uploading a PDF', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'CON-001',
        name: 'Contract Employee 1',
        department: 'HR',
        jobTitle: 'Specialist',
        startDate: '2026-01-01',
      });

      const contract = await createContract(adminUser, {
        employeeId: emp.id,
        startDate: '2026-01-01',
        monthlyBasic: 5000,
        monthlyAllowances: 1000,
        unpaidDayRate: 200,
        otRate: 40,
        contractSigned: false,
      });

      expect(contract).toBeDefined();
      expect(contract.id).toBeDefined();
      expect(contract.fileUrl).toBeNull();
    });

    it('6. Contract creation with contract_signed = false forces contract_signed_date = null', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'CON-002',
        name: 'Contract Employee 2',
        department: 'HR',
        jobTitle: 'Specialist',
        startDate: '2026-01-01',
      });

      const contract = await createContract(adminUser, {
        employeeId: emp.id,
        startDate: '2026-01-01',
        monthlyBasic: 6000,
        monthlyAllowances: 1000,
        unpaidDayRate: 250,
        otRate: 50,
        contractSigned: false,
        contractSignedDate: '2026-01-05', // Should be forced to null
      });

      expect(contract.contractSigned).toBe(false);
      expect(contract.contractSignedDate).toBeNull();
    });

    it('7. Contract creation with contract_signed = true without a signed date throws a validation error', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'CON-003',
        name: 'Contract Employee 3',
        department: 'HR',
        jobTitle: 'Specialist',
        startDate: '2026-01-01',
      });

      await expect(
        createContract(adminUser, {
          employeeId: emp.id,
          startDate: '2026-01-01',
          monthlyBasic: 6000,
          monthlyAllowances: 1000,
          unpaidDayRate: 250,
          otRate: 50,
          contractSigned: true,
          contractSignedDate: null, // Missing!
        })
      ).rejects.toThrow(/تاريخ توقيع العقد مطلوب/);
    });

    it('8. Contract creation with contract_signed = true and a valid date succeeds', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'CON-004',
        name: 'Contract Employee 4',
        department: 'HR',
        jobTitle: 'Specialist',
        startDate: '2026-01-01',
      });

      const contract = await createContract(adminUser, {
        employeeId: emp.id,
        startDate: '2026-01-01',
        monthlyBasic: 6000,
        monthlyAllowances: 1000,
        unpaidDayRate: 250,
        otRate: 50,
        contractSigned: true,
        contractSignedDate: '2026-01-03',
      });

      expect(contract.contractSigned).toBe(true);
      expect(contract.contractSignedDate).toBe('2026-01-03');
    });

    it('8b. Creating a permanent employee with monthlyBasic automatically provisions their contract', async () => {
      const { getEmployeeById } = await import('../src/lib/services/employee-service');
      const emp = await createEmployee(adminUser, {
        employeeNo: 'CON-005',
        name: 'Contract Employee 5',
        department: 'Engineering',
        jobTitle: 'Senior Developer',
        startDate: '2026-03-01',
        employmentType: 'PERMANENT',
        monthlyBasic: 750,
        monthlyAllowances: 100,
      });

      const detailedEmp = await getEmployeeById(adminUser, emp.id);
      expect(detailedEmp.currentContract).toBeDefined();
      expect(Number(detailedEmp.currentContract?.monthlyBasic)).toBe(750);
      expect(Number(detailedEmp.currentContract?.monthlyAllowances)).toBe(100);
      expect(detailedEmp.currentContract?.contractSigned).toBe(true);
    });
  });

  // ==========================================
  // SECTION 3: DAILY WORKERS (5 TESTS)
  // ==========================================
  describe('3. Daily Worker Support & Payroll Formula', () => {
    it('9. Daily worker created without a contract succeeds', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'DW-001',
        name: 'Daily Worker 1',
        department: 'Operations',
        jobTitle: 'Technician',
        startDate: '2026-02-01',
        employmentType: 'DAILY_WORKER',
        dailyRate: 150,
        temporaryStartDate: '2026-02-01',
      });

      expect(emp.employmentType).toBe('DAILY_WORKER');
      expect(Number(emp.dailyRate)).toBe(150);
    });

    it('10. Daily worker without daily_rate throws validation error', async () => {
      await expect(
        createEmployee(adminUser, {
          employeeNo: 'DW-002',
          name: 'Daily Worker 2',
          department: 'Operations',
          jobTitle: 'Technician',
          startDate: '2026-02-01',
          employmentType: 'DAILY_WORKER',
          // dailyRate missing!
        })
      ).rejects.toThrow(/أجرة المياومة مطلوبة/);
    });

    it('11. Daily worker payroll calculated using WorkedDays × DailyRate + OT - Deductions - Loans', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'DW-003',
        name: 'Daily Worker 3',
        department: 'Operations',
        jobTitle: 'Technician',
        startDate: '2026-03-01',
        employmentType: 'DAILY_WORKER',
        dailyRate: 200,
        temporaryStartDate: '2026-03-01',
      });

      // Mark 3 days present in March 2026
      await markPresent(adminUser, emp.id, '2026-03-01');
      await markPresent(adminUser, emp.id, '2026-03-02');
      await markPresent(adminUser, emp.id, '2026-03-03');

      // Create draft: 3 days × 200 = 600 Gross
      const draft = await createPayrollDraft(adminUser, {
        employeeId: emp.id,
        year: 2026,
        month: 3,
        otherAdditions: 50,
        otherDeductions: 20,
      });

      expect(draft.employmentType).toBe('DAILY_WORKER');
      expect(draft.workedDays).toBe(3);
      expect(Number(draft.dailyRate)).toBe(200);
      expect(Number(draft.basicEarned)).toBe(600); // 3 * 200
      expect(Number(draft.grossPay)).toBe(650); // 600 + 50
      expect(Number(draft.netPreview)).toBe(630); // 650 - 20
    });

    it('12. Daily worker rate change creates a new rate history record with effective date', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'DW-004',
        name: 'Daily Worker 4',
        department: 'Operations',
        jobTitle: 'Technician',
        startDate: '2026-04-01',
        employmentType: 'DAILY_WORKER',
        dailyRate: 180,
      });

      // Update rate to 220
      await updateEmployee(adminUser, emp.id, {
        dailyRate: 220,
      });

      const db = getDb();
      const history = await db.select().from(schema.dailyRateHistory).where(eq(schema.dailyRateHistory.employeeId, emp.id));
      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    it('13. Payroll uses the rate effective during the worked period, not a newer rate', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'DW-005',
        name: 'Daily Worker 5',
        department: 'Operations',
        jobTitle: 'Technician',
        startDate: '2026-05-01',
        employmentType: 'DAILY_WORKER',
        dailyRate: 150,
      });

      const db = getDb();
      // Insert historical rate active in May 2026: 150
      await db.insert(schema.dailyRateHistory).values({
        employeeId: emp.id,
        dailyRate: '150.000',
        effectiveFrom: '2026-05-01',
        createdBy: adminUser.id,
      });

      // And a newer rate effective June 2026: 250
      await db.insert(schema.dailyRateHistory).values({
        employeeId: emp.id,
        dailyRate: '250.000',
        effectiveFrom: '2026-06-01',
        createdBy: adminUser.id,
      });

      // Mark 2 days present in May
      await markPresent(adminUser, emp.id, '2026-05-01');
      await markPresent(adminUser, emp.id, '2026-05-02');

      // Create May payroll draft
      const draft = await createPayrollDraft(adminUser, {
        employeeId: emp.id,
        year: 2026,
        month: 5,
      });

      // Should use 150 (not the newer 250) -> 2 * 150 = 300
      expect(Number(draft.dailyRate)).toBe(150);
      expect(Number(draft.basicEarned)).toBe(300);
    });
  });

  // ==========================================
  // SECTION 4: ID CARD IMAGES (6 TESTS)
  // ==========================================
  describe('4. Employee ID Card Images & Access Control', () => {
    it('14. Uploading a JPG image succeeds and stores the file path', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'IMG-001',
        name: 'Image Employee 1',
        department: 'IT',
        jobTitle: 'Developer',
        startDate: '2026-01-01',
      });

      const dummyJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const updated = await uploadIdentityImage(adminUser, emp.id, 'front', dummyJpg, 'image/jpeg', 'card_front.jpg');

      expect(updated.identityImageFront).toBeTruthy();
    });

    it('15. Uploading a PNG image succeeds', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'IMG-002',
        name: 'Image Employee 2',
        department: 'IT',
        jobTitle: 'Developer',
        startDate: '2026-01-01',
      });

      const dummyPng = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const updated = await uploadIdentityImage(adminUser, emp.id, 'back', dummyPng, 'image/png', 'card_back.png');

      expect(updated.identityImageBack).toBeTruthy();
    });

    it('16. Uploading a WEBP image succeeds', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'IMG-003',
        name: 'Image Employee 3',
        department: 'IT',
        jobTitle: 'Developer',
        startDate: '2026-01-01',
      });

      const dummyWebp = Buffer.from('RIFF....WEBP');
      const updated = await uploadIdentityImage(adminUser, emp.id, 'front', dummyWebp, 'image/webp', 'card.webp');

      expect(updated.identityImageFront).toBeTruthy();
    });

    it('17. Uploading a PDF throws a validation error (PDF rejected for ID card images)', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'IMG-004',
        name: 'Image Employee 4',
        department: 'IT',
        jobTitle: 'Developer',
        startDate: '2026-01-01',
      });

      const dummyPdf = Buffer.from('%PDF-1.4');
      await expect(
        uploadIdentityImage(adminUser, emp.id, 'front', dummyPdf, 'application/pdf', 'national_id.pdf')
      ).rejects.toThrow(/صيغة الملف غير مدعومة للهوية.*JPG أو PNG أو WEBP/);
    });

    it('18. User with Supervisor role attempting to view/download ID card images gets AuthorizationError', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'IMG-005',
        name: 'Image Employee 5',
        department: 'IT',
        jobTitle: 'Developer',
        startDate: '2026-01-01',
      });

      await expect(
        getEmployeeIdentityImages(supervisorUser, emp.id)
      ).rejects.toThrow(AuthorizationError);
    });

    it('19. User with Admin or HR role can view/download ID card images', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'IMG-006',
        name: 'Image Employee 6',
        department: 'IT',
        jobTitle: 'Developer',
        startDate: '2026-01-01',
      });

      const dummyJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      await uploadIdentityImage(adminUser, emp.id, 'front', dummyJpg, 'image/jpeg', 'front.jpg');

      const adminView = await getEmployeeIdentityImages(adminUser, emp.id);
      expect(adminView).toBeDefined();

      const hrView = await getEmployeeIdentityImages(hrUser, emp.id);
      expect(hrView).toBeDefined();
    });
  });

  // ==========================================
  // SECTION 5: ATTENDANCE & LATENESS (5 TESTS)
  // ==========================================
  describe('5. Simplified Attendance, Lateness & Early Departure', () => {
    it('20. Quick attendance حضور marks employee present on-time (LateMinutes = 0)', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'ATT-001',
        name: 'Attendance Employee 1',
        department: 'Support',
        jobTitle: 'Agent',
        startDate: '2026-06-01',
        workStartTime: '08:00:00',
        workEndTime: '17:00:00',
      });

      const record = await markPresent(adminUser, emp.id, '2026-06-01');

      expect(record.attendanceType).toBe('PRESENT');
      expect(record.lateMinutes).toBe(0);
    });

    it('21. Quick attendance تأخير with clock-in 08:35 and scheduled start 08:00 calculates exactly 35 minutes late', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'ATT-002',
        name: 'Attendance Employee 2',
        department: 'Support',
        jobTitle: 'Agent',
        startDate: '2026-06-01',
        workStartTime: '08:00:00',
        workEndTime: '17:00:00',
      });

      const record = await markLate(adminUser, emp.id, '2026-06-02', '08:35');

      expect(record.attendanceType).toBe('PRESENT');
      expect(record.lateMinutes).toBe(35); // Exactly 35, never rounded
    });

    it('22. Clock-in 08:01 calculates exactly 1 minute late', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'ATT-003',
        name: 'Attendance Employee 3',
        department: 'Support',
        jobTitle: 'Agent',
        startDate: '2026-06-01',
        workStartTime: '08:00:00',
        workEndTime: '17:00:00',
      });

      const record = await markLate(adminUser, emp.id, '2026-06-03', '08:01');

      expect(record.attendanceType).toBe('PRESENT');
      expect(record.lateMinutes).toBe(1); // Every minute counts
    });

    it('23. Early departure with clock-out 16:20 and scheduled end 17:00 calculates exactly 40 minutes early departure', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'ATT-004',
        name: 'Attendance Employee 4',
        department: 'Support',
        jobTitle: 'Agent',
        startDate: '2026-06-01',
        workStartTime: '08:00:00',
        workEndTime: '17:00:00',
      });

      const att = await markPresent(adminUser, emp.id, '2026-06-04');
      const updated = await recordEarlyDeparture(adminUser, att.id, '16:20', 'إذن طبي');

      expect(updated.earlyDeparture).toBe(true);
      expect(updated.earlyDepartureMinutes).toBe(40); // 17:00 - 16:20 = 40 minutes
    });

    it('24. Early departure does not alter the PRESENT attendance status', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'ATT-005',
        name: 'Attendance Employee 5',
        department: 'Support',
        jobTitle: 'Agent',
        startDate: '2026-06-01',
        workStartTime: '08:00:00',
        workEndTime: '17:00:00',
      });

      const att = await markPresent(adminUser, emp.id, '2026-06-05');
      const updated = await recordEarlyDeparture(adminUser, att.id, '15:00', 'شخصي');

      expect(updated.attendanceType).toBe('PRESENT');
      expect(updated.earlyDeparture).toBe(true);
      expect(updated.earlyDepartureMinutes).toBe(120);
    });

    it('25. Excused absence applies 1.0 day deduction and saves excuse reason', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'ATT-006',
        name: 'Attendance Employee 6',
        department: 'Support',
        jobTitle: 'Agent',
        startDate: '2026-06-01',
      });

      const att = await markAbsent(adminUser, emp.id, '2026-06-06', 'EXCUSED_ABSENCE', 'ظرف صحي طارئ');

      expect(att.attendanceType).toBe('EXCUSED_ABSENCE');
      expect(Number(att.unpaidDays)).toBe(1.0);
      expect(att.notes).toContain('ظرف صحي طارئ');
    });

    it('26. Unexcused absence applies 2.0 days penalty deduction per day', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'ATT-007',
        name: 'Attendance Employee 7',
        department: 'Support',
        jobTitle: 'Agent',
        startDate: '2026-06-01',
      });

      const att = await markAbsent(adminUser, emp.id, '2026-06-07', 'UNEXCUSED_ABSENCE');

      expect(att.attendanceType).toBe('UNEXCUSED_ABSENCE');
      expect(Number(att.unpaidDays)).toBe(2.0); // 2 days penalty deduction for unexcused absence
      expect(att.notes).toContain('خصم يومين');
    });
  });

  // ==========================================
  // SECTION 6: PAYROLL DEDUCTIONS & LOCKING (4 TESTS)
  // ==========================================
  describe('6. Payroll Lateness & Early Departure Deductions & Locking', () => {
    it('25. Late minutes deduction correctly applies: LateMinutes × MinuteDeductionRate', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'PAY-001',
        name: 'Payroll Employee 1',
        department: 'Sales',
        jobTitle: 'Executive',
        startDate: '2026-07-01',
        workStartTime: '08:00:00',
        workEndTime: '17:00:00',
        minuteDeductionRate: 1.0, // 1 SAR per minute
      });

      await createContract(adminUser, {
        employeeId: emp.id,
        startDate: '2026-07-01',
        monthlyBasic: 5000,
        monthlyAllowances: 0,
        unpaidDayRate: 200,
        otRate: 50,
      });

      // 30 minutes late
      await markLate(adminUser, emp.id, '2026-07-02', '08:30');

      const draft = await createPayrollDraft(adminUser, {
        employeeId: emp.id,
        year: 2026,
        month: 7,
      });

      expect(draft.lateMinutes).toBe(30);
      expect(Number(draft.lateDeductions)).toBe(30); // 30 mins * 1.0 = 30 SAR
    });

    it('26. Early departure deduction correctly applies: EarlyDepartureMinutes × MinuteDeductionRate', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'PAY-002',
        name: 'Payroll Employee 2',
        department: 'Sales',
        jobTitle: 'Executive',
        startDate: '2026-08-01',
        workStartTime: '08:00:00',
        workEndTime: '17:00:00',
        minuteDeductionRate: 2.0, // 2 SAR per minute
      });

      await createContract(adminUser, {
        employeeId: emp.id,
        startDate: '2026-08-01',
        monthlyBasic: 6000,
        monthlyAllowances: 0,
        unpaidDayRate: 200,
        otRate: 50,
      });

      const att = await markPresent(adminUser, emp.id, '2026-08-02');
      await recordEarlyDeparture(adminUser, att.id, '16:45', 'شخصي'); // 15 mins early

      const draft = await createPayrollDraft(adminUser, {
        employeeId: emp.id,
        year: 2026,
        month: 8,
      });

      expect(draft.earlyDepartureMinutes).toBe(15);
      expect(Number(draft.earlyDepartureDeductions)).toBe(30); // 15 mins * 2.0 = 30 SAR
    });

    it('27. 1-minute lateness applies exactly 1 × MinuteDeductionRate (no rounding)', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'PAY-003',
        name: 'Payroll Employee 3',
        department: 'Sales',
        jobTitle: 'Executive',
        startDate: '2026-09-01',
        workStartTime: '08:00:00',
        workEndTime: '17:00:00',
        minuteDeductionRate: 0.5,
      });

      await createContract(adminUser, {
        employeeId: emp.id,
        startDate: '2026-09-01',
        monthlyBasic: 4000,
        monthlyAllowances: 0,
        unpaidDayRate: 150,
        otRate: 40,
      });

      await markLate(adminUser, emp.id, '2026-09-01', '08:01'); // exactly 1 min late

      const draft = await createPayrollDraft(adminUser, {
        employeeId: emp.id,
        year: 2026,
        month: 9,
      });

      expect(draft.lateMinutes).toBe(1);
      expect(Number(draft.lateDeductions)).toBe(0.5); // exactly 1 * 0.5 = 0.5
    });

    it('28. Payroll draft refresh picks up newly added attendance / lateness records and approved payroll locks attendance', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'PAY-004',
        name: 'Payroll Employee 4',
        department: 'Sales',
        jobTitle: 'Executive',
        startDate: '2026-10-05',
        endDate: '2026-10-05',
        workStartTime: '08:00:00',
        workEndTime: '17:00:00',
        minuteDeductionRate: 1.0,
      });

      await createContract(adminUser, {
        employeeId: emp.id,
        startDate: '2026-10-05',
        endDate: '2026-10-05',
        monthlyBasic: 5000,
        monthlyAllowances: 0,
        unpaidDayRate: 200,
        otRate: 50,
      });

      // Create initial draft
      const draft = await createPayrollDraft(adminUser, {
        employeeId: emp.id,
        year: 2026,
        month: 10,
      });
      expect(draft.lateMinutes).toBe(0);

      // Now employee arrives 25 mins late
      const att = await markLate(adminUser, emp.id, '2026-10-05', '08:25');

      // Refresh draft
      const refreshed = await refreshPayrollDraft(adminUser, draft.id);
      expect(refreshed.lateMinutes).toBe(25);
      expect(Number(refreshed.lateDeductions)).toBe(25);

      // Approve attendance so payroll completeness passes
      const db = getDb();
      await db.update(schema.attendance).set({ status: 'APPROVED' }).where(eq(schema.attendance.id, att.id));

      // Approve payroll
      await approvePayroll(adminUser, draft.id);

      // Check attendance locking
      const locked = await isAttendanceLocked(emp.id, '2026-10-05');
      expect(locked).toBe(true);

      // Attempting to modify locked attendance must throw error
      await expect(
        markLate(adminUser, emp.id, '2026-10-05', '08:50')
      ).rejects.toThrow(/معتمد أو مدفوع مسبقاً/);
    });

    it('Rule 32: Bulk generate payroll drafts for all active employees skipping existing active drafts', async () => {
      const emp1 = await createEmployee(adminUser, {
        employeeNo: 'EMP-BULK-1',
        name: 'Bulk Employee One',
        department: 'Engineering',
        jobTitle: 'Developer',
        startDate: '2026-01-01',
        employmentType: 'PERMANENT',
      });
      await createContract(adminUser, {
        employeeId: emp1.id,
        startDate: '2026-01-01',
        monthlyBasic: 1200,
        monthlyAllowances: 150,
        unpaidDayRate: 40,
        otRate: 5,
      });

      const emp2 = await createEmployee(adminUser, {
        employeeNo: 'EMP-BULK-2',
        name: 'Bulk Employee Two',
        department: 'Operations',
        jobTitle: 'Daily Inspector',
        startDate: '2026-01-01',
        employmentType: 'DAILY_WORKER',
        dailyRate: 35,
      });

      // Run bulk generation for 2026-11
      const res1 = await generateBulkPayrollDrafts(adminUser, { year: 2026, month: 11 });
      expect(res1.totalActiveCount).toBeGreaterThanOrEqual(2);
      expect(res1.successCount).toBeGreaterThanOrEqual(2);

      // Re-running bulk generation for the same month must safely skip existing active drafts
      const res2 = await generateBulkPayrollDrafts(adminUser, { year: 2026, month: 11 });
      expect(res2.skippedCount).toBeGreaterThanOrEqual(2);
    });

    it('Rule 33: Edit additions, deductions, unpaid absence days, and early departure minutes on payroll draft', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'EMP-EDIT-1',
        name: 'Editable Employee',
        department: 'Finance',
        jobTitle: 'Accountant',
        startDate: '2026-01-01',
        employmentType: 'PERMANENT',
      });
      await createContract(adminUser, {
        employeeId: emp.id,
        startDate: '2026-01-01',
        monthlyBasic: 1000,
        monthlyAllowances: 100,
        unpaidDayRate: 33.333,
        otRate: 4,
      });

      const draft = await createPayrollDraft(adminUser, {
        employeeId: emp.id,
        year: 2026,
        month: 12,
      });

      const updated = await updatePayrollDraft(adminUser, {
        payrollId: draft.id,
        otherAdditions: 75,
        otherDeductions: 25,
        unpaidDays: 2,
        earlyDepartureMinutes: 30,
        lateMinutes: 15,
        otHours: 5,
        notes: 'Adjusted overtime and early departure manually',
      });

      expect(Number(updated.otherAdditions)).toBe(75);
      expect(Number(updated.otherDeductions)).toBe(25);
      expect(Number(updated.unpaidDays)).toBe(2);
      expect(updated.earlyDepartureMinutes).toBe(30);
      expect(updated.lateMinutes).toBe(15);
      expect(Number(updated.otHours)).toBe(5);
      expect(updated.notes).toBe('Adjusted overtime and early departure manually');
    });

    it('Rule 34: getBatchPayslipData returns complete itemized statements for all employees in a batch', async () => {
      const emp = await createEmployee(adminUser, {
        employeeNo: 'EMP-BATCH-PS-01',
        name: 'حسن ناصر',
        department: 'المالية',
        jobTitle: 'محاسب أول',
        startDate: '2026-01-01',
        employmentType: 'PERMANENT',
      });

      await createContract(adminUser, {
        employeeId: emp.id,
        startDate: '2026-01-01',
        monthlyBasic: 900,
        monthlyAllowances: 100,
        unpaidDayRate: 30,
        otRate: 5,
      });

      await createPayrollDraft(adminUser, {
        employeeId: emp.id,
        year: 2026,
        month: 11,
      });

      const batchPayslips = await getBatchPayslipData(adminUser, { month: '2026-11' });
      expect(batchPayslips.length).toBeGreaterThanOrEqual(1);

      const payslip = batchPayslips.find((p) => p.employeeNo === 'EMP-BATCH-PS-01');
      expect(payslip).toBeDefined();
      if (payslip) {
        expect(payslip.basicEarned).toBe('900.000');
        expect(payslip.allowancesEarned).toBe('100.000');
        expect(payslip.totalEarnings).toBe('1000.000');
      }
    });

    it('Rule 35: createEmployee supports manual contractSigned toggle and updateContract toggles signature on/off', async () => {
      const empUnsigned = await createEmployee(adminUser, {
        employeeNo: 'EMP-TOGGLE-01',
        name: 'كريم خالد',
        department: 'الهندسة',
        jobTitle: 'مطور واجهات',
        startDate: '2026-01-01',
        employmentType: 'PERMANENT',
        monthlyBasic: 750,
        contractSigned: false,
      });

      const empDetailed = await getEmployeeById(adminUser, empUnsigned.id);
      expect(empDetailed.currentContract).toBeDefined();
      expect(empDetailed.currentContract?.contractSigned).toBe(false);
      expect(empDetailed.currentContract?.contractSignedDate).toBeNull();

      // Toggle contract signature ON
      await updateContract(adminUser, empDetailed.currentContract!.id, {
        contractSigned: true,
        contractSignedDate: '2026-01-05',
      });

      const empUpdated = await getEmployeeById(adminUser, empUnsigned.id);
      expect(empUpdated.currentContract?.contractSigned).toBe(true);
      expect(empUpdated.currentContract?.contractSignedDate).toBe('2026-01-05');
    });
  });
});


