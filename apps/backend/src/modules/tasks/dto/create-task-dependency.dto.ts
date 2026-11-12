import { IsUUID } from 'class-validator';

export class CreateTaskDependencyDto {
  @IsUUID()
  dependsOnTaskId!: string;
}
