import { IsNumberString, Length } from 'class-validator';

export class ConfirmEmailVerificationDto {
  @IsNumberString({ no_symbols: true })
  @Length(6, 6)
  code!: string;
}
