import { fromZonedTime } from 'date-fns-tz';
import { defaultWorkspaceTimeZone } from '../workspaces/workspace-policy';

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