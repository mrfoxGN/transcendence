import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SendDirectMessageDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @IsOptional()
  @IsUUID('4')
  requestId?: string;
}
