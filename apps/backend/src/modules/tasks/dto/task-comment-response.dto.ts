export class TaskCommentResponseDto {
  id!: string;
  taskId!: string;
  authorId!: string | null;
  content!: string;
  createdAt!: Date;
  updatedAt!: Date;
  editedAt!: Date | null;
}