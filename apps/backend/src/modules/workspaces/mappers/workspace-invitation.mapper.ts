import { WorkspaceInvitationResponseDto } from '../dto/workspace-invitation-response.dto';
import { WorkspaceInvitation } from '../entities/workspace-invitation.entity';

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
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      respondedAt: invitation.respondedAt,
      createdAt: invitation.createdAt,
    };
  }
}
