export class NoteResponseDto {
  revision!: number;
  pinnedAt!: Date | null;
  id!: string;
  workspaceId!: string;
  creatorId!: string | null;
  title!: string;
  content!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
