import { IsEmail, IsOptional, IsUUID } from 'class-validator';

export class CreateWorkspaceInvitationDto {
  @IsOptional()
  @IsUUID()
  invitedUserId?: string;

  @IsOptional()
  @IsEmail()
  invitedEmail?: string;
}
