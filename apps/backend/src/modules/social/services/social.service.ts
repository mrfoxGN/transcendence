import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { IsNull, QueryFailedError, Repository } from 'typeorm';

import { UserStatus } from '../../../database/enums/database.enums';
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
      userId < otherUser.id
        ? [userId, otherUser.id]
        : [otherUser.id, userId];

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
      order: {
        lastMessageAt: 'DESC',
        createdAt: 'DESC',
        id: 'DESC',
      },
      skip,
      take: limit,
    });

    return conversations.map((conversation) =>
      this.toConversationResponse(
        conversation,
        conversation.userAId === userId
          ? conversation.userBId
          : conversation.userAId,
      ),
    );
  }

  async markRead(userId: string, conversationId: string): Promise<void> {
    const conversation = await this.conversationsRepository.findOneBy({
      id: conversationId,
    });

    if (
      !conversation ||
      (conversation.userAId !== userId &&
        conversation.userBId !== userId)
    ) {
      throw new NotFoundException('Conversation not found');
    }

    const now = new Date();

    if (conversation.userAId === userId) {
      await this.conversationsRepository.update(
        { id: conversationId },
        { userALastReadAt: now, updatedAt: now },
      );
      return;
    }

    await this.conversationsRepository.update(
      { id: conversationId },
      { userBLastReadAt: now, updatedAt: now },
    );
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

        const now = new Date();

        const message = manager.create(DirectMessage, {
          id: randomUUID(),
          conversationId,
          senderId,
          content,
          createdAt: now,
          editedAt: null,
          deletedAt: null,
        });

        const saved = await manager.save(DirectMessage, message);

        await manager.update(
          DirectConversation,
          { id: conversationId },
          { lastMessageAt: now, updatedAt: now },
        );

        return {
          userAId: conversation.userAId,
          userBId: conversation.userBId,
          message: {
            id: saved.id,
            conversationId: saved.conversationId,
            senderId: saved.senderId,
            content: saved.content,
            createdAt: saved.createdAt,
          },
        };
      },
    );

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
      (conversation.userAId !== userId &&
        conversation.userBId !== userId)
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
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
      skip,
      take: limit,
    });

    return messages.reverse().map((message) => ({
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