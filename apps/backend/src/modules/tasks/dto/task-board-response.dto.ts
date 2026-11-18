import { TaskStatus } from '../../../database/enums/database.enums';
import { TaskResponseDto } from './task-response.dto';

export class TaskBoardColumnDto {
  status!: TaskStatus;
  tasks!: TaskResponseDto[];
}

export class TaskBoardResponseDto {
  workspaceId!: string;
  reportingTimeZone!: string;
  activeWipLimit!: number;
  activeCount!: number;
  columns!: TaskBoardColumnDto[];
  assigneesByTaskId!: Record<string, string>;
}
