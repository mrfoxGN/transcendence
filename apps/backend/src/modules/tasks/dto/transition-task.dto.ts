import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { TaskStatus } from '../../../database/enums/database.enums';

export class TransitionTaskDto {
  @IsEnum(TaskStatus)
  toStatus!: TaskStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}