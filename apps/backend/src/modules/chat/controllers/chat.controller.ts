import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';

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

  @Get()
  listMessages(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query() query: ListChatMessagesDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ChatMessageResponseDto[]> {
    return this.chatService.listMessages(
      workspaceId,
      request.user.id,
      query,
    );
  }

  @Post()
  sendMessage(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: SendChatMessageDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ChatMessageResponseDto> {
    return this.chatService.sendMessage(
      workspaceId,
      request.user.id,
      dto,
    );
  }
}
