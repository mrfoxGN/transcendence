import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsIn(['system', 'light', 'dark'])
  theme?: 'system' | 'light' | 'dark';

  @IsOptional()
  @IsBoolean()
  notificationBadge?: boolean;

  @IsOptional()
  @IsString()
  @Length(3, 30)
  username?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string | null;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(32791)
  @Matches(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)
  avatarImage?: string;
}
