import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';

import { CreateUserDto } from '../../users/dto/create-user.dto';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ConfirmEmailVerificationDto } from '../dto/confirm-email-verification.dto';
import { LoginDto } from '../dto/login.dto';
import { LoginResponseDto } from '../dto/login-response.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuthService } from '../services/auth.service';
import { RequestPasswordResetDto } from '../dto/request-password-reset.dto';
import { ConfirmPasswordResetDto } from '../dto/confirm-password-reset.dto';

type AuthenticatedRequest = Request & {
  user: UserResponseDto;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getProfile(@Req() request: AuthenticatedRequest): UserResponseDto {
    return request.user;
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async logout(@Req() request: AuthenticatedRequest) {
    await this.authService.logout(request.user.id);

    return {
      message: 'Logout successful',
      loggedOut: true,
    };
  }

  @Patch('password')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.authService.changePassword(request.user.id, dto);
  }

  @Post('email-verification/request')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  requestEmailVerification(
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.authService.requestEmailVerification(request.user.id);
  }

  @Post('email-verification/confirm')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  confirmEmailVerification(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ConfirmEmailVerificationDto,
  ): Promise<void> {
    return this.authService.confirmEmailVerification(request.user.id, dto.code);
  }

  @Post('password-reset/request')
  @HttpCode(204)
  requestPasswordReset(@Body() dto: RequestPasswordResetDto): Promise<void> {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('password-reset/confirm')
  @HttpCode(204)
  confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto): Promise<void> {
    return this.authService.confirmPasswordReset(
      dto.email,
      dto.code,
      dto.newPassword,
    );
  }
}
