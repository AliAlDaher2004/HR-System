export type WarningLevel = 'VERBAL' | 'FIRST' | 'SECOND' | 'FINAL' | 'TERMINATION';

export const WARNING_LEVELS: Record<
  WarningLevel,
  { label: string; severity: number; badgeColor: string; bgClass: string; textClass: string }
> = {
  VERBAL: {
    label: 'تنبيه شفوي',
    severity: 1,
    badgeColor: '#D97706',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-800',
  },
  FIRST: {
    label: 'إنذار أول',
    severity: 2,
    badgeColor: '#EA580C',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-800',
  },
  SECOND: {
    label: 'إنذار ثانٍ',
    severity: 3,
    badgeColor: '#DC2626',
    bgClass: 'bg-rose-100',
    textClass: 'text-rose-800',
  },
  FINAL: {
    label: 'إنذار نهائي',
    severity: 4,
    badgeColor: '#B91C1C',
    bgClass: 'bg-red-200',
    textClass: 'text-red-900',
  },
  TERMINATION: {
    label: 'إنذار مع الفصل / عقوبة',
    severity: 5,
    badgeColor: '#4C0519',
    bgClass: 'bg-rose-900',
    textClass: 'text-white',
  },
};

export interface WarningDTO {
  id: string;
  employeeId: string;
  warningLevel: WarningLevel;
  warningDate: string;
  title: string;
  reason: string;
  administrativeAction: string | null;
  signedByEmployee: boolean;
  attachmentPath: string | null;
  status: 'ACTIVE' | 'REVOKED';
  notes: string | null;
  createdAt: Date;
  createdBy: string | null;
  employee: {
    id: string;
    employeeNo: string;
    name: string;
    department: string;
    jobTitle: string;
  };
}
