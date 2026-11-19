export class LoginResponseDto {
  accessToken?: string;
  twoFactorRequired?: boolean;
  twoFactorToken?: string;
}
