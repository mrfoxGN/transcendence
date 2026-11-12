import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';

import { WorkspacesService } from '../../workspaces/services/workspaces.service';
import { ChatMessage } from '../entities/chat-message.entity';
import { WorkspaceChatGateway } from '../gateways/workspace-chat.gateway';
import { ChatService } from './chat.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

function makeRepository() {
  return {
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
    findOneForUser: jest.fn(() => Promise.resolve({ id: workspaceId })),
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

  it('counts workspace unread messages only after checking membership', async () => {
    chatMessagesRepository.query.mockResolvedValue([{ count: '3' }]);
    await expect(service.unreadCount(workspaceId, userId)).resolves.toBe(3);
    expect(workspacesService.findOneForUser).toHaveBeenCalledWith(workspaceId, userId);
    expect(chatMessagesRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('message.sender_id <> membership.user_id'),
      [workspaceId, userId],
    );
  });

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

  it('allows a workspace member to send a message', async () => {
    chatMessagesRepository.save.mockImplementation(
      (message: ChatMessage): Promise<ChatMessage> =>
        Promise.resolve(
          Object.assign(new ChatMessage(), message, { id: messageId }),
        ),
    );

    const result = await service.sendMessage(workspaceId, userId, {
      content: 'Hello workspace!',
    });

    expect(workspacesService.findOneForUser).toHaveBeenCalledWith(
      workspaceId,
      userId,
    );

    expect(chatMessagesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        senderId: userId,
        content: 'Hello workspace!',
        editedAt: null,
        deletedAt: null,
      }),
    );

    expect(chatMessagesRepository.save).toHaveBeenCalledTimes(1);

    expect(result).toEqual(
      expect.objectContaining({
        id: messageId,
        workspaceId,
        senderId: userId,
        content: 'Hello workspace!',
      }),
    );
  });

  it('trims message content before saving', async () => {
    chatMessagesRepository.save.mockImplementation(
      (message: ChatMessage): Promise<ChatMessage> =>
        Promise.resolve(
          Object.assign(new ChatMessage(), message, { id: messageId }),
        ),
    );

    const result = await service.sendMessage(workspaceId, userId, {
      content: '   Hello workspace!   ',
    });

    expect(chatMessagesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Hello workspace!',
      }),
    );

    expect(result.content).toBe('Hello workspace!');
  });

  it('rejects a blank message', async () => {
    await expect(
      service.sendMessage(workspaceId, userId, {
        content: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(chatMessagesRepository.save).not.toHaveBeenCalled();
  });

  it('propagates forbidden when user is not a workspace member', async () => {
    workspacesService.findOneForUser.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      service.sendMessage(workspaceId, userId, {
        content: 'Hello',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(chatMessagesRepository.save).not.toHaveBeenCalled();
  });

  it('propagates not found when workspace does not exist', async () => {
    workspacesService.findOneForUser.mockRejectedValue(
      new NotFoundException('Workspace not found'),
    );

    await expect(
      service.sendMessage(workspaceId, userId, {
        content: 'Hello',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(chatMessagesRepository.save).not.toHaveBeenCalled();
  });

  it('lists workspace messages for a member', async () => {
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

    // The service reverses the repository's newest-first result.
    chatMessagesRepository.find.mockResolvedValue([newerMessage, olderMessage]);

    const result = await service.listMessages(workspaceId, userId, {});

    expect(workspacesService.findOneForUser).toHaveBeenCalledWith(
      workspaceId,
      userId,
    );

    const findOptions = chatMessagesRepository.find.mock.calls[0]?.[0];

    expect(findOptions).toMatchObject({
      where: {
        workspaceId,
      },
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
      skip: 0,
      take: 20,
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: olderMessage.id,
        content: 'First message',
      }),
      expect.objectContaining({
        id: newerMessage.id,
        content: 'Second message',
      }),
    ]);
  });

  it('uses page and limit when listing messages', async () => {
    chatMessagesRepository.find.mockResolvedValue([]);

    await service.listMessages(workspaceId, userId, {
      page: 2,
      limit: 10,
    });

    expect(chatMessagesRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      }),
    );
  });

  it('does not list messages when user is not a workspace member', async () => {
    workspacesService.findOneForUser.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      service.listMessages(workspaceId, userId, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(chatMessagesRepository.find).not.toHaveBeenCalled();
  });
});
