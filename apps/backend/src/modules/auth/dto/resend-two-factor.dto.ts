import { IsNotEmpty, IsString } from 'class-validator';

export class ResendTwoFactorDto {
  @IsString()
  @IsNotEmpty()
  twoFactorToken!: string;
}
