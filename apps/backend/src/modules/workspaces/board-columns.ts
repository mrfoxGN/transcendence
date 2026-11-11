import { TaskStatus } from '../../database/enums/database.enums';
import type { BoardColumnDto } from './dto/update-workspace-kanban-settings.dto';
import type { Task } from '../tasks/entities/task.entity';

const transitions: Record<TaskStatus, readonly TaskStatus[]> = {
  BACKLOG: [TaskStatus.READY, TaskStatus.CANCELLED],
  READY: [TaskStatus.BACKLOG, TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  IN_PROGRESS: [TaskStatus.REVIEW, TaskStatus.CANCELLED],
  REVIEW: [TaskStatus.IN_PROGRESS, TaskStatus.DONE, TaskStatus.CANCELLED],
  DONE: [],
  CANCELLED: [],
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus) {
  return transitions[from].includes(to);
}

export function isActiveTaskStatus(status: TaskStatus) {
  return status === TaskStatus.IN_PROGRESS || status === TaskStatus.REVIEW;
}

export function compareBoardTasks(a: Task, b: Task) {
  return a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
}

export function defaultBoardColumns(): BoardColumnDto[] {
  const labels: Record<TaskStatus, string> = {
    BACKLOG: 'To do', READY: 'Ready', IN_PROGRESS: 'In progress',
    REVIEW: 'Review', DONE: 'Done', CANCELLED: 'Cancelled',
  };
  return Object.values(TaskStatus).map(status => ({ id: status, label: labels[status], status }));
}

export function taskColumn(columns: BoardColumnDto[], status: TaskStatus, id?: string | null) {
  return columns.find(column => column.id === id && column.status === status)
    ?? columns.find(column => column.status === status)
    ?? defaultBoardColumns().find(column => column.status === status)!;
}
