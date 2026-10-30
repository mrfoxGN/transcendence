import { SocialService } from './social.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

describe('SocialService sendMessage notifications', () => {
  const senderId =
    '11111111-1111-4111-8111-111111111111';

  const recipientId =
    '22222222-2222-4222-8222-222222222222';

  const conversationId =
    '33333333-3333-4333-8333-333333333333';

  const messageId =
    '44444444-4444-4444-8444-444444444444';

  let service: SocialService;

  let conversationsRepository: {
    findOneBy: jest.Mock;
  };

  let messagesRepository: {
    manager: {
      transaction: jest.Mock;
    };
  };

  let usersService: {
    findById: jest.Mock;
  };

  let directChatGateway: {
    emitMessageCreated: jest.Mock;
  };

  let notificationsService: {
    createForUser: jest.Mock;
  };

  beforeEach(() => {
    conversationsRepository = {
      findOneBy: jest.fn(),
    };

    messagesRepository = {
      manager: {
        transaction: jest.fn(),
      },
    };

    usersService = {
      findById: jest.fn(),
    };

    directChatGateway = {
      emitMessageCreated: jest.fn(),
    };

    notificationsService = {
      createForUser: jest.fn(),
    };

    service = new SocialService(
      conversationsRepository as never,
      messagesRepository as never,
      usersService as never,
      directChatGateway as never,
      notificationsService as never,
    );

    jest.clearAllMocks();
  });

  function mockSuccessfulTransaction() {
    messagesRepository.manager.transaction.mockImplementation(
      async (callback) => {
        const manager = {
          findOneBy: jest.fn().mockResolvedValue({
            id: conversationId,
            userAId: senderId,
            userBId: recipientId,
          }),

          create: jest.fn().mockReturnValue({
            id: messageId,
            conversationId,
            senderId,
            content: 'Hello',
            createdAt: new Date(),
            editedAt: null,
            deletedAt: null,
          }),

          save: jest.fn().mockImplementation(
            async (_entity, value) => value,
          ),

          update: jest.fn().mockResolvedValue({
            affected: 1,
          }),
        };

        return callback(manager);
      },
    );
  }

  it('notifies the direct message recipient', async () => {
    mockSuccessfulTransaction();

    notificationsService.createForUser.mockResolvedValue({
      id: 'notification-id',
    });

    const result = await service.sendMessage(
      senderId,
      conversationId,
      {
        content: 'Hello',
      },
    );

    expect(result.id).toBe(messageId);

    expect(
      notificationsService.createForUser,
    ).toHaveBeenCalledWith({
      userId: recipientId,
      workspaceId: null,
      type: 'DIRECT_MESSAGE',
      message: 'You received a new direct message',
      relatedResourceType: 'direct_conversation',
      relatedResourceId: conversationId,
      payload: {
        senderId,
        messageId,
      },
    });
  });

  it('does not notify the sender', async () => {
    mockSuccessfulTransaction();

    await service.sendMessage(
      senderId,
      conversationId,
      {
        content: 'Hello',
      },
    );

    expect(
      notificationsService.createForUser,
    ).not.toHaveBeenCalledWith(
      expect.objectContaining({
        userId: senderId,
      }),
    );
  });

  it('still returns the message when notification creation fails', async () => {
    mockSuccessfulTransaction();

    notificationsService.createForUser.mockRejectedValue(
      new Error('Notification unavailable'),
    );

    jest
      .spyOn(
        (service as unknown as {
          logger: {
            error: (...args: unknown[]) => void;
          };
        }).logger,
        'error',
      )
      .mockImplementation(() => undefined);

    const result = await service.sendMessage(
      senderId,
      conversationId,
      {
        content: 'Hello',
      },
    );

    expect(result.id).toBe(messageId);

    expect(
      directChatGateway.emitMessageCreated,
    ).toHaveBeenCalled();

    expect(
      notificationsService.createForUser,
    ).toHaveBeenCalledTimes(1);
  });
});
