import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, pointerWithin,
  useDraggable, useDroppable, useSensor, useSensors,
  type CollisionDetection, type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { CalendarDays, GripVertical, Plus } from 'lucide-react';
import { Avatar, FilterChips, Pill } from '../components';
import { ActionMenu, Drawer } from '../WorkspaceControls';
import { taskStatuses } from '../previewData';
import type { PageHeading, Task, AddTaskButton } from '../types';
import './board.css';

const columnTones = ['neutral', 'blue', 'violet', 'pink', 'mint'];

const findColumn: CollisionDetection = args => args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);

const keyboardColumnCoordinates = (columns: string[]): KeyboardCoordinateGetter => (event, { context, currentCoordinates }) => {
  const step = event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0;
  if (!step || !context.collisionRect) return;
  event.preventDefault();
  const currentColumn = context.over?.id ?? context.active?.data.current?.status;
  const index = columns.findIndex(status => status === currentColumn);
  if (index < 0) return;
  const target = context.droppableRects.get(columns[index + step]);
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
  allTasks: Task[];
  columns: string[];
  onAddColumn: (name: string) => string | undefined;
  onRemoveColumn: (status: string, destination: string) => string | undefined;
  activeCount: number;
  onMoveTask: (id: string, status: string) => void;
  setSelectedTask: (task: Task) => void;
  onAddTask: (status: string) => void;
  addTaskButton: AddTaskButton;
};

function TaskCardContent({ task }: { task: Task }) {
  return <>
    <span className="wu-task-id">{task.id}</span>
    <strong>{task.title}</strong>
    <span className="wu-board-card-tags">
      <Pill>{task.type}</Pill>
      <Pill tone={task.priority === 'High' ? 'orange' : 'neutral'}>{task.priority} priority</Pill>
      {task.isBlocked && <Pill tone="red">Blocked</Pill>}
    </span>
    {task.description && <span className="wu-board-card-description">{task.description}</span>}
    <span className="wu-task-card-foot">
      <span><Avatar initials={task.initials} small />{task.person}</span>
      {task.due && <span><CalendarDays size={14} aria-hidden="true" />{task.due}</span>}
    </span>
  </>;
}

function DraggableTask({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: task.id, data: { status: task.status },
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

function BoardColumn({ status, tone, tasks, count, onOpenTask, onAddTask, onRemove }: {
  status: string; tone: string; tasks: Task[]; count: string | number;
  onOpenTask: (task: Task) => void; onAddTask: () => void;
  onRemove?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const id = useId();
  const headingId = status === 'Review' ? 'board-review' : id;
  return (
    <section ref={setNodeRef} className={'wu-board-column wu-board-column--' + tone} aria-labelledby={headingId} data-drop-target={isOver}>
      <div className="wu-column-head">
        <h2 id={headingId} tabIndex={status === 'Review' ? -1 : undefined}><i />{status}</h2>
        <Pill>{count}</Pill>
        {onRemove && <ActionMenu label={status + ' column actions'} actions={[{ label: 'Remove column', run: onRemove }]} />}
      </div>
      <div className="wu-board-cards" tabIndex={tasks.length ? 0 : undefined} role="group" aria-label={status + ' tasks'}>
        {tasks.map(task => <DraggableTask key={task.id} task={task} onOpen={() => onOpenTask(task)} />)}
      </div>
      <button className="wu-add-card" type="button" onClick={onAddTask}><Plus size={14} /> Add task</button>
    </section>
  );
}

export function BoardPage({
  pageHeading, facets, filter, setFilter, filteredTasks, allTasks, columns, onAddColumn, onRemoveColumn,
  activeCount, onMoveTask, setSelectedTask, onAddTask, addTaskButton,
}: BoardPageProps) {
  const [draggedTask, setDraggedTask] = useState<Task>();
  const [columnEditor, setColumnEditor] = useState<{ status?: string }>();
  const [columnError, setColumnError] = useState('');
  const viewport = useRef<HTMLElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const revealNewColumn = useRef(false);
  const [scroll, setScroll] = useState({ position: 0, max: 0 });
  const removing = columnEditor?.status;
  const affected = removing ? allTasks.filter(task => task.status === removing).length : 0;

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

  useEffect(() => {
    if (!revealNewColumn.current || !viewport.current) return;
    revealNewColumn.current = false;
    viewport.current.scrollLeft = viewport.current.scrollWidth;
  }, [columns]);

  function editColumn(status?: string) {
    setColumnError('');
    setColumnEditor({ status });
  }

  function saveColumn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const error = removing
      ? onRemoveColumn(removing, String(data.get('destination') ?? ''))
      : onAddColumn(String(data.get('name') ?? '').trim());
    if (error) setColumnError(error);
    else {
      revealNewColumn.current = !removing;
      setColumnEditor(undefined);
    }
  }
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
    {facets}
    <div className="wu-filter-row wu-board-toolbar">
      <FilterChips items={['All tasks', 'My tasks', 'Due this week', 'Blocked']} active={filter} onChange={setFilter} />
      <button className="wu-button wu-button--secondary" type="button" onClick={() => editColumn()}><Plus size={15} /> Add column</button>
    </div>
    <DndContext sensors={sensors} collisionDetection={findColumn}
      accessibility={{
        screenReaderInstructions: { draggable: 'Press Space to pick up a task, Left or Right to choose a column, Space to drop, or Escape to cancel.' },
      }}
      onDragStart={({ active }) => setDraggedTask(filteredTasks.find(task => task.id === active.id))}
      onDragCancel={() => setDraggedTask(undefined)}
      onDragEnd={({ active, over }) => {
        setDraggedTask(undefined);
        if (over && typeof over.id === 'string' && columns.includes(over.id)) onMoveTask(String(active.id), over.id);
      }}
    >
      <section ref={viewport} className="wu-board-section" aria-label="Kanban board" tabIndex={0}>
        <div ref={grid} className="wu-board-grid">
          {columns.map(status => {
            const tasks = filteredTasks.filter(task => task.status === status);
            return <BoardColumn key={status} status={status} tone={columnTones[taskStatuses.indexOf(status)] ?? 'neutral'} tasks={tasks}
              count={status === 'In progress' ? activeCount + ' / 3' : tasks.length}
              onOpenTask={setSelectedTask} onAddTask={() => onAddTask(status)}
              onRemove={columns.length > 1 ? () => editColumn(status) : undefined} />;
          })}
        </div>
      </section>
      <DragOverlay dropAnimation={null}>
        {draggedTask && <div className="wu-task-card wu-board-drag-preview" aria-hidden="true"><TaskCardContent task={draggedTask} /></div>}
      </DragOverlay>
    </DndContext>
    {scroll.max > 0 && <input className="wu-board-slider" type="range" aria-label="Scroll Kanban columns horizontally"
      min={0} max={scroll.max} value={scroll.position} onChange={event => { if (viewport.current) viewport.current.scrollLeft = Number(event.target.value); }} />}
    {columnEditor && <Drawer title={removing ? 'Remove ' + removing : 'Add column'} confirmation={!!removing} onClose={() => setColumnEditor(undefined)}>
      <form className="wu-column-form" onSubmit={saveColumn}>
        {!removing && <label className="wu-field-label">Column name<input name="name" maxLength={40} required autoFocus /></label>}
        {!!removing && (affected ? <label className="wu-field-label">
          Move {affected} {affected === 1 ? 'task' : 'tasks'} to
          <select name="destination" defaultValue="" required autoFocus>
            <option value="" disabled>Choose a column</option>
            {columns.filter(status => status !== removing).map(status => <option key={status}>{status}</option>)}
          </select>
        </label> : <p>This column is empty.</p>)}
        {columnError && <p role="alert">{columnError}</p>}
        <div className="wu-modal-actions">
          <button className="wu-button wu-button--secondary" type="button" autoFocus={!!removing && !affected}
            onClick={event => event.currentTarget.closest('dialog')?.close()}>Cancel</button>
          <button className="wu-button wu-button--primary" type="submit">{removing ? 'Remove column' : 'Add column'}</button>
        </div>
      </form>
    </Drawer>}
  </>;
}
