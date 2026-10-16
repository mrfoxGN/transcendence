import { TaskAssignmentResponseDto } from '../dto/task-assignment-response.dto';
import { TaskAssignment } from '../entities/task-assignment.entity';

export class TaskAssignmentMapper {
  static toResponse(
    assignment: TaskAssignment,
  ): TaskAssignmentResponseDto {
    return {
      id: assignment.id,
      taskId: assignment.taskId,
      userId: assignment.userId,
      assignedById: assignment.assignedById,
      assignedAt: assignment.assignedAt,
    };
  }
}