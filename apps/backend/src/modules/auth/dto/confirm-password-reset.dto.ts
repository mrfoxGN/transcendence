import {
  IsEmail,
  IsNumberString,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class ConfirmPasswordResetDto {
  @IsEmail()
  email!: string;

  @IsNumberString({ no_symbols: true })
  @Length(6, 6)
  code!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
