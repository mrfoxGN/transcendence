import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { IsNull, Repository } from 'typeorm';

import { ListNotificationsDto } from '../dto/list-notifications.dto';
import { NotificationResponseDto } from '../dto/notification-response.dto';
import { Notification } from '../entities/notification.entity';

interface CreateNotificationInput {
  userId: string;
  workspaceId?: string | null;
  type: string;
  message: string;
  relatedResourceType?: string | null;
  relatedResourceId?: string | null;
  payload?: unknown;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
  ) {}

  async createForUser(
    input: CreateNotificationInput,
  ): Promise<NotificationResponseDto> {
    const notification = this.notificationsRepository.create({
      id: randomUUID(),
      userId: input.userId,
      workspaceId: input.workspaceId ?? null,
      type: input.type,
      message: input.message,
      relatedResourceType: input.relatedResourceType ?? null,
      relatedResourceId: input.relatedResourceId ?? null,
      payload: input.payload ?? null,
      createdAt: new Date(),
      readAt: null,
    });

    const saved = await this.notificationsRepository.save(notification);

    return this.toResponse(saved);
  }

  async findAll(
    userId: string,
    query: ListNotificationsDto,
  ): Promise<NotificationResponseDto[]> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where =
      query.unreadOnly === true
        ? {
            userId,
            readAt: IsNull(),
          }
        : {
            userId,
          };

    const notifications = await this.notificationsRepository.find({
      where,
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
      skip,
      take: limit,
    });

    return notifications.map((notification) => this.toResponse(notification));
  }

  async countUnread(userId: string): Promise<{ count: number }> {
    const count = await this.notificationsRepository.count({
      where: {
        userId,
        readAt: IsNull(),
      },
    });

    return { count };
  }

  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<NotificationResponseDto> {
    const notification = await this.notificationsRepository.findOne({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.readAt) {
      notification.readAt = new Date();

      await this.notificationsRepository.save(notification);
    }

    return this.toResponse(notification);
  }

  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationsRepository.update(
      {
        userId,
        readAt: IsNull(),
      },
      {
        readAt: new Date(),
      },
    );

    return {
      updated: result.affected ?? 0,
    };
  }

  private toResponse(notification: Notification): NotificationResponseDto {
    return {
      id: notification.id,
      workspaceId: notification.workspaceId,
      type: notification.type,
      message: notification.message,
      relatedResourceType: notification.relatedResourceType,
      relatedResourceId: notification.relatedResourceId,
      payload: notification.payload,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
    };
  }
}
