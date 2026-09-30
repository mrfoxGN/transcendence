import { InvitationStatus } from '../../../database/enums/database.enums';

export class WorkspaceInvitationResponseDto {
  id!: string;
  workspaceId!: string;
  invitedById!: string | null;
  invitedUserId!: string | null;
  invitedEmail!: string | null;
  status!: InvitationStatus;
  expiresAt!: Date | null;
  respondedAt!: Date | null;
  createdAt!: Date;
}
