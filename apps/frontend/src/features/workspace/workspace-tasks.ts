import { workspaceRequest } from './workspace-api';
import type { Task } from './types';

export const statusLabels = {
  BACKLOG: 'To do', READY: 'Ready', IN_PROGRESS: 'In progress',
  REVIEW: 'Review', DONE: 'Done', CANCELLED: 'Cancelled',
} as const;
type Status = keyof typeof statusLabels;
export const statusCodes = Object.fromEntries(Object.entries(statusLabels).map(([code, label]) => [label, code])) as Record<string, Status>;

export type Member = { userId: string; username: string; avatarUrl: string | null; isOwner: boolean; joinedAt: string };
type ApiTask = {
  id: string; title: string; description: string | null; acceptanceCriteria: string | null;
  priority: string | null; status: Status; dueAt: string | null; isBlocked: boolean;
  blockedReason: string | null; completedAt: string | null;
};
type ApiBoard = { activeCount: number; activeWipLimit: number; assigneesByTaskId?: Record<string, string>; columns: { status: Status; tasks: ApiTask[] }[] };

const transitions: Record<string, string[]> = {
  'To do': ['Ready', 'Cancelled'],
  Ready: ['To do', 'In progress', 'Cancelled'],
  'In progress': ['Review', 'Cancelled'],
  Review: ['In progress', 'Done', 'Cancelled'],
};
export const canTransition = (from: string, to: string) => transitions[from]?.includes(to) ?? false;

export function dueThisWeek(task: Task) {
  if (!task.dueAt) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(today.getDate() + 7);
  const due = new Date(task.dueAt);
  return due >= today && due < end;
}

export async function loadBoard(path: string, token: string, signal: AbortSignal) {
  const board: ApiBoard = await (await workspaceRequest(path + '/board', token, { signal })).json();
  const tasks = await Promise.all(board.columns.flatMap(column => column.tasks).map(async (item): Promise<Task> => {
    let assigneeId = board.assigneesByTaskId?.[item.id];
    if (!board.assigneesByTaskId) {
      const body = await (await workspaceRequest('tasks/' + item.id + '/assignment', token, { signal })).text();
      const assignment: { userId: string } | null = body ? JSON.parse(body) : null;
      assigneeId = assignment?.userId;
    }
    return {
      id: item.id, title: item.title, status: statusLabels[item.status],
      description: item.description ?? '', acceptanceCriteria: item.acceptanceCriteria,
      priority: item.priority ? item.priority[0] + item.priority.slice(1).toLowerCase() : 'None',
      due: item.dueAt ? new Date(item.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—',
      dueAt: item.dueAt, isBlocked: item.isBlocked, blockedReason: item.blockedReason,
      completedAt: item.completedAt, assigneeId,
      type: '', person: 'Unassigned', initials: '',
    };
  }));
  return { tasks, columns: board.columns.map(column => statusLabels[column.status]), activeCount: board.activeCount, activeWipLimit: board.activeWipLimit };
}
