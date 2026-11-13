import { assertWorkspaceWritable } from '../../workspaces/workspace-policy';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';

import { deliverWorkspaceNotifications, mentionRecipients } from '../../notifications/notification-events';
import type { Response } from 'express';
import { attachmentFields, downloadChatAttachment, messageContext, searchMessages, validateReply } from '../message-collaboration';
import { listByMessageCursor } from '../message-cursor';
import { WorkspacesService } from '../../workspaces/services/workspaces.service';
import { ChatMessageResponseDto } from '../dto/chat-message-response.dto';
import { ListChatMessagesDto } from '../dto/list-chat-messages.dto';
import { SendChatMessageDto } from '../dto/send-chat-message.dto';
import { ChatMessage } from '../entities/chat-message.entity';
import { WorkspaceChatGateway } from '../gateways/workspace-chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatMessagesRepository: Repository<ChatMessage>,
    private readonly workspacesService: WorkspacesService,
    private readonly workspaceChatGateway: WorkspaceChatGateway,
  ) {}

  async unreadCount(workspaceId: string, userId: string): Promise<number> {
    await this.workspacesService.findOneForUser(workspaceId, userId);
    const rows: { count: string | number }[] = await this.chatMessagesRepository.query(
      `SELECT COUNT(*) AS count
       FROM workspace_memberships AS membership
       INNER JOIN chat_messages AS message ON message.workspace_id = membership.workspace_id
       WHERE membership.workspace_id = ? AND membership.user_id = ?
         AND message.deleted_at IS NULL
         AND (message.sender_id IS NULL OR message.sender_id <> membership.user_id)
         AND message.created_at >= membership.joined_at
         AND (membership.chat_read_at IS NULL
           OR (message.created_at, message.id) > (membership.chat_read_at, membership.chat_read_message_id))`,
      [workspaceId, userId],
    );
    return Number(rows[0].count);
  }

  async markRead(workspaceId: string, userId: string, messageId: string): Promise<void> {
    await this.workspacesService.findOneForUser(workspaceId, userId);
    const result: { affectedRows: number } = await this.chatMessagesRepository.query(
      `UPDATE workspace_memberships AS membership
       INNER JOIN chat_messages AS message ON message.workspace_id = membership.workspace_id
       SET membership.chat_read_at = message.created_at, membership.chat_read_message_id = message.id
       WHERE membership.workspace_id = ? AND membership.user_id = ?
         AND message.id = ? AND message.deleted_at IS NULL
         AND (membership.chat_read_at IS NULL
           OR (message.created_at, message.id) > (membership.chat_read_at, membership.chat_read_message_id))`,
      [workspaceId, userId, messageId],
    );
    if (result.affectedRows > 0) this.workspaceChatGateway.emitReadUpdated(userId, workspaceId);
  }

  async listMessages(
    workspaceId: string,
    userId: string,
    query: ListChatMessagesDto,
  ): Promise<ChatMessageResponseDto[]> {
    await this.workspacesService.findOneForUser(workspaceId, userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(skip)) {
      throw new BadRequestException('Invalid page');
    }

    const messages = query.q?.trim()
      ? await searchMessages(this.chatMessagesRepository, 'workspace_id', workspaceId, query.q.trim(), skip, limit)
      : query.before || query.after
        ? await listByMessageCursor(this.chatMessagesRepository, 'workspace_id', workspaceId, query, limit)
        : await this.chatMessagesRepository.find({
      where: {
        workspaceId,
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
    const context = await messageContext(this.chatMessagesRepository, { workspaceId }, messages);
    return messages.map((message) => ({
      ...context(message),
      id: message.id,
      workspaceId: message.workspaceId,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt,
    }));
  }

  async downloadAttachment(workspaceId: string, userId: string, messageId: string, response: Response) {
    await this.workspacesService.findOneForUser(workspaceId, userId);
    return downloadChatAttachment(this.chatMessagesRepository, 'workspace_id', workspaceId, messageId, response);
  }

  async sendMessage(
    workspaceId: string,
    senderId: string,
    dto: SendChatMessageDto,
    file?: Express.Multer.File,
  ): Promise<ChatMessageResponseDto> {
    assertWorkspaceWritable(await this.workspacesService.findOneForUser(workspaceId, senderId));

    const content = dto.content.trim();
    const attachment = attachmentFields(file);

    if (!content && !file) {
      throw new BadRequestException('Message content is required');
    }

    const message = this.chatMessagesRepository.create({
      id: dto.requestId ?? randomUUID(),
      workspaceId,
      senderId,
      content,
      ...(dto.replyToId ? { replyToId: dto.replyToId } : {}),
      ...attachment,
      createdAt: new Date(),
      editedAt: null,
      deletedAt: null,
    });

    let replay = false;
    const saved = dto.requestId || dto.replyToId || file || /(?:^|\s)@/u.test(content)
      ? await this.chatMessagesRepository.manager.transaction(async manager => {
        const repository = manager.getRepository(ChatMessage);
        if (dto.requestId) {
          await manager.query('SELECT id FROM workspaces WHERE id = ? FOR UPDATE', [workspaceId]);
          const previous = await repository.findOneBy({ id: dto.requestId });
          if (previous) {
            if (previous.workspaceId !== workspaceId || previous.senderId !== senderId || previous.deletedAt) {
              throw new ConflictException('Message request ID is already in use');
            }
            replay = true;
            return previous;
          }
        }
        await validateReply(repository, { workspaceId }, dto.replyToId);
        message.createdAt = new Date();
        await repository.insert(message);
        const savedMessage = message;
        const recipients = await mentionRecipients(manager, workspaceId, content);
        await deliverWorkspaceNotifications(manager, {
          eventId: `chat:${savedMessage.id}`,
          actorId: senderId,
          workspaceId,
          resourceType: 'workspace_chat',
          resourceId: workspaceId,
          candidates: new Map(recipients.map(id => [id, 'mentions'])),
          message: () => 'You were mentioned in team chat',
        });
        return savedMessage;
      })
      : await this.chatMessagesRepository.save(message);

    const context = await messageContext(this.chatMessagesRepository, { workspaceId }, [saved]);
    const response: ChatMessageResponseDto = {
      ...context(saved),
      id: saved.id,
      workspaceId: saved.workspaceId,
      senderId: saved.senderId,
      content: saved.content,
      createdAt: saved.createdAt,
    };

    if (!replay) this.workspaceChatGateway.emitMessageCreated(workspaceId, response);

    return response;
  }
}
