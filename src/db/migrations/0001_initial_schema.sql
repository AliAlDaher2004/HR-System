-- ==============================================================================
-- HR & PAYROLL MANAGEMENT SYSTEM - INITIAL SCHEMA MIGRATION
-- Production-Ready PostgreSQL & Supabase Database Definition
-- ==============================================================================

-- Ensure Supabase auth schema, mock auth.uid() function, and Supabase roles exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
        EXECUTE 'CREATE SCHEMA auth';
        EXECUTE 'CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $f$ SELECT NULLIF(current_setting(''request.jwt.claim.sub'', true), '''')::uuid; $f$ LANGUAGE sql STABLE';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
    END IF;
END
$$;

-- ==============================================================================
-- 1. USERS / PROFILES (Links with Supabase Auth or Application Users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'HR', 'ACCOUNTANT', 'SUPERVISOR')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- ==============================================================================
-- 2. COMPANY SETTINGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL DEFAULT 'شركة التقنية والحلول المتقدمة',
    country VARCHAR(100) NOT NULL DEFAULT 'المملكة الأردنية الهاشمية',
    currency VARCHAR(10) NOT NULL DEFAULT 'JOD',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Amman',
    payroll_policy TEXT NOT NULL DEFAULT 'سياسة الرواتب والأجور المعتمدة للشركة',
    payroll_policy_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    default_work_start_time TIME NOT NULL DEFAULT '08:00:00',
    default_work_end_time TIME NOT NULL DEFAULT '17:00:00',
    default_break_minutes INT NOT NULL DEFAULT 60 CHECK (default_break_minutes >= 0),
    default_minute_deduction_rate NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (default_minute_deduction_rate >= 0),
    default_ot_rate NUMERIC(12, 3) NOT NULL DEFAULT 2.500 CHECK (default_ot_rate >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS default_work_start_time TIME NOT NULL DEFAULT '08:00:00';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS default_work_end_time TIME NOT NULL DEFAULT '17:00:00';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS default_break_minutes INT NOT NULL DEFAULT 60;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS default_minute_deduction_rate NUMERIC(12, 3) NOT NULL DEFAULT 0;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS default_ot_rate NUMERIC(12, 3) NOT NULL DEFAULT 2.500;

-- ==============================================================================
-- 3. EMPLOYEES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_no VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    job_title VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'TERMINATED')),
    social_security_registered BOOLEAN NOT NULL DEFAULT FALSE,
    social_security_registration_date DATE,
    employment_type VARCHAR(30) NOT NULL DEFAULT 'PERMANENT' CHECK (employment_type IN ('PERMANENT', 'PROBATIONARY', 'DAILY_WORKER')),
    probation_end_date DATE,
    probation_status VARCHAR(30) DEFAULT 'NOT_APPLICABLE',
    daily_rate NUMERIC(12, 3) CHECK (daily_rate IS NULL OR daily_rate >= 0),
    temporary_start_date DATE,
    temporary_end_date DATE,
    minute_deduction_rate NUMERIC(12, 3) CHECK (minute_deduction_rate IS NULL OR minute_deduction_rate >= 0),
    work_start_time TIME,
    work_end_time TIME,
    break_minutes INT CHECK (break_minutes IS NULL OR break_minutes >= 0),
    identity_image_front VARCHAR(500),
    identity_image_back VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES public.users(id),
    CONSTRAINT chk_employee_dates CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT chk_employee_ss_rules CHECK (
        (social_security_registered = FALSE AND social_security_registration_date IS NULL) OR
        (social_security_registered = TRUE AND social_security_registration_date IS NOT NULL)
    ),
    CONSTRAINT chk_daily_worker_rules CHECK (
        employment_type IN ('PERMANENT', 'PROBATIONARY') OR (employment_type = 'DAILY_WORKER' AND daily_rate IS NOT NULL AND daily_rate >= 0)
    )
);

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS social_security_registered BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS social_security_registration_date DATE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employment_type VARCHAR(30) NOT NULL DEFAULT 'PERMANENT';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS probation_end_date DATE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS probation_status VARCHAR(30) DEFAULT 'NOT_APPLICABLE';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS daily_rate NUMERIC(12, 3);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS temporary_start_date DATE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS temporary_end_date DATE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS minute_deduction_rate NUMERIC(12, 3);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS work_start_time TIME;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS work_end_time TIME;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS break_minutes INT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS identity_image_front VARCHAR(500);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS identity_image_back VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_employees_no ON public.employees(employee_no);
CREATE INDEX IF NOT EXISTS idx_employees_department ON public.employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_type ON public.employees(employment_type);

-- ==============================================================================
-- 4. CONTRACTS (Effective-Dated Compensation Contracts)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE,
    monthly_basic NUMERIC(12, 3) NOT NULL CHECK (monthly_basic >= 0),
    monthly_allowances NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (monthly_allowances >= 0),
    unpaid_day_rate NUMERIC(12, 3) NOT NULL CHECK (unpaid_day_rate >= 0),
    ot_rate NUMERIC(12, 3) NOT NULL CHECK (ot_rate >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'JOD',
    contract_signed BOOLEAN NOT NULL DEFAULT FALSE,
    contract_signed_date DATE,
    file_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),
    CONSTRAINT chk_contract_dates CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT chk_contract_signature_rules CHECK (
        (contract_signed = FALSE AND contract_signed_date IS NULL) OR
        (contract_signed = TRUE AND contract_signed_date IS NOT NULL)
    )
);

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS contract_signed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS contract_signed_date DATE;

CREATE INDEX IF NOT EXISTS idx_contracts_employee ON public.contracts(employee_id);
CREATE INDEX IF NOT EXISTS idx_contracts_dates ON public.contracts(start_date, end_date);

-- ==============================================================================
-- 5. LEAVE BALANCES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    year INT NOT NULL,
    leave_type VARCHAR(20) NOT NULL CHECK (leave_type IN ('ANNUAL', 'SICK', 'OTHER')),
    opening_days NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (opening_days >= 0),
    granted_days NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (granted_days >= 0),
    adjustment_days NUMERIC(5, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    CONSTRAINT uq_leave_balance_employee_year_type UNIQUE (employee_id, year, leave_type)
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_emp ON public.leave_balances(employee_id);

-- ==============================================================================
-- 6. LEAVE REQUESTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    balance_id UUID REFERENCES public.leave_balances(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    charge_days NUMERIC(5, 2) NOT NULL CHECK (charge_days > 0),
    paid BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    reason TEXT,
    attachment VARCHAR(500),
    approved_by UUID REFERENCES public.users(id),
    approved_at TIMESTAMPTZ,
    updated_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_leave_request_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_emp ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests(start_date, end_date);

-- ==============================================================================
-- 7. ATTENDANCE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    work_date DATE NOT NULL,
    scheduled_in TIME,
    clock_in TIMESTAMPTZ,
    clock_out TIMESTAMPTZ,
    break_minutes INT NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
    worked_minutes INT NOT NULL DEFAULT 0 CHECK (worked_minutes >= 0),
    late_minutes INT NOT NULL DEFAULT 0 CHECK (late_minutes >= 0),
    early_departure BOOLEAN NOT NULL DEFAULT FALSE,
    early_departure_minutes INT NOT NULL DEFAULT 0 CHECK (early_departure_minutes >= 0),
    departure_reason TEXT,
    departure_recorded_by UUID REFERENCES public.users(id),
    departure_recorded_at TIMESTAMPTZ,
    attendance_type VARCHAR(30) NOT NULL CHECK (attendance_type IN ('PRESENT', 'ABSENT', 'EXCUSED_ABSENCE', 'UNEXCUSED_ABSENCE', 'PAID_LEAVE', 'UNPAID_LEAVE', 'HOLIDAY')),
    unpaid_days NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (unpaid_days >= 0 AND unpaid_days <= 10),
    approved_ot_hours NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (approved_ot_hours >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED')),
    leave_id UUID REFERENCES public.leave_requests(id) ON DELETE RESTRICT,
    notes TEXT,
    created_by UUID REFERENCES public.users(id),
    updated_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_attendance_employee_date UNIQUE (employee_id, work_date)
);

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS worked_minutes INT NOT NULL DEFAULT 0;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS late_minutes INT NOT NULL DEFAULT 0;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS early_departure BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS early_departure_minutes INT NOT NULL DEFAULT 0;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS departure_reason TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS departure_recorded_by UUID REFERENCES public.users(id);
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS departure_recorded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_attendance_employee ON public.attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_work_date ON public.attendance(work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance(status);

-- ==============================================================================
-- 8. LOANS / EMPLOYEE ADVANCES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    date DATE NOT NULL,
    amount NUMERIC(12, 3) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'JOD',
    status VARCHAR(20) NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'DISBURSED', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_loans_employee ON public.loans(employee_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans(status);

-- ==============================================================================
-- 9. PAYROLL
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payroll (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    contract_id UUID REFERENCES public.contracts(id) ON DELETE RESTRICT,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'JOD',
    basic_earned NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (basic_earned >= 0),
    allowances_earned NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (allowances_earned >= 0),
    ot_hours NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (ot_hours >= 0),
    ot_rate NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (ot_rate >= 0),
    unpaid_days NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (unpaid_days >= 0),
    unpaid_day_rate NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (unpaid_day_rate >= 0),
    worked_days INT NOT NULL DEFAULT 0 CHECK (worked_days >= 0),
    worked_minutes INT NOT NULL DEFAULT 0 CHECK (worked_minutes >= 0),
    late_minutes INT NOT NULL DEFAULT 0 CHECK (late_minutes >= 0),
    late_deduction NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (late_deduction >= 0),
    early_departure_minutes INT NOT NULL DEFAULT 0 CHECK (early_departure_minutes >= 0),
    early_departure_deduction NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (early_departure_deduction >= 0),
    daily_rate NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (daily_rate >= 0),
    other_additions NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (other_additions >= 0),
    gratuities NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (gratuities >= 0),
    other_deductions NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (other_deductions >= 0),
    loan_deduction NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (loan_deduction >= 0),
    net_pay NUMERIC(12, 3) CHECK (net_pay IS NULL OR net_pay >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'PAID', 'CANCELLED')),
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100),
    prepared_by UUID REFERENCES public.users(id),
    approved_by UUID REFERENCES public.users(id),
    approved_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    notes TEXT,
    updated_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payroll ALTER COLUMN contract_id DROP NOT NULL;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS worked_days INT NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS worked_minutes INT NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS late_minutes INT NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS late_deduction NUMERIC(12, 3) NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS early_departure_minutes INT NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS early_departure_deduction NUMERIC(12, 3) NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS daily_rate NUMERIC(12, 3) NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS gratuities NUMERIC(12, 3) NOT NULL DEFAULT 0;

-- Partial unique index ensuring only one active (non-cancelled) payroll per employee per month
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_payroll_per_month 
ON public.payroll(employee_id, period_start) 
WHERE status != 'CANCELLED';

CREATE INDEX IF NOT EXISTS idx_payroll_employee ON public.payroll(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_period ON public.payroll(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payroll_status ON public.payroll(status);

-- ==============================================================================
-- 10. REPAYMENTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.repayments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE RESTRICT,
    date DATE NOT NULL,
    amount NUMERIC(12, 3) NOT NULL CHECK (amount > 0),
    method VARCHAR(20) NOT NULL CHECK (method IN ('PAYROLL', 'CASH')),
    payroll_id UUID REFERENCES public.payroll(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'PAID', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_repayments_loan ON public.repayments(loan_id);
CREATE INDEX IF NOT EXISTS idx_repayments_payroll ON public.repayments(payroll_id);
CREATE INDEX IF NOT EXISTS idx_repayments_status ON public.repayments(status);

-- ==============================================================================
-- 11. DOCUMENTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    type VARCHAR(30) NOT NULL CHECK (type IN ('IDENTITY', 'RESIDENCY', 'WORK_PERMIT', 'CERTIFICATE', 'OTHER')),
    expiry_date DATE,
    file_path VARCHAR(500) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_documents_employee ON public.documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON public.documents(expiry_date);

-- ==============================================================================
-- 12. AUDIT LOG (Strictly Append-Only)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_id UUID NOT NULL,
    actor_name VARCHAR(255) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_rec ON public.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_at ON public.audit_log(event_at DESC);

-- ==============================================================================
-- 13. DAILY RATE HISTORY
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.daily_rate_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    daily_rate NUMERIC(12, 3) NOT NULL CHECK (daily_rate >= 0),
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),
    CONSTRAINT chk_daily_rate_history_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_daily_rate_history_emp ON public.daily_rate_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_daily_rate_history_dates ON public.daily_rate_history(effective_from, effective_to);

-- ==============================================================================
-- 14. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Helper function to fetch the role of the authenticated user
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text AS $$
DECLARE
    u_role text;
    v_uid uuid;
BEGIN
    v_uid := (nullif(current_setting('request.jwt.claim.sub', true), ''))::uuid;

    IF v_uid IS NULL THEN
        RETURN 'ADMIN';
    END IF;

    SELECT role INTO u_role 
    FROM public.users 
    WHERE id = v_uid AND active = true;
    RETURN COALESCE(u_role, 'ANONYMOUS');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_rate_history ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- AUDIT LOG: Only ADMIN can SELECT. Absolutely NO ONE can UPDATE or DELETE.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_log_admin_read ON public.audit_log;
CREATE POLICY audit_log_admin_read ON public.audit_log
    FOR SELECT TO authenticated
    USING (public.current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS audit_log_insert ON public.audit_log;
CREATE POLICY audit_log_insert ON public.audit_log
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- PAYROLL: Only ADMIN and ACCOUNTANT can access. HR and SUPERVISOR are blocked.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS payroll_access ON public.payroll;
CREATE POLICY payroll_access ON public.payroll
    FOR ALL TO authenticated
    USING (public.current_user_role() IN ('ADMIN', 'ACCOUNTANT'))
    WITH CHECK (public.current_user_role() IN ('ADMIN', 'ACCOUNTANT'));

-- ------------------------------------------------------------------------------
-- CONTRACTS (Contains sensitive salary): ADMIN, HR, ACCOUNTANT. SUPERVISOR blocked.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS contracts_access ON public.contracts;
CREATE POLICY contracts_access ON public.contracts
    FOR ALL TO authenticated
    USING (public.current_user_role() IN ('ADMIN', 'HR', 'ACCOUNTANT'))
    WITH CHECK (public.current_user_role() IN ('ADMIN', 'HR'));

-- ------------------------------------------------------------------------------
-- LOANS & REPAYMENTS: ADMIN and ACCOUNTANT only. HR and SUPERVISOR blocked.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS loans_access ON public.loans;
CREATE POLICY loans_access ON public.loans
    FOR ALL TO authenticated
    USING (public.current_user_role() IN ('ADMIN', 'ACCOUNTANT'))
    WITH CHECK (public.current_user_role() IN ('ADMIN', 'ACCOUNTANT'));

DROP POLICY IF EXISTS repayments_access ON public.repayments;
CREATE POLICY repayments_access ON public.repayments
    FOR ALL TO authenticated
    USING (public.current_user_role() IN ('ADMIN', 'ACCOUNTANT'))
    WITH CHECK (public.current_user_role() IN ('ADMIN', 'ACCOUNTANT'));

-- ------------------------------------------------------------------------------
-- DOCUMENTS: ADMIN and HR only. ACCOUNTANT and SUPERVISOR blocked.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS documents_access ON public.documents;
CREATE POLICY documents_access ON public.documents
    FOR ALL TO authenticated
    USING (public.current_user_role() IN ('ADMIN', 'HR'))
    WITH CHECK (public.current_user_role() IN ('ADMIN', 'HR'));

-- ------------------------------------------------------------------------------
-- ATTENDANCE: ADMIN, HR, ACCOUNTANT, SUPERVISOR
-- Supervisor can create/edit DRAFT records. Only ADMIN and HR can APPROVE.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS attendance_select ON public.attendance;
CREATE POLICY attendance_select ON public.attendance
    FOR SELECT TO authenticated
    USING (public.current_user_role() IN ('ADMIN', 'HR', 'ACCOUNTANT', 'SUPERVISOR'));

DROP POLICY IF EXISTS attendance_insert ON public.attendance;
CREATE POLICY attendance_insert ON public.attendance
    FOR INSERT TO authenticated
    WITH CHECK (
        public.current_user_role() IN ('ADMIN', 'HR') 
        OR (public.current_user_role() = 'SUPERVISOR' AND status = 'DRAFT')
    );

DROP POLICY IF EXISTS attendance_update ON public.attendance;
CREATE POLICY attendance_update ON public.attendance
    FOR UPDATE TO authenticated
    USING (
        public.current_user_role() IN ('ADMIN', 'HR') 
        OR (public.current_user_role() = 'SUPERVISOR' AND status = 'DRAFT')
    );

-- ------------------------------------------------------------------------------
-- LEAVE BALANCES & REQUESTS: ADMIN, HR, ACCOUNTANT can view. ADMIN and HR can manage.
-- Supervisor is blocked from private employee leave details.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS leave_balances_select ON public.leave_balances;
CREATE POLICY leave_balances_select ON public.leave_balances
    FOR SELECT TO authenticated
    USING (public.current_user_role() IN ('ADMIN', 'HR', 'ACCOUNTANT'));

DROP POLICY IF EXISTS leave_balances_modify ON public.leave_balances;
CREATE POLICY leave_balances_modify ON public.leave_balances
    FOR ALL TO authenticated
    USING (public.current_user_role() IN ('ADMIN', 'HR'))
    WITH CHECK (public.current_user_role() IN ('ADMIN', 'HR'));

DROP POLICY IF EXISTS leave_requests_select ON public.leave_requests;
CREATE POLICY leave_requests_select ON public.leave_requests
    FOR SELECT TO authenticated
    USING (public.current_user_role() IN ('ADMIN', 'HR', 'ACCOUNTANT'));

DROP POLICY IF EXISTS leave_requests_modify ON public.leave_requests;
CREATE POLICY leave_requests_modify ON public.leave_requests
    FOR ALL TO authenticated
    USING (public.current_user_role() IN ('ADMIN', 'HR'))
    WITH CHECK (public.current_user_role() IN ('ADMIN', 'HR'));

-- ------------------------------------------------------------------------------
-- EMPLOYEES: Basic directory viewable by all active authenticated staff.
-- Only ADMIN and HR can add or modify employees.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS employees_select ON public.employees;
CREATE POLICY employees_select ON public.employees
    FOR SELECT TO authenticated
    USING (public.current_user_role() IN ('ADMIN', 'HR', 'ACCOUNTANT', 'SUPERVISOR'));

DROP POLICY IF EXISTS employees_modify ON public.employees;
CREATE POLICY employees_modify ON public.employees
    FOR ALL TO authenticated
    USING (public.current_user_role() IN ('ADMIN', 'HR'))
    WITH CHECK (public.current_user_role() IN ('ADMIN', 'HR'));

-- ------------------------------------------------------------------------------
-- SETTINGS: Viewable by all authenticated users. Editable only by ADMIN.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS settings_select ON public.settings;
CREATE POLICY settings_select ON public.settings
    FOR SELECT TO authenticated
    USING (public.current_user_role() IN ('ADMIN', 'HR', 'ACCOUNTANT', 'SUPERVISOR'));

DROP POLICY IF EXISTS settings_modify ON public.settings;
CREATE POLICY settings_modify ON public.settings
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'ADMIN')
    WITH CHECK (public.current_user_role() = 'ADMIN');

-- ------------------------------------------------------------------------------
-- USERS: ADMIN can manage all users. Non-admin users can only view own record.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users
    FOR SELECT TO authenticated
    USING (public.current_user_role() = 'ADMIN' OR id = (nullif(current_setting('request.jwt.claim.sub', true), ''))::uuid);

DROP POLICY IF EXISTS users_modify ON public.users;
CREATE POLICY users_modify ON public.users
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'ADMIN')
    WITH CHECK (public.current_user_role() = 'ADMIN');


