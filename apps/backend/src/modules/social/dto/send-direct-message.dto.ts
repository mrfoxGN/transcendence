import { IsNotEmpty, IsString } from 'class-validator';

export class SendDirectMessageDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}