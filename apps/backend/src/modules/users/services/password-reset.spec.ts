import { BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { Repository } from 'typeorm';

import { AppRole, UserStatus } from '../../../database/enums/database.enums';
import { User } from '../entities/user.entity';
import { UsersService } from './users.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

const userId = '550e8400-e29b-41d4-a716-446655440000';
const email = 'khaled@example.com';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: userId,
    username: 'khaled',
    email,
    passwordHash: 'old-hash',
    avatarUrl: null,
    appRole: AppRole.USER,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
    verifiedEmail: email,
    emailVerifyCodeHash: null,
    emailVerifyExpiresAt: null,
    emailVerifyAttempts: 0,
    lastSeenAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('UsersService password reset', () => {
  let repository: {
    findOneBy: jest.Mock;
    update: jest.Mock;
    increment: jest.Mock;
  };
  let service: UsersService;

  beforeEach(() => {
    repository = {
      findOneBy: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      increment: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    service = new UsersService(repository as unknown as Repository<User>);
  });

  it('does not create a code for an unknown email', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.createPasswordResetCode(email)).resolves.toBeNull();

    expect(repository.update).not.toHaveBeenCalled();
  });

  it('stores a hash and returns a six digit code', async () => {
    repository.findOneBy.mockResolvedValue(makeUser());

    const code = await service.createPasswordResetCode(email);

    if (code === null) {
      throw new Error('Expected a reset code');
    }

    expect(code).toMatch(/^\d{6}$/);

    const calls = repository.update.mock.calls as unknown[][];
    const changes = calls[0][1] as Partial<User>;
    const hash = changes.emailVerifyCodeHash;

    if (typeof hash !== 'string') {
      throw new Error('Expected a stored code hash');
    }

    expect(await argon2.verify(hash, `password-reset:${code}`)).toBe(true);
  });

  it('rejects an email verification code for password reset', async () => {
    repository.findOneBy.mockResolvedValue(
      makeUser({
        emailVerifyCodeHash: await argon2.hash('123456'),
        emailVerifyExpiresAt: new Date(Date.now() + 60_000),
      }),
    );

    await expect(
      service.resetPasswordWithCode(email, '123456', 'NewPassword123!'),
    ).rejects.toThrow(BadRequestException);

    expect(repository.increment).toHaveBeenCalledTimes(1);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects an expired reset code', async () => {
    repository.findOneBy.mockResolvedValue(
      makeUser({
        emailVerifyCodeHash: await argon2.hash('password-reset:123456'),
        emailVerifyExpiresAt: new Date(Date.now() - 1_000),
      }),
    );

    await expect(
      service.resetPasswordWithCode(email, '123456', 'NewPassword123!'),
    ).rejects.toThrow(BadRequestException);

    expect(repository.update).not.toHaveBeenCalled();
  });

  it('hashes the new password, consumes the code, and revokes tokens', async () => {
    repository.findOneBy.mockResolvedValue(
      makeUser({
        emailVerifyCodeHash: await argon2.hash('password-reset:123456'),
        emailVerifyExpiresAt: new Date(Date.now() + 60_000),
      }),
    );

    await expect(
      service.resetPasswordWithCode(email, '123456', 'NewPassword123!'),
    ).resolves.toBe(userId);

    const calls = repository.update.mock.calls as unknown[][];
    const changes = calls[0][1] as Record<string, unknown>;
    const hash = changes.passwordHash;

    if (typeof hash !== 'string') {
      throw new Error('Expected a new password hash');
    }

    expect(await argon2.verify(hash, 'NewPassword123!')).toBe(true);
    expect(changes.emailVerifyCodeHash).toBeNull();
    expect(typeof changes.tokenVersion).toBe('function');
  });
});
