import { TaskDistribution } from '../../../shared/charts/TaskDistribution';
import { IllustratedEmptyState } from '../../../shared/illustrations/EmptyIllustration';
import { useRef } from 'react';
import { ArrowRight, Clock3 } from 'lucide-react';
import { Avatar, FilterChips, Panel, Pill } from '../components';
import { homeFilters, statusTones } from '../previewData';
import type { Member } from '../workspace-tasks';
import type { Project } from '../workspace-projects';
import { addCalendarDays, isDueInNextSevenDays, isOpenTask, isOverdue } from '../workspace-calendar';
import { WorkspaceActivityList, type ActivityEvent } from './ActivityPage';
import type { PageHeading, Task, PageKey, AddTaskButton } from '../types';
import { WorkspaceProgress } from './WorkspaceProgress';
import { HomePinnedProjects } from './HomePinnedProjects';
import { LoadingPanel } from '../WorkspaceControls';
import { fileSize, type WorkspaceFile } from '../workspace-api';
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
  reportingTimeZone: string;
  profileId: string;
  members: Member[];
  projects?: Project[];
  recentActivity: { items?: ActivityEvent[]; error: boolean; retry: () => void };
  openActivityResource: (event: ActivityEvent) => boolean;
  workspaceId: string;
  projectsError: boolean;
  retryProjects: () => void;
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
  reportingTimeZone,
  profileId,
  members,
  projects,
  recentActivity,
  openActivityResource,
  workspaceId,
  projectsError,
  retryProjects,
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
  const taskProjects = new Map<string, string[]>();
  for (const project of projects ?? []) for (const task of project.tasks) {
    taskProjects.set(task.id, [...(taskProjects.get(task.id) ?? []), project.name]);
  }
  const assigned = tasks.filter(task => isOpenTask(task) && task.assigneeId === profileId);
  const nextSevenDaysEnd = addCalendarDays(today, 7);
  const assignedDueSoon = assigned.filter(task => isDueInNextSevenDays(task, today, nextSevenDaysEnd));
  const workspaceMetrics = [
    { label: 'In progress', status: 'In progress' },
    { label: 'In review', status: 'Review' },
    { label: 'Completed', status: 'Done' },
  ].map(metric => ({ ...metric, tasks: tasks.filter(task => task.status === metric.status) }));
  const isAssignedView = homeFilter === homeFilters[0];
  const isAttentionView = homeFilter === attentionView;
  const isOverdueView = homeFilter === 'Overdue';
  const assignedOverdue = assigned.filter(task => isOverdue(task, today));
  const activeMetric = workspaceMetrics.find(metric => metric.label === homeFilter);
  const attention = assigned.filter(task => attentionSeverity(task, today) > 0)
    .sort((a, b) => attentionSeverity(b, today) - attentionSeverity(a, today)
      || (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4)
      || compareDueDates(a, b)
      || a.id.localeCompare(b.id));
  const shown = isAttentionView ? attention : isOverdueView ? assignedOverdue : [
    ...(activeMetric?.tasks ?? (isAssignedView ? assigned : homeFilter === homeFilters[1] ? assignedDueSoon : tasks)),
  ].sort((a, b) => Number(isOpenTask(b)) - Number(isOpenTask(a)) || compareDueDates(a, b));
  const listFilters = activeMetric || isAttentionView || isOverdueView ? [...homeFilters, homeFilter] : homeFilters;
  const heading = activeMetric?.label ?? (isAttentionView ? attentionView : isOverdueView ? 'Overdue tasks' : homeFilter === homeFilters[2] ? 'Workspace tasks' : 'My tasks');

  function showTasks(filter: string) {
    setHomeFilter(filter);
    tasksHeading.current?.focus();
  }

  return <>
    {attention.length > 0 && <section className="wu-home-attention-banner" aria-labelledby="home-attention-title">
      <strong id="home-attention-title">Needs attention</strong>
      <button className="wu-attention-task" type="button" onClick={() => setSelectedTask(attention[0])}>
        <span>{attention[0].title}</span><small>{attentionReason(attention[0], today)}</small>
      </button>
      <button className="wu-text-button" type="button" onClick={() => showTasks(attentionView)}>View all ({attention.length})</button>
    </section>}
    {pageHeading(addTaskButton())}
    <div className="wu-home-summary">
      <Panel className="wu-home-personal-summary">
        <div className="wu-panel-heading"><h2>My work</h2><button className="wu-text-button" type="button" onClick={() => showTasks(homeFilters[0])}>View tasks</button></div>
        <div className="wu-home-personal-value"><strong>{assigned.length}</strong><span>Assigned to me</span></div>
        <div className="wu-home-personal-details">
          <button type="button" onClick={() => showTasks(homeFilters[1])}><span>Due in 7 days</span><strong>{assignedDueSoon.length}</strong></button>
          <button type="button" onClick={() => showTasks('Overdue')}><span>Overdue</span><strong>{assignedOverdue.length}</strong></button>
        </div>
      </Panel>
      <WorkspaceProgress tasks={tasks} columns={columns} compact onOpenBoard={() => navigate('board')} />
      <TaskDistribution tasks={tasks} onOpenBoard={() => navigate('board')} />
    </div>
    <HomePinnedProjects key={workspaceId+':'+profileId} projects={projects} failed={projectsError} retry={retryProjects} workspaceId={workspaceId} profileId={profileId} tasks={tasks} members={members}
      onOpen={id=>navigate('projects','project-'+id)} onBrowse={()=>navigate('projects')}/>
    <div className="wu-home-grid">
      <div className="wu-home-column">
      <Panel className="wu-home-tasks">
        <div className="wu-panel-heading"><h2 ref={tasksHeading} tabIndex={-1}>{heading}</h2><button className="wu-text-button" type="button" onClick={() => navigate('board')}>View board <ArrowRight size={14} /></button></div>
        <FilterChips items={listFilters} active={homeFilter} onChange={setHomeFilter} />
        <div className="wu-home-task-list">
          {shown.length > 0 && <div className="wu-home-task-columns" aria-hidden="true"><span>Task</span><span>Status</span><span>Assignee</span><span>Due date</span></div>}
          {shown.map(task => <button className="wu-home-task" key={task.id} type="button" onClick={() => setSelectedTask(task)}>
            <span className="wu-home-task-name"><strong>{task.title}</strong>
              {(task.taskKey || taskProjects.has(task.id)) && <small className="wu-home-task-context">{[task.taskKey, taskProjects.get(task.id)?.join(', ')].filter(Boolean).join(' · ')}</small>}
              {isAttentionView && <small className="wu-muted">{attentionReason(task, today)}</small>}
            </span>
            <Pill tone={statusTones[task.status]}>{task.status}</Pill>
            <span className="wu-home-task-assignee" title={task.person || 'Unassigned'}>
              {task.assigneeId ? <span aria-hidden="true"><Avatar initials={task.initials} small preview={false} /></span> : <span aria-hidden="true">—</span>}
              <span className="wu-visually-hidden">{task.assigneeId ? 'Assigned to ' + task.person : 'Unassigned'}</span>
            </span>
            <span className={'wu-home-task-date' + (isOverdue(task, today) ? ' is-overdue' : '')}><Clock3 size={13} aria-hidden="true" /><span className="wu-visually-hidden">Due </span>{task.due}</span>
          </button>)}
          {!shown.length && <div className="wu-home-empty">
            <IllustratedEmptyState compact kind="tasks" title={!tasks.length ? 'No tasks yet' : isAssignedView ? 'No assigned tasks' : 'No tasks in this view'} detail="Create a task to start planning with your team." />
            {!tasks.length ? addTaskButton('Create your first task')
              : isAssignedView && <button className="wu-text-button" type="button" onClick={() => showTasks(homeFilters[2])}>Browse workspace tasks</button>}
          </div>}
        </div>
      </Panel>

      </div>
      <div className="wu-home-column">
      <Panel className="wu-home-activity"><div className="wu-panel-heading"><h2>Recent activity</h2><button className="wu-text-button" type="button" onClick={() => navigate('activity')}>View all <ArrowRight size={14} /></button></div>
        {recentActivity.error ? <p role="alert">Could not load activity. <button type="button" className="wu-text-button" onClick={recentActivity.retry}>Try again</button></p>
          : !recentActivity.items ? <LoadingPanel label="Loading recent activity" />
          : <WorkspaceActivityList home today={today} timeZone={reportingTimeZone} items={recentActivity.items} members={members} openResource={openActivityResource} />}
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
          : <IllustratedEmptyState compact kind="files" title="No files shared yet" detail="Upload a document from the Files page." />}
      </Panel>
      </div>
    </div>
  </>;
}
