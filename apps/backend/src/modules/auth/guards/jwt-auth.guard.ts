import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { UserStatus } from '../../../database/enums/database.enums';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { UsersService } from '../../users/services/users.service';

type AuthenticatedRequest = Request & {
  user?: UserResponseDto;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const [type, token] = request.headers.authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException();
    }

    let payload: { sub?: unknown; tokenVersion?: unknown };

    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException();
    }

    if (
      typeof payload.sub !== 'string' ||
      !Number.isInteger(payload.tokenVersion) ||
      (payload.tokenVersion as number) < 0
    ) {
      throw new UnauthorizedException();
    }

    let authUser: Awaited<ReturnType<UsersService['findForAuth']>>;

    try {
      authUser = await this.usersService.findForAuth(payload.sub);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException();
      }
      throw error;
    }

    if (
      authUser.user.status !== UserStatus.ACTIVE ||
      authUser.tokenVersion !== payload.tokenVersion
    ) {
      throw new UnauthorizedException();
    }

    request.user = authUser.user;
    return true;
  }
}
