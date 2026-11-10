import { useId, useRef, type ReactNode } from 'react';
import { ArrowRight, Check, Clock3, GitBranch, LayoutGrid, List } from 'lucide-react';
import { ActivityList, FilterChips, Panel, Pill } from '../components';
import { homeFilters, previewWeek, statusTones } from '../previewData';
import type { PageHeading, Task, PageKey, AddTaskButton } from '../types';
import { WorkspaceProgress } from './WorkspaceProgress';
import { LoadingPanel } from '../WorkspaceControls';
import { fileSize, type WorkspaceFile } from '../workspace-api';
import './home.css';

type HomeMetricProps = {
  icon: ReactNode;
  label: string;
  value: number;
  note: string;
  tone: 'blue' | 'mint' | 'violet' | 'pink';
  onClick?: () => void;
};

function HomeMetric({ icon, label, value, note, tone, onClick }: HomeMetricProps) {
  const gradientId = useId();
  const Card = onClick ? 'button' : 'div';

  return (
    <Card className={`wu-home-metric wu-home-metric--${tone}`} type={onClick ? 'button' : undefined} onClick={onClick}>
      <span className="wu-home-metric-icon" aria-hidden="true">{icon}</span>
      <span className="wu-home-metric-copy">
        <strong>{value}</strong>
        <span>{label}</span>
        <small>{note}</small>
      </span>
      {onClick && <ArrowRight className="wu-home-metric-arrow" size={14} aria-hidden="true" />}
      <svg className="wu-home-metric-wave" viewBox="0 0 110 46" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x2="0%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity=".24" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path fill={`url(#${gradientId})`} d="M0 46C25 46 28 22 49 22S66 34 79 34 92 15 110 15V46Z" />
      </svg>
    </Card>
  );
}

const months = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

function dueOrder(due: string) {
  const [month, day] = due.split(' ');
  const monthIndex = months.indexOf(month);
  return monthIndex < 0 || !Number(day) ? Infinity : monthIndex * 32 + Number(day);
}

type HomePageProps = {
  columns: string[];
  pageHeading: PageHeading;
  tasks: Task[];
  homeFilter: string;
  setHomeFilter: (filter: string) => void;
  navigate: (page: PageKey, section?: string) => void;
  recentFiles?: WorkspaceFile[];
  filesError: boolean;
  retryFiles: () => void;
  setSelectedTask: (task: Task) => void;
  addTaskButton: AddTaskButton;
};

export function HomePage({
  columns,
  pageHeading,
  tasks,
  homeFilter,
  setHomeFilter,
  navigate,
  recentFiles,
  filesError,
  retryFiles,
  setSelectedTask,
  addTaskButton,
}: HomePageProps) {
  const tasksHeading = useRef<HTMLHeadingElement>(null);
  const assigned = tasks.filter(task => task.initials === 'AM');
  const dueSoon = tasks.filter(task => task.status !== 'Done' && previewWeek.has(task.due));
  const assignedDueSoon = dueSoon.filter(task => task.initials === 'AM').length;
  const inProgress = tasks.filter(task => task.status === 'In progress').length;
  const isAssignedView = homeFilter === homeFilters[0];
  const now = Date.now();
  const attention = assigned.filter(task => task.status !== 'Done' && (
    task.isBlocked || (task.dueAt && Date.parse(task.dueAt) < now)
  )).slice(0, 3);
  const shown = [...(isAssignedView ? assigned : homeFilter === homeFilters[1] ? dueSoon : tasks)]
    .sort((a, b) => Number(a.status === 'Done') - Number(b.status === 'Done') || dueOrder(a.due) - dueOrder(b.due));

  function showAssignedTasks() {
    setHomeFilter(homeFilters[0]);
    tasksHeading.current?.focus();
  }

  return <>
    {pageHeading(addTaskButton())}
    <div className="wu-stat-grid">
      <HomeMetric icon={<List size={18} />} label="Assigned to me" value={assigned.length} note={`${assignedDueSoon} due this week`} tone="blue" onClick={showAssignedTasks} />
      <HomeMetric icon={<LayoutGrid size={18} />} label="In progress" value={inProgress} note={`${inProgress} of 3 slots used`} tone="mint" />
      <HomeMetric icon={<Check size={18} />} label="In review" value={tasks.filter(task => task.status === 'Review').length} note="Awaiting review" tone="violet" onClick={() => navigate('board', 'board-review')} />
      <HomeMetric icon={<GitBranch size={18} />} label="Recent commits" value={12} note="Across 3 branches" tone="pink" />
    </div>
    <div className="wu-home-grid">
      <div className="wu-home-column">
      <Panel className="wu-home-tasks">
        <div className="wu-panel-heading"><h2 ref={tasksHeading} tabIndex={-1}>{isAssignedView ? 'My tasks' : 'Tasks'}</h2><button className="wu-text-button" type="button" onClick={() => navigate('board')}>View board <ArrowRight size={14} /></button></div>
        {isAssignedView && (
          <section className={attention.length ? 'wu-home-attention' : 'wu-home-attention wu-home-attention--clear'} aria-labelledby="home-attention-title">
            <h3 id="home-attention-title">Needs attention</h3>
            {attention.length ? <ul>
              {attention.map(task => (
                <li key={task.id}>
                  <button type="button" onClick={() => setSelectedTask(task)}>
                    <span>{task.title}</span>
                    <Pill tone="red">{task.isBlocked ? 'Blocked' : 'Overdue'}</Pill>
                  </button>
                </li>
              ))}
            </ul> : <p><Check size={16} aria-hidden="true" /> No blocked or overdue tasks.</p>}
          </section>
        )}
        <FilterChips items={homeFilters} active={homeFilter} onChange={setHomeFilter} />
        <div className="wu-home-task-list">
          {shown.map(task => <button className="wu-home-task" key={task.id} type="button" onClick={() => setSelectedTask(task)}>
            <span className="wu-home-task-name"><strong>{task.title}</strong><span className="wu-task-id">{task.id}</span></span>
            <Pill tone={statusTones[task.status]}>{task.status}</Pill>
            <span className="wu-home-task-date"><Clock3 size={13} aria-hidden="true" /><span className="wu-visually-hidden">Due </span>{task.due}</span>
          </button>)}
          {!shown.length && <p className="wu-home-empty" role="status">No tasks in this view.</p>}
        </div>
      </Panel>
      <Panel className="wu-home-repo"><div className="wu-panel-heading"><h2>GitHub repository</h2><button className="wu-text-button" type="button" onClick={() => navigate('github')}>Open GitHub <ArrowRight size={14} /></button></div><div className="wu-repo-line"><GitBranch size={17} /><strong>studio-north / storefront</strong><Pill tone="mint">Synced</Pill></div><p className="wu-muted">Default branch: main <span>·</span> Last sync today at 10:24</p></Panel>
      </div>
      <div className="wu-home-column">
      <WorkspaceProgress tasks={tasks} columns={columns} onOpenBoard={() => navigate('board')} />
      <Panel className="wu-home-activity"><div className="wu-panel-heading"><h2>Recent activity</h2><button className="wu-text-button" type="button" onClick={() => navigate('activity')}>View all <ArrowRight size={14} /></button></div><ActivityList compact /></Panel>
      <Panel className="wu-home-files">
        <div className="wu-panel-heading"><h2>Recent files</h2><button className="wu-text-button" type="button" onClick={() => navigate('files')}>View files <ArrowRight size={14} /></button></div>
        {filesError ? <p role="alert">Could not load files. <button className="wu-text-button" onClick={retryFiles}>Try again</button></p>
          : !recentFiles ? <LoadingPanel label="Loading recent files" />
          : recentFiles.length ? <ul className="wu-document-list">{recentFiles.slice(0, 3).map(file => <li key={file.id}>
              <button className="wu-document-select" type="button" onClick={() => navigate('files', 'file-' + file.id)}>
                <span><strong>{file.displayName}</strong><small>{fileSize(file.sizeBytes)}</small></span>
              </button>
            </li>)}</ul>
          : <p className="wu-muted">No files shared yet.</p>}
      </Panel>
      </div>
    </div>
  </>;
}
