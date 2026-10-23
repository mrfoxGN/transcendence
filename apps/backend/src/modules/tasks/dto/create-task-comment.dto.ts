import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTaskCommentDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}