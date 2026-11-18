import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';

import { UserStatus } from '../../../database/enums/database.enums';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { UsersService } from '../../users/services/users.service';
import { DirectConversation } from '../entities/direct-conversation.entity';
import { DirectMessage } from '../entities/direct-message.entity';
import { DirectChatGateway } from '../gateways/direct-chat.gateway';
import { SocialService } from './social.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

function makeTransactionManager(mocks: {
  conversation?: DirectConversation | null;
  previousMessage?: DirectMessage | null;
  replyToMessage?: DirectMessage | null;
}) {
  return {
    findOne: jest.fn(async (entity: unknown, options: { where: { id?: string } }) => {
      if (entity === DirectConversation) {
        return mocks.conversation !== undefined ? mocks.conversation : {
          id: options.where.id,
          userAId: '11111111-1111-4111-8111-111111111111',
          userBId: '22222222-2222-4222-8222-222222222222',
        };
      }
      if (entity === DirectMessage) {
        if (options.where.id === mocks.previousMessage?.id) return mocks.previousMessage;
        if (options.where.id === mocks.replyToMessage?.id) return mocks.replyToMessage;
        return null;
      }
      return null;
    }),
    create: jest.fn((_entity: unknown, data: Partial<DirectMessage>): DirectMessage =>
      Object.assign(new DirectMessage(), data),
    ),
    insert: jest.fn(async () => ({ identifiers: [], generatedMaps: [], raw: [] })),
    update: jest.fn(async () => ({ affected: 1 })),
  };
}

describe('SocialService', () => {
  const senderId = '11111111-1111-4111-8111-111111111111';
  const recipientId = '22222222-2222-4222-8222-222222222222';
  const conversationId = '33333333-3333-4333-8333-333333333333';
  const messageId = '44444444-4444-4444-8444-444444444444';

  let service: SocialService;

  let conversationsRepository: {
    findOneBy: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };

  let messagesRepository: {
    find: jest.Mock;
    manager: {
      transaction: jest.Mock;
    };
  };

  let usersService: {
    findById: jest.Mock;
  };

  let directChatGateway: {
    emitMessageCreated: jest.Mock;
    emitReadUpdated: jest.Mock;
  };

  let notificationsService: {
    createForUser: jest.Mock;
  };

  beforeEach(() => {
    conversationsRepository = {
      findOneBy: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data: Partial<DirectConversation>) => Object.assign(new DirectConversation(), data)),
      save: jest.fn(async (conv: DirectConversation) => conv),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    messagesRepository = {
      find: jest.fn(),
      manager: {
        transaction: jest.fn(),
      },
    };

    usersService = {
      findById: jest.fn(),
    };

    directChatGateway = {
      emitMessageCreated: jest.fn(),
      emitReadUpdated: jest.fn(),
    };

    notificationsService = {
      createForUser: jest.fn().mockResolvedValue({ id: 'notif-id' }),
    };

    service = new SocialService(
      conversationsRepository as unknown as Repository<DirectConversation>,
      messagesRepository as unknown as Repository<DirectMessage>,
      usersService as unknown as UsersService,
      directChatGateway as unknown as DirectChatGateway,
      notificationsService as unknown as NotificationsService,
    );

    jest.clearAllMocks();
  });

  describe('openConversation', () => {
    it('throws BadRequestException when trying to chat with self', async () => {
      usersService.findById.mockResolvedValue({ id: senderId, status: UserStatus.ACTIVE });
      await expect(service.openConversation(senderId, senderId)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when other user is not active', async () => {
      usersService.findById.mockResolvedValue({ id: recipientId, status: UserStatus.SUSPENDED });
      await expect(service.openConversation(senderId, recipientId)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns existing conversation if one already exists', async () => {
      usersService.findById.mockResolvedValue({ id: recipientId, status: UserStatus.ACTIVE });
      const existing = Object.assign(new DirectConversation(), {
        id: conversationId,
        userAId: senderId < recipientId ? senderId : recipientId,
        userBId: senderId < recipientId ? recipientId : senderId,
        lastMessageAt: null,
        createdAt: new Date(),
      });
      conversationsRepository.findOneBy.mockResolvedValue(existing);

      const result = await service.openConversation(senderId, recipientId);
      expect(result.id).toBe(conversationId);
      expect(conversationsRepository.create).not.toHaveBeenCalled();
    });

    it('creates a new conversation with canonical ordering', async () => {
      usersService.findById.mockResolvedValue({ id: recipientId, status: UserStatus.ACTIVE });
      conversationsRepository.findOneBy.mockResolvedValue(null);

      const result = await service.openConversation(senderId, recipientId);
      expect(conversationsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userAId: senderId < recipientId ? senderId : recipientId,
          userBId: senderId < recipientId ? recipientId : senderId,
        }),
      );
      expect(conversationsRepository.save).toHaveBeenCalledTimes(1);
      expect(result.otherUserId).toBe(recipientId);
    });

    it('handles ER_DUP_ENTRY race condition by returning existing conversation', async () => {
      usersService.findById.mockResolvedValue({ id: recipientId, status: UserStatus.ACTIVE });
      const existing = Object.assign(new DirectConversation(), {
        id: conversationId,
        userAId: senderId,
        userBId: recipientId,
        lastMessageAt: null,
        createdAt: new Date(),
      });
      conversationsRepository.findOneBy
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);

      const queryError = new QueryFailedError('query', [], new Error('dup'));
      (queryError as unknown as { driverError: { code: string } }).driverError = { code: 'ER_DUP_ENTRY' };
      conversationsRepository.save.mockRejectedValueOnce(queryError);

      const result = await service.openConversation(senderId, recipientId);
      expect(result.id).toBe(conversationId);
    });
  });

  describe('unreadCount', () => {
    it('returns 0 when user has no conversations', async () => {
      conversationsRepository.find.mockResolvedValue([]);
      const count = await service.unreadCount(senderId);
      expect(count).toBe(0);
      expect(messagesRepository.find).not.toHaveBeenCalled();
    });

    it('sums unread messages across conversations comparing with lastReadAt', async () => {
      const conv1 = Object.assign(new DirectConversation(), {
        id: 'c1',
        userAId: senderId,
        userBId: recipientId,
        userALastReadAt: new Date('2026-10-30T10:00:00Z'),
        userBLastReadAt: null,
      });
      const conv2 = Object.assign(new DirectConversation(), {
        id: 'c2',
        userAId: 'other-user',
        userBId: senderId,
        userALastReadAt: null,
        userBLastReadAt: null,
      });
      conversationsRepository.find.mockResolvedValue([conv1, conv2]);

      messagesRepository.find.mockResolvedValue([
        { conversationId: 'c1', createdAt: new Date('2026-10-30T09:00:00Z') }, // read
        { conversationId: 'c1', createdAt: new Date('2026-10-30T11:00:00Z') }, // unread
        { conversationId: 'c2', createdAt: new Date('2026-10-30T08:00:00Z') }, // unread (null lastRead)
      ]);

      const count = await service.unreadCount(senderId);
      expect(count).toBe(2);
    });
  });

  describe('markRead', () => {
    it('throws NotFoundException when conversation does not exist or user is not in it', async () => {
      conversationsRepository.findOneBy.mockResolvedValue(null);
      await expect(service.markRead(senderId, conversationId)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates userALastReadAt when reader is userA and emits socket event', async () => {
      conversationsRepository.findOneBy.mockResolvedValue({
        id: conversationId, userAId: senderId, userBId: recipientId,
      });

      await service.markRead(senderId, conversationId);
      expect(conversationsRepository.update).toHaveBeenCalledWith(
        { id: conversationId },
        expect.objectContaining({ userALastReadAt: expect.any(Date) }),
      );
      expect(directChatGateway.emitReadUpdated).toHaveBeenCalledWith(senderId);
    });

    it('updates userBLastReadAt when reader is userB', async () => {
      conversationsRepository.findOneBy.mockResolvedValue({
        id: conversationId, userAId: recipientId, userBId: senderId,
      });

      await service.markRead(senderId, conversationId);
      expect(conversationsRepository.update).toHaveBeenCalledWith(
        { id: conversationId },
        expect.objectContaining({ userBLastReadAt: expect.any(Date) }),
      );
      expect(directChatGateway.emitReadUpdated).toHaveBeenCalledWith(senderId);
    });
  });

  describe('sendMessage', () => {
    it('sends direct message and notifies recipient without notifying sender', async () => {
      const mockManager = makeTransactionManager({});
      messagesRepository.manager.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => cb(mockManager),
      );

      const result = await service.sendMessage(senderId, conversationId, {
        content: 'Hello friend!',
      });

      expect(mockManager.findOne).toHaveBeenCalledWith(DirectConversation, expect.objectContaining({
        where: { id: conversationId },
        lock: { mode: 'pessimistic_write' },
      }));
      expect(mockManager.insert).toHaveBeenCalledTimes(1);
      expect(mockManager.update).toHaveBeenCalledWith(DirectConversation, { id: conversationId }, expect.anything());
      expect(directChatGateway.emitMessageCreated).toHaveBeenCalledWith(senderId, recipientId, expect.anything());
      expect(notificationsService.createForUser).toHaveBeenCalledWith(expect.objectContaining({
        userId: recipientId,
        type: 'DIRECT_MESSAGE',
      }));
      expect(notificationsService.createForUser).not.toHaveBeenCalledWith(expect.objectContaining({
        userId: senderId,
      }));
      expect(result.content).toBe('Hello friend!');
    });

    it('rejects empty or whitespace content', async () => {
      await expect(
        service.sendMessage(senderId, conversationId, { content: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when conversation not found in transaction', async () => {
      const mockManager = makeTransactionManager({ conversation: null });
      messagesRepository.manager.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => cb(mockManager),
      );

      await expect(
        service.sendMessage(senderId, conversationId, { content: 'Hello' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('caps reply preview to 100 characters', async () => {
      const replyTargetId = '88888888-8888-4888-8888-888888888888';
      const replyToMessage = Object.assign(new DirectMessage(), {
        id: replyTargetId,
        conversationId,
        senderId: recipientId,
        content: 'B'.repeat(160),
        deletedAt: null,
      });

      const mockManager = makeTransactionManager({ replyToMessage });
      messagesRepository.manager.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => cb(mockManager),
      );

      const result = await service.sendMessage(senderId, conversationId, {
        content: 'Replying to you',
        replyToId: replyTargetId,
      });

      expect(result.reply).toEqual({
        id: replyTargetId,
        senderId: recipientId,
        preview: 'B'.repeat(100),
        unavailable: false,
      });
    });

    it('throws BadRequestException for invalid reply target', async () => {
      const mockManager = makeTransactionManager({ replyToMessage: null });
      messagesRepository.manager.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => cb(mockManager),
      );

      await expect(
        service.sendMessage(senderId, conversationId, {
          content: 'Replying',
          replyToId: '99999999-9999-4999-9999-999999999999',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('idempotently replays message when requestId matches', async () => {
      const requestId = '77777777-7777-4777-8777-777777777777';
      const existing = Object.assign(new DirectMessage(), {
        id: requestId,
        conversationId,
        senderId,
        content: 'Original direct text',
        replyToId: null,
        createdAt: new Date(),
        deletedAt: null,
      });

      const mockManager = makeTransactionManager({ previousMessage: existing });
      messagesRepository.manager.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => cb(mockManager),
      );

      const result = await service.sendMessage(senderId, conversationId, {
        content: 'Original direct text',
        requestId,
      });

      expect(result.id).toBe(requestId);
      expect(mockManager.insert).not.toHaveBeenCalled();
      expect(directChatGateway.emitMessageCreated).not.toHaveBeenCalled();
      expect(notificationsService.createForUser).not.toHaveBeenCalled();
    });

    it('throws ConflictException on mismatched requestId replay', async () => {
      const requestId = '77777777-7777-4777-8777-777777777777';
      const existing = Object.assign(new DirectMessage(), {
        id: requestId,
        conversationId,
        senderId,
        content: 'Old text',
        replyToId: null,
        createdAt: new Date(),
        deletedAt: null,
      });

      const mockManager = makeTransactionManager({ previousMessage: existing });
      messagesRepository.manager.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => cb(mockManager),
      );

      await expect(
        service.sendMessage(senderId, conversationId, {
          content: 'Changed text',
          requestId,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('still returns message when notificationsService fails', async () => {
      const mockManager = makeTransactionManager({});
      messagesRepository.manager.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => cb(mockManager),
      );
      notificationsService.createForUser.mockRejectedValue(new Error('Notification failure'));

      const result = await service.sendMessage(senderId, conversationId, { content: 'Safe message' });
      expect(result.content).toBe('Safe message');
    });
  });

  describe('listMessages', () => {
    it('lists messages for a participant in chronological order', async () => {
      conversationsRepository.findOneBy.mockResolvedValue({
        id: conversationId, userAId: senderId, userBId: recipientId,
      });

      const m1 = Object.assign(new DirectMessage(), {
        id: 'm1',
        conversationId,
        senderId,
        content: 'Older',
        createdAt: new Date('2026-10-30T10:00:00Z'),
        deletedAt: null,
      });
      const m2 = Object.assign(new DirectMessage(), {
        id: 'm2',
        conversationId,
        senderId: recipientId,
        content: 'Newer',
        createdAt: new Date('2026-10-30T10:05:00Z'),
        deletedAt: null,
      });

      messagesRepository.find.mockResolvedValue([m2, m1]);

      const result = await service.listMessages(senderId, conversationId, {});
      expect(messagesRepository.find).toHaveBeenCalledWith(expect.objectContaining({
        where: { conversationId, deletedAt: expect.anything() },
        order: { createdAt: 'DESC', id: 'DESC' },
        skip: 0,
        take: 20,
      }));
      expect(result).toEqual([
        expect.objectContaining({ id: 'm1', content: 'Older' }),
        expect.objectContaining({ id: 'm2', content: 'Newer' }),
      ]);
    });

    it('throws NotFoundException when user is not a participant', async () => {
      conversationsRepository.findOneBy.mockResolvedValue({
        id: conversationId, userAId: 'other-a', userBId: 'other-b',
      });

      await expect(
        service.listMessages(senderId, conversationId, {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects invalid page with BadRequestException', async () => {
      conversationsRepository.findOneBy.mockResolvedValue({
        id: conversationId, userAId: senderId, userBId: recipientId,
      });

      await expect(
        service.listMessages(senderId, conversationId, { page: Number.NaN }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('listConversations', () => {
    it('returns empty array when user has no conversations', async () => {
      conversationsRepository.find.mockResolvedValue([]);
      const result = await service.listConversations(senderId, {});
      expect(result).toEqual([]);
    });

    it('returns conversations with unread counts and otherUsername', async () => {
      const conv = Object.assign(new DirectConversation(), {
        id: conversationId,
        userAId: senderId,
        userBId: recipientId,
        userA: { username: 'sender' },
        userB: { username: 'recipient' },
        userALastReadAt: new Date('2026-10-30T10:00:00Z'),
        userBLastReadAt: null,
        lastMessageAt: new Date('2026-10-30T10:10:00Z'),
        createdAt: new Date('2026-10-30T09:00:00Z'),
      });
      conversationsRepository.find.mockResolvedValue([conv]);

      messagesRepository.find.mockResolvedValue([
        { conversationId, createdAt: new Date('2026-10-30T10:05:00Z') },
      ]);

      const result = await service.listConversations(senderId, {});
      expect(result).toEqual([
        expect.objectContaining({
          id: conversationId,
          otherUserId: recipientId,
          otherUsername: 'recipient',
          unreadCount: 1,
        }),
      ]);
    });
  });
});
