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
