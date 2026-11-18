export class NoteResponseDto {
  id!: string;
  workspaceId!: string;
  creatorId!: string | null;
  title!: string;
  content!: string | null;
  pinnedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}
