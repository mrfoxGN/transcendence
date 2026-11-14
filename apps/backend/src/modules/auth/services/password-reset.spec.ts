import { Logger } from '@nestjs/common';

import { AuthService } from './auth.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

describe('AuthService password reset', () => {
  const email = 'khaled@example.com';
  const userId = '550e8400-e29b-41d4-a716-446655440000';

  const usersService = {
    createPasswordResetCode: jest.fn(),
    resetPasswordWithCode: jest.fn(),
  };

  const directChatGateway = {
    disconnectUser: jest.fn(),
  };

  const workspaceChatGateway = {
    disconnectUser: jest.fn(),
  };

  let service: AuthService;
  const oldApiKey = process.env.RESEND_API_KEY;
  const oldFrom = process.env.RESEND_FROM_EMAIL;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.RESEND_API_KEY = 'test-only-key';
    process.env.RESEND_FROM_EMAIL = 'verify@example.com';

    service = new AuthService(
      usersService as never,
      {} as never,
      directChatGateway as never,
      workspaceChatGateway as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (oldApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = oldApiKey;
    }

    if (oldFrom === undefined) {
      delete process.env.RESEND_FROM_EMAIL;
    } else {
      process.env.RESEND_FROM_EMAIL = oldFrom;
    }
  });

  it('does not send an email when the account does not exist', async () => {
    usersService.createPasswordResetCode.mockResolvedValue(null);
    const fetchMock = jest.spyOn(globalThis, 'fetch');

    await service.requestPasswordReset(email);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the reset code to the account email', async () => {
    usersService.createPasswordResetCode.mockResolvedValue('123456');

    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true } as Response);

    await service.requestPasswordReset(email);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const calls = fetchMock.mock.calls as unknown[][];
    const [url, options] = calls[0] as [string, RequestInit];

    expect(url).toBe('https://api.resend.com/emails');
    expect(options.method).toBe('POST');

    if (typeof options.body !== 'string') {
      throw new Error('Email request body must be a string');
    }

    expect(options.body).toContain('"to":["khaled@example.com"]');
    expect(options.body).toContain('123456');
  });

  it('logs a sending failure but returns the same response', async () => {
    usersService.createPasswordResetCode.mockResolvedValue('123456');

    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: false } as Response);

    const logSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await expect(service.requestPasswordReset(email)).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('disconnects chats only after a successful reset', async () => {
    usersService.resetPasswordWithCode.mockResolvedValue(userId);

    await service.confirmPasswordReset(email, '123456', 'NewPassword123!');

    expect(usersService.resetPasswordWithCode).toHaveBeenCalledWith(
      email,
      '123456',
      'NewPassword123!',
    );
    expect(directChatGateway.disconnectUser).toHaveBeenCalledWith(userId);
    expect(workspaceChatGateway.disconnectUser).toHaveBeenCalledWith(userId);
  });

  it('does not disconnect chats when the reset fails', async () => {
    usersService.resetPasswordWithCode.mockRejectedValue(
      new Error('Invalid code'),
    );

    await expect(
      service.confirmPasswordReset(email, '123456', 'NewPassword123!'),
    ).rejects.toThrow('Invalid code');

    expect(directChatGateway.disconnectUser).not.toHaveBeenCalled();
    expect(workspaceChatGateway.disconnectUser).not.toHaveBeenCalled();
  });
});
