import {
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class UpdateWorkspaceKanbanSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  activeWipLimit?: number;

  @IsOptional()
  definitionOfReady?: unknown;

  @IsOptional()
  definitionOfDone?: unknown;
}
