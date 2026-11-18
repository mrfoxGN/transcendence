import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';

import { Workspace } from '../../workspaces/entities/workspace.entity';
import { WorkspacesService } from '../../workspaces/services/workspaces.service';
import { ChatMessage } from '../entities/chat-message.entity';
import { WorkspaceChatGateway } from '../gateways/workspace-chat.gateway';
import { ChatService } from './chat.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

function makeTransactionManager(mocks: {
  workspace?: Workspace | null;
  previousMessage?: ChatMessage | null;
  replyToMessage?: ChatMessage | null;
}) {
  return {
    findOne: jest.fn(async (entity: unknown, options: { where: { id?: string } }) => {
      if (entity === Workspace) {
        return mocks.workspace !== undefined ? mocks.workspace : Object.assign(new Workspace(), { id: options.where.id, archivedAt: null });
      }
      if (entity === ChatMessage) {
        if (options.where.id === mocks.previousMessage?.id) return mocks.previousMessage;
        if (options.where.id === mocks.replyToMessage?.id) return mocks.replyToMessage;
        return null;
      }
      return null;
    }),
    create: jest.fn((_entity: unknown, data: Partial<ChatMessage>): ChatMessage =>
      Object.assign(new ChatMessage(), data),
    ),
    insert: jest.fn(async () => ({ identifiers: [], generatedMaps: [], raw: [] })),
  };
}

function makeRepository() {
  const manager = {
    transaction: jest.fn(),
  };

  return {
    manager,
    create: jest.fn((data: Partial<ChatMessage>): ChatMessage =>
      Object.assign(new ChatMessage(), data),
    ),
    save: jest.fn((message: ChatMessage): Promise<ChatMessage> =>
      Promise.resolve(message),
    ),
    query: jest.fn(),
    find: jest.fn((options: unknown): Promise<ChatMessage[]> => {
      void options;
      return Promise.resolve([]);
    }),
  };
}

function makeWorkspacesService(workspaceId: string) {
  return {
    findOneForUser: jest.fn(() => Promise.resolve({ id: workspaceId, archivedAt: null })),
  };
}

describe('ChatService', () => {
  const userId = '9afb3d2a-5d0a-4544-a9fc-6cdb465de34b';
  const workspaceId = '62a9bb1e-bf7b-4d38-a986-14f730579045';
  const messageId = '73362c61-b9c9-45f0-aeec-30542510fc79';

  let service: ChatService;
  let chatMessagesRepository: ReturnType<typeof makeRepository>;
  let workspacesService: ReturnType<typeof makeWorkspacesService>;
  let workspaceChatGateway: {
    emitMessageCreated: jest.Mock;
    emitReadUpdated: jest.Mock;
  };

  beforeEach(() => {
    chatMessagesRepository = makeRepository();
    workspacesService = makeWorkspacesService(workspaceId);
    workspaceChatGateway = {
      emitMessageCreated: jest.fn(),
      emitReadUpdated: jest.fn(),
    };

    service = new ChatService(
      chatMessagesRepository as unknown as Repository<ChatMessage>,
      workspacesService as unknown as WorkspacesService,
      workspaceChatGateway as unknown as WorkspaceChatGateway,
    );
  });

  describe('unreadCount', () => {
    it('counts workspace unread messages only after checking membership', async () => {
      chatMessagesRepository.query.mockResolvedValue([{ count: '3' }]);
      await expect(service.unreadCount(workspaceId, userId)).resolves.toBe(3);
      expect(workspacesService.findOneForUser).toHaveBeenCalledWith(workspaceId, userId);
      expect(chatMessagesRepository.query).toHaveBeenCalledWith(
        expect.stringContaining('message.sender_id <> membership.user_id'),
        [workspaceId, userId],
      );
    });
  });

  describe('markRead', () => {
    it('rejects a read update from outside the workspace before touching the cursor', async () => {
      workspacesService.findOneForUser.mockRejectedValue(new ForbiddenException());
      await expect(service.markRead(workspaceId, userId, messageId)).rejects.toThrow(ForbiddenException);
      expect(chatMessagesRepository.query).not.toHaveBeenCalled();
    });

    it('notifies the reader’s sessions only when the cursor moves forward', async () => {
      chatMessagesRepository.query
        .mockResolvedValueOnce({ affectedRows: 1 })
        .mockResolvedValueOnce({ affectedRows: 0 });
      await service.markRead(workspaceId, userId, messageId);
      await service.markRead(workspaceId, userId, messageId);
      expect(chatMessagesRepository.query).toHaveBeenCalledWith(
        expect.stringContaining('(message.created_at, message.id) >'),
        [workspaceId, userId, messageId],
      );
      expect(workspaceChatGateway.emitReadUpdated).toHaveBeenCalledTimes(1);
      expect(workspaceChatGateway.emitReadUpdated).toHaveBeenCalledWith(userId, workspaceId);
    });
  });

  describe('sendMessage', () => {
    it('allows a workspace member to send a standard message', async () => {
      const mockManager = makeTransactionManager({});
      chatMessagesRepository.manager.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => cb(mockManager),
      );

      const result = await service.sendMessage(workspaceId, userId, {
        content: 'Hello workspace!',
      });

      expect(workspacesService.findOneForUser).toHaveBeenCalledWith(workspaceId, userId);
      expect(mockManager.findOne).toHaveBeenCalledWith(Workspace, expect.objectContaining({
        where: { id: workspaceId },
        lock: { mode: 'pessimistic_write' },
      }));
      expect(mockManager.insert).toHaveBeenCalledTimes(1);
      expect(workspaceChatGateway.emitMessageCreated).toHaveBeenCalledWith(workspaceId, expect.objectContaining({
        workspaceId,
        senderId: userId,
        content: 'Hello workspace!',
      }));
      expect(result).toEqual(
        expect.objectContaining({
          workspaceId,
          senderId: userId,
          content: 'Hello workspace!',
        }),
      );
    });

    it('trims message content before saving', async () => {
      const mockManager = makeTransactionManager({});
      chatMessagesRepository.manager.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => cb(mockManager),
      );

      const result = await service.sendMessage(workspaceId, userId, {
        content: '   Hello workspace!   ',
      });

      expect(result.content).toBe('Hello workspace!');
    });

    it('rejects a blank or whitespace-only message', async () => {
      await expect(
        service.sendMessage(workspaceId, userId, { content: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(chatMessagesRepository.manager.transaction).not.toHaveBeenCalled();
    });

    it('propagates forbidden when user is not a workspace member', async () => {
      const mockManager = makeTransactionManager({});
      chatMessagesRepository.manager.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => cb(mockManager),
      );
      workspacesService.findOneForUser.mockRejectedValue(new ForbiddenException());

      await expect(
        service.sendMessage(workspaceId, userId, { content: 'Hello' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when workspace is not found', async () => {
      const mockManager = makeTransactionManager({ workspace: null });
      chatMessagesRepository.manager.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => cb(mockManager),
      );

      await expect(
        service.sendMessage(workspaceId, userId, { content: 'Hello' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('supports replying to an existing message and caps preview to 100 characters', async () => {
      const replyTargetId = '88888888-8888-4888-8888-888888888888';
      const longText = 'A'.repeat(150);
      const replyToMessage = Object.assign(new ChatMessage(), {
        id: replyTargetId,
        workspaceId,
        senderId: 'author-user-id',
        content: longText,
        createdAt: new Date(),
        deletedAt: null,
      });

      const mockManager = makeTransactionManager({ replyToMessage });
      chatMessagesRepository.manager.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => cb(mockManager),
      );

      const result = await service.sendMessage(workspaceId, userId, {
        content: 'This is my reply',
        replyToId: replyTargetId,
      });

      expect(mockManager.findOne).toHaveBeenCalledWith(ChatMessage, expect.objectContaining({
        where: { id: replyTargetId, workspaceId, deletedAt: expect.anything() },
      }));
      expect(result.reply).toEqual({
        id: replyTargetId,
        senderId: 'author-user-id',
        preview: 'A'.repeat(100),
        unavailable: false,
      });
    });

    it('throws BadRequestException when reply target does not exist or was deleted', async () => {
      const mockManager = makeTransactionManager({ replyToMessage: null });
      chatMessagesRepository.manager.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => cb(mockManager),
      );

      await expect(
        service.sendMessage(workspaceId, userId, {
          content: 'Reply attempt',
          replyToId: '99999999-9999-4999-9999-999999999999',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('replays previously sent message when requestId matches identically', async () => {
      const requestId = '77777777-7777-4777-8777-777777777777';
      const existing = Object.assign(new ChatMessage(), {
        id: requestId,
        workspaceId,
        senderId: userId,
        content: 'Original message',
        replyToId: null,
        createdAt: new Date(),
        deletedAt: null,
      });

      const mockManager = makeTransactionManager({ previousMessage: existing });
      chatMessagesRepository.manager.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => cb(mockManager),
      );

      const result = await service.sendMessage(workspaceId, userId, {
        content: 'Original message',
        requestId,
      });

      expect(result.id).toBe(requestId);
      expect(mockManager.insert).not.toHaveBeenCalled();
      expect(workspaceChatGateway.emitMessageCreated).not.toHaveBeenCalled();
    });

    it('throws ConflictException when requestId matches a conflicting message', async () => {
      const requestId = '77777777-7777-4777-8777-777777777777';
      const existing = Object.assign(new ChatMessage(), {
        id: requestId,
        workspaceId,
        senderId: userId,
        content: 'Different content',
        replyToId: null,
        createdAt: new Date(),
        deletedAt: null,
      });

      const mockManager = makeTransactionManager({ previousMessage: existing });
      chatMessagesRepository.manager.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => cb(mockManager),
      );

      await expect(
        service.sendMessage(workspaceId, userId, {
          content: 'New content',
          requestId,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('listMessages', () => {
    it('lists workspace messages for a member in chronological order', async () => {
      const olderMessage = Object.assign(new ChatMessage(), {
        id: '11111111-1111-4111-8111-111111111111',
        workspaceId,
        senderId: userId,
        content: 'First message',
        createdAt: new Date('2026-10-30T15:00:00Z'),
        editedAt: null,
        deletedAt: null,
      });

      const newerMessage = Object.assign(new ChatMessage(), {
        id: '22222222-2222-4222-8222-222222222222',
        workspaceId,
        senderId: userId,
        content: 'Second message',
        createdAt: new Date('2026-10-30T15:01:00Z'),
        editedAt: null,
        deletedAt: null,
      });

      chatMessagesRepository.find.mockResolvedValue([newerMessage, olderMessage]);

      const result = await service.listMessages(workspaceId, userId, {});

      expect(workspacesService.findOneForUser).toHaveBeenCalledWith(workspaceId, userId);
      expect(chatMessagesRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId, deletedAt: expect.anything() },
          relations: { replyTo: true },
          order: { createdAt: 'DESC', id: 'DESC' },
          skip: 0,
          take: 20,
        }),
      );

      expect(result).toEqual([
        expect.objectContaining({ id: olderMessage.id, content: 'First message' }),
        expect.objectContaining({ id: newerMessage.id, content: 'Second message' }),
      ]);
    });

    it('uses page and limit when listing messages', async () => {
      chatMessagesRepository.find.mockResolvedValue([]);

      await service.listMessages(workspaceId, userId, { page: 2, limit: 10 });

      expect(chatMessagesRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('rejects invalid page with BadRequestException', async () => {
      await expect(
        service.listMessages(workspaceId, userId, { page: Number.NaN }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('does not list messages when user is not a workspace member', async () => {
      workspacesService.findOneForUser.mockRejectedValue(new ForbiddenException());

      await expect(
        service.listMessages(workspaceId, userId, {}),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(chatMessagesRepository.find).not.toHaveBeenCalled();
    });
  });
});
