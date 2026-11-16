import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { IsNull, QueryFailedError, Repository } from 'typeorm';

import type { Response } from 'express';
import { attachmentFields, downloadChatAttachment, messageContext, searchMessages, validateReply } from '../../chat/message-collaboration';
import { listByMessageCursor } from '../../chat/message-cursor';
import { UserStatus } from '../../../database/enums/database.enums';
import { mentionedNames } from '../../notifications/notification-events';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { UsersService } from '../../users/services/users.service';
import { DirectConversationResponseDto } from '../dto/direct-conversation-response.dto';
import { DirectMessageResponseDto } from '../dto/direct-message-response.dto';
import { ListDirectMessagesDto } from '../dto/list-direct-messages.dto';
import { SendDirectMessageDto } from '../dto/send-direct-message.dto';
import { DirectConversation } from '../entities/direct-conversation.entity';
import { DirectMessage } from '../entities/direct-message.entity';
import { DirectChatGateway } from '../gateways/direct-chat.gateway';

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    @InjectRepository(DirectConversation)
    private readonly conversationsRepository: Repository<DirectConversation>,
    @InjectRepository(DirectMessage)
    private readonly messagesRepository: Repository<DirectMessage>,
    private readonly usersService: UsersService,
    private readonly directChatGateway: DirectChatGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  async openConversation(
    userId: string,
    otherUserId: string,
  ): Promise<DirectConversationResponseDto> {
    const otherUser = await this.usersService.findById(otherUserId);

    if (userId === otherUser.id) {
      throw new BadRequestException('Cannot chat with yourself');
    }

    if (otherUser.status !== UserStatus.ACTIVE) {
      throw new NotFoundException('User not found');
    }

    const [userAId, userBId] =
      userId < otherUser.id ? [userId, otherUser.id] : [otherUser.id, userId];

    const existing = await this.conversationsRepository.findOneBy({
      userAId,
      userBId,
    });

    if (existing) {
      return this.toConversationResponse(existing, otherUser.id);
    }

    const now = new Date();

    const conversation = this.conversationsRepository.create({
      id: randomUUID(),
      userAId,
      userBId,
      userALastReadAt: null,
      userBLastReadAt: null,
      lastMessageAt: null,
      createdAt: now,
      updatedAt: now,
    });

    try {
      const saved = await this.conversationsRepository.save(conversation);
      return this.toConversationResponse(saved, otherUser.id);
    } catch (error: unknown) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === 'ER_DUP_ENTRY'
      ) {
        const existing = await this.conversationsRepository.findOneBy({
          userAId,
          userBId,
        });

        if (existing) {
          return this.toConversationResponse(existing, otherUser.id);
        }
      }

      throw error;
    }
  }

  async listConversations(
    userId: string,
    query: ListDirectMessagesDto,
  ): Promise<DirectConversationResponseDto[]> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(skip)) {
      throw new BadRequestException('Invalid page');
    }

    const conversations = await this.conversationsRepository.find({
      where: [{ userAId: userId }, { userBId: userId }],
      relations: { userA: true, userB: true },
      select: {
        id: true, userAId: true, userBId: true, lastMessageAt: true, createdAt: true,
        userA: { id: true, username: true },
        userB: { id: true, username: true },
      },
      order: {
        lastMessageAt: 'DESC',
        createdAt: 'DESC',
        id: 'DESC',
      },
      skip,
      take: limit,
    });

    if (!conversations.length) return [];
    const lastRead = 'CASE WHEN conversation.userAId = :userId THEN conversation.userALastReadAt ELSE conversation.userBLastReadAt END';
    const counts = await this.messagesRepository.createQueryBuilder('message')
      .innerJoin(DirectConversation, 'conversation', 'conversation.id = message.conversationId')
      .select('message.conversationId', 'conversationId')
      .addSelect('COUNT(*)', 'unreadCount')
      .where('message.conversationId IN (:...ids)', { ids: conversations.map(conversation => conversation.id) })
      .andWhere('message.senderId != :userId', { userId })
      .andWhere('message.deletedAt IS NULL')
      .andWhere(`((${lastRead}) IS NULL OR message.createdAt > (${lastRead}))`)
      .groupBy('message.conversationId')
      .getRawMany<{ conversationId: string; unreadCount: string }>();
    const unread = new Map(counts.map(count => [count.conversationId, Number(count.unreadCount)]));
    return conversations.map(conversation => {
      const other = conversation.userAId === userId ? conversation.userB : conversation.userA;
      const otherUserId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;
      return {
        ...this.toConversationResponse(conversation, otherUserId),
        otherUsername: other?.username,
        unreadCount: unread.get(conversation.id) ?? 0,
      };
    });
  }

  async unreadCount(userId: string): Promise<number> {
    const lastRead = 'CASE WHEN conversation.userAId = :userId THEN conversation.userALastReadAt ELSE conversation.userBLastReadAt END';
    return this.messagesRepository.createQueryBuilder('message')
      .innerJoin(DirectConversation, 'conversation', 'conversation.id = message.conversationId')
      .where('(conversation.userAId = :userId OR conversation.userBId = :userId)', { userId })
      .andWhere('message.senderId != :userId')
      .andWhere('message.deletedAt IS NULL')
      .andWhere(`((${lastRead}) IS NULL OR message.createdAt > (${lastRead}))`)
      .getCount();
  }

  async markRead(userId: string, conversationId: string): Promise<void> {
    const conversation = await this.conversationsRepository.findOneBy({
      id: conversationId,
    });

    if (
      !conversation ||
      (conversation.userAId !== userId && conversation.userBId !== userId)
    ) {
      throw new NotFoundException('Conversation not found');
    }

    const now = new Date();

    if (conversation.userAId === userId) {
      await this.conversationsRepository.update(
        { id: conversationId },
        { userALastReadAt: now, updatedAt: now },
      );
    } else {
      await this.conversationsRepository.update(
        { id: conversationId },
        { userBLastReadAt: now, updatedAt: now },
      );
    }
    this.directChatGateway.emitReadUpdated(userId);
  }

  async sendMessage(
    senderId: string,
    conversationId: string,
    dto: SendDirectMessageDto,
    file?: Express.Multer.File,
  ): Promise<DirectMessageResponseDto> {
    if (typeof dto?.content !== 'string' || (!dto.content.trim() && !file)) {
      throw new BadRequestException('Message content is required');
    }

    const content = dto.content.trim();
    const attachment = attachmentFields(file);

    const result = await this.messagesRepository.manager.transaction(
      async (manager) => {
        if (dto.requestId) await manager.query('SELECT id FROM direct_conversations WHERE id = ? FOR UPDATE', [conversationId]);
        const conversation = await manager.findOneBy(DirectConversation, {
          id: conversationId,
        });

        if (
          !conversation ||
          (conversation.userAId !== senderId &&
            conversation.userBId !== senderId)
        ) {
          throw new NotFoundException('Conversation not found');
        }

        if (dto.requestId) {
          const previous = await manager.findOneBy(DirectMessage, { id: dto.requestId });
          if (previous) {
            if (previous.conversationId !== conversationId || previous.senderId !== senderId || previous.deletedAt) {
              throw new ConflictException('Message request ID is already in use');
            }
            return { message: previous, replay: true as const };
          }
        }
        if (dto.replyToId) await validateReply(manager.getRepository(DirectMessage), { conversationId }, dto.replyToId);
        const now = new Date();

        const message = manager.create(DirectMessage, {
          id: dto.requestId ?? randomUUID(),
          conversationId,
          senderId,
          content,
          ...(dto.replyToId ? { replyToId: dto.replyToId } : {}),
          ...attachment,
          createdAt: now,
          editedAt: null,
          deletedAt: null,
        });

        if (dto.requestId) await manager.insert(DirectMessage, message);
        const saved = dto.requestId ? message : await manager.save(DirectMessage, message);

        await manager.update(
          DirectConversation,
          { id: conversationId },
          { lastMessageAt: now, updatedAt: now },
        );

        return {
          replay: false as const,
          userAId: conversation.userAId,
          userBId: conversation.userBId,
          message: saved,
        };
      },
    );

    const { id, senderId: authorId, content: body, createdAt } = result.message;
    const context = await messageContext(this.messagesRepository, { conversationId }, [result.message]);
    const response = { id, conversationId, senderId: authorId, content: body, createdAt, ...context(result.message) };
    if (result.replay) return response;

    try {
      this.directChatGateway.emitMessageCreated(
        result.userAId,
        result.userBId,
        response,
      );
    } catch (error) {
      this.logger.error(
        'Could not notify chat clients',
        error instanceof Error ? error.stack : String(error),
      );
    }

    const recipientId =
      result.userAId === senderId ? result.userBId : result.userAId;

    try {
      const names = mentionedNames(content);
      const recipient = names.length ? await this.usersService.findById(recipientId) : undefined;
      const mentioned = recipient && names.some(name => name.toLowerCase() === recipient.username.toLowerCase());
      const mentionEnabled = mentioned && (await this.notificationsService.getPreferences(recipientId)).mentions;
      await this.notificationsService.createForUser({
        userId: recipientId,
        workspaceId: null,
        type: mentionEnabled ? 'DIRECT_MENTION' : 'DIRECT_MESSAGE',
        message: mentionEnabled ? 'You were mentioned in a direct message' : 'You received a new direct message',
        relatedResourceType: 'direct_conversation',
        relatedResourceId: conversationId,
        payload: {
          senderId,
          messageId: result.message.id,
        },
      });
    } catch (error) {
      this.logger.error(
        `Could not create direct message notification for user ${recipientId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return response;
  }

  async downloadAttachment(conversationId: string, userId: string, messageId: string, response: Response) {
    const conversation = await this.conversationsRepository.findOneBy({ id: conversationId });
    if (!conversation || (conversation.userAId !== userId && conversation.userBId !== userId)) {
      throw new NotFoundException('Conversation not found');
    }
    return downloadChatAttachment(this.messagesRepository, 'conversation_id', conversationId, messageId, response);
  }

  async listMessages(
    userId: string,
    conversationId: string,
    query: ListDirectMessagesDto,
  ): Promise<DirectMessageResponseDto[]> {
    const conversation = await this.conversationsRepository.findOneBy({
      id: conversationId,
    });

    if (
      !conversation ||
      (conversation.userAId !== userId && conversation.userBId !== userId)
    ) {
      throw new NotFoundException('Conversation not found');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(skip)) {
      throw new BadRequestException('Invalid page');
    }

    const messages = query.q?.trim()
      ? await searchMessages(this.messagesRepository, 'conversation_id', conversationId, query.q.trim(), skip, limit)
      : query.before || query.after
        ? await listByMessageCursor(this.messagesRepository, 'conversation_id', conversationId, query, limit)
        : await this.messagesRepository.find({
      where: {
        conversationId,
        deletedAt: IsNull(),
      },
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
      skip,
      take: limit,
    });

    if (!query.after && !query.q?.trim()) messages.reverse();
    const context = await messageContext(this.messagesRepository, { conversationId }, messages);
    return messages.map((message) => ({
      ...context(message),
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt,
    }));
  }

  private toConversationResponse(
    conversation: DirectConversation,
    otherUserId: string,
  ): DirectConversationResponseDto {
    return {
      id: conversation.id,
      otherUserId,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
    };
  }
}
