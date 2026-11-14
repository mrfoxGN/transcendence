import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class ListAvailableRepositoriesDto {
  @IsUUID()
  workspaceId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  setupSessionId!: string;
}
