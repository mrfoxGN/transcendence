import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class SendChatMessageDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Message content cannot be blank' })
  content!: string;

  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @IsOptional()
  @IsUUID('4')
  requestId?: string;
}
