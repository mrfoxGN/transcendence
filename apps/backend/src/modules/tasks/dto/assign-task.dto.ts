import { IsUUID, ValidateIf } from 'class-validator';

export class AssignTaskDto {
  @IsUUID()
  userId!: string;
}

export class SetTaskAssigneeDto {
  @ValidateIf((_, value: unknown) => value !== null)
  @IsUUID()
  userId!: string | null;
}
