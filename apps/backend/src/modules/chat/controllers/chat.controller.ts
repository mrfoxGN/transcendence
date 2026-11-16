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
import { chatAttachmentLimit } from '../message-collaboration';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { ChatMessageResponseDto } from '../dto/chat-message-response.dto';
import { ListChatMessagesDto } from '../dto/list-chat-messages.dto';
import { SendChatMessageDto } from '../dto/send-chat-message.dto';
import { ChatService } from '../services/chat.service';

type AuthenticatedRequest = Request & {
  user: UserResponseDto;
};

@Controller('workspaces/:workspaceId/messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('unread-count')
  async unreadCount(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ count: number }> {
    return { count: await this.chatService.unreadCount(workspaceId, request.user.id) };
  }

  @Patch(':messageId/read')
  @HttpCode(204)
  markRead(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.chatService.markRead(workspaceId, request.user.id, messageId);
  }

  @Get()
  listMessages(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query() query: ListChatMessagesDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ChatMessageResponseDto[]> {
    return this.chatService.listMessages(workspaceId, request.user.id, query);
  }

  @Get(':messageId/attachment')
  downloadAttachment(
    @Param('workspaceId', ParseUUIDPipe) threadId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.chatService.downloadAttachment(threadId, request.user.id, messageId, response);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: chatAttachmentLimit, files: 1 } }))
  sendMessage(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: SendChatMessageDto,
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<ChatMessageResponseDto> {
    if (!file && !dto.content.trim()) throw new BadRequestException('Message content is required');
    return file ? this.chatService.sendMessage(workspaceId, request.user.id, dto, file) : this.chatService.sendMessage(workspaceId, request.user.id, dto);
  }
}
