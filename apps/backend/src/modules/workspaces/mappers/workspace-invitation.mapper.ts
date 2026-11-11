import { WorkspaceInvitationResponseDto } from '../dto/workspace-invitation-response.dto';
import { WorkspaceInvitation } from '../entities/workspace-invitation.entity';
import { InvitationStatus } from '../../../database/enums/database.enums';

export class WorkspaceInvitationMapper {
  static toResponse(
    invitation: WorkspaceInvitation,
  ): WorkspaceInvitationResponseDto {
    return {
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      invitedById: invitation.invitedById,
      invitedUserId: invitation.invitedUserId,
      invitedEmail: invitation.invitedEmail,
      status: invitation.status === InvitationStatus.PENDING && invitation.expiresAt && invitation.expiresAt <= new Date()
        ? InvitationStatus.EXPIRED : invitation.status,
      expiresAt: invitation.expiresAt,
      respondedAt: invitation.respondedAt,
      createdAt: invitation.createdAt,
    };
  }
}
