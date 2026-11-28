import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import {
  FriendshipStatus,
  UserStatus,
} from '../../../database/enums/database.enums';
import { Friendship } from '../../social/entities/friendship.entity';
import { FriendshipsService } from './friendships.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

describe('FriendshipsService', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const otherUserId = '22222222-2222-4222-8222-222222222222';
  const friendshipId = '33333333-3333-4333-8333-333333333333';

  const otherUser = {
    id: otherUserId,
    username: 'friend',
    avatarUrl: null,
    status: UserStatus.ACTIVE,
    deletedAt: null,
  };

  const friendshipsRepository = {
    findOneBy: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const usersRepository = {
    findOneBy: jest.fn(),
    find: jest.fn(),
  };

  let service: FriendshipsService;

  function makeFriendship(changes: Partial<Friendship> = {}): Friendship {
    return Object.assign(new Friendship(), {
      id: friendshipId,
      userAId: userId,
      userBId: otherUserId,
      requestedById: userId,
      status: FriendshipStatus.PENDING,
      requestedAt: new Date('2026-11-27T12:00:00.000Z'),
      respondedAt: null,
      ...changes,
    });
  }

  beforeEach(() => {
    jest.resetAllMocks();

    friendshipsRepository.findOneBy.mockResolvedValue(null);
    friendshipsRepository.find.mockResolvedValue([]);
    friendshipsRepository.create.mockImplementation(
      (value: Friendship) => value,
    );
    friendshipsRepository.save.mockImplementation((value: Friendship) =>
      Promise.resolve(value),
    );
    friendshipsRepository.update.mockResolvedValue({
      affected: 1,
    });
    friendshipsRepository.delete.mockResolvedValue({
      affected: 1,
    });

    usersRepository.findOneBy.mockResolvedValue(otherUser);
    usersRepository.find.mockResolvedValue([otherUser]);

    service = new FriendshipsService(
      friendshipsRepository as never,
      usersRepository as never,
    );
  });

  it('does not allow a request to yourself', async () => {
    await expect(service.request(userId, userId)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(friendshipsRepository.save).not.toHaveBeenCalled();
  });

  it('does not send a request to a missing user', async () => {
    usersRepository.findOneBy.mockResolvedValue(null);

    await expect(service.request(userId, otherUserId)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(friendshipsRepository.save).not.toHaveBeenCalled();
  });

  it('creates a pending request with the user pair in order', async () => {
    const result = await service.request(userId, otherUserId);

    expect(friendshipsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userAId: userId,
        userBId: otherUserId,
        requestedById: userId,
        status: FriendshipStatus.PENDING,
      }),
    );

    expect(friendshipsRepository.save).toHaveBeenCalledTimes(1);
    expect(result.otherUser.id).toBe(otherUserId);
    expect(result.status).toBe(FriendshipStatus.PENDING);
  });

  it('rejects a duplicate pending request', async () => {
    friendshipsRepository.findOneBy.mockResolvedValue(makeFriendship());

    await expect(service.request(userId, otherUserId)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(friendshipsRepository.save).not.toHaveBeenCalled();
  });

  it('lets the recipient accept a pending request', async () => {
    const pending = makeFriendship();
    const accepted = makeFriendship({
      status: FriendshipStatus.ACCEPTED,
      respondedAt: new Date(),
    });

    friendshipsRepository.findOneBy
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(accepted);

    usersRepository.findOneBy.mockResolvedValue({
      id: userId,
      username: 'requester',
      avatarUrl: null,
    });

    const result = await service.accept(friendshipId, otherUserId);

    expect(friendshipsRepository.update).toHaveBeenCalledWith(
      {
        id: friendshipId,
        status: FriendshipStatus.PENDING,
      },
      expect.objectContaining({
        status: FriendshipStatus.ACCEPTED,
      }),
    );

    expect(result.status).toBe(FriendshipStatus.ACCEPTED);
    expect(result.otherUser.id).toBe(userId);
  });

  it('does not let the requester accept their own request', async () => {
    friendshipsRepository.findOneBy.mockResolvedValue(makeFriendship());

    await expect(service.accept(friendshipId, userId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(friendshipsRepository.update).not.toHaveBeenCalled();
  });

  it('does not let an outsider answer a request', async () => {
    friendshipsRepository.findOneBy.mockResolvedValue(makeFriendship());

    await expect(
      service.accept(friendshipId, '44444444-4444-4444-8444-444444444444'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(friendshipsRepository.update).not.toHaveBeenCalled();
  });

  it('lists only accepted friendships returned by the query', async () => {
    friendshipsRepository.find.mockResolvedValue([
      makeFriendship({
        status: FriendshipStatus.ACCEPTED,
      }),
    ]);

    const result = await service.listFriends(userId);

    expect(friendshipsRepository.find).toHaveBeenCalledWith({
      where: [
        {
          userAId: userId,
          status: FriendshipStatus.ACCEPTED,
        },
        {
          userBId: userId,
          status: FriendshipStatus.ACCEPTED,
        },
      ],
      order: {
        requestedAt: 'DESC',
        id: 'DESC',
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0].otherUser.username).toBe('friend');
  });

  it('lets either friend remove an accepted friendship', async () => {
    friendshipsRepository.findOneBy.mockResolvedValue(
      makeFriendship({
        status: FriendshipStatus.ACCEPTED,
      }),
    );

    await service.removeFriend(otherUserId, userId);

    expect(friendshipsRepository.delete).toHaveBeenCalledWith({
      id: friendshipId,
      status: FriendshipStatus.ACCEPTED,
    });
  });

  it('does not remove a friendship that is not accepted', async () => {
    friendshipsRepository.findOneBy.mockResolvedValue(null);

    await expect(
      service.removeFriend(userId, otherUserId),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(friendshipsRepository.delete).not.toHaveBeenCalled();
  });
});
