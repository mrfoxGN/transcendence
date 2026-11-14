import { IsEmail, IsString } from 'class-validator';

export class RequestPasswordResetDto {
  @IsString()
  @IsEmail()
  email!: string;
}
