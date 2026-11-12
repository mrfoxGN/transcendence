import { useEffect, useRef, useState } from 'react';
import { MetricCard } from '../MetricCard';
import { ArrowRight, Check, CheckCircle2, Clock3, ScanEye } from 'lucide-react';
import { workspaceIcons } from '../workspace-icons';
import { FilterChips, Panel, Pill } from '../components';
import { homeFilters, statusTones } from '../previewData';
import type { Member } from '../workspace-tasks';
import { addCalendarDays, isDueInNextSevenDays, isOpenTask, isOverdue } from '../workspace-calendar';
import { WorkspaceActivityList, type ActivityEvent } from './ActivityPage';
import type { PageHeading, Task, PageKey, AddTaskButton } from '../types';
import { WorkspaceProgress } from './WorkspaceProgress';
import { LoadingPanel } from '../WorkspaceControls';
import { fileSize, workspaceRequest, WorkspaceRequestError, type WorkspaceFile } from '../workspace-api';
import './home.css';

const attentionView = 'Needs attention';
const priorityOrder: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

function attentionSeverity(task: Task, today: string) {
  return Number(!!task.isBlocked) * 2 + Number(isOverdue(task, today));
}

function attentionReason(task: Task, today: string) {
  return ['', 'Overdue', 'Blocked', 'Blocked and overdue'][attentionSeverity(task, today)];
}

function compareDueDates(a: Task, b: Task) {
  return (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99');
}

type HomePageProps = {
  columns: string[];
  pageHeading: PageHeading;
  tasks: Task[];
  today: string;
  profileId: string;
  members: Member[];
  recentActivity: { items?: ActivityEvent[]; error: boolean; retry: () => void };
  openActivityResource: (event: ActivityEvent) => boolean;
  githubPath: string;
  token: string | null;
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
  today,
  profileId,
  members,
  recentActivity,
  openActivityResource,
  githubPath,
  token,
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
  const [github, setGithub] = useState<{ name: string; branch: string; lastSyncedAt: string | null; commitCount?: number } | null>();
  const [githubError, setGithubError] = useState(false);
  const [githubAttempt, setGithubAttempt] = useState(0);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    void workspaceRequest(githubPath + '/repository', token, options)
      .then(response => response.json())
      .then(async repository => {
        const info = { name: repository.fullName, branch: repository.defaultBranch, lastSyncedAt: repository.lastSyncedAt };
        if (!controller.signal.aborted) setGithub(info);
        const response = await workspaceRequest(githubPath + '/commits?limit=1', token, options);
        const result = await response.json() as { total: number };
        if (!controller.signal.aborted) setGithub({ ...info, commitCount: result.total });
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        if (error instanceof WorkspaceRequestError && error.status === 404) setGithub(null);
        else setGithubError(true);
      });
    return () => controller.abort();
  }, [githubPath, token, githubAttempt]);
  const assigned = tasks.filter(task => isOpenTask(task) && task.assigneeId === profileId);
  const nextSevenDaysEnd = addCalendarDays(today, 7);
  const assignedDueSoon = assigned.filter(task => isDueInNextSevenDays(task, today, nextSevenDaysEnd));
  const workspaceMetrics = ([
    { label: 'In progress', status: 'In progress', note: 'Tasks underway', tone: 'mint', icon: <workspaceIcons.board size={19} /> },
    { label: 'In review', status: 'Review', note: 'Awaiting review', tone: 'violet', icon: <ScanEye size={19} /> },
    { label: 'Completed', status: 'Done', note: 'Tasks finished', tone: 'pink', icon: <CheckCircle2 size={19} /> },
  ] as const).map(metric => ({ ...metric, tasks: tasks.filter(task => task.status === metric.status) }));
  const isAssignedView = homeFilter === homeFilters[0];
  const isAttentionView = homeFilter === attentionView;
  const activeMetric = workspaceMetrics.find(metric => metric.label === homeFilter);
  const attention = assigned.filter(task => attentionSeverity(task, today) > 0)
    .sort((a, b) => attentionSeverity(b, today) - attentionSeverity(a, today)
      || (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4)
      || compareDueDates(a, b)
      || a.id.localeCompare(b.id));
  const shown = isAttentionView ? attention : [
    ...(activeMetric?.tasks ?? (isAssignedView ? assigned : homeFilter === homeFilters[1] ? assignedDueSoon : tasks)),
  ].sort((a, b) => Number(isOpenTask(b)) - Number(isOpenTask(a)) || compareDueDates(a, b));
  const listFilters = activeMetric || isAttentionView ? [...homeFilters, homeFilter] : homeFilters;
  const heading = activeMetric?.label ?? (isAttentionView ? attentionView : homeFilter === homeFilters[2] ? 'Workspace tasks' : 'My tasks');

  function showTasks(filter: string) {
    setHomeFilter(filter);
    tasksHeading.current?.focus();
  }

  return <>
    {pageHeading(addTaskButton())}
    <div className="wu-home-metrics">
      <section aria-labelledby="home-personal-metrics">
        <h2 id="home-personal-metrics">My work</h2>
        <MetricCard icon={<workspaceIcons.backlog size={19} />} label="Assigned to me" value={assigned.length} note={`${assignedDueSoon.length} due in the next 7 days`} tone="blue" onClick={() => showTasks(homeFilters[0])} />
      </section>
      <section aria-labelledby="home-workspace-metrics">
        <h2 id="home-workspace-metrics">Workspace overview</h2>
        <div className="wu-home-workspace-metrics">
          {workspaceMetrics.map(metric => <MetricCard key={metric.status} icon={metric.icon} label={metric.label}
            value={metric.tasks.length} note={metric.note} tone={metric.tone} onClick={() => showTasks(metric.label)} />)}
        </div>
      </section>
    </div>
    <div className="wu-home-grid">
      <div className="wu-home-column">
      <Panel className="wu-home-tasks">
        <div className="wu-panel-heading"><h2 ref={tasksHeading} tabIndex={-1}>{heading}</h2><button className="wu-text-button" type="button" onClick={() => navigate('board')}>View board <ArrowRight size={14} /></button></div>
        {isAssignedView && assigned.length > 0 && (
          <section className={attention.length ? 'wu-home-attention' : 'wu-home-attention wu-home-attention--clear'} aria-labelledby="home-attention-title">
            <div className="wu-home-attention-heading">
              <h3 id="home-attention-title">Needs attention</h3>
              {attention.length > 0 && <button className="wu-text-button" type="button" onClick={() => showTasks(attentionView)}>View all ({attention.length})</button>}
            </div>
            {attention.length ? <ul>
              {attention.slice(0, 3).map(task => (
                <li key={task.id}>
                  <button type="button" onClick={() => setSelectedTask(task)}>
                    <span>{task.title}</span>
                    <Pill tone="red">{attentionReason(task, today)}</Pill>
                  </button>
                </li>
              ))}
            </ul> : <p><Check size={16} aria-hidden="true" /> No blocked or overdue tasks.</p>}
          </section>
        )}
        <FilterChips items={listFilters} active={homeFilter} onChange={setHomeFilter} />
        <div className="wu-home-task-list">
          {shown.map(task => <button className="wu-home-task" key={task.id} type="button" onClick={() => setSelectedTask(task)}>
            <span className="wu-home-task-name"><strong>{task.title}</strong>{isAttentionView && <small className="wu-muted">{attentionReason(task, today)}</small>}</span>
            <Pill tone={statusTones[task.status]}>{task.status}</Pill>
            <span className="wu-home-task-date"><Clock3 size={13} aria-hidden="true" /><span className="wu-visually-hidden">Due </span>{task.due}</span>
          </button>)}
          {!shown.length && <div className="wu-home-empty">
            <p role="status">{!tasks.length ? 'This workspace has no tasks yet.' : isAssignedView ? 'You have no assigned tasks.' : 'No tasks in this view.'}</p>
            {!tasks.length ? addTaskButton('Create your first task')
              : isAssignedView && <button className="wu-text-button" type="button" onClick={() => showTasks(homeFilters[2])}>Browse workspace tasks</button>}
          </div>}
        </div>
      </Panel>
      <Panel className="wu-home-repo">
        <div className="wu-panel-heading"><h2>GitHub repository</h2><button className="wu-text-button" type="button" onClick={() => navigate('github')}>Open GitHub <ArrowRight size={14} /></button></div>
        {githubError && <p role="alert">Could not load GitHub details. <button type="button" className="wu-text-button" onClick={() => { setGithubError(false); setGithubAttempt(value => value + 1); }}>Try again</button></p>}
        {github ? <><div className="wu-repo-line"><workspaceIcons.github size={17} /><strong>{github.name}</strong></div>
          <p className="wu-muted">{github.branch} · {github.lastSyncedAt ? 'Last synced ' + new Date(github.lastSyncedAt).toLocaleString() : 'No commits synced yet'}</p></>
          : github === null ? <p className="wu-muted">No repository connected.</p> : !githubError && <LoadingPanel label="Loading GitHub repository" />}
        {github?.commitCount !== undefined && <p className="wu-muted">{github.commitCount} {github.commitCount === 1 ? 'commit' : 'commits'} synced</p>}
      </Panel>
      </div>
      <div className="wu-home-column">
      <WorkspaceProgress tasks={tasks} columns={columns} onOpenBoard={() => navigate('board')} />
      <Panel className="wu-home-activity"><div className="wu-panel-heading"><h2>Recent activity</h2><button className="wu-text-button" type="button" onClick={() => navigate('activity')}>View all <ArrowRight size={14} /></button></div>
        {recentActivity.error ? <p role="alert">Could not load activity. <button type="button" className="wu-text-button" onClick={recentActivity.retry}>Try again</button></p>
          : !recentActivity.items ? <LoadingPanel label="Loading recent activity" />
          : <WorkspaceActivityList items={recentActivity.items} members={members} openResource={openActivityResource} />}
      </Panel>
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
