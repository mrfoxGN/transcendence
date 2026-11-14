import { IsString, Length, Matches } from 'class-validator';

export class RenameWorkspaceFileDto {
  @IsString()
  @Length(1, 255)
  @Matches(/^[^\x00-\x1f\x7f/\\]+$/, { message: 'Enter a filename without slashes or control characters.' })
  displayName!: string;
}
