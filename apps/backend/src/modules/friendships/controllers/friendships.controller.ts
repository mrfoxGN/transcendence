import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { FriendshipResponseDto } from '../dto/friendship-response.dto';
import { FriendshipsService } from '../services/friendships.service';

type AuthenticatedRequest = Request & {
  user: UserResponseDto;
};

@Controller('friendships')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FriendshipsController {
  constructor(private readonly friendshipsService: FriendshipsService) {}

  @Post('requests/:userId')
  sendRequest(
    @Param('userId', ParseUUIDPipe) otherUserId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<FriendshipResponseDto> {
    return this.friendshipsService.request(request.user.id, otherUserId);
  }

  @Get('requests')
  listRequests(
    @Req() request: AuthenticatedRequest,
  ): Promise<FriendshipResponseDto[]> {
    return this.friendshipsService.listRequests(request.user.id);
  }

  @Post('requests/:requestId/accept')
  @HttpCode(200)
  accept(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<FriendshipResponseDto> {
    return this.friendshipsService.accept(requestId, request.user.id);
  }

  @Post('requests/:requestId/reject')
  @HttpCode(200)
  reject(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<FriendshipResponseDto> {
    return this.friendshipsService.reject(requestId, request.user.id);
  }

  @Delete('requests/:requestId')
  @HttpCode(204)
  cancelRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.friendshipsService.cancelRequest(requestId, request.user.id);
  }

  @Get()
  listFriends(
    @Req() request: AuthenticatedRequest,
  ): Promise<FriendshipResponseDto[]> {
    return this.friendshipsService.listFriends(request.user.id);
  }

  @Delete(':userId')
  @HttpCode(204)
  removeFriend(
    @Param('userId', ParseUUIDPipe) otherUserId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.friendshipsService.removeFriend(request.user.id, otherUserId);
  }
}
