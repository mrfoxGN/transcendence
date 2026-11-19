import { TaskStatus } from '../../database/enums/database.enums';
import type { Task } from '../tasks/entities/task.entity';

export function isActiveTaskStatus(status: TaskStatus) {
  return status === TaskStatus.IN_PROGRESS || status === TaskStatus.REVIEW;
}

export function compareBoardTasks(a: Task, b: Task) {
  return a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
}

export function defaultBoardColumns() {
  const labels: Record<TaskStatus, string> = {
    BACKLOG: 'To do',
    READY: 'Ready',
    IN_PROGRESS: 'In progress',
    REVIEW: 'Review',
    DONE: 'Done',
    CANCELLED: 'Cancelled',
  };
  return Object.values(TaskStatus).map(status => ({ id: status, label: labels[status], status }));
}

export function taskColumn(columns: { status: TaskStatus }[], status: TaskStatus) {
  return (
    columns.find(column => column.status === status)
    ?? defaultBoardColumns().find(column => column.status === status)!
  );
}
