export class TaskAssignmentResponseDto {
  id!: string;
  taskId!: string;
  userId!: string;
  assignedById!: string | null;
  assignedAt!: Date;
}