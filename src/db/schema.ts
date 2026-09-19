import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  time,
  numeric,
  integer,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// 1. Users / Profiles
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().$type<'ADMIN' | 'HR' | 'ACCOUNTANT' | 'SUPERVISOR'>(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 2. Settings
export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyName: varchar('company_name', { length: 255 }).notNull().default('شركة التقنية والحلول المتقدمة'),
  country: varchar('country', { length: 100 }).notNull().default('المملكة الأردنية الهاشمية'),
  currency: varchar('currency', { length: 10 }).notNull().default('JOD'),
  timezone: varchar('timezone', { length: 50 }).notNull().default('Asia/Amman'),
  payrollPolicy: text('payroll_policy').notNull().default('سياسة الرواتب والأجور المعتمدة للشركة'),
  payrollPolicyConfirmed: boolean('payroll_policy_confirmed').notNull().default(false),
  defaultWorkStartTime: time('default_work_start_time').notNull().default('08:00:00'),
  defaultWorkEndTime: time('default_work_end_time').notNull().default('16:30:00'),
  defaultBreakMinutes: integer('default_break_minutes').notNull().default(60),
  defaultMinuteDeductionRate: numeric('default_minute_deduction_rate', { precision: 12, scale: 3 }).notNull().default('0.000'),
  defaultOtRate: numeric('default_ot_rate', { precision: 12, scale: 3 }).notNull().default('2.500'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
});

// 3. Employees
export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeNo: varchar('employee_no', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  department: varchar('department', { length: 100 }).notNull(),
  jobTitle: varchar('job_title', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE').$type<'ACTIVE' | 'TERMINATED'>(),
  socialSecurityRegistered: boolean('social_security_registered').notNull().default(false),
  socialSecurityRegistrationDate: date('social_security_registration_date'),
  employmentType: varchar('employment_type', { length: 30 }).notNull().default('PERMANENT').$type<'PERMANENT' | 'PROBATIONARY' | 'DAILY_WORKER'>(),
  probationEndDate: date('probation_end_date'),
  probationStatus: varchar('probation_status', { length: 30 }).default('NOT_APPLICABLE').$type<'IN_PROBATION' | 'PROBATION_ENDED' | 'PASSED' | 'FAILED' | 'NOT_APPLICABLE'>(),
  dailyRate: numeric('daily_rate', { precision: 12, scale: 3 }),
  temporaryStartDate: date('temporary_start_date'),
  temporaryEndDate: date('temporary_end_date'),
  minuteDeductionRate: numeric('minute_deduction_rate', { precision: 12, scale: 3 }),
  workStartTime: time('work_start_time'),
  workEndTime: time('work_end_time'),
  breakMinutes: integer('break_minutes'),
  identityImageFront: varchar('identity_image_front', { length: 500 }),
  identityImageBack: varchar('identity_image_back', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
});

// 4. Contracts
export const contracts = pgTable('contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  monthlyBasic: numeric('monthly_basic', { precision: 12, scale: 3 }).notNull(),
  monthlyAllowances: numeric('monthly_allowances', { precision: 12, scale: 3 }).notNull().default('0'),
  unpaidDayRate: numeric('unpaid_day_rate', { precision: 12, scale: 3 }).notNull(),
  otRate: numeric('ot_rate', { precision: 12, scale: 3 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('JOD'),
  contractSigned: boolean('contract_signed').notNull().default(false),
  contractSignedDate: date('contract_signed_date'),
  fileUrl: varchar('file_url', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
});

// 5. Leave Balances
export const leaveBalances = pgTable('leave_balances', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  year: integer('year').notNull(),
  leaveType: varchar('leave_type', { length: 20 }).notNull().$type<'ANNUAL' | 'SICK' | 'OTHER'>(),
  openingDays: numeric('opening_days', { precision: 5, scale: 2 }).notNull().default('0'),
  grantedDays: numeric('granted_days', { precision: 5, scale: 2 }).notNull().default('0'),
  adjustmentDays: numeric('adjustment_days', { precision: 5, scale: 2 }).notNull().default('0'),
  notes: text('notes'),
});

// 6. Leave Requests
export const leaveRequests = pgTable('leave_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  balanceId: uuid('balance_id').references(() => leaveBalances.id),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  chargeDays: numeric('charge_days', { precision: 5, scale: 2 }).notNull(),
  paid: boolean('paid').notNull().default(true),
  status: varchar('status', { length: 20 }).notNull().default('PENDING').$type<'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'>(),
  reason: text('reason'),
  attachment: varchar('attachment', { length: 500 }),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  updatedBy: uuid('updated_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 7. Attendance
export const attendance = pgTable('attendance', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  workDate: date('work_date').notNull(),
  scheduledIn: time('scheduled_in'),
  clockIn: timestamp('clock_in', { withTimezone: true }),
  clockOut: timestamp('clock_out', { withTimezone: true }),
  breakMinutes: integer('break_minutes').notNull().default(0),
  workedMinutes: integer('worked_minutes').notNull().default(0),
  lateMinutes: integer('late_minutes').notNull().default(0),
  earlyDeparture: boolean('early_departure').notNull().default(false),
  earlyDepartureMinutes: integer('early_departure_minutes').notNull().default(0),
  departureReason: text('departure_reason'),
  departureRecordedBy: uuid('departure_recorded_by').references(() => users.id),
  departureRecordedAt: timestamp('departure_recorded_at', { withTimezone: true }),
  attendanceType: varchar('attendance_type', { length: 30 }).notNull().$type<'PRESENT' | 'ABSENT' | 'EXCUSED_ABSENCE' | 'UNEXCUSED_ABSENCE' | 'PAID_LEAVE' | 'UNPAID_LEAVE' | 'HOLIDAY'>(),
  unpaidDays: numeric('unpaid_days', { precision: 5, scale: 2 }).notNull().default('0'),
  approvedOtHours: numeric('approved_ot_hours', { precision: 5, scale: 2 }).notNull().default('0'),
  status: varchar('status', { length: 20 }).notNull().default('DRAFT').$type<'DRAFT' | 'APPROVED'>(),
  leaveId: uuid('leave_id').references(() => leaveRequests.id),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 8. Loans
export const loans = pgTable('loans', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  date: date('date').notNull(),
  amount: numeric('amount', { precision: 12, scale: 3 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('JOD'),
  status: varchar('status', { length: 20 }).notNull().default('PROPOSED').$type<'PROPOSED' | 'DISBURSED' | 'CANCELLED'>(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
});

// 9. Payroll
export const payroll = pgTable('payroll', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  contractId: uuid('contract_id').references(() => contracts.id),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('JOD'),
  basicEarned: numeric('basic_earned', { precision: 12, scale: 3 }).notNull().default('0.000'),
  allowancesEarned: numeric('allowances_earned', { precision: 12, scale: 3 }).notNull().default('0.000'),
  otHours: numeric('ot_hours', { precision: 6, scale: 2 }).notNull().default('0.00'),
  otRate: numeric('ot_rate', { precision: 12, scale: 3 }).notNull().default('0.000'),
  unpaidDays: numeric('unpaid_days', { precision: 5, scale: 2 }).notNull().default('0.00'),
  unpaidDayRate: numeric('unpaid_day_rate', { precision: 12, scale: 3 }).notNull().default('0.000'),
  workedDays: integer('worked_days').notNull().default(0),
  workedMinutes: integer('worked_minutes').notNull().default(0),
  lateMinutes: integer('late_minutes').notNull().default(0),
  lateDeduction: numeric('late_deduction', { precision: 12, scale: 3 }).notNull().default('0.000'),
  earlyDepartureMinutes: integer('early_departure_minutes').notNull().default(0),
  earlyDepartureDeduction: numeric('early_departure_deduction', { precision: 12, scale: 3 }).notNull().default('0.000'),
  dailyRate: numeric('daily_rate', { precision: 12, scale: 3 }).notNull().default('0.000'),
  otherAdditions: numeric('other_additions', { precision: 12, scale: 3 }).notNull().default('0.000'),
  gratuities: numeric('gratuities', { precision: 12, scale: 3 }).notNull().default('0.000'),
  otherDeductions: numeric('other_deductions', { precision: 12, scale: 3 }).notNull().default('0.000'),
  loanDeduction: numeric('loan_deduction', { precision: 12, scale: 3 }).notNull().default('0.000'),
  netPay: numeric('net_pay', { precision: 12, scale: 3 }),
  status: varchar('status', { length: 20 }).notNull().default('DRAFT').$type<'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED'>(),
  paymentMethod: varchar('payment_method', { length: 50 }),
  paymentReference: varchar('payment_reference', { length: 100 }),
  preparedBy: uuid('prepared_by').references(() => users.id),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  notes: text('notes'),
  updatedBy: uuid('updated_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 10. Repayments
export const repayments = pgTable('repayments', {
  id: uuid('id').primaryKey().defaultRandom(),
  loanId: uuid('loan_id').notNull().references(() => loans.id),
  date: date('date').notNull(),
  amount: numeric('amount', { precision: 12, scale: 3 }).notNull(),
  method: varchar('method', { length: 20 }).notNull().$type<'PAYROLL' | 'CASH'>(),
  payrollId: uuid('payroll_id').references(() => payroll.id),
  status: varchar('status', { length: 20 }).notNull().default('SCHEDULED').$type<'SCHEDULED' | 'PAID' | 'CANCELLED'>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
});

// 11. Documents
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  type: varchar('type', { length: 30 }).notNull().$type<'IDENTITY' | 'RESIDENCY' | 'WORK_PERMIT' | 'CERTIFICATE' | 'OTHER'>(),
  expiryDate: date('expiry_date'),
  filePath: varchar('file_path', { length: 500 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
});

// 12. Audit Log
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventAt: timestamp('event_at', { withTimezone: true }).notNull().defaultNow(),
  actorId: uuid('actor_id').notNull(),
  actorName: varchar('actor_name', { length: 255 }).notNull(),
  actorRole: varchar('actor_role', { length: 50 }).notNull(),
  tableName: varchar('table_name', { length: 100 }).notNull(),
  recordId: varchar('record_id', { length: 100 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  oldStatus: varchar('old_status', { length: 50 }),
  newStatus: varchar('new_status', { length: 50 }),
  metadata: jsonb('metadata'),
});

// 13. Daily Rate History
export const dailyRateHistory = pgTable('daily_rate_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  dailyRate: numeric('daily_rate', { precision: 12, scale: 3 }).notNull(),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
});

// Relations
export const employeesRelations = relations(employees, ({ many }) => ({
  contracts: many(contracts),
  attendances: many(attendance),
  leaveRequests: many(leaveRequests),
  leaveBalances: many(leaveBalances),
  loans: many(loans),
  payrolls: many(payroll),
  documents: many(documents),
}));

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  employee: one(employees, {
    fields: [contracts.employeeId],
    references: [employees.id],
  }),
  payrolls: many(payroll),
}));

export const loansRelations = relations(loans, ({ one, many }) => ({
  employee: one(employees, {
    fields: [loans.employeeId],
    references: [employees.id],
  }),
  repayments: many(repayments),
}));

export const repaymentsRelations = relations(repayments, ({ one }) => ({
  loan: one(loans, {
    fields: [repayments.loanId],
    references: [loans.id],
  }),
  payroll: one(payroll, {
    fields: [repayments.payrollId],
    references: [payroll.id],
  }),
}));

export const payrollRelations = relations(payroll, ({ one, many }) => ({
  employee: one(employees, {
    fields: [payroll.employeeId],
    references: [employees.id],
  }),
  contract: one(contracts, {
    fields: [payroll.contractId],
    references: [contracts.id],
  }),
  repayments: many(repayments),
}));
