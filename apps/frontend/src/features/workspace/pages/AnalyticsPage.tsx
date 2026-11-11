import { Panel } from '../components';
import { MetricCard } from '../MetricCard';
import { CheckCircle2, Clock3 } from 'lucide-react';
import { workspaceIcons } from '../workspace-icons';
import { addCalendarDays, calendarDate, formatCalendarDate, isOpenTask, isOverdue } from '../workspace-calendar';
import type { PageHeading, Task } from '../types';
import './analytics.css';

export function AnalyticsPage({ pageHeading, analyticsPeriod, setAnalyticsPeriod, tasks, columns, activeCount, activeWipLimit, today, reportingTimeZone }: {
  pageHeading: PageHeading; analyticsPeriod: string; setAnalyticsPeriod: (period: string) => void;
  tasks: Task[]; columns: string[]; activeCount: number; activeWipLimit: number;
  today: string; reportingTimeZone: string;
}) {
  const days = analyticsPeriod === 'Last 7 days' ? 7 : 30;
  const completedByDay = new Map<string, number>();
  for (const task of tasks) {
    if (task.status === 'Done' && task.completedAt) {
      const day = calendarDate(new Date(task.completedAt), reportingTimeZone);
      completedByDay.set(day, (completedByDay.get(day) ?? 0) + 1);
    }
  }
  const open = tasks.filter(isOpenTask);
  const overdue = open.filter(task => isOverdue(task, today));
  const counts = Array.from({ length: days }, (_, index) => {
    const day = addCalendarDays(today, index - days + 1);
    return { day, label: formatCalendarDate(day, {}), count: completedByDay.get(day) ?? 0 };
  });
  const total = counts.reduce((sum, day) => sum + day.count, 0);
  const max = Math.max(1, ...counts.map(day => day.count));

  return <>
    {pageHeading(<select className="wu-select" aria-label="Analytics period" value={analyticsPeriod} onChange={event => setAnalyticsPeriod(event.target.value)}><option>Last 30 days</option><option>Last 7 days</option></select>)}
    <div className="wu-stat-grid">
      <MetricCard icon={<CheckCircle2 size={19} />} label="Tasks completed" value={total} note={analyticsPeriod} tone="mint" />
      <MetricCard icon={<workspaceIcons.backlog size={19} />} label="Open tasks" value={open.length} note="Current workspace" tone="blue" />
      <MetricCard icon={<Clock3 size={19} />} label="Overdue tasks" value={overdue.length} note="Open tasks past their due date" tone="pink" />
      <MetricCard icon={<workspaceIcons.board size={19} />} label="Active work" value={activeCount} note={`Limit: ${activeWipLimit} tasks`} tone="violet" />
    </div>
    <div className="wu-analytics-grid">
      <Panel className="wu-content-panel">
        <h2>Tasks completed by day</h2>
        {total ? <div className="wu-chart" role="img" aria-label={counts.filter(day => day.count).map(day => day.label + ': ' + day.count).join(', ')}>
          <div className="wu-bars" style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}>
            {counts.map((day, index) => <div key={day.day} title={day.label + ': ' + day.count}>
              <i style={{ height: (day.count / max) * 100 + '%' }} />
              <small>{days === 7 || index % 7 === 0 ? Number(day.day.slice(-2)) : ''}</small>
            </div>)}
          </div>
        </div> : <p className="wu-muted">No tasks completed in this period.</p>}
      </Panel>
      <Panel className="wu-content-panel">
        <h2>Work by status</h2>
        <div className="wu-status-summary">{columns.map(label => <div key={label}><span className="wu-status-dot wu-status-dot--blue" /><span>{label}</span><strong>{tasks.filter(task => task.status === label).length}</strong></div>)}</div>
      </Panel>
    </div>
  </>;
}
