import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { TaskStatus } from '../../../database/enums/database.enums';

export class TransitionTaskDto {
  @IsEnum(TaskStatus)
  toStatus!: TaskStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{1,40}$/)
  boardColumnId?: string;
}
