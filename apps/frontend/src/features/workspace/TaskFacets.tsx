import { useId, useRef } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { isDueInNextSevenDays, isOverdue, nextSevenDaysLabel } from './workspace-calendar';
import type { Task } from './types';

export type Facets = { assignee: string; priority: string; due: string };
export const emptyFacets: Facets = { assignee: '', priority: '', due: '' };

export function matchesTaskFacets(task: Task, value: Facets, today: string, end: string) {
  return (!value.assignee || (value.assignee === 'unassigned' ? !task.assigneeId : task.assigneeId === value.assignee))
    && (!value.priority || task.priority === value.priority)
    && (value.due === '' || (
      value.due === 'Overdue' ? isOverdue(task, today)
      : value.due === nextSevenDaysLabel ? isDueInNextSevenDays(task, today, end)
      : !task.dueDate
    ));
}

export function TaskFacets({ tasks, value, onChange }: { tasks: Task[]; value: Facets; onChange: (value: Facets) => void }) {
  const id = useId();
  const popover = useRef<HTMLDivElement>(null);
  const people = [...new Map(tasks.flatMap(task => task.assigneeId ? [[task.assigneeId, task.person] as const] : [])).entries()];
  const asOptions = (labels: string[]) => labels.map(label => ({ value: label, label }));
  const facets = [
    { key: 'assignee', label: 'Assignee', options: [
      { value: 'unassigned', label: 'Unassigned' },
      ...people.map(([id, name]) => ({ value: id, label: people.some(([otherId, otherName]) => id !== otherId && name === otherName) ? name + ' (' + id.slice(-8) + ')' : name })),
    ] },
    { key: 'priority', label: 'Priority', options: asOptions([...new Set(tasks.map(task => task.priority).filter(Boolean))].sort()) },
    { key: 'due', label: 'Due date', options: asOptions([nextSevenDaysLabel, 'Overdue', 'No due date']) },
  ] as const;
  const applied = facets.filter(({ key }) => value[key]);
  return <>
    <button className="wu-button wu-button--secondary" type="button" popoverTarget={id} onClick={event => {
      const anchor = event.currentTarget.getBoundingClientRect();
      if (!popover.current) return;
      popover.current.style.left = Math.max(8, Math.min(anchor.left, window.innerWidth - 288)) + 'px';
      popover.current.style.top = Math.min(anchor.bottom + 6, Math.max(8, window.innerHeight - 288)) + 'px';
    }}><SlidersHorizontal size={16} aria-hidden="true" />Filter{applied.length > 0 && ' (' + applied.length + ')'}</button>
    {applied.map(({ key, label, options }) => {
      const selected = options.find(option => option.value === value[key])?.label ?? label;
      return <button key={key} type="button" className="wu-task-filter-tag"
        aria-label={`Remove ${label} filter: ${selected}`} onClick={() => onChange({ ...value, [key]: '' })}>
        {selected} <X size={13} aria-hidden="true" />
      </button>;
    })}
    <div ref={popover} id={id} popover="auto" className="wu-task-facets wu-task-filter-popover" role="group" aria-label="Filter tasks">
    {facets.map(({ key, label, options }) => <label key={key}>{label}
      <select className="wu-select" value={value[key]} onChange={event => onChange({ ...value, [key]: event.target.value })}>
        <option value="">Any</option>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>)}
    {Object.values(value).some(Boolean) && <button type="button" className="wu-button wu-button--secondary" onClick={() => onChange(emptyFacets)}>Clear filters</button>}
    </div>
  </>;
}
