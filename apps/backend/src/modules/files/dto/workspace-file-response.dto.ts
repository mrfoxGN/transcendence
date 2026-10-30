export class WorkspaceFileResponseDto {
  id!: string;
  workspaceId!: string;
  uploaderId!: string | null;
  taskId!: string | null;
  originalName!: string;
  displayName!: string;
  mimeType!: string | null;
  sizeBytes!: string;
  createdAt!: Date;
}
