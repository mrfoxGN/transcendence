export class ActivityResponseDto {
  id!: string;
  workspaceId!: string;
  actorUserId!: string | null;
  actionType!: string;
  resourceType!: string | null;
  resourceId!: string | null;
  metadata!: unknown;
  createdAt!: Date;
}
