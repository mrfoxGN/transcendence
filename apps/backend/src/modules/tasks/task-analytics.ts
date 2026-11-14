import { TaskStatus } from '../../database/enums/database.enums';

export type AnalyticsTask = {
  id: string; taskNumber: number; title: string; status: TaskStatus; createdAt: Date; deletedAt: Date | null;
  completedAt: Date | null; cancelledAt: Date | null;
};
export type AnalyticsTransition = { taskId: string; fromStatus: TaskStatus | null; toStatus: TaskStatus; changedAt: Date };
const dayMs = 86_400_000;
const statuses = Object.values(TaskStatus);

export function reportingCalendar(timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const dayOf = (time: number) => {
    const parts = formatter.formatToParts(time);
    return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
  };
  const offsetDay = (day: string, offset: number) => new Date(Date.parse(day + 'T00:00:00Z') + offset * dayMs).toISOString().slice(0, 10);
  function startOf(day: string) {
    const utc = Date.parse(day + 'T00:00:00Z');
    let lower = utc - 2 * dayMs;
    let upper = utc + 2 * dayMs;
    // Find the first instant in the local date, even when midnight is skipped by a clock change.
    while (lower < upper) {
      const mid = Math.floor((lower + upper) / 2);
      if (dayOf(mid) < day) lower = mid + 1;
      else upper = mid;
    }
    return lower;
  }
  return { dayOf, offsetDay, startOf };
}

export function analyticsWindow(now: Date, days: number, timeZone: string) {
  const calendar = reportingCalendar(timeZone);
  const today = calendar.dayOf(now.getTime());
  const dates = Array.from({ length: days }, (_, index) => calendar.offsetDay(today, index - days + 1));
  const start = calendar.startOf(dates[0]);
  const end = now.getTime();
  const points = dates.map((day, index) => ({
    day,
    at: index === dates.length - 1 ? end : calendar.startOf(dates[index + 1]) - 1,
  }));
  return { calendar, start, end, today, points, timeZone };
}

type Window = ReturnType<typeof analyticsWindow>;
type ReportTask = { id: string; taskKey: string; title: string; deleted: boolean };

function taskTimeline(task: AnalyticsTask, transitions: AnalyticsTransition[]) {
  const created = task.createdAt.getTime();
  const first = transitions[0];
  const recordedEnd = task.status === TaskStatus.DONE ? task.completedAt : task.status === TaskStatus.CANCELLED ? task.cancelledAt : null;
  if (first) return [{ at: created, status: first.fromStatus ?? first.toStatus }, ...transitions.map(event => ({
    at: event.changedAt.getTime(), status: event.toStatus,
  }))];
  if (recordedEnd && recordedEnd.getTime() > created) {
    return [{ at: created, status: TaskStatus.BACKLOG }, { at: recordedEnd.getTime(), status: task.status }];
  }
  return [{ at: created, status: task.status }];
}

export function buildAnalytics(tasks: AnalyticsTask[], history: AnalyticsTransition[], window: Window, flowDay: string) {
  const { calendar, start, end, points, timeZone } = window;
  const rows = points.map(point => ({
    day: point.day, completed: 0, counts: Object.fromEntries(statuses.map(status => [status, 0])) as Record<TaskStatus, number>,
  }));
  const byDay = new Map(rows.map(row => [row.day, row]));
  const byTask = new Map<string, AnalyticsTransition[]>();
  for (const event of history) {
    const transitions = byTask.get(event.taskId) ?? [];
    transitions.push(event);
    byTask.set(event.taskId, transitions);
  }
  const completions: (ReportTask & { day: string; at: string })[] = [];
  const durations: (ReportTask & { progressMs: number; reviewMs: number })[] = [];
  const flowTasks: (ReportTask & { status: TaskStatus })[] = [];
  for (const task of tasks) {
    const deleted = task.deletedAt?.getTime() ?? Infinity;
    const summary = { id: task.id, taskKey: 'TASK-' + task.taskNumber, title: task.title, deleted: task.deletedAt !== null };
    const transitions = byTask.get(task.id) ?? [];
    const timeline = taskTimeline(task, transitions);
    let progressMs = 0;
    let reviewMs = 0;
    for (const [index, segment] of timeline.entries()) {
      const next = Math.min(timeline[index + 1]?.at ?? Infinity, deleted);
      const overlap = Math.max(0, Math.min(next, end) - Math.max(segment.at, start));
      if (segment.status === TaskStatus.IN_PROGRESS) progressMs += overlap;
      if (segment.status === TaskStatus.REVIEW) reviewMs += overlap;
      if (segment.status === TaskStatus.DONE && timeline[index - 1]?.status !== TaskStatus.DONE
        && (index > 0 || transitions.length > 0 || task.completedAt !== null)
        && segment.at >= start && segment.at <= end && segment.at < deleted) {
        const day = calendar.dayOf(segment.at);
        const row = byDay.get(day);
        if (row) {
          row.completed++;
          completions.push({ ...summary, day, at: new Date(segment.at).toISOString() });
        }
      }
    }
    if (progressMs || reviewMs) durations.push({ ...summary, progressMs, reviewMs });
    let index = 0;
    for (const [rowIndex, point] of points.entries()) {
      if (point.at < timeline[0].at || point.at >= deleted) continue;
      while (index + 1 < timeline.length && timeline[index + 1].at <= point.at) index++;
      const status = timeline[index].status;
      rows[rowIndex].counts[status]++;
      if (point.day === flowDay) flowTasks.push({ ...summary, status });
    }
  }
  completions.sort((left, right) => right.at.localeCompare(left.at));
  return { timeZone, asOf: new Date(end).toISOString(), flowDay, rows, completions, durations, flowTasks };
}
