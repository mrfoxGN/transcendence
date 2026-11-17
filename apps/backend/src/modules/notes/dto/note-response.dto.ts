export class NoteResponseDto {
  id!: string;
  workspaceId!: string;
  creatorId!: string | null;
  title!: string;
  content!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
