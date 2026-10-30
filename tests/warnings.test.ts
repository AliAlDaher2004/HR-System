import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../src/db/migrate';
import { getDb, schema } from '../src/db';
import { createEmployee } from '../src/lib/services/employee-service';
import {
  createWarning,
  getWarnings,
  getEmployeeWarnings,
  getWarningById,
  revokeWarning,
  deleteWarning,
} from '../src/lib/services/warning-service';
import { UserSession, AuthorizationError } from '../src/lib/auth/rbac';
import { eq } from 'drizzle-orm';

describe('Disciplinary Warnings Module Test Suite', () => {
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
    fullName: 'HR Officer',
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

  let testEmployeeId: string;

  beforeAll(async () => {
    const { getPglite } = await import('../src/db');
    const pglite = getPglite();
    await runMigrations(pglite);

    const db = getDb();
    // Insert test users if not existing
    for (const u of [adminUser, hrUser, accountantUser, supervisorUser]) {
      const [existing] = await db.select().from(schema.users).where(eq(schema.users.id, u.id));
      if (!existing) {
        await db.insert(schema.users).values(u);
      }
    }

    const emp = await createEmployee(adminUser, {
      name: 'سامر أحمد محمود',
      department: 'المستودعات',
      jobTitle: 'أمين مستودع',
      startDate: '2026-01-01',
      employmentType: 'PERMANENT',
      monthlyBasic: 450,
    });
    testEmployeeId = emp.id;
  });

  it('1. HR or Admin can issue a warning with level, detailed reason, administrative action, and signature status', async () => {
    const warning = await createWarning(hrUser, {
      employeeId: testEmployeeId,
      warningLevel: 'FIRST',
      warningDate: '2026-03-15',
      title: 'تأخر متكرر عن موعد بدء العمل',
      reason: 'تأخر الموظف عن الحضور في الموعد المحدد لمدة 4 أيام متتالية دون إذن مسبق.',
      administrativeAction: 'توجيه إنذار خطي أول يودع في الملف الوظيفي مع حسم يوم عمل في حال التكرار.',
      signedByEmployee: true,
      notes: 'تم استدعاء الموظف وشرح اللائحة الداخلية له.',
    });

    expect(warning.id).toBeDefined();
    expect(warning.employeeId).toBe(testEmployeeId);
    expect(warning.warningLevel).toBe('FIRST');
    expect(warning.warningDate).toBe('2026-03-15');
    expect(warning.title).toBe('تأخر متكرر عن موعد بدء العمل');
    expect(warning.signedByEmployee).toBe(true);
    expect(warning.status).toBe('ACTIVE');
    expect(warning.employee.name).toBe('سامر أحمد محمود');
  });

  it('2. Warning is automatically linked to the employee and appears in both employee profile and general register', async () => {
    const empWarnings = await getEmployeeWarnings(adminUser, testEmployeeId);
    expect(empWarnings.length).toBeGreaterThanOrEqual(1);
    expect(empWarnings[0].employeeId).toBe(testEmployeeId);

    const allWarnings = await getWarnings(adminUser);
    expect(allWarnings.some((w) => w.employeeId === testEmployeeId)).toBe(true);
  });

  it('3. Can issue higher level warnings such as SECOND, FINAL, and TERMINATION', async () => {
    const secondWarning = await createWarning(adminUser, {
      employeeId: testEmployeeId,
      warningLevel: 'SECOND',
      warningDate: '2026-03-20',
      title: 'إهمال في تطبيق ضوابط السلامة',
      reason: 'عدم ارتداء معدات الوقاية الشخصية في المستودع الرئيسي رغم التنبيه السابق.',
      administrativeAction: 'حسم يومين من الراتب.',
      signedByEmployee: false,
    });

    expect(secondWarning.warningLevel).toBe('SECOND');
    expect(secondWarning.signedByEmployee).toBe(false);

    const empWarnings = await getEmployeeWarnings(hrUser, testEmployeeId);
    expect(empWarnings.length).toBe(2);
  });

  it('4. Supervisor or Accountant cannot issue warnings (strict RBAC enforcement)', async () => {
    await expect(
      createWarning(supervisorUser, {
        employeeId: testEmployeeId,
        warningLevel: 'VERBAL',
        warningDate: '2026-03-21',
        title: 'تنبيه شفوي',
        reason: 'سبب المخالفة',
      })
    ).rejects.toThrow(AuthorizationError);

    await expect(
      createWarning(accountantUser, {
        employeeId: testEmployeeId,
        warningLevel: 'VERBAL',
        warningDate: '2026-03-21',
        title: 'تنبيه شفوي',
        reason: 'سبب المخالفة',
      })
    ).rejects.toThrow(AuthorizationError);
  });

  it('5. HR or Admin can revoke a warning, updating its status to REVOKED', async () => {
    const warning = await createWarning(adminUser, {
      employeeId: testEmployeeId,
      warningLevel: 'VERBAL',
      warningDate: '2026-03-22',
      title: 'تنبيه تم التراجع عنه',
      reason: 'تبين لاحقاً أن الموظف كان في مهمة عمل رسمية.',
    });

    await revokeWarning(hrUser, warning.id, 'تم تقديم إثبات مهمة العمل الرسمية');

    const updated = await getWarningById(adminUser, warning.id);
    expect(updated?.status).toBe('REVOKED');
    expect(updated?.notes).toContain('تم إلغاء الإنذار: تم تقديم إثبات مهمة العمل الرسمية');
  });

  it('6. Only Admin can delete a warning record completely', async () => {
    const warning = await createWarning(adminUser, {
      employeeId: testEmployeeId,
      warningLevel: 'VERBAL',
      warningDate: '2026-03-23',
      title: 'إنذار للحذف',
      reason: 'سجل تجريبي',
    });

    // HR cannot delete
    await expect(deleteWarning(hrUser, warning.id)).rejects.toThrow(AuthorizationError);

    // Admin can delete
    await deleteWarning(adminUser, warning.id);
    const fetched = await getWarningById(adminUser, warning.id);
    expect(fetched).toBeNull();
  });

  it('7. Warning image / signed letter upload succeeds and stores attachment path', async () => {
    const dummyImageBuffer = Buffer.from('mock-signed-warning-document-content');
    const warning = await createWarning(adminUser, {
      employeeId: testEmployeeId,
      warningLevel: 'FINAL',
      warningDate: '2026-03-24',
      title: 'إنذار نهائي مع كتاب موقع',
      reason: 'تكرار مخالفة مغادرة العمل قبل انتهاء الدوام.',
      administrativeAction: 'توجيه إنذار نهائي، وفي حال التكرار سيتم فصل الموظف فوراً وفق المادة 28.',
      signedByEmployee: true,
      fileBuffer: dummyImageBuffer,
      mimeType: 'image/jpeg',
      originalFilename: 'signed_final_warning.jpg',
    });

    expect(warning.attachmentPath).toBeDefined();
    expect(warning.attachmentPath).toContain('employee-documents');
    expect(warning.attachmentPath).toContain('.jpg');
  });
});
