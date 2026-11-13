import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { chatAttachmentLimit } from '../../chat/message-collaboration';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { DirectConversationResponseDto } from '../dto/direct-conversation-response.dto';
import { DirectMessageResponseDto } from '../dto/direct-message-response.dto';
import { ListDirectMessagesDto } from '../dto/list-direct-messages.dto';
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

  @Get('unread-count')
  async unreadCount(@Req() request: AuthenticatedRequest): Promise<{ count: number }> {
    return { count: await this.socialService.unreadCount(request.user.id) };
  }

  @Get()
  listConversations(
    @Query() query: ListDirectMessagesDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<DirectConversationResponseDto[]> {
    return this.socialService.listConversations(request.user.id, query);
  }

  @Post(':userId')
  @HttpCode(200)
  openConversation(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<DirectConversationResponseDto> {
    return this.socialService.openConversation(request.user.id, userId);
  }

  @Get(':id/messages/:messageId/attachment')
  downloadAttachment(
    @Param('id', ParseUUIDPipe) threadId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.socialService.downloadAttachment(threadId, request.user.id, messageId, response);
  }

  @Post(':id/messages')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: chatAttachmentLimit, files: 1 } }))
  sendMessage(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendDirectMessageDto,
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<DirectMessageResponseDto> {
    if (!file && !dto.content.trim()) throw new BadRequestException('Message content is required');
    return file ? this.socialService.sendMessage(request.user.id, conversationId, dto, file) : this.socialService.sendMessage(request.user.id, conversationId, dto);
  }

  @Get(':id/messages')
  listMessages(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Query() query: ListDirectMessagesDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<DirectMessageResponseDto[]> {
    return this.socialService.listMessages(
      request.user.id,
      conversationId,
      query,
    );
  }

  @Patch(':id/read')
  @HttpCode(204)
  markRead(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.socialService.markRead(request.user.id, conversationId);
  }
}
