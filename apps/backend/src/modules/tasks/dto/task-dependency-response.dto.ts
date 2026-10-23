export class TaskDependencyResponseDto {
  id!: string;
  taskId!: string;
  dependsOnTaskId!: string;
  createdById!: string | null;
  createdAt!: Date;
}