import { TaskCommentResponseDto } from '../dto/task-comment-response.dto';
import { TaskComment } from '../entities/task-comment.entity';

export class TaskCommentMapper {
  static toResponse(comment: TaskComment): TaskCommentResponseDto {
    return {
      id: comment.id,
      taskId: comment.taskId,
      authorId: comment.authorId,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      editedAt: comment.editedAt,
    };
  }
}