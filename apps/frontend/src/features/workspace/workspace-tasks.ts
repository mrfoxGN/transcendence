import { workspaceRequest } from './workspace-api';
import { calendarDate, formatCalendarDate } from './workspace-calendar';
import type { Task } from './types';

export const statusLabels = {
  BACKLOG: 'To do', READY: 'Ready', IN_PROGRESS: 'In progress',
  REVIEW: 'Review', DONE: 'Done', CANCELLED: 'Cancelled',
} as const;
type Status = keyof typeof statusLabels;
export type BoardColumnConfig = { id: string; label: string; status: Status; limit?: number | null };
export const statusCodes = Object.fromEntries(Object.entries(statusLabels).map(([code, label]) => [label, code])) as Record<string, Status>;
export const taskPriorities = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' };

export type Member = { userId: string; username: string; avatarUrl: string | null; isOwner: boolean; joinedAt: string };
type ApiTask = {
  id: string; taskKey?: string; title: string; description: string | null; acceptanceCriteria: string | null;
  priority: string | null; status: Status; dueDate?: string | null; dueAt: string | null; isBlocked: boolean;
  blockedReason: string | null; completedAt: string | null; boardColumnId?: string; position?: number;
};
type ApiBoard = { activeCount: number; activeWipLimit: number; reportingTimeZone?: string; assigneesByTaskId?: Record<string, string>; columns: { status: Status; tasks: ApiTask[] }[]; boardColumns?: BoardColumnConfig[] };

export function taskBoardColumn(task: Task, columns: BoardColumnConfig[]) {
  const status = statusCodes[task.status];
  return columns.find(column => column.id === task.boardColumnId && column.status === status)
    ?? columns.find(column => column.status === status);
}

const transitions: Record<string, string[]> = {
  'To do': ['Ready', 'Cancelled'],
  Ready: ['To do', 'In progress', 'Cancelled'],
  'In progress': ['Review', 'Cancelled'],
  Review: ['In progress', 'Done', 'Cancelled'],
};
export const canTransition = (from: string, to: string) => transitions[from]?.includes(to) ?? false;

export async function loadBoard(path: string, token: string, signal: AbortSignal) {
  const board: ApiBoard = await (await workspaceRequest(path + '/board', token, { signal })).json();
  const reportingTimeZone = board.reportingTimeZone ?? 'Africa/Casablanca';
  const tasks = await Promise.all(board.columns.flatMap(column => column.tasks).map(async (item): Promise<Task> => {
    let assigneeId = board.assigneesByTaskId?.[item.id];
    if (!board.assigneesByTaskId) {
      const body = await (await workspaceRequest('tasks/' + item.id + '/assignment', token, { signal })).text();
      const assignment: { userId: string } | null = body ? JSON.parse(body) : null;
      assigneeId = assignment?.userId;
    }
    const dueDate = item.dueDate === undefined && item.dueAt
      ? calendarDate(new Date(item.dueAt), reportingTimeZone)
      : item.dueDate ?? null;
    return {
      id: item.id, taskKey: item.taskKey, title: item.title, status: statusLabels[item.status], boardColumnId: item.boardColumnId, position: item.position,
      description: item.description ?? '', acceptanceCriteria: item.acceptanceCriteria,
      priority: item.priority ? item.priority[0] + item.priority.slice(1).toLowerCase() : 'None',
      due: dueDate ? formatCalendarDate(dueDate, { month: 'short', day: 'numeric' }) : '—',
      dueDate, isBlocked: item.isBlocked, blockedReason: item.blockedReason,
      completedAt: item.completedAt, assigneeId,
      type: '', person: 'Unassigned', initials: '',
    };
  }));
  const defaults = board.columns.map(({ status }) => ({ id: status, label: statusLabels[status], status }));
  const layout = board.boardColumns ?? defaults;
  const boardColumns = [...layout, ...defaults.filter(column => !layout.some(item => item.status === column.status)
    && tasks.some(task => statusCodes[task.status] === column.status))];
  return { tasks, columns: defaults.map(column => column.label), boardColumns, activeCount: board.activeCount, activeWipLimit: board.activeWipLimit, reportingTimeZone };
}
