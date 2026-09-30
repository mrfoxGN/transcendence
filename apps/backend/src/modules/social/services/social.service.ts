import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { QueryFailedError, Repository } from 'typeorm';

import { UserStatus } from '../../../database/enums/database.enums';
import { UsersService } from '../../users/services/users.service';
import { DirectConversationResponseDto } from '../dto/direct-conversation-response.dto';
import { DirectMessageResponseDto } from '../dto/direct-message-response.dto';
import { SendDirectMessageDto } from '../dto/send-direct-message.dto';
import { DirectConversation } from '../entities/direct-conversation.entity';
import { DirectMessage } from '../entities/direct-message.entity';

@Injectable()
export class SocialService {
  constructor(
    @InjectRepository(DirectConversation)
    private readonly conversationsRepository: Repository<DirectConversation>,
    @InjectRepository(DirectMessage)
    private readonly messagesRepository: Repository<DirectMessage>,
    private readonly usersService: UsersService,
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

  async sendMessage(
    senderId: string,
    conversationId: string,
    dto: SendDirectMessageDto,
  ): Promise<DirectMessageResponseDto> {
    if (typeof dto?.content !== 'string' || !dto.content.trim()) {
      throw new BadRequestException('Message content is required');
    }

    const content = dto.content.trim();

    return this.messagesRepository.manager.transaction(async (manager) => {
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
        id: saved.id,
        conversationId: saved.conversationId,
        senderId: saved.senderId,
        content: saved.content,
        createdAt: saved.createdAt,
      };
    });
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