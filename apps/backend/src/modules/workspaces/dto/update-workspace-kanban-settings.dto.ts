import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, Length, Matches, Min, ValidateNested } from 'class-validator';
import { TaskStatus } from '../../../database/enums/database.enums';

export class BoardColumnDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,40}$/)
  id!: string;

  @IsString()
  @Length(1, 40)
  label!: string;

  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number | null;
}

export class MoveColumnTasksDto {
  @Matches(/^[A-Za-z0-9_-]{1,40}$/)
  fromColumnId!: string;

  @Matches(/^[A-Za-z0-9_-]{1,40}$/)
  toColumnId!: string;
}

export class UpdateWorkspaceKanbanSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  activeWipLimit?: number;

  @IsOptional()
  definitionOfReady?: unknown;

  @IsOptional()
  definitionOfDone?: unknown;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => BoardColumnDto)
  boardColumns?: BoardColumnDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => MoveColumnTasksDto)
  moveColumnTasks?: MoveColumnTasksDto;
}
