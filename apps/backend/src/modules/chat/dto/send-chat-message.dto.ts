import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SendChatMessageDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @IsOptional()
  @IsUUID('4')
  requestId?: string;
}
