import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export const projectStatuses = ['planned', 'active', 'on-hold', 'completed'] as const;
export type ProjectStatus = typeof projectStatuses[number];

export class MilestoneDto {
  @IsString()
  @Length(1, 120)
  @Matches(/\S/, { message: 'Enter a name.' })
  name!: string;

  @IsOptional()
  @Matches(/^[1-9]\d{3}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  targetDate?: string | null;
}

export class ProjectDto extends MilestoneDto {
  @IsIn(projectStatuses)
  status!: ProjectStatus;

  @IsOptional()
  @IsUUID()
  ownerId?: string | null;
}

export class TaskProjectDto {
  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  @IsOptional()
  @IsUUID()
  milestoneId?: string | null;

  @IsOptional()
  @IsBoolean()
  onlyUngrouped?: boolean;
}
