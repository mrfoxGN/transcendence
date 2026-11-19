import {
  BadRequestException,
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { IsNull, QueryFailedError, Repository, In, Not } from 'typeorm';

import { UserStatus } from '../../../database/enums/database.enums';
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
      relations: {
        userA: true,
        userB: true,
      },
      order: {
        lastMessageAt: 'DESC',
        createdAt: 'DESC',
        id: 'DESC',
      },
      skip,
      take: limit,
    });

    if (conversations.length === 0) {
      return [];
    }

    const messages = await this.messagesRepository.find({
      where: {
        conversationId: In(conversations.map((conversation) => conversation.id)),
        senderId: Not(userId),
        deletedAt: IsNull(),
      },
      select: {
        conversationId: true,
        createdAt: true,
      },
    });

    return conversations.map((conversation) => {
      const isUserA = conversation.userAId === userId;

      const otherUserId = isUserA
        ? conversation.userBId
        : conversation.userAId;

      const otherUser = isUserA
        ? conversation.userB
        : conversation.userA;

      const lastReadAt = isUserA
        ? conversation.userALastReadAt
        : conversation.userBLastReadAt;

      const unreadCount = messages.filter(
        (message) =>
          message.conversationId === conversation.id &&
          (lastReadAt === null || message.createdAt > lastReadAt),
      ).length;

      return {
        ...this.toConversationResponse(conversation, otherUserId),
        otherUsername: otherUser.username,
        unreadCount,
      };
    });
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
    }
    else{
      await this.conversationsRepository.update(
        { id: conversationId },
        { userBLastReadAt: now, updatedAt: now },
      );
    }
    this.directChatGateway.emitReadUpdated(userId);
  }

  async unreadCount(userId: string): Promise<number> {
    const conversations = await this.conversationsRepository.find({
      where: [
        { userAId: userId },
        { userBId: userId },
      ],
    });

    if (conversations.length === 0) {
      return 0;
    }

    const messages = await this.messagesRepository.find({
      where: {
        conversationId: In(conversations.map((conversation) => conversation.id)),
        senderId: Not(userId),
        deletedAt: IsNull(),
      },
      select: {
        conversationId: true,
        createdAt: true,
      },
    });

    let count = 0;

    for (const conversation of conversations) {
      const lastReadAt =
        conversation.userAId === userId
          ? conversation.userALastReadAt
          : conversation.userBLastReadAt;

      count += messages.filter(
        (message) =>
          message.conversationId === conversation.id &&
          (lastReadAt === null || message.createdAt > lastReadAt),
      ).length;
    }
    return count;
  }

  async sendMessage(
    senderId: string,
    conversationId: string,
    dto: SendDirectMessageDto,
  ): Promise<DirectMessageResponseDto> {
    if (typeof dto?.content !== 'string' || !dto.content.trim()) {
      throw new BadRequestException('Message content is required');
    }

    const content = dto.content.trim();

    const result = await this.messagesRepository.manager.transaction(
      async (manager) => {
        const conversation = await manager.findOne(DirectConversation, {
          where: { id: conversationId },
          lock: { mode: 'pessimistic_write' },
        });

        if (
          !conversation ||
          (conversation.userAId !== senderId &&
            conversation.userBId !== senderId)
        ) {
          throw new NotFoundException('Conversation not found');
        }

        if (dto.requestId) {
          const previous = await manager.findOne(DirectMessage, {
          where: { id: dto.requestId },
          relations: { replyTo: true },
        });

          if (previous) {
            if (
              previous.conversationId !== conversationId ||
              previous.senderId !== senderId ||
              previous.deletedAt !== null ||
              previous.content !== content ||
              previous.replyToId !== (dto.replyToId ?? null)
            ) {
              throw new ConflictException('Message request ID is already in use');
            }
          
            return {
              replay: true as const,
              userAId: conversation.userAId,
              userBId: conversation.userBId,
              message: this.toMessageResponse(previous),
            };
          }
        }
        
        let replyTo: DirectMessage | null = null;

        if (dto.replyToId) {
          replyTo = await manager.findOne(DirectMessage, {
            where: {
              id: dto.replyToId,
              conversationId,
              deletedAt: IsNull(),
            },
          });
        
          if (!replyTo) {
            throw new BadRequestException('Invalid reply message');
          }
        }

        const now = new Date();

        const message = manager.create(DirectMessage, {
          id: dto.requestId ?? randomUUID(),
          conversationId,
          senderId,
          content,
          replyToId: replyTo?.id ?? null,
          createdAt: now,
          editedAt: null,
          deletedAt: null,
        });

        await manager.insert(DirectMessage, message);
        message.replyTo = replyTo;

        await manager.update(
          DirectConversation,
          { id: conversationId },
          { lastMessageAt: now, updatedAt: now },
        );

        return {
          replay: false as const,
          userAId: conversation.userAId,
          userBId: conversation.userBId,
          message: this.toMessageResponse(message),
        };
      },
    );
    if (result.replay) {
      return result.message;
    }

    try {
      this.directChatGateway.emitMessageCreated(
        result.userAId,
        result.userBId,
        result.message,
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
      await this.notificationsService.createForUser({
        userId: recipientId,
        workspaceId: null,
        type: 'DIRECT_MESSAGE',
        message: 'You received a new direct message',
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
    return result.message;
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

    const messages = await this.messagesRepository.find({
      where: {
        conversationId,
        deletedAt: IsNull(),
      },
      relations: {
        replyTo: true,
      },
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
      skip,
      take: limit,
    });

    return messages.reverse().map((message) =>
      this.toMessageResponse(message),
    );
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

  private toMessageResponse(
    message: DirectMessage,
  ): DirectMessageResponseDto {
    const replyTo = message.replyTo;

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt,
      ...(message.replyToId
        ? {
            reply: {
              id: message.replyToId,
              senderId:
                replyTo && !replyTo.deletedAt ? replyTo.senderId : null,
              preview:
                replyTo && !replyTo.deletedAt
                  ? replyTo.content.slice(0, 100)
                  : '',
              unavailable: !replyTo || replyTo.deletedAt !== null,
            },
          }
        : {}),
    };
  }
}
