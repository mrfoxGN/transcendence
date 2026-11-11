import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, pointerWithin,
  useDraggable, useDroppable, useSensor, useSensors,
  type CollisionDetection, type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { CalendarDays, GripVertical, Keyboard, Plus } from 'lucide-react';
import { Avatar, FilterChips, Pill } from '../components';
import { ActionMenu, Drawer } from '../WorkspaceControls';
import { finishInputEdit, saveTextOnBlur } from '../autosave';
import type { PageHeading, Task, AddTaskButton } from '../types';
import { canTransition, statusLabels, taskBoardColumn, type BoardColumnConfig } from '../workspace-tasks';
import './board.css';

const findColumn: CollisionDetection = args => {
  const from = args.active.data.current?.status;
  const valid = { ...args, droppableContainers: args.droppableContainers.filter(target => {
    const status = target.data.current?.status;
    return status === from || canTransition(from, status);
  }) };
  return args.pointerCoordinates ? pointerWithin(valid) : closestCenter(valid);
};

const keyboardColumnCoordinates = (columns: BoardColumnConfig[]): KeyboardCoordinateGetter => (event, { context, currentCoordinates }) => {
  const step = event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0;
  if (!step || !context.collisionRect) return;
  event.preventDefault();
  const from = context.active?.data.current?.status;
  const currentColumn = context.over?.id ?? context.active?.data.current?.columnId;
  const targets = columns.filter(column => statusLabels[column.status] === from || canTransition(from, statusLabels[column.status])).map(column => column.id);
  const index = targets.findIndex(status => status === currentColumn);
  if (index < 0) return;
  const target = context.droppableRects.get(targets[index + step]);
  if (!target) return;
  const { collisionRect } = context;
  return {
    x: currentCoordinates.x + target.left + target.width / 2 - collisionRect.left - collisionRect.width / 2,
    y: currentCoordinates.y + target.top + target.height / 2 - collisionRect.top - collisionRect.height / 2,
  };
};

type BoardPageProps = {
  pageHeading: PageHeading;
  facets: ReactNode;
  filter: string;
  setFilter: (filter: string) => void;
  filteredTasks: Task[];
  columns: BoardColumnConfig[];
  allTasks: Task[];
  canManage: boolean;
  savingColumns: boolean;
  error: string;
  saveColumns: (columns: BoardColumnConfig[]) => Promise<boolean>;
  activeCount: number;
  activeWipLimit: number;
  onMoveTask: (id: string, column: BoardColumnConfig) => void;
  setSelectedTask: (task: Task) => void;
  onAddTask: (column: BoardColumnConfig) => void;
  addTaskButton: AddTaskButton;
};

function TaskCardContent({ task }: { task: Task }) {
  return <>
    <strong>{task.title}</strong>
    <span className="wu-board-card-tags">
      {task.priority !== 'None' && <Pill tone={task.priority === 'High' ? 'orange' : 'neutral'}>{task.priority} priority</Pill>}
      {task.isBlocked && <Pill tone="red">Blocked</Pill>}
    </span>
    <span className="wu-task-card-foot">
      <span>{task.assigneeId && <Avatar initials={task.initials} small preview={false} />}{task.person}</span>
      {task.dueDate && <span><CalendarDays size={14} aria-hidden="true" />{task.due}</span>}
    </span>
  </>;
}

function DraggableTask({ task, onOpen, columnId }: { task: Task; onOpen: () => void; columnId: string }) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: task.id, data: { status: task.status, columnId },
  });
  return (
    <div ref={setNodeRef} className="wu-board-card-slot" data-dragging={isDragging}>
      <button className="wu-task-card" type="button" onPointerDown={(event) => listeners?.onPointerDown?.(event)} onClick={onOpen}><TaskCardContent task={task} /></button>
      <button ref={setActivatorNodeRef} type="button" className="wu-board-grip"
        {...attributes} {...listeners} aria-label={'Move ' + task.title}>
        <GripVertical size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

function BoardColumn({ column, tasks, count, onOpenTask, onAddTask, rename, actions, limitEditor }: {
  column: BoardColumnConfig; tasks: Task[]; count: number;
  onOpenTask: (task: Task) => void; onAddTask: () => void;
  rename?: (label: string) => Promise<boolean>;
  actions: { label: string; run: () => void; disabled?: boolean }[];
  limitEditor?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { status: statusLabels[column.status] } });
  const id = useId();
  const headingId = column.status === 'REVIEW' && column.id === 'REVIEW' ? 'board-review' : id;
  return (
    <section ref={setNodeRef} className="wu-board-column" aria-label={column.label} data-drop-target={isOver}>
      <div className="wu-column-head">
        {editing && rename ? <div className="wu-board-rename">
          <label className="wu-visually-hidden" htmlFor={id + '-label'}>Rename {column.label}</label>
          <input id={id + '-label'} name="label" defaultValue={column.label} placeholder="e.g. Ready for review" maxLength={40} required autoFocus
            onFocus={event => event.currentTarget.select()} onBlur={event => {
              if (event.currentTarget.value.trim() === column.label) setEditing(false);
              else saveTextOnBlur(event, column.label, async label => { if (await rename(label)) setEditing(false); });
            }} onKeyDown={event => { if (event.key === 'Escape') setEditing(false); else finishInputEdit(event); }} />
        </div> : <h2 id={headingId} tabIndex={rename ? 0 : -1}
          title={rename ? 'Double-click or press Enter to rename' : undefined}
          onDoubleClick={() => { if (rename) setEditing(true); }}
          onKeyDown={event => { if (rename && event.key === 'Enter') setEditing(true); }}>{column.label}</h2>}
        <Pill>{column.limit ? count + ' / ' + column.limit : count}</Pill>
        {!!actions.length && <ActionMenu label={'Options for ' + column.label} actions={actions} />}
      </div>
      {limitEditor}
      <div className="wu-board-cards" tabIndex={tasks.length ? 0 : undefined} role="group" aria-label={column.label + ' tasks'}>
        {tasks.map(task => <DraggableTask key={task.id} task={task} columnId={column.id} onOpen={() => onOpenTask(task)} />)}
      </div>
      <button className="wu-add-card" type="button" aria-label={'Add task to ' + column.label} title={'Add task to ' + column.label} onClick={onAddTask}><Plus size={17} aria-hidden="true" /></button>
    </section>
  );
}

export function BoardPage({
  pageHeading, facets, filter, setFilter, filteredTasks, columns, allTasks, canManage, savingColumns, saveColumns, error,
  activeCount, activeWipLimit, onMoveTask, setSelectedTask, onAddTask, addTaskButton,
}: BoardPageProps) {
  const [draggedTask, setDraggedTask] = useState<Task>();
  const [adding, setAdding] = useState(false);
  const [limiting, setLimiting] = useState<string>();
  const [deleting, setDeleting] = useState<BoardColumnConfig>();
  const [showShortcuts, setShowShortcuts] = useState(false);

  const updateColumn = (id: string, patch: Partial<BoardColumnConfig>) => saveColumns(columns.map(column => column.id === id ? { ...column, ...patch } : column));

  function reorder(index: number, direction: -1 | 1) {
    const next = [...columns];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void saveColumns(next);
  }
  const viewport = useRef<HTMLElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ position: 0, max: 0 });

  useEffect(() => {
    const element = viewport.current;
    const content = grid.current;
    if (!element || !content) return;
    const sync = () => setScroll({ position: Math.round(element.scrollLeft), max: element.scrollWidth - element.clientWidth });
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    observer.observe(content);
    element.addEventListener('scroll', sync, { passive: true });
    sync();
    return () => { observer.disconnect(); element.removeEventListener('scroll', sync); };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardColumnCoordinates(columns) }),
  );

  useEffect(() => {
    if (window.location.hash === '#board-review') {
      const review = document.getElementById('board-review');
      review?.focus({ preventScroll: true });
      review?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, []);

  return <>
    {pageHeading(addTaskButton('Add task'))}
    <div className="wu-task-toolbar">
      <FilterChips items={['All tasks', 'My tasks', 'Next 7 days', 'Blocked']} active={filter} onChange={setFilter} />
      {facets}
      {canManage && <button className="wu-button wu-button--secondary" type="button" aria-expanded={adding} onClick={() => setAdding(value => !value)}><Plus size={16} />Add column</button>}
      <button className="wu-icon-button" type="button" aria-label="Board keyboard shortcuts" title="Board keyboard shortcuts" aria-expanded={showShortcuts} onClick={() => setShowShortcuts(value => !value)}><Keyboard size={18} /></button>
      <div className="wu-task-toolbar-counts"><span>{filteredTasks.length} tasks</span><span>Active work {activeCount} / {activeWipLimit}</span></div>
    </div>
    {showShortcuts && <p className="wu-board-help">Focus a card’s drag handle. Press <kbd>Space</kbd> to pick it up, use <kbd>←</kbd> or <kbd>→</kbd> to choose a column, and press <kbd>Space</kbd> to drop it or <kbd>Esc</kbd> to cancel.</p>}
    {error && <p className="wu-board-error" role="alert">{error}</p>}
    {adding && <form className="wu-board-inline-form" onSubmit={async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const label = String(data.get('label')).trim();
      const status = String(data.get('status')) as BoardColumnConfig['status'];
      const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
      if (label && await saveColumns([...columns, { id, label, status }])) setAdding(false);
    }}>
      <label className="wu-field-label">Column name<input name="label" placeholder="e.g. Ready for review" maxLength={40} required autoFocus /></label>
      <label className="wu-field-label">Workflow status<select name="status">{Object.entries(statusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label>
      <button className="wu-button wu-button--primary" disabled={savingColumns}>Add column</button>
      <button className="wu-button wu-button--secondary" type="button" onClick={() => setAdding(false)}>Cancel</button>
    </form>}
    <DndContext sensors={sensors} collisionDetection={findColumn}
      accessibility={{
        screenReaderInstructions: { draggable: 'Press Space to pick up a task, Left or Right to choose a column, Space to drop, or Escape to cancel.' },
      }}
      onDragStart={({ active }) => setDraggedTask(filteredTasks.find(task => task.id === active.id))}
      onDragCancel={() => setDraggedTask(undefined)}
      onDragEnd={({ active, over }) => {
        setDraggedTask(undefined);
        const column = columns.find(item => item.id === over?.id);
        if (column) onMoveTask(String(active.id), column);
      }}
    >
      <section ref={viewport} className="wu-board-section" aria-label="Kanban board" tabIndex={0}>
        <div ref={grid} className="wu-board-grid">
          {columns.map((column, index) => {
            const inColumn = (task: Task) => taskBoardColumn(task, columns)?.id === column.id;
            const count = allTasks.filter(inColumn).length;
            return <BoardColumn key={column.id} column={column} tasks={filteredTasks.filter(inColumn)} count={count}
              onOpenTask={setSelectedTask} onAddTask={() => onAddTask(column)}
              rename={canManage ? label => updateColumn(column.id, { label }) : undefined}
              actions={canManage ? [
                { label: 'Set column limit', run: () => setLimiting(column.id), disabled: savingColumns },
                { label: 'Move column left', run: () => reorder(index, -1), disabled: savingColumns || index === 0 },
                { label: 'Move column right', run: () => reorder(index, 1), disabled: savingColumns || index === columns.length - 1 },
                { label: 'Delete status', run: () => setDeleting(column), disabled: savingColumns || columns.length < 2 },
              ] : []}
              limitEditor={limiting === column.id && <div className="wu-board-limit">
                <label className="wu-field-label">Task limit<input name="limit" type="number" min="1" step="1" defaultValue={column.limit ?? ''} placeholder="No limit" autoFocus
                  onBlur={event => {
                    const previous = String(column.limit ?? '');
                    if (event.currentTarget.validity.valid && event.currentTarget.value === previous) setLimiting(undefined);
                    else saveTextOnBlur(event, previous, async limit => {
                      if (await updateColumn(column.id, { limit: limit ? Number(limit) : null })) setLimiting(undefined);
                    });
                  }} onKeyDown={event => { if (event.key === 'Escape') setLimiting(undefined); else finishInputEdit(event); }} /></label>
              </div>} />;
          })}
        </div>
      </section>
      <DragOverlay dropAnimation={null}>
        {draggedTask && <div className="wu-task-card wu-board-drag-preview" aria-hidden="true"><TaskCardContent task={draggedTask} /></div>}
      </DragOverlay>
    </DndContext>
    {scroll.max > 0 && <input className="wu-board-slider" type="range" aria-label="Scroll Kanban columns horizontally"
      min={0} max={scroll.max} value={scroll.position} onChange={event => { if (viewport.current) viewport.current.scrollLeft = Number(event.target.value); }} />}
    {deleting && <Drawer title={'Delete ' + deleting.label + '?'} confirmation onClose={() => setDeleting(undefined)}>
      <p>{allTasks.some(task => taskBoardColumn(task, columns)?.id === deleting.id)
        ? 'Move all tasks out of this column before deleting it.' : 'This removes the column from the workspace board.'}</p>
      {error && <p role="alert">{error}</p>}
      <div className="wu-modal-actions">
        <button className="wu-button wu-button--secondary" type="button" autoFocus onClick={() => setDeleting(undefined)}>Cancel</button>
        <button className="wu-button wu-button--primary" type="button" disabled={savingColumns || allTasks.some(task => taskBoardColumn(task, columns)?.id === deleting.id)}
          onClick={async () => { if (await saveColumns(columns.filter(column => column.id !== deleting.id))) setDeleting(undefined); }}>Delete status</button>
      </div>
    </Drawer>}
  </>;
}
