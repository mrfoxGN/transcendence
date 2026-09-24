import * as argon2 from 'argon2';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UsersService } from './users.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  AppRole,
  UserStatus,
} from '../../../database/enums/database.enums';
import { UpdateProfileDto } from '../dto/update-profile.dto';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
function makeUser(): User {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    username: 'khaled',
    email: 'khaled@example.com',
    passwordHash: 'stored-hash',
    avatarUrl: 'old-avatar',
    appRole: AppRole.USER,
    status: UserStatus.ACTIVE,
    lastSeenAt: null,
    createdAt: new Date('2026-09-01'),
    updatedAt: new Date('2026-09-01'),
    deletedAt: null,
  };
}

describe('UsersService', () => {
  it('returns 404 when updating a missing user', async () => {
  const repository = {
    findOneBy: jest.fn().mockResolvedValue(null),
  };
  const service = new UsersService(
    repository as unknown as Repository<User>,
  );

  await expect(
    service.updateProfile('missing-id', { username: 'newname' }),
  ).rejects.toThrow(NotFoundException);
});

it('rejects an empty update and a null username', async () => {
  const repository = {
    findOneBy: jest.fn().mockImplementation(async () => makeUser()),
  };
  const service = new UsersService(
    repository as unknown as Repository<User>,
  );
  const id = makeUser().id;

  await expect(service.updateProfile(id, new UpdateProfileDto())).rejects.toThrow(
    BadRequestException,
  );

  await expect(
    service.updateProfile(id, { username: null } as never),
  ).rejects.toThrow(BadRequestException);
});

it('updates allowed fields and returns a safe response', async () => {
  const repository = {
    findOneBy: jest.fn().mockResolvedValue(makeUser()),
    existsBy: jest.fn().mockResolvedValue(false),
    save: jest.fn().mockImplementation(async (user) => user),
  };
  const service = new UsersService(
    repository as unknown as Repository<User>,
  );

  const response = await service.updateProfile(makeUser().id, {
    username: 'newname',
    email: 'new@example.com',
    avatarUrl: null,
  });

  expect(response.username).toBe('newname');
  expect(response.email).toBe('new@example.com');
  expect(response.avatarUrl).toBeNull();
  expect(response).not.toHaveProperty('passwordHash');
});

it('rejects an existing username', async () => {
  const repository = {
    findOneBy: jest.fn().mockResolvedValue(makeUser()),
    existsBy: jest.fn().mockResolvedValue(true),
    save: jest.fn(),
  };
  const service = new UsersService(
    repository as unknown as Repository<User>,
  );

  await expect(
    service.updateProfile(makeUser().id, { username: 'taken' }),
  ).rejects.toThrow(ConflictException);

  expect(repository.save).not.toHaveBeenCalled();
});

it('rejects an existing email', async () => {
  const repository = {
    findOneBy: jest.fn().mockResolvedValue(makeUser()),
    existsBy: jest.fn().mockResolvedValue(true),
    save: jest.fn(),
  };
  const service = new UsersService(
    repository as unknown as Repository<User>,
  );

  await expect(
    service.updateProfile(makeUser().id, { email: 'taken@example.com' }),
  ).rejects.toThrow(ConflictException);

  expect(repository.save).not.toHaveBeenCalled();
});

it('returns a conflict if MySQL rejects an update duplicate', async () => {
  const repository = {
    findOneBy: jest.fn().mockResolvedValue(makeUser()),
    existsBy: jest.fn().mockResolvedValue(false),
    save: jest.fn().mockRejectedValue(
      new QueryFailedError('UPDATE', [], {
        code: 'ER_DUP_ENTRY',
      }),
    ),
  };
  const service = new UsersService(
    repository as unknown as Repository<User>,
  );

  await expect(
    service.updateProfile(makeUser().id, { username: 'newname' }),
  ).rejects.toThrow(ConflictException);
});
  it('returns 404 when a user does not exist', async () => {
  const repository = {
    findOneBy: jest.fn().mockResolvedValue(null),
  };

  const service = new UsersService(
    repository as unknown as Repository<User>,
  );

  await expect(
    service.findById('missing-user-id'),
  ).rejects.toThrow(NotFoundException);
});
  it('returns a conflict if the database rejects a duplicate', async () => {
  const repository = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((user) => user),
    save: jest.fn().mockRejectedValue(
      new QueryFailedError('INSERT', [], {
        code: 'ER_DUP_ENTRY',
      }),
    ),
  };

  const service = new UsersService(
    repository as unknown as Repository<User>,
  );

  await expect(
    service.create({
      username: 'khaled',
      email: 'khaled@example.com',
      password: 'example-password',
    }),
  ).rejects.toThrow(ConflictException);
});
  it('rejects an existing username or email', async () => {
  const repository = {
    findOne: jest.fn().mockResolvedValue({ id: 'existing-user' }),
    create: jest.fn(),
    save: jest.fn(),
  };

  const service = new UsersService(
    repository as unknown as Repository<User>,
  );

  await expect(
    service.create({
      username: 'khaled',
      email: 'khaled@example.com',
      password: 'example-password',
    }),
  ).rejects.toThrow(ConflictException);

  expect(repository.save).not.toHaveBeenCalled();
});
  it('hashes a password and never returns the hash', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((user) => user),
      save: jest.fn().mockImplementation(async (user) => user),
    };

    const service = new UsersService(
      repository as unknown as Repository<User>,
    );

    const response = await service.create({
      username: 'khaled',
      email: 'khaled@example.com',
      password: 'example-password',
    });

    const savedUser = repository.save.mock.calls[0][0] as User;

    expect(savedUser.passwordHash).not.toBe('example-password');
    expect(
      await argon2.verify(savedUser.passwordHash, 'example-password'),
    ).toBe(true);
    expect(response).not.toHaveProperty('passwordHash');
  });
});
