import { Injectable, UnauthorizedException } from '@nestjs/common';
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

@Injectable()
export class AuthService {
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

  return {
      accessToken: await this.jwtService.signAsync({
        sub: user.id,
        tokenVersion: user.tokenVersion,
      }),
    };
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.revokeTokens(userId);

    this.directChatGateway.disconnectUser(userId);
    this.workspaceChatGateway.disconnectUser(userId);
  }
}