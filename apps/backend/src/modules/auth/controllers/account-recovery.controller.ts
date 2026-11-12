import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { UserResponseDto } from '../../users/dto/user-response.dto';
import { AccountTokenDto, RequestPasswordResetDto, ResetPasswordDto } from '../dto/account-recovery.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AccountRecoveryService } from '../services/account-recovery.service';

@Controller('auth')
export class AccountRecoveryController {
  constructor(private readonly recovery: AccountRecoveryService) {}

  @Post('email-verification/request')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  requestVerification(@Req() request: Request & { user: UserResponseDto }) {
    return this.recovery.requestVerification(request.user.id);
  }

  @Post('email-verification/confirm')
  @HttpCode(204)
  verifyEmail(@Body() dto: AccountTokenDto) {
    return this.recovery.verifyEmail(dto.token);
  }

  @Post('password-reset/request')
  @HttpCode(204)
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.recovery.requestPasswordReset(dto.email);
  }

  @Post('password-reset/confirm')
  @HttpCode(204)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.recovery.resetPassword(dto.token, dto.password);
  }
}
