import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, pointerWithin,
  useDraggable, useDroppable, useSensor, useSensors,
  type CollisionDetection, type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { CalendarDays, GripVertical, Plus } from 'lucide-react';
import { Avatar, FilterChips, Pill } from '../components';
import { taskStatuses } from '../previewData';
import type { PageHeading, Task, AddTaskButton } from '../types';
import { canTransition } from '../workspace-tasks';
import './board.css';

const columnTones = ['neutral', 'blue', 'violet', 'pink', 'mint'];

const findColumn: CollisionDetection = args => {
  const from = args.active.data.current?.status;
  const valid = { ...args, droppableContainers: args.droppableContainers.filter(({ id }) => typeof id === 'string' && (id === from || canTransition(from, id))) };
  return args.pointerCoordinates ? pointerWithin(valid) : closestCenter(valid);
};

const keyboardColumnCoordinates = (columns: string[]): KeyboardCoordinateGetter => (event, { context, currentCoordinates }) => {
  const step = event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0;
  if (!step || !context.collisionRect) return;
  event.preventDefault();
  const from = context.active?.data.current?.status;
  const currentColumn = context.over?.id ?? from;
  const targets = columns.filter(status => status === from || canTransition(from, status));
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
  columns: string[];
  activeCount: number;
  activeWipLimit: number;
  onMoveTask: (id: string, status: string) => void;
  setSelectedTask: (task: Task) => void;
  onAddTask: () => void;
  addTaskButton: AddTaskButton;
};

function TaskCardContent({ task }: { task: Task }) {
  return <>
    <strong>{task.title}</strong>
    <span className="wu-board-card-tags">
      {task.priority !== 'None' && <Pill tone={task.priority === 'High' ? 'orange' : 'neutral'}>{task.priority} priority</Pill>}
      {task.isBlocked && <Pill tone="red">Blocked</Pill>}
    </span>
    {task.description && <span className="wu-board-card-description">{task.description}</span>}
    <span className="wu-task-card-foot">
      <span>{task.assigneeId && <Avatar initials={task.initials} small preview={false} />}{task.person}</span>
      {task.dueAt && <span><CalendarDays size={14} aria-hidden="true" />{task.due}</span>}
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

function BoardColumn({ status, tone, tasks, count, onOpenTask, onAddTask }: {
  status: string; tone: string; tasks: Task[]; count: string | number;
  onOpenTask: (task: Task) => void; onAddTask?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const id = useId();
  const headingId = status === 'Review' ? 'board-review' : id;
  return (
    <section ref={setNodeRef} className={'wu-board-column wu-board-column--' + tone} aria-labelledby={headingId} data-drop-target={isOver}>
      <div className="wu-column-head">
        <h2 id={headingId} tabIndex={status === 'Review' ? -1 : undefined}><i />{status}</h2>
        <Pill>{count}</Pill>
      </div>
      <div className="wu-board-cards" tabIndex={tasks.length ? 0 : undefined} role="group" aria-label={status + ' tasks'}>
        {tasks.map(task => <DraggableTask key={task.id} task={task} onOpen={() => onOpenTask(task)} />)}
      </div>
      {onAddTask && <button className="wu-add-card" type="button" onClick={onAddTask}><Plus size={14} /> Add task</button>}
    </section>
  );
}

export function BoardPage({
  pageHeading, facets, filter, setFilter, filteredTasks, columns,
  activeCount, activeWipLimit, onMoveTask, setSelectedTask, onAddTask, addTaskButton,
}: BoardPageProps) {
  const [draggedTask, setDraggedTask] = useState<Task>();
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
    {facets}
    <div className="wu-filter-row wu-board-toolbar">
      <FilterChips items={['All tasks', 'My tasks', 'Due this week', 'Blocked']} active={filter} onChange={setFilter} />
      <span className="wu-result-count">Active work: {activeCount} / {activeWipLimit}</span>
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
              count={tasks.length} onOpenTask={setSelectedTask} onAddTask={status === 'To do' ? onAddTask : undefined} />;
          })}
        </div>
      </section>
      <DragOverlay dropAnimation={null}>
        {draggedTask && <div className="wu-task-card wu-board-drag-preview" aria-hidden="true"><TaskCardContent task={draggedTask} /></div>}
      </DragOverlay>
    </DndContext>
    {scroll.max > 0 && <input className="wu-board-slider" type="range" aria-label="Scroll Kanban columns horizontally"
      min={0} max={scroll.max} value={scroll.position} onChange={event => { if (viewport.current) viewport.current.scrollLeft = Number(event.target.value); }} />}
  </>;
}
