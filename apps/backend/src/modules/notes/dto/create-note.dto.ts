import { IsOptional, IsString, Length } from 'class-validator';

export class CreateNoteDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsOptional()
  @IsString()
  content?: string | null;
}
