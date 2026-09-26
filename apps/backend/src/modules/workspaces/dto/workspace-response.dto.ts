export class WorkspaceResponseDto {
  id!: string;
  ownerId!: string;
  name!: string;
  description!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
  archivedAt!: Date | null;
}
