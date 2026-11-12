export class ActivityResponseDto {
  id!: string;
  workspaceId!: string;
  actorUserId!: string | null;
  actorName?: string;
  subjectName?: string;
  actionType!: string;
  resourceType!: string | null;
  resourceId!: string | null;
  resourceState?: 'available' | 'deleted';
  metadata!: unknown;
  createdAt!: Date;
}
