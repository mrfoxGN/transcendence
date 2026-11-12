import { IsBoolean, IsInt, IsOptional, IsString, Length, Min, ValidateIf } from 'class-validator';

export class NoteRevisionDto {
  @IsInt()
  @Min(1)
  revision!: number;
}

export class UpdateNoteDto extends NoteRevisionDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  pinned?: boolean;

  @ValidateIf((dto: UpdateNoteDto) => dto.title !== undefined)
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string | null;
}
