import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, IsNull, Repository } from 'typeorm';

import { configurableCategories, notificationCategories } from '../notification-events';
import { WorkspaceInvitation } from '../../workspaces/entities/workspace-invitation.entity';
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

    const where = {
      userId,
      ...(query.unreadOnly ? { readAt: IsNull() } : {}),
      ...(query.category ? { type: In(notificationCategories[query.category]) } : {}),
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

    const invitationIds = notifications.flatMap(notification =>
      notification.type === 'WORKSPACE_INVITATION' && notification.relatedResourceId
        ? [notification.relatedResourceId] : []);
    const invitations = invitationIds.length
      ? await this.notificationsRepository.manager.getRepository(WorkspaceInvitation).findBy({
        id: In(invitationIds),
        invitedUserId: userId,
      })
      : [];
    const invitationsById = new Map(invitations.map(invitation => [invitation.id, invitation]));
    return notifications.map(notification => {
      const response = this.toResponse(notification);
      if (notification.type !== 'WORKSPACE_INVITATION') return response;
      const invitation = invitationsById.get(notification.relatedResourceId ?? '');
      const expired = invitation?.status === 'PENDING' && invitation.expiresAt && invitation.expiresAt <= new Date();
      return { ...response, invitationStatus: expired ? 'EXPIRED' : invitation?.status ?? 'UNAVAILABLE' };
    });
  }

  async getPreferences(userId: string) {
    const rows: { category: string }[] = await this.notificationsRepository.query(
      'SELECT category FROM notification_preferences WHERE user_id = ?', [userId],
    );
    const disabled = new Set(rows.map(row => row.category));
    return Object.fromEntries(configurableCategories.map(category => [category, !disabled.has(category)]));
  }

  async setPreference(userId: string, category: typeof configurableCategories[number], enabled: boolean) {
    if (enabled) {
      await this.notificationsRepository.query(
        'DELETE FROM notification_preferences WHERE user_id = ? AND category = ?', [userId, category],
      );
    } else {
      await this.notificationsRepository.query(
        `INSERT INTO notification_preferences (user_id, category) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE category = notification_preferences.category`, [userId, category],
      );
    }
    return { enabled };
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
