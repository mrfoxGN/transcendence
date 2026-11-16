import type { Task } from './types';

export const nextSevenDaysLabel = 'Next 7 days';

export function calendarDate(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function addCalendarDays(day: string, days: number) {
  const date = new Date(day + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatCalendarDate(day: string, options: Intl.DateTimeFormatOptions) {
  return new Date(day + 'T00:00:00Z').toLocaleDateString(undefined, { ...options, timeZone: 'UTC' });
}

export function isOpenTask(task: Pick<Task, 'status'>) {
  return task.status !== 'Done' && task.status !== 'Cancelled';
}

export function isOverdue(task: Task, today: string) {
  return isOpenTask(task) && !!task.dueDate && task.dueDate < today;
}

export function isDueInNextSevenDays(task: Task, today: string, end = addCalendarDays(today, 7)) {
  return isOpenTask(task) && !!task.dueDate && task.dueDate >= today && task.dueDate < end;
}
