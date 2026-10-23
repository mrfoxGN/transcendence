import { TaskDependencyResponseDto } from '../dto/task-dependency-response.dto';
import { TaskDependency } from '../entities/task-dependency.entity';

export class TaskDependencyMapper {
  static toResponse(
    dependency: TaskDependency,
  ): TaskDependencyResponseDto {
    return {
      id: dependency.id,
      taskId: dependency.taskId,
      dependsOnTaskId: dependency.dependsOnTaskId,
      createdById: dependency.createdById,
      createdAt: dependency.createdAt,
    };
  }
}