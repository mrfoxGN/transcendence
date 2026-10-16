import { TaskResponseDto } from '../dto/task-response.dto';
import { Task } from '../entities/task.entity';

export class TaskMapper {
  static toResponse(task: Task): TaskResponseDto {
    return {
      id: task.id,
      workspaceId: task.workspaceId,
      creatorId: task.creatorId,
      title: task.title,
      description: task.description,
      acceptanceCriteria: task.acceptanceCriteria,
      status: task.status,
      priority: task.priority,
      position: task.position,
      isBlocked: task.isBlocked,
      blockedReason: task.blockedReason,
      blockedAt: task.blockedAt,
      dueAt: task.dueAt,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
      cancelledAt: task.cancelledAt,
    };
  }
}