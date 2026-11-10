import { List } from 'lucide-react';
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
  return <>{pageHeading(addTaskButton())}{facets}<div className="wu-filter-row"><FilterChips items={['All tasks', 'My tasks', 'Due this week', 'Blocked']} active={filter} onChange={setFilter} /><span className="wu-result-count">{backlogTasks.length} tasks</span></div>
    <Panel className="wu-content-panel"><div className="wu-panel-heading"><div><h2>Backlog</h2><p>Tasks waiting to be planned and picked up.</p></div></div>
      {backlogTasks.length ? <TaskTable items={backlogTasks} onSelect={setSelectedTask} /> : <EmptyState icon={<List size={21} />} title="No matching tasks" detail="Change the filters or add a task to your backlog." action="Add a task" onAction={onAddTask} />}
    </Panel></>;
}
