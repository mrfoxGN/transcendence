import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ListNotificationsDto } from '../dto/list-notifications.dto';
import { NotificationResponseDto } from '../dto/notification-response.dto';
import { NotificationsService } from '../services/notifications.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(
    @Req()
    request: AuthenticatedRequest,

    @Query()
    query: ListNotificationsDto,
  ): Promise<NotificationResponseDto[]> {
    return this.notificationsService.findAll(request.user.id, query);
  }

  @Get('unread-count')
  async countUnread(
    @Req()
    request: AuthenticatedRequest,
  ): Promise<{ count: number }> {
    return this.notificationsService.countUnread(request.user.id);
  }

  @Patch('read-all')
  async markAllAsRead(
    @Req()
    request: AuthenticatedRequest,
  ): Promise<{ updated: number }> {
    return this.notificationsService.markAllAsRead(request.user.id);
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id', ParseUUIDPipe)
    notificationId: string,

    @Req()
    request: AuthenticatedRequest,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.markAsRead(
      notificationId,
      request.user.id,
    );
  }
}
