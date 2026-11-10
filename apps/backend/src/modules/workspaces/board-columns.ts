import { TaskStatus } from '../../database/enums/database.enums';
import type { BoardColumnDto } from './dto/update-workspace-kanban-settings.dto';

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
