import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateWorkspaceInvitationDto {
  @IsOptional()
  @IsUUID()
  invitedUserId?: string;

  @IsOptional()
  @IsEmail()
  invitedEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  invitedUsername?: string;
}
