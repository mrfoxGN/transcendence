import { WorkspaceIllustration } from '../WorkspaceIllustration';
import { EmptyState, FilterChips, Panel, TaskTable } from '../components';
import type { ReactNode } from 'react';
import type { PageHeading, Task, AddTaskButton } from '../types';
import './backlog.css';

type BacklogPageProps = {
  pageHeading: PageHeading;
  facets: ReactNode;
  filter: string;
  setFilter: (filter: string) => void;
  filteredTasks: Task[];
  setSelectedTask: (task: Task) => void;
  onAddTask: () => void;
  addTaskButton: AddTaskButton;
};

export function BacklogPage({
  pageHeading,
  facets,
  filter,
  setFilter,
  filteredTasks,
  setSelectedTask,
  onAddTask,
  addTaskButton,
}: BacklogPageProps) {
  const backlogTasks = filteredTasks.filter(task => task.status === 'To do' || task.status === 'Ready');
  return <>{pageHeading(addTaskButton())}<div className="wu-task-toolbar"><FilterChips items={['All tasks', 'My tasks', 'Next 7 days', 'Blocked']} active={filter} onChange={setFilter} />{facets}<span className="wu-task-toolbar-counts">{backlogTasks.length} tasks</span></div>
    <Panel className="wu-content-panel"><div className="wu-panel-heading"><div><h2>Backlog</h2><p>Tasks waiting to be planned and picked up.</p></div></div>
      {backlogTasks.length ? <TaskTable items={backlogTasks} onSelect={setSelectedTask} /> : <EmptyState icon={<WorkspaceIllustration kind="checklist" />} title="No matching tasks" detail="Change the filters or add a task to your backlog." action="Add a task" onAction={onAddTask} />}
    </Panel></>;
}
