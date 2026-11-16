import { useEffect, useState } from 'react';
import { ArrowRight, Clock3, List, Table2 } from 'lucide-react';
import { FilterChips, Panel } from '../components';
import { MetricCard } from '../MetricCard';
import { Drawer, LoadingPanel } from '../WorkspaceControls';
import { useWorkspaceData } from '../workspace-api';
import { formatCalendarDate, isOpenTask, isOverdue } from '../workspace-calendar';
import { statusLabels } from '../workspace-tasks';
import type { PageHeading, Task } from '../types';
import './analytics.css';

type Status = keyof typeof statusLabels;
type ReportTask = { id: string; taskKey?: string; title: string; deleted?: boolean };
type Completion = ReportTask & { day: string; at: string };
type Duration = ReportTask & { progressMs: number; reviewMs: number };
type Report = {
  timeZone: string;
  asOf: string;
  rows: { day: string; completed: number; counts: Record<Status, number> }[];
  completions: Completion[];
  durations: Duration[];
  flowTasks: (ReportTask & { status: Status })[];
};
type Drill =
  | { kind: 'current'; title: string; tasks: Task[] }
  | { kind: 'completion'; day?: string }
  | { kind: 'duration'; stage: 'progressMs' | 'reviewMs' }
  | { kind: 'flow'; day: string; status?: Status };
const statuses = Object.keys(statusLabels) as Status[];
const dayLabel = (day: string) => formatCalendarDate(day, { month: 'short', day: 'numeric' });
const stageLabels = { progressMs: 'Time in progress', reviewMs: 'Time in review' };

function elapsed(ms: number) {
  if (!ms) return '0 min';
  const minutes = Math.floor(ms / 60_000);
  if (!minutes) return '<1 min';
  const hours = Math.floor(minutes / 60);
  return [hours >= 24 && Math.floor(hours / 24) + 'd', hours % 24 > 0 && hours % 24 + 'h', minutes % 60 > 0 && minutes % 60 + 'm'].filter(Boolean).join(' ');
}

function TaskRows({ rows, onOpen }: { rows: (ReportTask & { key?: string; detail?: string })[]; onOpen: (id: string) => void }) {
  if (!rows.length) return <p className="wu-muted">No tasks contribute to this metric.</p>;
  return <ul className="wu-analytics-task-list">{rows.map(row => <li key={row.key ?? row.id}>
    <div><strong>{row.title}</strong><small>{[row.taskKey, row.detail].filter(Boolean).join(' · ')}</small></div>
    {row.deleted ? <span className="wu-muted">Deleted</span> : <button type="button" className="wu-text-button" aria-label={'Open task: ' + row.title}
      onClick={() => onOpen(row.id)}>Open task <ArrowRight size={13} aria-hidden="true" /></button>}
  </li>)}</ul>;
}

function FlowTasks({ path, token, status, onOpen }: { path: string; token: string | null; status?: Status; onOpen: (id: string) => void }) {
  const result = useWorkspaceData<Report>(path, token);
  if (result.error) return <p role="alert">Could not load the tasks. <button className="wu-text-button" type="button" onClick={result.retry}>Try again</button></p>;
  if (!result.data) return <LoadingPanel label="Loading status breakdown" />;
  return <TaskRows onOpen={onOpen} rows={result.data.flowTasks.filter(task => !status || task.status === status)
    .map(task => ({ ...task, detail: statusLabels[task.status] }))} />;
}

export function AnalyticsPage({ pageHeading, analyticsPeriod, setAnalyticsPeriod, tasks, activeWipLimit, today, reportingTimeZone, path, token, onOpenTask, refreshKey }: {
  pageHeading: PageHeading; analyticsPeriod: string; setAnalyticsPeriod: (period: string) => void;
  tasks: Task[]; activeWipLimit: number; today: string; reportingTimeZone: string;
  path: string; token: string | null; onOpenTask: (id: string) => void; refreshKey: number;
}) {
  const [view, setView] = useState('Charts');
  const [drill, setDrill] = useState<Drill>();
  const days = analyticsPeriod === 'Last 7 days' ? 7 : 30;
  const reportPath = path + '?days=' + days;
  const report = useWorkspaceData<Report>(reportPath, token);
  useEffect(() => { if (refreshKey > 0) report.retry(); }, [refreshKey]);

  const open = tasks.filter(isOpenTask);
  const overdue = open.filter(task => isOverdue(task, today));
  const active = open.filter(task => task.status === statusLabels.IN_PROGRESS || task.status === statusLabels.REVIEW);
  const rows = report.data?.rows ?? [];
  const maxCompleted = Math.max(1, ...rows.map(row => row.completed));
  const maxFlow = Math.max(1, ...rows.map(row => statuses.reduce((sum, status) => sum + row.counts[status], 0)));
  const totals = report.data?.durations.reduce((sums, task) => ({
    progressMs: sums.progressMs + task.progressMs, reviewMs: sums.reviewMs + task.reviewMs,
  }), { progressMs: 0, reviewMs: 0 });
  const openTask = (id: string) => { setDrill(undefined); onOpenTask(id); };
  const drillTitle = drill?.kind === 'current' ? drill.title : drill?.kind === 'completion' ? 'Completion events' + (drill.day ? ' · ' + dayLabel(drill.day) : '')
    : drill?.kind === 'duration' ? stageLabels[drill.stage]
    : drill?.kind === 'flow' ? (drill.status ? statusLabels[drill.status] : 'Status breakdown') + ' · ' + dayLabel(drill.day) : '';

  return <>
    {pageHeading()}
    <section className="wu-analytics-section" aria-labelledby="wu-analytics-current">
      <div className="wu-analytics-heading"><h2 id="wu-analytics-current">Current snapshot</h2><span className="wu-muted">As of {dayLabel(today)}</span></div>
      <div className="wu-stat-grid">
        <MetricCard icon={<List size={19} />} label="Open tasks" value={open.length} note="All unfinished tasks" tone="blue"
          onClick={() => setDrill({ kind: 'current', title: 'Open tasks', tasks: open })} />
        <MetricCard icon={<Clock3 size={19} />} label="Overdue tasks" value={overdue.length} note="Open tasks past their due date" tone="pink"
          onClick={() => setDrill({ kind: 'current', title: 'Overdue tasks', tasks: overdue })} />
        <MetricCard icon={<List size={19} />} label="Active work" value={active.length} note={`In progress and review · limit ${activeWipLimit}`} tone="violet"
          onClick={() => setDrill({ kind: 'current', title: 'Active work', tasks: active })} />
      </div>
    </section>
    <section className="wu-analytics-section" aria-labelledby="wu-analytics-report">
      <div className="wu-analytics-heading">
        <div><h2 id="wu-analytics-report">Period report</h2><p className="wu-muted">Reporting time zone · {report.data?.timeZone ?? reportingTimeZone}</p></div>
        <label className="wu-field-label">Date range<select aria-label="Analytics period" value={analyticsPeriod} onChange={event => { setDrill(undefined); setAnalyticsPeriod(event.target.value); }}>
          <option>Last 30 days</option><option>Last 7 days</option>
        </select></label>
      </div>
      {report.error ? <Panel className="wu-content-panel"><p role="alert">Could not load the period report. <button className="wu-text-button" type="button" onClick={report.retry}>Try again</button></p></Panel>
        : !report.data ? <LoadingPanel label="Loading the period report" /> : <>
          <div className="wu-analytics-totals">
            <button type="button" className="wu-panel wu-analytics-total" onClick={() => setDrill({ kind: 'completion' })}>
              <span>Completion events</span><strong>{report.data.completions.length}</strong><ArrowRight size={15} aria-hidden="true" />
            </button>
            {(['progressMs', 'reviewMs'] as const).map(stage => <button key={stage} type="button" className="wu-panel wu-analytics-total"
              onClick={() => setDrill({ kind: 'duration', stage })}>
              <span>{stageLabels[stage]}</span><strong>{elapsed(totals?.[stage] ?? 0)}</strong><ArrowRight size={15} aria-hidden="true" />
            </button>)}
          </div>
          <div aria-label="Report display"><FilterChips items={['Charts', 'Data table']} active={view} onChange={setView} /></div>
          {view === 'Charts' ? <div className="wu-analytics-grid">
            <Panel className="wu-content-panel">
              <h3>Completion events by day</h3>
              <div className="wu-analytics-scale" aria-hidden="true">{maxCompleted}</div>
              <div className="wu-analytics-bars" style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}>
                {rows.map(row => <button key={row.day} type="button" data-count={row.completed} className="wu-analytics-bar"
                  title={dayLabel(row.day) + ' · ' + row.completed + ' completions'} aria-label={dayLabel(row.day) + ', ' + row.completed + ' completion events'}
                  onClick={() => setDrill({ kind: 'completion', day: row.day })}>
                  <span style={{ height: row.completed / maxCompleted * 100 + '%' }} />
                </button>)}
              </div>
              <div className="wu-analytics-axis"><span>{dayLabel(rows[0].day)}</span><span>{dayLabel(rows[rows.length - 1].day)}</span></div>
            </Panel>
            <Panel className="wu-content-panel">
              <h3>Cumulative flow</h3>
              <div className="wu-analytics-scale" aria-hidden="true">{maxFlow}</div>
              <div className="wu-analytics-bars" style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}>
                {rows.map(row => <button key={row.day} type="button" className="wu-analytics-bar wu-analytics-bar--stack"
                  title={dayLabel(row.day) + ' · ' + statuses.reduce((sum, status) => sum + row.counts[status], 0) + ' tasks'}
                  aria-label={'Status breakdown for ' + dayLabel(row.day)} onClick={() => setDrill({ kind: 'flow', day: row.day })}>
                  {statuses.map(status => row.counts[status] > 0 && <span key={status} data-status={status}
                    style={{ height: row.counts[status] / maxFlow * 100 + '%' }} />)}
                </button>)}
              </div>
              <div className="wu-analytics-axis"><span>{dayLabel(rows[0].day)}</span><span>{dayLabel(rows[rows.length - 1].day)}</span></div>
              <ul className="wu-analytics-legend">{statuses.map(status => <li key={status}><i data-status={status} />{statusLabels[status]}</li>)}</ul>
            </Panel>
          </div> : <Panel className="wu-content-panel">
            <h3><Table2 size={16} aria-hidden="true" /> Daily report data</h3>
            <div className="wu-table-wrap" tabIndex={0} role="region" aria-label="Daily report data">
              <table className="wu-table wu-analytics-table">
                <thead><tr><th scope="col">Date</th><th scope="col">Completions</th>{statuses.map(status => <th scope="col" key={status}>{statusLabels[status]}</th>)}</tr></thead>
                <tbody>{rows.map(row => <tr key={row.day}>
                  <th scope="row">{dayLabel(row.day)}</th>
                  <td><button className="wu-text-button" type="button" aria-label={dayLabel(row.day) + ', ' + row.completed + ' completions'} onClick={() => setDrill({ kind: 'completion', day: row.day })}>{row.completed}</button></td>
                  {statuses.map(status => <td key={status}><button className="wu-text-button" type="button" aria-label={dayLabel(row.day) + ', ' + row.counts[status] + ' ' + statusLabels[status]}
                    onClick={() => setDrill({ kind: 'flow', day: row.day, status })}>{row.counts[status]}</button></td>)}
                </tr>)}</tbody>
              </table>
            </div>
          </Panel>}
          <p className="wu-muted">Flow counts each task at the end of the day, or at the current time for today. Reopened tasks can complete again.</p>
        </>}
    </section>
    {drill && <Drawer title={drillTitle} onClose={() => setDrill(undefined)}>
      {drill.kind === 'current' && <TaskRows onOpen={openTask} rows={drill.tasks.map(task => ({ ...task, detail: task.status }))} />}
      {drill.kind === 'completion' && <TaskRows onOpen={openTask} rows={(report.data?.completions ?? []).filter(event => !drill.day || event.day === drill.day)
        .map((event, index) => ({ ...event, key: event.id + ':' + index, detail: new Date(event.at).toLocaleString(undefined, { timeZone: report.data?.timeZone }) }))} />}
      {drill.kind === 'duration' && <TaskRows onOpen={openTask} rows={(report.data?.durations ?? []).filter(task => task[drill.stage] > 0)
        .map(task => ({ ...task, detail: elapsed(task[drill.stage]) }))} />}
      {drill.kind === 'flow' && report.data && <FlowTasks path={reportPath + '&day=' + drill.day + '&asOf=' + encodeURIComponent(report.data.asOf)}
        token={token} status={drill.status} onOpen={openTask} />}
    </Drawer>}
  </>;
}
