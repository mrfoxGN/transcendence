import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class ConnectRepositoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  setupSessionId!: string;

  @IsString()
  @Matches(/^[0-9]{1,32}$/)
  githubRepositoryId!: string;
}
