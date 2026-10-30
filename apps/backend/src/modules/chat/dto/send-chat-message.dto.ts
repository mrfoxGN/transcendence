import { IsNotEmpty, IsString } from 'class-validator';

export class SendChatMessageDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}
