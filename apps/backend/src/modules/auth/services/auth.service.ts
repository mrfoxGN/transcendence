import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UserStatus } from '../../../database/enums/database.enums';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/services/users.service';
import { LoginDto } from '../dto/login.dto';
import { LoginResponseDto } from '../dto/login-response.dto';
import { WorkspaceChatGateway } from '../../chat/gateways/workspace-chat.gateway';
import { DirectChatGateway } from '../../social/gateways/direct-chat.gateway';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ConfirmTwoFactorDto } from '../dto/confirm-two-factor.dto';
import { ResendTwoFactorDto } from '../dto/resend-two-factor.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly directChatGateway: DirectChatGateway,
    private readonly workspaceChatGateway: WorkspaceChatGateway,
  ) {}

  register(dto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(dto);
  }

  async validateCredentials(dto: LoginDto): Promise<User> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!passwordMatches || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.validateCredentials(dto);

    if (user.isTwoFactorEnabled) {
      const challenge = await this.usersService.createTwoFactorCode(user.id);

      if (challenge) {
        try {
          await this.sendCodeEmail(
            challenge.email,
            challenge.code,
            'DevUP Two-Factor Authentication Code',
          );
        } catch (error) {
          this.logger.error(
            '2FA email could not be sent',
            error instanceof Error ? error.stack : String(error),
          );
        }
      }

      const twoFactorToken = await this.jwtService.signAsync(
        {
          sub: user.id,
          purpose: '2fa_login',
          tokenVersion: user.tokenVersion,
        },
        { expiresIn: '10m' },
      );

      return {
        twoFactorRequired: true,
        twoFactorToken,
      };
    }

    return {
      accessToken: await this.jwtService.signAsync({
        sub: user.id,
        tokenType: 'access',
        tokenVersion: user.tokenVersion,
      }),
    };
  }

  async confirmTwoFactorLogin(
    dto: ConfirmTwoFactorDto,
  ): Promise<LoginResponseDto> {
    let payload: { sub?: unknown; purpose?: unknown; tokenVersion?: unknown };
    try {
      payload = await this.jwtService.verifyAsync(dto.twoFactorToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired 2FA session');
    }

    if (
      typeof payload.sub !== 'string' ||
      payload.purpose !== '2fa_login' ||
      !Number.isInteger(payload.tokenVersion)
    ) {
      throw new UnauthorizedException('Invalid or expired 2FA session');
    }

    const user = await this.usersService.verifyTwoFactorCode(
      payload.sub,
      dto.code,
    );

    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    return {
      accessToken: await this.jwtService.signAsync({
        sub: user.id,
        tokenType: 'access',
        tokenVersion: user.tokenVersion,
      }),
    };
  }

  async resendTwoFactorLogin(dto: ResendTwoFactorDto): Promise<void> {
    let payload: { sub?: unknown; purpose?: unknown; tokenVersion?: unknown };
    try {
      payload = await this.jwtService.verifyAsync(dto.twoFactorToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired 2FA session');
    }

    if (
      typeof payload.sub !== 'string' ||
      payload.purpose !== '2fa_login' ||
      !Number.isInteger(payload.tokenVersion)
    ) {
      throw new UnauthorizedException('Invalid or expired 2FA session');
    }

    const challenge = await this.usersService.createTwoFactorCode(payload.sub);
    if (!challenge) {
      throw new BadRequestException(
        'Please wait a minute before requesting another code',
      );
    }

    await this.sendCodeEmail(
      challenge.email,
      challenge.code,
      'DevUP Two-Factor Authentication Code',
    );
  }

  async requestEnableTwoFactor(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user.emailVerified) {
      throw new BadRequestException(
        'Please verify your email address before enabling two-factor authentication',
      );
    }

    const challenge = await this.usersService.createTwoFactorCode(userId);
    if (!challenge) {
      throw new BadRequestException(
        'Please wait a minute before requesting another code',
      );
    }

    await this.sendCodeEmail(
      challenge.email,
      challenge.code,
      'Confirm Enabling Two-Factor Authentication on DevUP',
    );
  }

  async confirmEnableTwoFactor(
    userId: string,
    code: string,
  ): Promise<UserResponseDto> {
    await this.usersService.verifyTwoFactorCode(userId, code);
    return this.usersService.enableTwoFactor(userId);
  }

  async disableTwoFactor(userId: string): Promise<UserResponseDto> {
    return this.usersService.disableTwoFactor(userId);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.revokeTokens(userId);

    this.directChatGateway.disconnectUser(userId);
    this.workspaceChatGateway.disconnectUser(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    await this.usersService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );

    this.directChatGateway.disconnectUser(userId);
    this.workspaceChatGateway.disconnectUser(userId);
  }

  async requestEmailVerification(userId: string): Promise<void> {
    const verification =
      await this.usersService.createEmailVerificationCode(userId);

    if (verification === null) {
      return;
    }

    await this.sendCodeEmail(
      verification.email,
      verification.code,
      'Verify your email',
    );
  }

  async requestPasswordReset(email: string): Promise<void> {
    const code = await this.usersService.createPasswordResetCode(email);

    // Give the same response when no account has this email.
    if (code === null) {
      return;
    }

    try {
      await this.sendCodeEmail(email, code, 'Reset your password');
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) {
        throw error;
      }

      this.logger.error('Password reset email could not be sent', error.stack);
    }
  }

  async confirmPasswordReset(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    const userId = await this.usersService.resetPasswordWithCode(
      email,
      code,
      newPassword,
    );

    this.directChatGateway.disconnectUser(userId);
    this.workspaceChatGateway.disconnectUser(userId);
  }

  private async sendCodeEmail(
    email: string,
    code: string,
    subject: string,
  ): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !from) {
      throw new ServiceUnavailableException('Email service is not configured');
    }

    let response: Response;

    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject,
          text: `Your code is ${code}. It expires in 10 minutes.`,
        }),
      });
    } catch {
      throw new ServiceUnavailableException('Could not send email');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException('Could not send email');
    }
  }

  confirmEmailVerification(userId: string, code: string): Promise<void> {
    return this.usersService.confirmEmailVerification(userId, code);
  }
}
