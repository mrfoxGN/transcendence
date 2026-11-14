import { TaskStatus as Status } from '../../database/enums/database.enums';
import { analyticsWindow, buildAnalytics, reportingCalendar, type AnalyticsTask, type AnalyticsTransition } from './task-analytics';

const date = (value: string) => new Date(value);
const hour = 3_600_000;

function task(id: string, fields: Partial<AnalyticsTask> = {}): AnalyticsTask {
  return { id, taskNumber: Number(id), title: 'Task ' + id, status: Status.BACKLOG, createdAt: date('2026-11-03T00:00:00Z'),
    deletedAt: null, completedAt: null, cancelledAt: null, ...fields };
}

const move = (taskId: string, fromStatus: Status, toStatus: Status, at: string): AnalyticsTransition =>
  ({ taskId, fromStatus, toStatus, changedAt: date(at) });

describe('task analytics', () => {
  it('reconciles duration, repeat completions, cancellation, and deleted resources', () => {
    const window = analyticsWindow(date('2026-11-12T12:00:00Z'), 7, 'UTC');
    const history = [
      move('1', Status.BACKLOG, Status.IN_PROGRESS, '2026-11-05T18:00:00Z'),
      move('1', Status.IN_PROGRESS, Status.REVIEW, '2026-11-06T06:00:00Z'),
      move('1', Status.REVIEW, Status.DONE, '2026-11-06T09:00:00Z'),
      move('1', Status.DONE, Status.IN_PROGRESS, '2026-11-07T10:00:00Z'),
      move('1', Status.IN_PROGRESS, Status.DONE, '2026-11-07T12:00:00Z'),
      move('2', Status.BACKLOG, Status.REVIEW, '2026-11-08T08:00:00Z'),
      move('2', Status.REVIEW, Status.CANCELLED, '2026-11-08T12:00:00Z'),
      move('3', Status.BACKLOG, Status.IN_PROGRESS, '2026-11-10T09:00:00Z'),
    ];
    const report = buildAnalytics([
      task('1', { status: Status.DONE, deletedAt: date('2026-11-09T00:00:00Z') }),
      task('2', { status: Status.CANCELLED }),
      task('3', { status: Status.IN_PROGRESS, deletedAt: date('2026-11-10T11:00:00Z') }),
    ], history, window, '2026-11-08');
    expect(report.completions.map(item => [item.day, item.id, item.deleted])).toEqual([
      ['2026-11-07', '1', true], ['2026-11-06', '1', true],
    ]);
    expect(report.rows.reduce((sum, row) => sum + row.completed, 0)).toBe(2);
    expect(report.durations.map(item => [item.id, item.progressMs / hour, item.reviewMs / hour])).toEqual([
      ['1', 8, 3], ['2', 0, 4], ['3', 2, 0],
    ]);
    expect(report.rows.find(row => row.day === '2026-11-08')?.counts).toMatchObject({ DONE: 1, CANCELLED: 1 });
    expect(report.flowTasks.map(item => [item.id, item.status])).toEqual([['1', Status.DONE], ['2', Status.CANCELLED], ['3', Status.BACKLOG]]);
    expect(report.rows.find(row => row.day === '2026-11-09')?.counts.DONE).toBe(0);
    expect(report.rows.find(row => row.day === '2026-11-10')?.counts.IN_PROGRESS).toBe(0);
  });

  it('uses workspace midnight, including a short local day, and clips work at the report timestamp', () => {
    const calendar = reportingCalendar('America/New_York');
    expect(calendar.startOf('2026-03-09') - calendar.startOf('2026-03-08')).toBe(23 * hour);
    const window = analyticsWindow(date('2026-03-09T06:00:00Z'), 7, 'America/New_York');
    const timeline = [
      move('1', Status.BACKLOG, Status.IN_PROGRESS, '2026-03-09T04:00:00Z'),
      move('1', Status.IN_PROGRESS, Status.DONE, '2026-03-09T08:00:00Z'),
      move('2', Status.BACKLOG, Status.DONE, '2026-03-09T03:59:59Z'),
    ];
    const report = buildAnalytics([task('1', { createdAt: date('2026-03-07T12:00:00Z') }),
      task('2', { createdAt: date('2026-03-07T12:00:00Z') })], timeline, window, window.today);
    expect(report.completions.map(event => event.day)).toEqual(['2026-03-08']);
    expect(report.durations[0].progressMs).toBe(2 * hour);
    expect(report.flowTasks.map(item => item.status)).toEqual([Status.IN_PROGRESS, Status.DONE]);
  });

  it('uses a legacy completion timestamp and avoids inventing a completion when it is absent', () => {
    const window = analyticsWindow(date('2026-11-12T12:00:00Z'), 7, 'UTC');
    const report = buildAnalytics([
      task('1', { status: Status.DONE, completedAt: date('2026-11-10T07:00:00Z') }),
      task('2', { status: Status.DONE }),
    ], [], window, window.today);
    expect(report.completions.map(item => item.id)).toEqual(['1']);
    expect(report.flowTasks.filter(item => item.status === Status.DONE)).toHaveLength(2);
  });
});
