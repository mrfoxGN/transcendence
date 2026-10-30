import {
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';

export class UpdateNoteDto {
  @ValidateIf((dto) => dto.title !== undefined)
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string | null;
}