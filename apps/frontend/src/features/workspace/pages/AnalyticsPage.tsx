import { Panel } from '../components';
import { MetricCard } from '../MetricCard';
import { CheckCircle2, Clock3 } from 'lucide-react';
import { workspaceIcons } from '../workspace-icons';
import type { PageHeading, Task } from '../types';
import './analytics.css';

export function AnalyticsPage({ pageHeading, analyticsPeriod, setAnalyticsPeriod, tasks, columns, activeCount, activeWipLimit }: {
  pageHeading: PageHeading; analyticsPeriod: string; setAnalyticsPeriod: (period: string) => void;
  tasks: Task[]; columns: string[]; activeCount: number; activeWipLimit: number;
}) {
  const days = analyticsPeriod === 'Last 7 days' ? 7 : 30;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completed = tasks.filter(task => task.status === 'Done' && task.completedAt);
  const open = tasks.filter(task => !['Done', 'Cancelled'].includes(task.status));
  const overdue = open.filter(task => task.dueAt && Date.parse(task.dueAt) < today.getTime());
  const counts = Array.from({ length: days }, (_, index) => {
    const start = new Date(today);
    start.setDate(today.getDate() - days + index + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    const count = completed.filter(task => Date.parse(task.completedAt!) >= start.getTime() && Date.parse(task.completedAt!) < end.getTime()).length;
    return { start, count };
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
        {total ? <div className="wu-chart" role="img" aria-label={counts.filter(day => day.count).map(day => day.start.toLocaleDateString() + ': ' + day.count).join(', ')}>
          <div className="wu-bars" style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}>
            {counts.map((day, index) => <div key={day.start.toISOString()} title={day.start.toLocaleDateString() + ': ' + day.count}>
              <i style={{ height: (day.count / max) * 100 + '%' }} />
              <small>{days === 7 || index % 7 === 0 ? day.start.getDate() : ''}</small>
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
