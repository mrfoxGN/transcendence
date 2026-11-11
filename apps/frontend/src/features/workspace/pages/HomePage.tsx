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
  const dueSoon = tasks.filter(task => isDueInNextSevenDays(task, today, nextSevenDaysEnd));
  const assignedDueSoon = dueSoon.filter(task => task.assigneeId === profileId).length;
  const inProgress = tasks.filter(task => task.status === 'In progress').length;
  const isAssignedView = homeFilter === homeFilters[0];
  const attention = assigned.filter(task => task.isBlocked || isOverdue(task, today)).slice(0, 3);
  const shown = [...(isAssignedView ? assigned : homeFilter === homeFilters[1] ? dueSoon : tasks)]
    .sort((a, b) => Number(isOpenTask(b)) - Number(isOpenTask(a)) || (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99'));

  function showAssignedTasks() {
    setHomeFilter(homeFilters[0]);
    tasksHeading.current?.focus();
  }

  return <>
    {pageHeading(addTaskButton())}
    <div className="wu-stat-grid">
      <MetricCard icon={<workspaceIcons.backlog size={19} />} label="Assigned to me" value={assigned.length} note={`${assignedDueSoon} due in the next 7 days`} tone="blue" onClick={showAssignedTasks} />
      <MetricCard icon={<workspaceIcons.board size={19} />} label="In progress" value={inProgress} note="Tasks underway" tone="mint" />
      <MetricCard icon={<ScanEye size={19} />} label="In review" value={tasks.filter(task => task.status === 'Review').length} note="Awaiting review" tone="violet" onClick={() => navigate('board', 'board-review')} />
      {github?.commitCount !== undefined
        ? <MetricCard icon={<workspaceIcons.github size={19} />} label="Synced commits" value={github.commitCount} note={github.branch} tone="pink" onClick={() => navigate('github')} />
        : <MetricCard icon={<CheckCircle2 size={19} />} label="Completed" value={tasks.filter(task => task.status === 'Done').length} note="Tasks finished" tone="pink" />}
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
            <span className="wu-home-task-name"><strong>{task.title}</strong></span>
            <Pill tone={statusTones[task.status]}>{task.status}</Pill>
            <span className="wu-home-task-date"><Clock3 size={13} aria-hidden="true" /><span className="wu-visually-hidden">Due </span>{task.due}</span>
          </button>)}
          {!shown.length && <p className="wu-home-empty" role="status">No tasks in this view.</p>}
        </div>
      </Panel>
      <Panel className="wu-home-repo">
        <div className="wu-panel-heading"><h2>GitHub repository</h2><button className="wu-text-button" type="button" onClick={() => navigate('github')}>Open GitHub <ArrowRight size={14} /></button></div>
        {githubError && <p role="alert">Could not load GitHub details. <button type="button" className="wu-text-button" onClick={() => { setGithubError(false); setGithubAttempt(value => value + 1); }}>Try again</button></p>}
        {github ? <><div className="wu-repo-line"><workspaceIcons.github size={17} /><strong>{github.name}</strong></div>
          <p className="wu-muted">{github.branch} · {github.lastSyncedAt ? 'Last synced ' + new Date(github.lastSyncedAt).toLocaleString() : 'No commits synced yet'}</p></>
          : github === null ? <p className="wu-muted">No repository connected.</p> : !githubError && <LoadingPanel label="Loading GitHub repository" />}
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
