import { IsEnum, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

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

  @IsOptional()
  @IsIn(['before', 'after', 'end'])
  placement?: 'before' | 'after' | 'end';

  @IsOptional()
  @IsUUID()
  anchorTaskId?: string;
}
