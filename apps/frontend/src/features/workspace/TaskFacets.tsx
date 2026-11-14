import { previewWeek } from './previewData';
import type { Task } from './types';

type Facets = { assignee: string; priority: string; due: string };
export const emptyFacets: Facets = { assignee: '', priority: '', due: '' };

export function matchesTaskFacets(task: Task, value: Facets) {
  const due = task.dueAt ? new Date(task.dueAt).getTime() : NaN;
  const now = Date.now();
  return (!value.assignee || task.person === value.assignee)
    && (!value.priority || task.priority === value.priority)
    && (value.due === '' || (
      value.due === 'Overdue' ? task.status !== 'Done' && due < now
      : value.due === 'Due this week' ? (task.dueAt ? due >= now && due <= now + 7 * 86400000 : previewWeek.has(task.due))
      : !task.dueAt && !task.due
    ));
}

export function TaskFacets({ tasks, value, onChange }: { tasks: Task[]; value: Facets; onChange: (value: Facets) => void }) {
  const facets = [
    { key: 'assignee', label: 'Assignee', options: [...new Set(tasks.map(task => task.person).filter(Boolean))].sort() },
    { key: 'priority', label: 'Priority', options: [...new Set(tasks.map(task => task.priority).filter(Boolean))].sort() },
    { key: 'due', label: 'Due date', options: ['Due this week', 'Overdue', 'No due date'] },
  ] as const;
  return <div className="wu-task-facets" role="group" aria-label="Filter tasks">
    {facets.map(({ key, label, options }) => <label key={key}>{label}
      <select className="wu-select" value={value[key]} onChange={event => onChange({ ...value, [key]: event.target.value })}>
        <option value="">Any</option>
        {options.map(option => <option key={option}>{option}</option>)}
      </select>
    </label>)}
    {Object.values(value).some(Boolean) && <button type="button" className="wu-button wu-button--secondary" onClick={() => onChange(emptyFacets)}>Clear filters</button>}
  </div>;
}
