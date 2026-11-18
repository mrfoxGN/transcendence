import { IsNotEmpty, IsUUID, IsOptional, IsString } from 'class-validator';

export class SendDirectMessageDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsUUID('4')
  replyToId?: string;

  @IsOptional()
  @IsUUID('4')
  requestId?: string;
}
