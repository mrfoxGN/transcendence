import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
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
}