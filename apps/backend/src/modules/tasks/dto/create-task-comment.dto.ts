import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTaskCommentDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsUUID('4')
  requestId?: string;
}
