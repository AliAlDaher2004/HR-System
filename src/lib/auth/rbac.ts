export type UserRole = 'ADMIN' | 'HR' | 'ACCOUNTANT' | 'SUPERVISOR';

export interface UserSession {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  active: boolean;
}

export class AuthorizationError extends Error {
  statusCode: number;
  constructor(message: string = 'ليس لديك صلاحية لتنفيذ هذا الإجراء') {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
  }
}

export const RBAC = {
  // Financial access: Only Admin and Accountant
  canViewFinancials(role: UserRole): boolean {
    return role === 'ADMIN' || role === 'ACCOUNTANT';
  },

  canManagePayroll(role: UserRole): boolean {
    return role === 'ADMIN' || role === 'ACCOUNTANT';
  },

  // ONLY Admin can approve payroll
  canApprovePayroll(role: UserRole): boolean {
    return role === 'ADMIN';
  },

  canConfirmPayrollPayment(role: UserRole): boolean {
    return role === 'ADMIN' || role === 'ACCOUNTANT';
  },

  // Loans: Admin and Accountant only
  canManageLoans(role: UserRole): boolean {
    return role === 'ADMIN' || role === 'ACCOUNTANT';
  },

  // Attendance approval: Admin and HR only. Supervisor CANNOT approve!
  canApproveAttendance(role: UserRole): boolean {
    return role === 'ADMIN' || role === 'HR';
  },

  canCreateAttendanceDraft(role: UserRole): boolean {
    return ['ADMIN', 'HR', 'ACCOUNTANT', 'SUPERVISOR'].includes(role);
  },

  // Leave approval: Admin and HR only
  canApproveLeave(role: UserRole): boolean {
    return role === 'ADMIN' || role === 'HR';
  },

  canManageLeave(role: UserRole): boolean {
    return role === 'ADMIN' || role === 'HR';
  },

  // Confidential Employee Documents: Admin and HR only
  canViewDocuments(role: UserRole): boolean {
    return role === 'ADMIN' || role === 'HR';
  },

  canManageDocuments(role: UserRole): boolean {
    return role === 'ADMIN' || role === 'HR';
  },

  // Employee Profile Management: Admin and HR only
  canManageEmployees(role: UserRole): boolean {
    return role === 'ADMIN' || role === 'HR';
  },

  // Contracts: Admin, HR, Accountant can view. Supervisor CANNOT!
  canViewContracts(role: UserRole): boolean {
    return ['ADMIN', 'HR', 'ACCOUNTANT'].includes(role);
  },

  canManageContracts(role: UserRole): boolean {
    return role === 'ADMIN' || role === 'HR';
  },

  // Audit Log: ADMIN ONLY
  canViewAuditLog(role: UserRole): boolean {
    return role === 'ADMIN';
  },

  // User Management & Settings: ADMIN ONLY
  canManageUsers(role: UserRole): boolean {
    return role === 'ADMIN';
  },

  canManageSettings(role: UserRole): boolean {
    return role === 'ADMIN';
  },
};

export function requireRole(user: UserSession | null, allowedRoles: UserRole[]) {
  if (!user) {
    throw new AuthorizationError('يجب تسجيل الدخول أولاً للوصول إلى هذا المورد');
  }
  if (!user.active) {
    throw new AuthorizationError('الحساب معطل حالياً. يرجى التواصل مع مسؤول النظام.');
  }
  if (!allowedRoles.includes(user.role)) {
    throw new AuthorizationError(`دورك الحالي (${user.role}) لا يمتلك الصلاحية الكافية لهذا الإجراء.`);
  }
}

export function assertCanViewFinancials(user: UserSession | null) {
  if (!user || !user.active || !RBAC.canViewFinancials(user.role)) {
    throw new AuthorizationError('غير مصرح لك بالوصول إلى البيانات المالية والرواتب.');
  }
}

export function assertCanApprovePayroll(user: UserSession | null) {
  if (!user || !user.active || !RBAC.canApprovePayroll(user.role)) {
    throw new AuthorizationError('فقط مسؤول النظام (إدارة) يمتلك صلاحية اعتماد الرواتب.');
  }
}

export function assertCanApproveAttendance(user: UserSession | null) {
  if (!user || !user.active || !RBAC.canApproveAttendance(user.role)) {
    throw new AuthorizationError('فقط الإدارة والموارد البشرية يمتلكان صلاحية اعتماد سجلات الحضور.');
  }
}

export function assertCanViewAuditLog(user: UserSession | null) {
  if (!user || !user.active || !RBAC.canViewAuditLog(user.role)) {
    throw new AuthorizationError('فقط مسؤول النظام يمتلك صلاحية استعراض سجل العمليات والتدقيق.');
  }
}

export function assertCanViewDocuments(user: UserSession | null) {
  if (!user || !user.active || !RBAC.canViewDocuments(user.role)) {
    throw new AuthorizationError('غير مصرح لك بالوصول إلى وثائق الموظفين السرية.');
  }
}
