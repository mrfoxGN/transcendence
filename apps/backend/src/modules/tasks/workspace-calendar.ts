import { fromZonedTime } from 'date-fns-tz';
import { defaultWorkspaceTimeZone } from '../workspaces/workspace-policy';

export function legacyDeadlineDate(value: string | Date, timeZone = defaultWorkspaceTimeZone): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const instant = new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function taskDeadline(
  dueDate: string | null | undefined,
  dueAt: string | null | undefined,
  timeZone = defaultWorkspaceTimeZone,
): Date | null {
  // Prioritize dueAt when it contains a value
  if (dueAt != null) {
    return new Date(dueAt);
  }

  // Otherwise, use dueDate
  if (dueDate != null) {
    return fromZonedTime(
      `${dueDate}T23:59:59.999`,
      timeZone,
    );
  }
  return null;
}