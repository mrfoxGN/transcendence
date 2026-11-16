import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';

import { TaskPriority } from '../../../database/enums/database.enums';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  acceptanceCriteria?: string | null;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority | null;

  @IsOptional()
  @IsDateString()
  dueAt?: string | null;

  @IsOptional()
  @Matches(/^[1-9]\d{3}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  dueDate?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  position?: number;
}
