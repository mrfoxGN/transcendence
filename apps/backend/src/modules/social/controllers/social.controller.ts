import {
  Body,
  Controller,
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
import { DirectConversationResponseDto } from '../dto/direct-conversation-response.dto';
import { DirectMessageResponseDto } from '../dto/direct-message-response.dto';
import { SendDirectMessageDto } from '../dto/send-direct-message.dto';
import { SocialService } from '../services/social.service';

type AuthenticatedRequest = Request & {
  user: UserResponseDto;
};

@Controller('direct-conversations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Post(':userId')
  @HttpCode(200)
  openConversation(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<DirectConversationResponseDto> {
    return this.socialService.openConversation(request.user.id, userId);
  }

  @Post(':id/messages')
  sendMessage(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendDirectMessageDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<DirectMessageResponseDto> {
    return this.socialService.sendMessage(
      request.user.id,
      conversationId,
      dto,
    );
  }
}