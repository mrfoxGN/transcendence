import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, MeasuringStrategy, PointerSensor, closestCenter, pointerWithin,
  useDraggable, useDroppable, useSensor, useSensors,
  type CollisionDetection, type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { ArrowRightLeft, CalendarDays, GripVertical, Keyboard, Plus } from 'lucide-react';
import { Avatar, FilterChips, Pill } from '../components';
import { ActionMenu, Drawer } from '../WorkspaceControls';
import { finishInputEdit, saveTextOnBlur } from '../autosave';
import type { PageHeading, Task, AddTaskButton } from '../types';
import { canTransition, statusLabels, taskBoardColumn, type BoardColumnConfig } from '../workspace-tasks';
import './board.css';

type Placement = 'before' | 'after' | 'end';
type ColumnMove = { fromColumnId: string; toColumnId: string };

const findDropTarget: CollisionDetection = args => {
  const available = args.droppableContainers.filter(target =>
    target.data.current?.available && target.data.current?.anchorTaskId !== args.active.id);
  const columns = available.filter(target => !target.data.current?.anchorTaskId);
  if (!args.pointerCoordinates) return closestCenter({ ...args, droppableContainers: columns });
  const cardTargets = available.filter(target => target.data.current?.anchorTaskId);
  const cardHits = pointerWithin({ ...args, droppableContainers: cardTargets });
  const columnHits = pointerWithin({ ...args, droppableContainers: columns });
  // Nested card targets must belong to the column under the pointer.
  const columnId = columnHits[0]?.id;
  const insertion = cardHits.find(hit => cardTargets.find(target => target.id === hit.id)?.data.current?.columnId === columnId);
  if (insertion) return [insertion];
  const draggedCard = args.droppableContainers.filter(target => target.data.current?.anchorTaskId === args.active.id);
  return pointerWithin({ ...args, droppableContainers: draggedCard }).length ? [] : columnHits;
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
  saveColumns: (columns: BoardColumnConfig[], move?: ColumnMove) => Promise<boolean>;
  activeCount: number;
  activeWipLimit: number;
  onMoveTask: (id: string, column: BoardColumnConfig, placement: Placement, anchorTaskId?: string) => Promise<boolean>;
  movingTask: boolean;
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

function CardDropTarget({ taskId, columnId, available, placement }: {
  taskId: string; columnId: string; available: boolean; placement: 'before' | 'after';
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: placement + ':' + taskId,
    data: { columnId, placement, anchorTaskId: taskId, available },
  });
  return <span ref={setNodeRef} className={`wu-card-drop wu-card-drop--${placement}`} data-active={isOver} aria-hidden="true" />;
}

function DraggableTask({ task, onOpen, onMove, columnId, available }: {
  task: Task; onOpen: () => void; onMove: () => void; columnId: string; available: boolean;
}) {
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
      <button className="wu-board-move" type="button" aria-label={'Move to a position for ' + task.title} title="Move to" onClick={onMove}>
        <ArrowRightLeft size={16} aria-hidden="true" />
      </button>
      <CardDropTarget taskId={task.id} columnId={columnId} available={available} placement="before" />
      <CardDropTarget taskId={task.id} columnId={columnId} available={available} placement="after" />
    </div>
  );
}

function BoardColumn({ column, tasks, count, onOpenTask, onMoveTask, onAddTask, rename, actions, limitEditor, unavailableReason, dragging }: {
  column: BoardColumnConfig; tasks: Task[]; count: number;
  onOpenTask: (task: Task) => void; onAddTask: () => void;
  onMoveTask: (task: Task) => void;
  unavailableReason: string;
  dragging: boolean;
  rename?: (label: string) => Promise<boolean>;
  actions: { label: string; run: () => void; disabled?: boolean }[];
  limitEditor?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const available = !unavailableReason;
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { columnId: column.id, available } });
  const id = useId();
  const headingId = column.status === 'REVIEW' && column.id === 'REVIEW' ? 'board-review' : id;
  return (
    <section ref={setNodeRef} className="wu-board-column" aria-label={column.label} data-drop-target={isOver} data-drop-unavailable={dragging && !available}>
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
        {!!actions.length && <ActionMenu label={'Options for ' + column.label} actions={[
          ...(rename ? [{ label: 'Rename', run: () => setEditing(true) }] : []),
          ...actions,
        ]} />}
      </div>
      {column.label !== statusLabels[column.status] && <p className="wu-board-workflow">Workflow status · {statusLabels[column.status]}</p>}
      {dragging && unavailableReason && <p className="wu-board-drop-reason">{unavailableReason}</p>}
      {limitEditor}
      <div className="wu-board-cards" tabIndex={tasks.length ? 0 : undefined} role="group" aria-label={column.label + ' tasks'}>
        {tasks.map(task => <DraggableTask key={task.id} task={task} columnId={column.id} available={available}
          onOpen={() => onOpenTask(task)} onMove={() => onMoveTask(task)} />)}
      </div>
      <button className="wu-add-card" type="button" aria-label={'Add task to ' + column.label} title={'Add task to ' + column.label} onClick={onAddTask}><Plus size={17} aria-hidden="true" /></button>
    </section>
  );
}

export function BoardPage({
  pageHeading, facets, filter, setFilter, filteredTasks, columns, allTasks, canManage, savingColumns, saveColumns, error,
  activeCount, activeWipLimit, onMoveTask, movingTask, setSelectedTask, onAddTask, addTaskButton,
}: BoardPageProps) {
  const [draggedTask, setDraggedTask] = useState<Task>();
  const [adding, setAdding] = useState(false);
  const [limiting, setLimiting] = useState<string>();
  const [deleting, setDeleting] = useState<BoardColumnConfig>();
  const [deleteDestination, setDeleteDestination] = useState('');
  const [moveTask, setMoveTask] = useState<Task>();
  const [moveDestination, setMoveDestination] = useState('');
  const [movePosition, setMovePosition] = useState('end');
  const [showShortcuts, setShowShortcuts] = useState(false);

  const tasksInColumn = (column: BoardColumnConfig) => allTasks
    .filter(task => taskBoardColumn(task, columns)?.id === column.id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const activeStatus = (status: string) => status === 'In progress' || status === 'Review';
  function unavailableReason(task: Task, column: BoardColumnConfig, count = 1) {
    if (taskBoardColumn(task, columns)?.id === column.id) return '';
    const to = statusLabels[column.status];
    if (task.status !== to && !canTransition(task.status, to)) return 'Workflow move unavailable';
    if (column.limit && tasksInColumn(column).length + count > column.limit) return 'Column is full';
    if (!activeStatus(task.status) && activeStatus(to) && activeCount + count > activeWipLimit) return 'Active work limit reached';
    return '';
  }

  const deletedTasks = deleting ? tasksInColumn(deleting) : [];
  const moveColumn = columns.find(column => column.id === moveDestination);
  const eligibleDeleteColumns = columns.filter(column => column.id !== deleting?.id && deletedTasks.length > 0 &&
    !unavailableReason(deletedTasks[0], column, deletedTasks.length));
  const selectedDeleteColumn = eligibleDeleteColumns.find(column => column.id === deleteDestination);
  const visibleIds = new Set(filteredTasks.map(task => task.id));

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
    useSensor(KeyboardSensor, { coordinateGetter: keyboardColumnCoordinates(
      draggedTask ? columns.filter(column => !unavailableReason(draggedTask, column)) : columns,
    ) }),
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
    {showShortcuts && <p className="wu-board-help">Use <strong>Move to</strong> on a card to choose a column and position. You can also focus the drag handle, press <kbd>Space</kbd>, use <kbd>←</kbd> or <kbd>→</kbd> to choose a column, and press <kbd>Space</kbd> to place the card at the bottom.</p>}
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
    <DndContext sensors={sensors} collisionDetection={findDropTarget} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      accessibility={{
        screenReaderInstructions: { draggable: 'Press Space to pick up a task, Left or Right to choose a column, Space to drop, or Escape to cancel.' },
      }}
      onDragStart={({ active }) => setDraggedTask(filteredTasks.find(task => task.id === active.id))}
      onDragCancel={() => setDraggedTask(undefined)}
      onDragEnd={({ active, over, activatorEvent }) => {
        setDraggedTask(undefined);
        const target = over?.data.current;
        const column = columns.find(item => item.id === target?.columnId);
        if (activatorEvent instanceof KeyboardEvent && column?.id === active.data.current?.columnId) return;
        if (column && target?.available) void onMoveTask(String(active.id), column, target.placement ?? 'end', target.anchorTaskId);
      }}
    >
      <section ref={viewport} className="wu-board-section" aria-label="Kanban board" tabIndex={0}>
        <div ref={grid} className="wu-board-grid">
          {columns.map((column, index) => {
            const columnTasks = tasksInColumn(column);
            return <BoardColumn key={column.id} column={column} tasks={columnTasks.filter(task => visibleIds.has(task.id))} count={columnTasks.length}
              dragging={!!draggedTask} unavailableReason={draggedTask ? unavailableReason(draggedTask, column) : ''}
              onOpenTask={setSelectedTask} onAddTask={() => onAddTask(column)}
              onMoveTask={task => {
                setMoveTask(task);
                setMoveDestination(taskBoardColumn(task, columns)?.id ?? '');
                setMovePosition('end');
              }}
              rename={canManage ? label => updateColumn(column.id, { label }) : undefined}
              actions={canManage ? [
                { label: 'Set column limit', run: () => setLimiting(column.id), disabled: savingColumns },
                { label: 'Move column left', run: () => reorder(index, -1), disabled: savingColumns || index === 0 },
                { label: 'Move column right', run: () => reorder(index, 1), disabled: savingColumns || index === columns.length - 1 },
                { label: 'Delete column', run: () => { setDeleting(column); setDeleteDestination(''); }, disabled: savingColumns || columns.length < 2 },
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
    {moveTask && <Drawer title={'Move ' + moveTask.title} confirmation closeDisabled={movingTask} onClose={() => setMoveTask(undefined)}>
      <form className="wu-column-form" onSubmit={async event => {
        event.preventDefault();
        if (!moveColumn || unavailableReason(moveTask, moveColumn)) return;
        const [placement, anchor] = movePosition.split(':');
        if (await onMoveTask(moveTask.id, moveColumn, placement as Placement, anchor)) setMoveTask(undefined);
      }}>
        <label className="wu-field-label">Destination column
          <select value={moveDestination} disabled={movingTask} onChange={event => { setMoveDestination(event.currentTarget.value); setMovePosition('end'); }}>
            <option value="" disabled>Choose a column</option>
            {columns.map(column => {
              const reason = unavailableReason(moveTask, column);
              return <option key={column.id} value={column.id} disabled={!!reason}>{column.label}{reason ? ' — ' + reason : ''}</option>;
            })}
          </select>
        </label>
        <label className="wu-field-label">Position
          <select value={movePosition} disabled={!moveColumn || movingTask} onChange={event => setMovePosition(event.currentTarget.value)}>
            <option value="end">Bottom of column</option>
            {moveColumn && tasksInColumn(moveColumn).filter(task => task.id !== moveTask.id)
              .map(task => <option key={task.id} value={'before:' + task.id}>Before {task.title}</option>)}
          </select>
        </label>
        {error && <p role="alert">{error}</p>}
        <div className="wu-modal-actions">
          <button className="wu-button wu-button--secondary" type="button" disabled={movingTask} onClick={() => setMoveTask(undefined)}>Cancel</button>
          <button className="wu-button wu-button--primary" type="submit" disabled={movingTask || !moveColumn}>Move task</button>
        </div>
      </form>
    </Drawer>}
    {deleting && <Drawer title={'Delete ' + deleting.label + '?'} confirmation closeDisabled={savingColumns} onClose={() => setDeleting(undefined)}>
      {deletedTasks.length ? <>
        <p>Move {deletedTasks.length} {deletedTasks.length === 1 ? 'task' : 'tasks'} before deleting this column.</p>
        {eligibleDeleteColumns.length > 0 ? <label className="wu-field-label">Destination column
          <select value={deleteDestination} disabled={savingColumns} onChange={event => setDeleteDestination(event.currentTarget.value)}>
            <option value="">Choose a column</option>
            {eligibleDeleteColumns.map(column => <option key={column.id} value={column.id}>{column.label}</option>)}
          </select>
        </label> : <p>No available column can accept all of these tasks.</p>}
        {selectedDeleteColumn && <p>The tasks will be added to the bottom of {selectedDeleteColumn.label} with the {statusLabels[selectedDeleteColumn.status]} workflow status.</p>}
      </> : <p>This removes the column from the workspace board.</p>}
      {error && <p role="alert">{error}</p>}
      <div className="wu-modal-actions">
        <button className="wu-button wu-button--secondary" type="button" disabled={savingColumns} autoFocus onClick={() => setDeleting(undefined)}>Cancel</button>
        <button className="wu-button wu-button--primary" type="button" disabled={savingColumns || (deletedTasks.length > 0 && !selectedDeleteColumn)}
          onClick={async () => {
            const move = selectedDeleteColumn && { fromColumnId: deleting.id, toColumnId: selectedDeleteColumn.id };
            if (await saveColumns(columns.filter(column => column.id !== deleting.id), move)) setDeleting(undefined);
          }}>{deletedTasks.length ? 'Move tasks and delete column' : 'Delete column'}</button>
      </div>
    </Drawer>}
  </>;
}
