import {
  Body,
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
import { IsBoolean, IsIn } from 'class-validator';
import { configurableCategories } from '../notification-events';
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

class NotificationPreferenceDto {
  @IsIn(configurableCategories)
  category!: typeof configurableCategories[number];

  @IsBoolean()
  enabled!: boolean;
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

  @Get('preferences')
  getPreferences(@Req() request: AuthenticatedRequest) {
    return this.notificationsService.getPreferences(request.user.id);
  }

  @Patch('preferences')
  setPreference(@Req() request: AuthenticatedRequest, @Body() dto: NotificationPreferenceDto) {
    return this.notificationsService.setPreference(request.user.id, dto.category, dto.enabled);
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
