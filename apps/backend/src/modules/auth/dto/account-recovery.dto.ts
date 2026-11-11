import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

export class RequestPasswordResetDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;
}

export class AccountTokenDto {
  @Matches(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/i)
  token!: string;
}

export class ResetPasswordDto extends AccountTokenDto {
  @IsString()
  @Length(8, 128)
  password!: string;
}
