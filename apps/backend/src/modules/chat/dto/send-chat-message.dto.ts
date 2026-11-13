import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class SendChatMessageDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsUUID('4')
  requestId?: string;
}
