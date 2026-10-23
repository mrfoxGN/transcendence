import {
  TaskPriority,
  TaskStatus,
} from '../../../database/enums/database.enums';

export class TaskResponseDto {
  id!: string;
  workspaceId!: string;
  creatorId!: string | null;
  title!: string;
  description!: string | null;
  acceptanceCriteria!: string | null;
  status!: TaskStatus;
  priority!: TaskPriority | null;
  position!: number;
  isBlocked!: boolean;
  blockedReason!: string | null;
  blockedAt!: Date | null;
  dueAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
  completedAt!: Date | null;
  cancelledAt!: Date | null;
}