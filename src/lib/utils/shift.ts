export type ShiftCode = 'ALL' | 'MORNING' | 'EVENING';

export interface ShiftDefinition {
  code: 'MORNING' | 'EVENING';
  name: string;
  shortName: string;
  icon: string;
  defaultStartTime: string;
  defaultEndTime: string;
  hoursLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export const SHIFTS: Record<'MORNING' | 'EVENING', ShiftDefinition> = {
  MORNING: {
    code: 'MORNING',
    name: 'الوردية الصباحية',
    shortName: 'صباحي',
    icon: '☀️',
    defaultStartTime: '08:00',
    defaultEndTime: '16:30',
    hoursLabel: '08:00 - 16:30',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900',
    badgeBorder: 'border-amber-400',
  },
  EVENING: {
    code: 'EVENING',
    name: 'الوردية المسائية',
    shortName: 'مسائي',
    icon: '🌙',
    defaultStartTime: '16:30',
    defaultEndTime: '01:00',
    hoursLabel: '16:30 - 01:00',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-900',
    badgeBorder: 'border-indigo-400',
  },
};

/**
 * Determine whether an employee or attendance record belongs to MORNING or EVENING shift.
 * Evening shift is defined as starting at or after 16:30 (4:30 PM) or before 06:00 AM.
 * Morning shift is defined as starting between 06:00 AM and 16:29 PM (default: 08:00).
 */
export function getEmployeeShiftCode(workStartTime?: string | null): 'MORNING' | 'EVENING' {
  if (!workStartTime) return 'MORNING';
  const cleanTime = workStartTime.trim();
  const [hStr, mStr] = cleanTime.split(':');
  const hours = parseInt(hStr, 10) || 0;
  const minutes = parseInt(mStr, 10) || 0;
  const totalMinutes = hours * 60 + minutes;

  // 16:30 = 990 minutes. 06:00 = 360 minutes.
  if (totalMinutes >= 16 * 60 + 30 || totalMinutes < 6 * 60) {
    return 'EVENING';
  }
  return 'MORNING';
}

/**
 * Get the shift definition for a given work start time.
 */
export function getEmployeeShift(workStartTime?: string | null): ShiftDefinition {
  const code = getEmployeeShiftCode(workStartTime);
  return SHIFTS[code];
}
