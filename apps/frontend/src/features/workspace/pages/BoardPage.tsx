import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { ArrowRightLeft, CalendarDays, GripVertical, Keyboard, Plus } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Select } from '../../../shared/controls/Select';
import { Button, IconButton } from '../../../shared/ui';
import { Avatar, FilterChips, Pill } from '../components';
import type { AddTaskButton, PageHeading, Task } from '../types';
import { statusCodes, type BoardColumnConfig } from '../workspace-tasks';
import { Drawer } from '../WorkspaceControls';
import './board.css';

type Placement = 'before' | 'after' | 'end';

const findDropTarget: CollisionDetection = (args) => {
  const available = args.droppableContainers.filter(
    (target) => target.data.current?.anchorTaskId !== args.active.id,
  );
  const columns = available.filter((target) => !target.data.current?.anchorTaskId);
  if (!args.pointerCoordinates) return closestCenter({ ...args, droppableContainers: columns });
  const cardTargets = available.filter((target) => target.data.current?.anchorTaskId);
  const cardHits = pointerWithin({ ...args, droppableContainers: cardTargets });
  const columnHits = pointerWithin({ ...args, droppableContainers: columns });
  // Nested card targets must belong to the column under the pointer.
  const columnId = columnHits[0]?.id;
  const insertion = cardHits.find(
    (hit) =>
      cardTargets.find((target) => target.id === hit.id)?.data.current?.columnId === columnId,
  );
  if (insertion) return [insertion];
  const draggedCard = args.droppableContainers.filter(
    (target) => target.data.current?.anchorTaskId === args.active.id,
  );
  return pointerWithin({ ...args, droppableContainers: draggedCard }).length ? [] : columnHits;
};

const keyboardColumnCoordinates =
  (columns: BoardColumnConfig[]): KeyboardCoordinateGetter =>
  (event, { context, currentCoordinates }) => {
    const step = event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0;
    if (!step || !context.collisionRect) return;
    event.preventDefault();
    const currentColumn = context.over?.id ?? context.active?.data.current?.columnId;
    const targets = columns.map((column) => column.id);
    const index = targets.findIndex((status) => status === currentColumn);
    if (index < 0) return;
    const target = context.droppableRects.get(targets[index + step]);
    if (!target) return;
    const { collisionRect } = context;
    return {
      x:
        currentCoordinates.x +
        target.left +
        target.width / 2 -
        collisionRect.left -
        collisionRect.width / 2,
      y:
        currentCoordinates.y +
        target.top +
        target.height / 2 -
        collisionRect.top -
        collisionRect.height / 2,
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
  backlogTasks?: Task[];
  error: string;
  activeCount: number;
  activeWipLimit: number;
  onMoveTask: (
    id: string,
    column: BoardColumnConfig,
    placement: Placement,
    anchorTaskId?: string,
  ) => Promise<boolean>;
  movingTask: boolean;
  setSelectedTask: (task: Task) => void;
  addTaskButton: AddTaskButton;
  readOnly?: boolean;
};

function TaskCardContent({ task }: { task: Task }) {
  return (
    <>
      <strong>{task.title}</strong>
      {task.taskKey && <small className="wu-muted">{task.taskKey}</small>}
      <span className="wu-board-card-tags">
        {task.priority !== 'None' && (
          <Pill tone={task.priority === 'High' ? 'orange' : 'neutral'}>
            {task.priority} priority
          </Pill>
        )}
        {task.isBlocked && <Pill tone="red">Blocked</Pill>}
      </span>
      <span className="wu-task-card-foot">
        <span>
          {task.assigneeId && <Avatar initials={task.initials} small preview={false} />}
          {task.person}
        </span>
        {task.dueDate && (
          <span>
            <CalendarDays size={14} aria-hidden="true" />
            {task.due}
          </span>
        )}
      </span>
    </>
  );
}

function CardDropTarget({
  taskId,
  columnId,
  placement,
}: {
  taskId: string;
  columnId: string;
  placement: 'before' | 'after';
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: placement + ':' + taskId,
    data: { columnId, placement, anchorTaskId: taskId },
  });
  return (
    <span
      ref={setNodeRef}
      className={`wu-card-drop wu-card-drop--${placement}`}
      data-active={isOver}
      aria-hidden="true"
    />
  );
}

function DraggableTask({
  task,
  onOpen,
  onMove,
  columnId,
  readOnly,
}: {
  task: Task;
  onOpen: () => void;
  onMove: () => void;
  columnId: string;
  readOnly: boolean;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: task.id,
    data: { status: task.status, columnId },
    disabled: readOnly,
  });
  return (
    <div ref={setNodeRef} className="wu-board-card-slot" data-dragging={isDragging}>
      <button
        className="wu-task-card"
        type="button"
        onPointerDown={(event) => listeners?.onPointerDown?.(event)}
        onClick={onOpen}
      >
        <TaskCardContent task={task} />
      </button>
      {!readOnly && (
        <>
          <button
            ref={setActivatorNodeRef}
            type="button"
            className="wu-board-grip"
            {...attributes}
            {...listeners}
            aria-label={'Move ' + task.title}
          >
            <GripVertical size={17} aria-hidden="true" />
          </button>
          <button
            className="wu-board-move"
            type="button"
            aria-label={'Move to a position for ' + task.title}
            title="Move to"
            onClick={onMove}
          >
            <ArrowRightLeft size={16} aria-hidden="true" />
          </button>
          <CardDropTarget taskId={task.id} columnId={columnId} placement="before" />
          <CardDropTarget taskId={task.id} columnId={columnId} placement="after" />
        </>
      )}
    </div>
  );
}

function BoardColumn({
  column,
  tasks,
  count,
  onOpenTask,
  onMoveTask,
  onSelectFromBacklog,
  readOnly,
}: {
  column: BoardColumnConfig;
  tasks: Task[];
  count: number;
  onOpenTask: (task: Task) => void;
  onMoveTask: (task: Task) => void;
  onSelectFromBacklog?: () => void;
  readOnly: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { columnId: column.id } });
  const id = useId();
  const headingId = column.status === 'REVIEW' && column.id === 'REVIEW' ? 'board-review' : id;
  return (
    <section
      ref={setNodeRef}
      className="wu-board-column"
      data-status={column.status.replace(/[^a-z]/gi, '').toLowerCase()}
      aria-label={column.label}
      data-drop-target={isOver}
    >
      <div className="wu-column-head">
        <h2 id={headingId}>{column.label}</h2>
        <Pill>{count}</Pill>
      </div>
      <div
        className="wu-board-cards"
        tabIndex={tasks.length ? 0 : undefined}
        role="group"
        aria-label={column.label + ' tasks'}
      >
        {tasks.map((task) => (
          <DraggableTask
            key={task.id}
            task={task}
            columnId={column.id}
            readOnly={readOnly}
            onOpen={() => onOpenTask(task)}
            onMove={() => onMoveTask(task)}
          />
        ))}
      </div>
      {!readOnly && column.status === 'TODO' && onSelectFromBacklog && (
        <button
          className="wu-add-card"
          type="button"
          aria-label="Add task from backlog"
          title="Add task from backlog"
          onClick={onSelectFromBacklog}
        >
          <Plus size={17} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

export function BoardPage({
  pageHeading,
  facets,
  filter,
  setFilter,
  filteredTasks,
  columns,
  allTasks,
  backlogTasks = [],
  error,
  activeCount,
  activeWipLimit,
  onMoveTask,
  movingTask,
  setSelectedTask,
  addTaskButton,
  readOnly = false,
}: BoardPageProps) {
  const [draggedTask, setDraggedTask] = useState<Task>();
  const [moveTask, setMoveTask] = useState<Task>();
  const [moveDestination, setMoveDestination] = useState('');
  const [movePosition, setMovePosition] = useState('end');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [pickingFromBacklog, setPickingFromBacklog] = useState(false);
  const [selectedBacklogTaskId, setSelectedBacklogTaskId] = useState('');

  const tasksInColumn = (column: BoardColumnConfig) =>
    allTasks
      .filter((task) => statusCodes[task.status] === column.status)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const moveColumn = columns.find((column) => column.id === moveDestination);
  const visibleIds = new Set(filteredTasks.map((task) => task.id));

  const viewport = useRef<HTMLElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ position: 0, max: 0 });

  useEffect(() => {
    const element = viewport.current;
    const content = grid.current;
    if (!element || !content) return;
    const sync = () =>
      setScroll({
        position: Math.round(element.scrollLeft),
        max: element.scrollWidth - element.clientWidth,
      });
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    observer.observe(content);
    element.addEventListener('scroll', sync, { passive: true });
    sync();
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', sync);
    };
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

  return (
    <>
      {pageHeading(addTaskButton('Add task'))}
      <div className="wu-task-toolbar">
        <FilterChips
          items={['All tasks', 'My tasks', 'Next 7 days', 'Blocked']}
          active={filter}
          onChange={setFilter}
        />
        {facets}
        <IconButton
          type="button"
          aria-label="Board keyboard shortcuts"
          title="Board keyboard shortcuts"
          aria-expanded={showShortcuts}
          onClick={() => setShowShortcuts((value) => !value)}
        >
          <Keyboard size={18} />
        </IconButton>
        <div className="wu-task-toolbar-counts">
          <span>{filteredTasks.length} tasks</span>
          <span>
            Active work {activeCount} / {activeWipLimit}
          </span>
        </div>
      </div>
      {showShortcuts && (
        <p className="wu-board-help">
          Use <strong>Move to</strong> on a card to choose a column and position. You can also focus
          the drag handle, press <kbd>Space</kbd>, use <kbd>←</kbd> or <kbd>→</kbd> to choose a
          column, and press <kbd>Space</kbd> to place the card at the bottom.
        </p>
      )}
      {error && (
        <p className="wu-board-error" role="alert">
          {error}
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={findDropTarget}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              'Press Space to pick up a task, Left or Right to choose a column, Space to drop, or Escape to cancel.',
          },
        }}
        onDragStart={({ active }) =>
          setDraggedTask(filteredTasks.find((task) => task.id === active.id))
        }
        onDragCancel={() => setDraggedTask(undefined)}
        onDragEnd={({ active, over, activatorEvent }) => {
          setDraggedTask(undefined);
          if (readOnly) return;
          const target = over?.data.current;
          const column = columns.find((item) => item.id === target?.columnId);
          if (
            activatorEvent instanceof KeyboardEvent &&
            column?.id === active.data.current?.columnId
          )
            return;
          if (column && target)
            void onMoveTask(
              String(active.id),
              column,
              target.placement ?? 'end',
              target.anchorTaskId,
            );
        }}
      >
        <section ref={viewport} className="wu-board-section" aria-label="Kanban board" tabIndex={0}>
          <div ref={grid} className="wu-board-grid">
            {columns.map((column) => {
              const columnTasks = tasksInColumn(column);
              return (
                <BoardColumn
                  key={column.id}
                  column={column}
                  tasks={columnTasks.filter((task) => visibleIds.has(task.id))}
                  count={columnTasks.length}
                  readOnly={readOnly}
                  onOpenTask={setSelectedTask}
                  onSelectFromBacklog={() => {
                    setSelectedBacklogTaskId(backlogTasks[0]?.id ?? '');
                    setPickingFromBacklog(true);
                  }}
                  onMoveTask={() => {
                    setMoveTask(allTasks.find((task) => task.id === columnTasks[0]?.id));
                    setMoveDestination(column.id);
                    setMovePosition('end');
                  }}
                />
              );
            })}
          </div>
        </section>
        <DragOverlay dropAnimation={null}>
          {draggedTask && (
            <div className="wu-task-card wu-board-drag-preview" aria-hidden="true">
              <TaskCardContent task={draggedTask} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
      {scroll.max > 0 && (
        <input
          className="wu-board-slider"
          type="range"
          aria-label="Scroll Kanban columns horizontally"
          min={0}
          max={scroll.max}
          value={scroll.position}
          onChange={(event) => {
            if (viewport.current) viewport.current.scrollLeft = Number(event.target.value);
          }}
        />
      )}
      {moveTask && (
        <Drawer
          title={'Move ' + moveTask.title}
          confirmation
          closeDisabled={movingTask}
          onClose={() => setMoveTask(undefined)}
        >
          <form
            className="wu-column-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!moveColumn) return;
              const [placement, anchor] = movePosition.split(':');
              if (await onMoveTask(moveTask.id, moveColumn, placement as Placement, anchor))
                setMoveTask(undefined);
            }}
          >
            <label className="wu-field-label">
              Destination column
              <Select
                value={moveDestination}
                disabled={movingTask}
                onChange={(event) => {
                  setMoveDestination(event.currentTarget.value);
                  setMovePosition('end');
                }}
              >
                <option value="" disabled>
                  Choose a column
                </option>
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="wu-field-label">
              Position
              <Select
                value={movePosition}
                disabled={!moveColumn || movingTask}
                onChange={(event) => setMovePosition(event.currentTarget.value)}
              >
                <option value="end">Bottom of column</option>
                {moveColumn &&
                  tasksInColumn(moveColumn)
                    .filter((task) => task.id !== moveTask.id)
                    .map((task) => (
                      <option key={task.id} value={'before:' + task.id}>
                        Before {task.title}
                      </option>
                    ))}
              </Select>
            </label>
            {error && <p role="alert">{error}</p>}
            <div className="wu-modal-actions">
              <Button
                variant="secondary"
                type="button"
                disabled={movingTask}
                onClick={() => setMoveTask(undefined)}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={movingTask || !moveColumn}>
                Move task
              </Button>
            </div>
          </form>
        </Drawer>
      )}
      {pickingFromBacklog && (
        <Drawer
          title="Add task from backlog"
          confirmation
          closeDisabled={movingTask}
          onClose={() => {
            setPickingFromBacklog(false);
            setSelectedBacklogTaskId('');
          }}
        >
          {!backlogTasks.length ? (
            <div className="wu-column-form">
              <p className="wu-muted">No tasks in the backlog.</p>
              <div className="wu-modal-actions">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setPickingFromBacklog(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <form
              className="wu-column-form"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!selectedBacklogTaskId) return;
                const todoColumn = columns.find((column) => column.status === 'TODO');
                if (!todoColumn) return;
                if (await onMoveTask(selectedBacklogTaskId, todoColumn, 'end')) {
                  setPickingFromBacklog(false);
                  setSelectedBacklogTaskId('');
                }
              }}
            >
              <label className="wu-field-label">
                Backlog task
                <Select
                  value={selectedBacklogTaskId}
                  disabled={movingTask}
                  onChange={(event) => setSelectedBacklogTaskId(event.currentTarget.value)}
                  required
                >
                  <option value="" disabled>
                    Choose a task
                  </option>
                  {backlogTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.taskKey ? `${task.taskKey}: ` : ''}
                      {task.title}
                    </option>
                  ))}
                </Select>
              </label>
              <div
                className="wu-board-cards"
                style={{ maxHeight: '240px', overflowY: 'auto' }}
                role="listbox"
                aria-label="Backlog tasks list"
              >
                {backlogTasks.map((task) => {
                  const isSelected = selectedBacklogTaskId === task.id;
                  return (
                    <div
                      key={task.id}
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={0}
                      style={{
                        cursor: 'pointer',
                        marginBottom: '8px',
                        borderRadius: '10px',
                        border: isSelected
                          ? '2px solid var(--wu-blue)'
                          : '1px solid var(--wu-line)',
                        background: isSelected ? 'var(--wu-surface-soft)' : 'var(--wu-surface)',
                        padding: '10px',
                      }}
                      onClick={() => setSelectedBacklogTaskId(task.id)}
                      onKeyDown={(event) => {
                        if (event.key === ' ' || event.key === 'Enter') {
                          event.preventDefault();
                          setSelectedBacklogTaskId(task.id);
                        }
                      }}
                    >
                      <TaskCardContent task={task} />
                    </div>
                  );
                })}
              </div>
              {error && <p role="alert">{error}</p>}
              <div className="wu-modal-actions">
                <Button
                  variant="secondary"
                  type="button"
                  disabled={movingTask}
                  onClick={() => {
                    setPickingFromBacklog(false);
                    setSelectedBacklogTaskId('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={movingTask || !selectedBacklogTaskId}
                >
                  Move to To do
                </Button>
              </div>
            </form>
          )}
        </Drawer>
      )}
    </>
  );
}
