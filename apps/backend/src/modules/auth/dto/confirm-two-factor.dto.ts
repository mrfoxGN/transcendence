import { IsNotEmpty, IsNumberString, IsString, Length } from 'class-validator';

export class ConfirmTwoFactorDto {
  @IsString()
  @IsNotEmpty()
  twoFactorToken!: string;

  @IsNumberString({ no_symbols: true })
  @Length(6, 6)
  code!: string;
}
