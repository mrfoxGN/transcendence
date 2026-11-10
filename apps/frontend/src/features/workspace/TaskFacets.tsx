import { useId, useRef } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { dueThisWeek } from './workspace-tasks';
import type { Task } from './types';

type Facets = { assignee: string; priority: string; due: string };
export const emptyFacets: Facets = { assignee: '', priority: '', due: '' };

export function matchesTaskFacets(task: Task, value: Facets) {
  const due = task.dueAt ? new Date(task.dueAt).getTime() : NaN;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (!value.assignee || task.person === value.assignee)
    && (!value.priority || task.priority === value.priority)
    && (value.due === '' || (
      value.due === 'Overdue' ? !['Done', 'Cancelled'].includes(task.status) && due < today.getTime()
      : value.due === 'Due this week' ? dueThisWeek(task)
      : !task.dueAt
    ));
}

export function TaskFacets({ tasks, value, onChange }: { tasks: Task[]; value: Facets; onChange: (value: Facets) => void }) {
  const id = useId();
  const popover = useRef<HTMLDivElement>(null);
  const facets = [
    { key: 'assignee', label: 'Assignee', options: [...new Set(tasks.map(task => task.person).filter(Boolean))].sort() },
    { key: 'priority', label: 'Priority', options: [...new Set(tasks.map(task => task.priority).filter(Boolean))].sort() },
    { key: 'due', label: 'Due date', options: ['Due this week', 'Overdue', 'No due date'] },
  ] as const;
  const applied = facets.filter(({ key }) => value[key]);
  return <>
    <button className="wu-button wu-button--secondary" type="button" popoverTarget={id} onClick={event => {
      const anchor = event.currentTarget.getBoundingClientRect();
      if (!popover.current) return;
      popover.current.style.left = Math.max(8, Math.min(anchor.left, window.innerWidth - 288)) + 'px';
      popover.current.style.top = Math.min(anchor.bottom + 6, Math.max(8, window.innerHeight - 288)) + 'px';
    }}><SlidersHorizontal size={16} aria-hidden="true" />Filter{applied.length > 0 && ' (' + applied.length + ')'}</button>
    {applied.map(({ key, label }) => <button key={key} type="button" className="wu-task-filter-tag"
      aria-label={`Remove ${label} filter: ${value[key]}`} onClick={() => onChange({ ...value, [key]: '' })}>
      {value[key]} <X size={13} aria-hidden="true" />
    </button>)}
    <div ref={popover} id={id} popover="auto" className="wu-task-facets wu-task-filter-popover" role="group" aria-label="Filter tasks">
    {facets.map(({ key, label, options }) => <label key={key}>{label}
      <select className="wu-select" value={value[key]} onChange={event => onChange({ ...value, [key]: event.target.value })}>
        <option value="">Any</option>
        {options.map(option => <option key={option}>{option}</option>)}
      </select>
    </label>)}
    {Object.values(value).some(Boolean) && <button type="button" className="wu-button wu-button--secondary" onClick={() => onChange(emptyFacets)}>Clear filters</button>}
    </div>
  </>;
}
