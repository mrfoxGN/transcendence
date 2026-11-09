import { List, MoreHorizontal } from 'lucide-react';
import { EmptyState, FilterChips, Panel, TaskTable } from '../components';
import type { PageHeading, Task, AddTaskButton } from '../types';
import './backlog.css';

type BacklogPageProps = {
  pageHeading: PageHeading;
  filter: string;
  setFilter: (filter: string) => void;
  filteredTasks: Task[];
  setSelectedTask: (task: Task) => void;
  onAddTask: () => void;
  addTaskButton: AddTaskButton;
};

export function BacklogPage({
  pageHeading,
  filter,
  setFilter,
  filteredTasks,
  setSelectedTask,
  onAddTask,
  addTaskButton,
}: BacklogPageProps) {
  return <>{pageHeading(addTaskButton())}<div className="wu-filter-row"><FilterChips items={['All tasks', 'My tasks', 'Due this week', 'Blocked']} active={filter} onChange={setFilter} /><span className="wu-result-count">{filteredTasks.length} tasks</span></div>
    <Panel className="wu-content-panel"><div className="wu-panel-heading"><div><h2>Backlog</h2><p>Tasks waiting to be planned and picked up.</p></div><button className="wu-icon-button" type="button" aria-label="More backlog options"><MoreHorizontal size={18} /></button></div>
      {filteredTasks.length ? <TaskTable items={filteredTasks.filter(task => task.status !== 'Done')} onSelect={setSelectedTask} /> : <EmptyState icon={<List size={21} />} title="Your backlog is empty" detail="New work will appear here. Add a task to give your team a clear next step." action="Add a task" onAction={onAddTask} />}
    </Panel></>;
}
