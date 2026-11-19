import { workspaceRequest } from './workspace-api';
import { calendarDate, formatCalendarDate } from './workspace-calendar';
import type { Task } from './types';

export const statusLabels = {
  BACKLOG: 'Backlog',
  TODO: 'To do',
  READY: 'Ready',
  IN_PROGRESS: 'In progress',
  REVIEW: 'Review',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
} as const;

export type Status = keyof typeof statusLabels;
export type BoardColumnConfig = { id: string; label: string; status: Status; limit?: number | null };
export const statusCodes = Object.fromEntries(
  Object.entries(statusLabels).map(([code, label]) => [label, code]),
) as Record<string, Status>;

export const fixedBoardColumns: BoardColumnConfig[] = (
  Object.keys(statusLabels) as Status[]
)
  .filter(status => status !== 'BACKLOG')
  .map(status => ({
    id: status,
    label: statusLabels[status],
    status,
  }));

export const allTaskColumns: BoardColumnConfig[] = (
  Object.keys(statusLabels) as Status[]
).map(status => ({
  id: status,
  label: statusLabels[status],
  status,
}));

export const taskPriorities = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' };

export type Member = { userId: string; username: string; avatarUrl: string | null; isOwner: boolean; joinedAt: string };

type ApiTask = {
  id: string;
  taskKey?: string;
  title: string;
  description: string | null;
  acceptanceCriteria: string | null;
  priority: string | null;
  status: Status;
  dueAt: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
  completedAt: string | null;
  position: number;
};

type ApiBoard = {
  workspaceId: string;
  reportingTimeZone?: string;
  activeWipLimit: number;
  activeCount: number;
  columns: { status: Status; tasks: ApiTask[] }[];
  assigneesByTaskId?: Record<string, string>;
};

export type BoardData = {
  tasks: Task[];
  backlogTasks: Task[];
  columns: string[];
  boardColumns: BoardColumnConfig[];
  activeCount: number;
  activeWipLimit: number;
  reportingTimeZone: string;
};

export function taskBoardColumn(
  task: Task,
  columns: BoardColumnConfig[] = fixedBoardColumns,
) {
  const status = statusCodes[task.status];
  return columns.find(column => column.status === status);
}

const transitions: Record<string, string[]> = {
  Backlog: ['To do', 'Cancelled'],
  'To do': ['Backlog', 'Ready', 'Cancelled'],
  Ready: ['To do', 'In progress', 'Cancelled'],
  'In progress': ['Ready', 'Review', 'Cancelled'],
  Review: ['In progress', 'Done', 'Cancelled'],
  Done: ['Review'],
  Cancelled: [],
};

export const canTransition = (from: string, to: string) => transitions[from]?.includes(to) ?? false;

export async function loadBoard(path: string, token: string, signal: AbortSignal): Promise<BoardData> {
  const board: ApiBoard = await (await workspaceRequest(path + '/board', token, { signal })).json();
  const reportingTimeZone = board.reportingTimeZone ?? 'Africa/Casablanca';
  const mapItemToTask = (item: ApiTask): Task => {
    const assigneeId = board.assigneesByTaskId?.[item.id];
    const dueDate = item.dueAt
      ? calendarDate(new Date(item.dueAt), reportingTimeZone)
      : null;
    return {
      id: item.id,
      taskKey: item.taskKey,
      title: item.title,
      status: statusLabels[item.status],
      position: item.position,
      description: item.description ?? '',
      acceptanceCriteria: item.acceptanceCriteria,
      priority: item.priority ? item.priority[0] + item.priority.slice(1).toLowerCase() : 'None',
      due: dueDate ? formatCalendarDate(dueDate, { month: 'short', day: 'numeric' }) : '—',
      dueDate,
      isBlocked: item.isBlocked,
      blockedReason: item.blockedReason,
      completedAt: item.completedAt,
      assigneeId,
      type: '',
      person: 'Unassigned',
      initials: '',
    };
  };
  const tasks: Task[] = board.columns
  .flatMap(column => column.tasks)
  .filter(item => item.status !== 'BACKLOG')
  .map(mapItemToTask);
  const backlogTasks: Task[] = board.columns
  .flatMap(column => column.tasks)
  .filter(item => item.status === 'BACKLOG')
  .map(mapItemToTask);
  return {
    tasks,
    backlogTasks,
    columns: fixedBoardColumns.map(column => column.label),
    boardColumns: fixedBoardColumns,
    activeCount: board.activeCount,
    activeWipLimit: board.activeWipLimit,
    reportingTimeZone,
  };
}
