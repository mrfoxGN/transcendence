import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UserStatus } from '../../../database/enums/database.enums';
import { AuthService } from './auth.service';

jest.mock('@nestjs/typeorm', () => ({ InjectRepository: () => () => undefined }));

describe('AuthService', () => {
  const id = '550e8400-e29b-41d4-a716-446655440000';
  const email = 'khaled@example.com';
  const password = 'correct-password';
  const users = {
    create: jest.fn(), findByEmail: jest.fn(), revokeTokens: jest.fn(),
    changePassword: jest.fn(), createEmailVerificationCode: jest.fn(),
    confirmEmailVerification: jest.fn(),
    createTwoFactorCode: jest.fn(),
    verifyTwoFactorCode: jest.fn(),
    enableTwoFactor: jest.fn(),
    disableTwoFactor: jest.fn(),
    findById: jest.fn(),
  };
  const direct = { disconnectUser: jest.fn() };
  const workspace = { disconnectUser: jest.fn() };
  const jwt = new JwtService({ secret: 'test-only-secret', signOptions: { expiresIn: '1h' } });
  const service = new AuthService(users as never, jwt, direct as never, workspace as never);
  let passwordHash: string;

  beforeAll(async () => { passwordHash = await argon2.hash(password); });
  beforeEach(() => { jest.resetAllMocks(); });
  afterEach(() => { jest.restoreAllMocks(); });

  it('returns the registered profile', async () => {
    const input = { username: 'khaled', email, password };
    users.create.mockResolvedValue({ id, email });
    await expect(service.register(input)).resolves.toEqual({ id, email });
    expect(users.create).toHaveBeenCalledWith(input);
  });

  it.each(['missing', 'wrong password', 'disabled'])('rejects %s credentials', async (scenario) => {
    users.findByEmail.mockResolvedValue(scenario === 'missing' ? null : {
      id, passwordHash, status: scenario === 'disabled' ? UserStatus.DISABLED : UserStatus.ACTIVE,
    });
    await expect(service.login({ email, password: scenario === 'wrong password' ? 'wrong' : password }))
      .rejects.toThrow(UnauthorizedException);
  });

  it('issues a verifiable token without exposing user secrets', async () => {
    users.findByEmail.mockResolvedValue({ id, passwordHash, status: UserStatus.ACTIVE, tokenVersion: 3 });
    const result = await service.login({ email, password });
    expect(Object.keys(result)).toEqual(['accessToken']);
    const payload = await jwt.verifyAsync(result.accessToken);
    expect(payload).toMatchObject({ sub: id, tokenVersion: 3 });
    expect(payload).not.toHaveProperty('passwordHash');
  });

  it('revokes tokens before disconnecting a logged-out user', async () => {
    users.revokeTokens.mockImplementation(async () => {
      expect(direct.disconnectUser).not.toHaveBeenCalled();
      expect(workspace.disconnectUser).not.toHaveBeenCalled();
    });
    await service.logout(id);
    expect(users.revokeTokens).toHaveBeenCalledWith(id);
    expect(direct.disconnectUser).toHaveBeenCalledWith(id);
    expect(workspace.disconnectUser).toHaveBeenCalledWith(id);
  });

  it('does not disconnect chats when revocation fails', async () => {
    users.revokeTokens.mockRejectedValue(new Error('Database unavailable'));
    await expect(service.logout(id)).rejects.toThrow('Database unavailable');
    expect(direct.disconnectUser).not.toHaveBeenCalled();
    expect(workspace.disconnectUser).not.toHaveBeenCalled();
  });

  it('skips email delivery when no verification code is issued', async () => {
    users.createEmailVerificationCode.mockResolvedValue(null);
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected email'));
    await service.requestEmailVerification(id);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('verification delivery', () => {
    const originalKey = process.env.RESEND_API_KEY;
    const originalFrom = process.env.RESEND_FROM_EMAIL;
    beforeEach(() => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.RESEND_FROM_EMAIL = 'verify@example.com';
      users.createEmailVerificationCode.mockResolvedValue({ email, code: '012345' });
    });
    afterEach(() => {
      if (originalKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = originalKey;
      if (originalFrom === undefined) delete process.env.RESEND_FROM_EMAIL;
      else process.env.RESEND_FROM_EMAIL = originalFrom;
    });

    it('sends the verification code to the account email', async () => {
      const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);
      await service.requestEmailVerification(id);
      expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
        method: 'POST', body: expect.any(String),
      }));
      const options = fetchMock.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(options.body as string)).toMatchObject({
        to: [email], subject: 'Verify your email', text: expect.stringContaining('012345'),
      });
    });

    it.each(['network', 'provider', 'configuration'])('reports a %s delivery failure', async (reason) => {
      const fetchMock = jest.spyOn(globalThis, 'fetch');
      if (reason === 'network') fetchMock.mockRejectedValue(new Error('Network unavailable'));
      else fetchMock.mockResolvedValue({ ok: false } as Response);
      if (reason === 'configuration') delete process.env.RESEND_API_KEY;
      await expect(service.requestEmailVerification(id)).rejects.toThrow(ServiceUnavailableException);
      if (reason === 'configuration') expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('passes email confirmation to the users service', async () => {
    await service.confirmEmailVerification(id, '012345');
    expect(users.confirmEmailVerification).toHaveBeenCalledWith(id, '012345');
  });

  describe('two-factor authentication', () => {
    it('requires 2FA when user has 2FA enabled', async () => {
      users.findByEmail.mockResolvedValue({
        id,
        email,
        passwordHash,
        status: UserStatus.ACTIVE,
        tokenVersion: 1,
        isTwoFactorEnabled: true,
      });
      users.createTwoFactorCode.mockResolvedValue({ email, code: '123456' });
      jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

      const result = await service.login({ email, password });
      expect(result.twoFactorRequired).toBe(true);
      expect(result.twoFactorToken).toBeDefined();

      const payload = await jwt.verifyAsync(result.twoFactorToken!);
      expect(payload).toMatchObject({ sub: id, purpose: '2fa_login', tokenVersion: 1 });
    });

    it('verifies 2FA code and returns access token', async () => {
      const twoFactorToken = await jwt.signAsync({
        sub: id,
        purpose: '2fa_login',
        tokenVersion: 1,
      });
      users.verifyTwoFactorCode.mockResolvedValue({
        id,
        tokenVersion: 1,
        status: UserStatus.ACTIVE,
      });

      const result = await service.confirmTwoFactorLogin({
        twoFactorToken,
        code: '123456',
      });
      expect(result.accessToken).toBeDefined();

      const payload = await jwt.verifyAsync(result.accessToken!);
      expect(payload).toMatchObject({ sub: id, tokenVersion: 1 });
    });

    it('rejects 2FA verification with an invalid token or wrong purpose', async () => {
      const invalidToken = await jwt.signAsync({
        sub: id,
        purpose: 'other_purpose',
        tokenVersion: 1,
      });

      await expect(
        service.confirmTwoFactorLogin({
          twoFactorToken: invalidToken,
          code: '123456',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('allows resending 2FA code', async () => {
      const twoFactorToken = await jwt.signAsync({
        sub: id,
        purpose: '2fa_login',
        tokenVersion: 1,
      });
      users.createTwoFactorCode.mockResolvedValue({ email, code: '654321' });
      const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

      await service.resendTwoFactorLogin({ twoFactorToken });
      expect(users.createTwoFactorCode).toHaveBeenCalledWith(id);
      expect(fetchMock).toHaveBeenCalled();
    });

    it('confirms enabling 2FA', async () => {
      users.verifyTwoFactorCode.mockResolvedValue({ id });
      users.enableTwoFactor.mockResolvedValue({ id, isTwoFactorEnabled: true });

      const result = await service.confirmEnableTwoFactor(id, '123456');
      expect(users.verifyTwoFactorCode).toHaveBeenCalledWith(id, '123456');
      expect(users.enableTwoFactor).toHaveBeenCalledWith(id);
      expect(result.isTwoFactorEnabled).toBe(true);
    });

    it('disables 2FA', async () => {
      users.disableTwoFactor.mockResolvedValue({ id, isTwoFactorEnabled: false });

      const result = await service.disableTwoFactor(id);
      expect(users.disableTwoFactor).toHaveBeenCalledWith(id);
      expect(result.isTwoFactorEnabled).toBe(false);
    });
  });
});
