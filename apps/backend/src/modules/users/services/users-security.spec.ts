import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { IsNull, LessThan, MoreThan } from 'typeorm';
import { AppRole, UserStatus } from '../../../database/enums/database.enums';
import { User } from '../entities/user.entity';
import { UsersService } from './users.service';

jest.mock('@nestjs/typeorm', () => ({ InjectRepository: () => () => undefined }));

describe('UsersService authentication and verification', () => {
  const id = '550e8400-e29b-41d4-a716-446655440000';
  const email = 'khaled@example.com';
  let passwordHash: string;
  let codeHash: string;
  let user: User;
  const repository = { findOneBy: jest.fn(), update: jest.fn(), increment: jest.fn() };
  const service = new UsersService(repository as never);

  beforeAll(async () => {
    passwordHash = await argon2.hash('current-password');
    codeHash = await argon2.hash('012345');
  });
  beforeEach(() => {
    jest.resetAllMocks();
    user = {
      id, email, username: 'khaled', passwordHash, tokenVersion: 2,
      appRole: AppRole.USER, status: UserStatus.ACTIVE, avatarUrl: null,
      verifiedEmail: null, emailVerifyCodeHash: codeHash,
      emailVerifyExpiresAt: new Date(Date.now() + 120_000), emailVerifyAttempts: 0,
      isTwoFactorEnabled: false,
      createdAt: new Date(), updatedAt: new Date(), lastSeenAt: null, deletedAt: null,
    };
    repository.findOneBy.mockResolvedValue(user);
    repository.update.mockResolvedValue({ affected: 1 });
    repository.increment.mockResolvedValue({ affected: 1 });
  });

  it.each([null, email, 'old@example.com'])('maps verification state for %j without exposing secrets', async (verifiedEmail) => {
    user.verifiedEmail = verifiedEmail;
    const result = await service.findForAuth(id);
    expect(result.tokenVersion).toBe(2);
    expect(result.user.emailVerified).toBe(verifiedEmail === email);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user).not.toHaveProperty('emailVerifyCodeHash');
    expect(result.user).not.toHaveProperty('tokenVersion');
    expect((await service.findById(id)).emailVerified).toBe(verifiedEmail === email);
  });

  it('rejects authentication lookup for a missing user', async () => {
    repository.findOneBy.mockResolvedValue(null);
    await expect(service.findForAuth(id)).rejects.toThrow(NotFoundException);
  });

  it('excludes deleted accounts in email and username lookups', async () => {
    await service.findByEmail(email);
    expect(repository.findOneBy).toHaveBeenLastCalledWith({ email, deletedAt: IsNull() });
    await service.findByUsername('khaled');
    expect(repository.findOneBy).toHaveBeenLastCalledWith({ username: 'khaled', deletedAt: IsNull() });
  });

  it('revokes tokens and rejects revocation for a missing user', async () => {
    await service.revokeTokens(id);
    expect(repository.increment).toHaveBeenCalledWith({ id, deletedAt: IsNull() }, 'tokenVersion', 1);
    repository.increment.mockResolvedValue({ affected: 0 });
    await expect(service.revokeTokens(id)).rejects.toThrow(NotFoundException);
  });

  it('changes a password, revokes tokens, and clears pending codes', async () => {
    await service.changePassword(id, 'current-password', 'new-password');
    const [criteria, changes] = repository.update.mock.calls[0] as [Partial<User>, Partial<User>];
    expect(criteria).toMatchObject({ id, passwordHash, status: UserStatus.ACTIVE });
    expect(await argon2.verify(changes.passwordHash!, 'new-password')).toBe(true);
    expect(changes).toMatchObject({ emailVerifyCodeHash: null, emailVerifyExpiresAt: null, emailVerifyAttempts: 0 });
    expect((changes.tokenVersion as unknown as () => string)()).toBe('token_version + 1');
  });

  it.each([
    ['wrong-password', 'new-password', UnauthorizedException],
    ['current-password', 'current-password', BadRequestException],
  ] as const)('rejects password change from %s to %s', async (current, next, error) => {
    await expect(service.changePassword(id, current, next)).rejects.toThrow(error);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects password changes for a missing active account', async () => {
    repository.findOneBy.mockResolvedValue(null);
    await expect(service.changePassword(id, 'current-password', 'new-password')).rejects.toThrow(UnauthorizedException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects a concurrent password change', async () => {
    repository.update.mockResolvedValue({ affected: 0 });
    await expect(service.changePassword(id, 'current-password', 'new-password')).rejects.toThrow(ConflictException);
  });

  it.each(['missing', 'disabled', 'verified', 'cooldown'])('does not issue a verification code for %s', async (reason) => {
    if (reason === 'missing') repository.findOneBy.mockResolvedValue(null);
    if (reason === 'disabled') user.status = UserStatus.DISABLED;
    if (reason === 'verified') user.verifiedEmail = email;
    if (reason === 'cooldown') user.emailVerifyExpiresAt = new Date(Date.now() + 590_000);
    await expect(service.createEmailVerificationCode(id)).resolves.toBeNull();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('issues a six-digit code and stores only its hash', async () => {
    const result = await service.createEmailVerificationCode(id);
    expect(result).toEqual({ email, code: expect.stringMatching(/^\d{6}$/) });
    const changes = repository.update.mock.calls[0][1] as Partial<User>;
    expect(await argon2.verify(changes.emailVerifyCodeHash!, result!.code)).toBe(true);
    expect(changes.emailVerifyCodeHash).not.toBe(result!.code);
    expect(changes.emailVerifyExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 590_000);
  });

  it('does not return a code if its conditional update loses a race', async () => {
    repository.update.mockResolvedValue({ affected: 0 });
    await expect(service.createEmailVerificationCode(id)).resolves.toBeNull();
  });

  it.each(['missing', 'disabled', 'no hash', 'no expiry', 'expired', 'locked'])('rejects verification for %s', async (reason) => {
    if (reason === 'missing') repository.findOneBy.mockResolvedValue(null);
    if (reason === 'disabled') user.status = UserStatus.DISABLED;
    if (reason === 'no hash') user.emailVerifyCodeHash = null;
    if (reason === 'no expiry') user.emailVerifyExpiresAt = null;
    if (reason === 'expired') user.emailVerifyExpiresAt = new Date(Date.now() - 1);
    if (reason === 'locked') user.emailVerifyAttempts = 5;
    await expect(service.confirmEmailVerification(id, '012345')).rejects.toThrow(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.increment).not.toHaveBeenCalled();
  });

  it('counts an incorrect verification attempt', async () => {
    await expect(service.confirmEmailVerification(id, '999999')).rejects.toThrow(BadRequestException);
    expect(repository.increment).toHaveBeenCalledWith(expect.objectContaining({
      id, email, emailVerifyCodeHash: codeHash, emailVerifyAttempts: LessThan(5),
    }), 'emailVerifyAttempts', 1);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects a password-reset code for email verification', async () => {
    user.emailVerifyCodeHash = await argon2.hash('password-reset:012345');
    await expect(service.confirmEmailVerification(id, '012345')).rejects.toThrow(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('verifies the current email and consumes the code', async () => {
    await service.confirmEmailVerification(id, '012345');
    expect(repository.update).toHaveBeenCalledWith(expect.objectContaining({
      id, email, emailVerifyCodeHash: codeHash, emailVerifyAttempts: LessThan(5),
      emailVerifyExpiresAt: expect.anything(),
    }), expect.objectContaining({
      verifiedEmail: email, emailVerifyCodeHash: null,
      emailVerifyExpiresAt: null, emailVerifyAttempts: 0,
    }));
    const criteria = repository.update.mock.calls[0][0] as { emailVerifyExpiresAt: ReturnType<typeof MoreThan> };
    expect(criteria.emailVerifyExpiresAt.type).toBe('moreThan');
  });

  it('rejects confirmation when the code or email changed concurrently', async () => {
    repository.update.mockResolvedValue({ affected: 0 });
    await expect(service.confirmEmailVerification(id, '012345')).rejects.toThrow(BadRequestException);
  });
});
