import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { UsersService } from '../services/users.service';

type AuthenticatedRequest = Request & {
  user: UserResponseDto;
};

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id/avatar/:avatarId')
  async getAvatar(
    @Param('id', ParseUUIDPipe) userId: string,
    @Param('avatarId', ParseUUIDPipe) avatarId: string,
    @Res() response: Response,
  ): Promise<void> {
    const absolutePath = await this.usersService.getAvatarPath(
      userId,
      avatarId,
    );

    response.type('image/jpeg');
    response.sendFile(absolutePath);
  }

  @Get(':id')
  getUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserResponseDto> {
    if (request.user.id !== id) {
      throw new ForbiddenException();
    }

    return this.usersService.findById(id);
  }

  @Patch(':id')
  updateProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfileDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserResponseDto> {
    if (request.user.id !== id) {
      throw new ForbiddenException();
    }

    return this.usersService.updateProfile(id, dto);
  }
}
