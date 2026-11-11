export const workspaceReportingTimeZone = 'Africa/Casablanca';

const calendarDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: workspaceReportingTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function legacyDeadlineDate(value: string | Date): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const instant = new Date(value);
  const parts = calendarDate.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function taskDeadline(dueDate: string | null | undefined, dueAt: string | null | undefined) {
  if (dueDate !== undefined) {
    return { dueDate, dueAt: dueDate ? new Date(dueDate + 'T00:00:00.000Z') : null };
  }
  return { dueDate: dueAt ? legacyDeadlineDate(dueAt) : null, dueAt: dueAt ? new Date(dueAt) : null };
}
