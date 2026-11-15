import { BadRequestException, NotFoundException } from '@nestjs/common';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { UserStatus, AppRole } from '../../../database/enums/database.enums';
import { User } from '../entities/user.entity';
import { UsersService } from './users.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

jest.mock('node:fs/promises', () => ({
  access: jest.fn(),
  mkdir: jest.fn(),
  unlink: jest.fn(),
  writeFile: jest.fn(),
}));

describe('UsersService avatars', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const avatarId = '22222222-2222-4222-8222-222222222222';
  const avatarUrl = `/users/${userId}/avatar/${avatarId}.jpg`;

  // These bytes pass the checks currently implemented by saveAvatarImage().
  // They are for testing that code path, not a complete JPEG file.
  const imageBytes = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0xff, 0xd9]);
  const avatarImage = `data:image/jpeg;base64,${imageBytes.toString('base64')}`;

  const repository = {
    findOneBy: jest.fn(),
    existsBy: jest.fn(),
    update: jest.fn(),
  };

  let service: UsersService;

  function makeUser(overrides: Partial<User> = {}): User {
    return Object.assign(new User(), {
      id: userId,
      username: 'khaled',
      email: 'khaled@example.com',
      passwordHash: 'stored-hash',
      avatarUrl: null,
      appRole: AppRole.USER,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
      lastSeenAt: null,
      createdAt: new Date('2026-11-01T12:00:00.000Z'),
      updatedAt: new Date('2026-11-01T12:00:00.000Z'),
      deletedAt: null,
      verifiedEmail: 'khaled@example.com',
      emailVerifyCodeHash: null,
      emailVerifyExpiresAt: null,
      emailVerifyAttempts: 0,
      ...overrides,
    });
  }

  beforeEach(() => {
    jest.resetAllMocks();

    repository.findOneBy.mockResolvedValue(makeUser());
    repository.existsBy.mockResolvedValue(false);
    repository.update.mockResolvedValue({ affected: 1 });

    jest.mocked(access).mockResolvedValue(undefined);
    jest.mocked(mkdir).mockResolvedValue(undefined);
    jest.mocked(writeFile).mockResolvedValue(undefined);
    jest.mocked(unlink).mockResolvedValue(undefined);

    service = new UsersService(repository as never);
  });

  it('saves an uploaded avatar and stores its short URL', async () => {
    const result = await service.updateProfile(userId, {
      avatarImage,
    });

    expect(mkdir).toHaveBeenCalledTimes(1);
    expect(writeFile).toHaveBeenCalledTimes(1);

    const writtenBytes = jest.mocked(writeFile).mock.calls[0][1];
    expect(writtenBytes).toEqual(imageBytes);

    const changes = repository.update.mock.calls[0][1] as Partial<User>;

    expect(changes.avatarUrl).toMatch(
      new RegExp(`^/users/${userId}/avatar/[0-9a-f-]{36}\\.jpg$`),
    );
    expect(result.avatarUrl).toBe(changes.avatarUrl);
  });

  it('rejects text disguised as an avatar', async () => {
    await expect(
      service.updateProfile(userId, {
        avatarImage: 'data:image/jpeg;base64,SGVsbG8=',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(writeFile).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects an avatar image and avatar URL together', async () => {
    await expect(
      service.updateProfile(userId, {
        avatarImage,
        avatarUrl: 'https://example.com/avatar.jpg',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(writeFile).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('removes a new avatar if the database update fails', async () => {
    repository.update.mockRejectedValue(new Error('Database unavailable'));

    await expect(
      service.updateProfile(userId, { avatarImage }),
    ).rejects.toThrow('Database unavailable');

    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(unlink).toHaveBeenCalledTimes(1);

    const writtenPath = jest.mocked(writeFile).mock.calls[0][0];
    const removedPath = jest.mocked(unlink).mock.calls[0][0];

    expect(removedPath).toBe(writtenPath);
  });

  it('removes the previous stored avatar after an update', async () => {
    repository.findOneBy.mockResolvedValue(makeUser({ avatarUrl }));

    await service.updateProfile(userId, { avatarImage });

    expect(unlink).toHaveBeenCalledWith(
      join(process.cwd(), 'storage', 'avatars', userId, `${avatarId}.jpg`),
    );
  });

  it('clears verification when the email changes', async () => {
    await service.updateProfile(userId, {
      email: 'new@example.com',
    });

    const changes = repository.update.mock.calls[0][1] as Partial<User>;

    expect(changes.email).toBe('new@example.com');
    expect(changes.verifiedEmail).toBeNull();
    expect(changes.emailVerifyCodeHash).toBeNull();
    expect(changes.emailVerifyExpiresAt).toBeNull();
    expect(changes.emailVerifyAttempts).toBe(0);
  });

  it('returns the current avatar file path', async () => {
    repository.findOneBy.mockResolvedValue(makeUser({ avatarUrl }));

    const result = await service.getAvatarPath(userId, avatarId);

    const expectedPath = join(
      process.cwd(),
      'storage',
      'avatars',
      userId,
      `${avatarId}.jpg`,
    );

    expect(access).toHaveBeenCalledWith(expectedPath);
    expect(result).toBe(expectedPath);
  });

  it('does not serve an avatar that is no longer current', async () => {
    await expect(
      service.getAvatarPath(userId, avatarId),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(access).not.toHaveBeenCalled();
  });

  it('returns 404 when the current avatar file is missing', async () => {
    repository.findOneBy.mockResolvedValue(makeUser({ avatarUrl }));
    jest.mocked(access).mockRejectedValue(new Error('File does not exist'));

    await expect(
      service.getAvatarPath(userId, avatarId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
