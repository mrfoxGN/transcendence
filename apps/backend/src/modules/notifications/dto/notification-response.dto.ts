export class NotificationResponseDto {
  id!: string;
  workspaceId!: string | null;
  type!: string;
  message!: string;
  relatedResourceType!: string | null;
  relatedResourceId!: string | null;
  payload!: unknown;
  createdAt!: Date;
  invitationStatus?: string;
  readAt!: Date | null;
}
