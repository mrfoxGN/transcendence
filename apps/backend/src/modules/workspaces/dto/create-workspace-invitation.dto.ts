import { IsUUID } from 'class-validator';

export class CreateWorkspaceInvitationDto {
  @IsUUID()
  invitedUserId!: string;
}
