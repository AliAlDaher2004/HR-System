export function formatDurationArabic(minutes: number): string {
  if (!minutes || minutes <= 0) return '0 دقيقة';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours} ساعة و ${mins} دقيقة`;
  } else if (hours > 0) {
    return `${hours} ساعة`;
  }
  return `${mins} دقيقة`;
}

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Calculate early departure minutes accurately, supporting both standard daytime shifts
 * and overnight shifts that cross midnight (e.g. 17:00 -> 01:00).
 *
 * @param scheduledOut Scheduled shift end time (e.g. '17:00' or '01:00')
 * @param departureTime Actual departure time (e.g. '20:00' or '00:30')
 */
export function calculateEarlyDepartureMinutes(scheduledOut: string, departureTime: string): number {
  if (!scheduledOut || !departureTime) return 0;

  const schedMins = parseTimeToMinutes(scheduledOut);
  const depMins = parseTimeToMinutes(departureTime);

  // If shift ends past midnight (e.g. 01:00, which is <= 360 mins / 6:00 AM)
  const isOvernightShift = schedMins <= 360;

  let effectiveSchedMins = schedMins;
  let effectiveDepMins = depMins;

  if (isOvernightShift) {
    // 01:00 becomes 60 + 1440 = 1500
    effectiveSchedMins = schedMins + 1440;
    // If departure time is after midnight (e.g. 00:30), add 1440 so it's 1470
    // If departure time is before midnight (e.g. 20:00), keep as 1200
    if (depMins <= 360) {
      effectiveDepMins = depMins + 1440;
    }
  }

  return Math.max(0, effectiveSchedMins - effectiveDepMins);
}

/**
 * Calculate late arrival minutes accurately, supporting both standard daytime shifts
 * and overnight shifts that start in evening and arrive after midnight.
 */
export function calculateLateMinutes(scheduledIn: string, arrivalTime: string): number {
  if (!scheduledIn || !arrivalTime) return 0;

  const schedMins = parseTimeToMinutes(scheduledIn);
  const arrMins = parseTimeToMinutes(arrivalTime);

  // If evening shift (starts at 16:30 or later), and employee arrives past midnight (e.g. 00:30, <= 360 mins)
  if (schedMins >= 16 * 60 + 30 && arrMins <= 6 * 60) {
    return Math.max(0, arrMins + 1440 - schedMins);
  }

  return Math.max(0, arrMins - schedMins);
}

