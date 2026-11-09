import { useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Avatar, FilterChips, Pill } from '../components';
import { taskStatuses } from '../previewData';
import type { PageHeading, Task, AddTaskButton } from '../types';
import './board.css';

type BoardPageProps = {
  pageHeading: PageHeading;
  filter: string;
  setFilter: (filter: string) => void;
  filteredTasks: Task[];
  setSelectedTask: (task: Task) => void;
  onAddTask: () => void;
  addTaskButton: AddTaskButton;
};

export function BoardPage({
  pageHeading,
  filter,
  setFilter,
  filteredTasks,
  setSelectedTask,
  onAddTask,
  addTaskButton,
}: BoardPageProps) {
  useEffect(() => {
    if (window.location.hash === '#board-review') {
      const review = document.getElementById('board-review');
      review?.focus({ preventScroll: true });
      review?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, []);

  return <>{pageHeading(addTaskButton('Add task'))}<div className="wu-filter-row"><FilterChips items={['All tasks', 'My tasks', 'Due this week', 'Blocked']} active={filter} onChange={setFilter} /></div><div className="wu-board-grid">
    {taskStatuses.map((status, index) => {
      const columnTasks = filteredTasks.filter(task => task.status === status);
      return <section key={status} className={`wu-board-column wu-board-column--${['neutral', 'blue', 'violet', 'pink', 'mint'][index]}`}><div className="wu-column-head"><h2 id={status === 'Review' ? 'board-review' : undefined} tabIndex={status === 'Review' ? -1 : undefined}><i />{status}</h2><Pill>{status === 'In progress' ? `${columnTasks.length} / 3` : columnTasks.length}</Pill></div>{columnTasks.map(task => <button className="wu-task-card" type="button" key={task.id} onClick={() => setSelectedTask(task)}><span className="wu-task-id">{task.id}</span><strong>{task.title}</strong><Pill>{task.type}</Pill><div className="wu-task-card-foot"><Avatar initials={task.initials} small /><span>{task.due}</span></div></button>)}<button className="wu-add-card" type="button" onClick={onAddTask}><Plus size={14} /> Add task</button></section>;
    })}</div></>;
}
