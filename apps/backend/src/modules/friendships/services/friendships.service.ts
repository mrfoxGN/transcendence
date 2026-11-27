import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { In, IsNull, QueryFailedError, Repository } from 'typeorm';

import {
  FriendshipStatus,
  UserStatus,
} from '../../../database/enums/database.enums';
import { User } from '../../users/entities/user.entity';
import { Friendship } from '../../social/entities/friendship.entity';
import { FriendshipResponseDto } from '../dto/friendship-response.dto';

function isDuplicateError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as {
    code?: string;
  };

  return driverError.code === 'ER_DUP_ENTRY';
}

@Injectable()
export class FriendshipsService {
  constructor(
    @InjectRepository(Friendship)
    private readonly friendshipsRepository: Repository<Friendship>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async request(
    userId: string,
    otherUserId: string,
  ): Promise<FriendshipResponseDto> {
    if (userId === otherUserId) {
      throw new BadRequestException(
        'You cannot send a friend request to yourself',
      );
    }

    const otherUser = await this.usersRepository.findOneBy({
      id: otherUserId,
      status: UserStatus.ACTIVE,
      deletedAt: IsNull(),
    });

    if (!otherUser) {
      throw new NotFoundException('User not found');
    }

    const [userAId, userBId] = this.orderUserIds(userId, otherUserId);

    const existing = await this.friendshipsRepository.findOneBy({
      userAId,
      userBId,
    });

    if (existing) {
      if (
        existing.status === FriendshipStatus.PENDING ||
        existing.status === FriendshipStatus.ACCEPTED
      ) {
        throw new ConflictException('A request or friendship already exists');
      }

      const now = new Date();

      const result = await this.friendshipsRepository.update(
        {
          id: existing.id,
          status: existing.status,
        },
        {
          requestedById: userId,
          status: FriendshipStatus.PENDING,
          requestedAt: now,
          respondedAt: null,
        },
      );

      if (!result.affected) {
        throw new ConflictException('Friendship changed; please try again');
      }

      const updated = await this.friendshipsRepository.findOneBy({
        id: existing.id,
      });

      if (!updated) {
        throw new NotFoundException('Friend request not found');
      }

      return this.toResponse(updated, userId, otherUser);
    }

    const friendship = this.friendshipsRepository.create({
      id: randomUUID(),
      userAId,
      userBId,
      requestedById: userId,
      status: FriendshipStatus.PENDING,
      requestedAt: new Date(),
      respondedAt: null,
    });

    try {
      const saved = await this.friendshipsRepository.save(friendship);

      return this.toResponse(saved, userId, otherUser);
    } catch (error: unknown) {
      if (isDuplicateError(error)) {
        throw new ConflictException('A request or friendship already exists');
      }

      throw error;
    }
  }

  async listFriends(userId: string): Promise<FriendshipResponseDto[]> {
    const friendships = await this.friendshipsRepository.find({
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

    return this.addOtherUsers(friendships, userId);
  }

  async listRequests(userId: string): Promise<FriendshipResponseDto[]> {
    const requests = await this.friendshipsRepository.find({
      where: [
        {
          userAId: userId,
          status: FriendshipStatus.PENDING,
        },
        {
          userBId: userId,
          status: FriendshipStatus.PENDING,
        },
      ],
      order: {
        requestedAt: 'DESC',
        id: 'DESC',
      },
    });

    return this.addOtherUsers(requests, userId);
  }

  async accept(
    requestId: string,
    userId: string,
  ): Promise<FriendshipResponseDto> {
    return this.respond(requestId, userId, FriendshipStatus.ACCEPTED);
  }

  async reject(
    requestId: string,
    userId: string,
  ): Promise<FriendshipResponseDto> {
    return this.respond(requestId, userId, FriendshipStatus.REJECTED);
  }

  async cancelRequest(requestId: string, userId: string): Promise<void> {
    const friendship = await this.findForUser(requestId, userId);

    if (
      friendship.status !== FriendshipStatus.PENDING ||
      friendship.requestedById !== userId
    ) {
      throw new ForbiddenException(
        'Only the requester can cancel a pending request',
      );
    }

    const result = await this.friendshipsRepository.update(
      {
        id: friendship.id,
        status: FriendshipStatus.PENDING,
      },
      {
        status: FriendshipStatus.CANCELLED,
        respondedAt: new Date(),
      },
    );

    if (!result.affected) {
      throw new ConflictException('Friend request changed; please try again');
    }
  }

  async removeFriend(userId: string, otherUserId: string): Promise<void> {
    if (userId === otherUserId) {
      throw new BadRequestException('You cannot remove yourself as a friend');
    }

    const [userAId, userBId] = this.orderUserIds(userId, otherUserId);

    const friendship = await this.friendshipsRepository.findOneBy({
      userAId,
      userBId,
      status: FriendshipStatus.ACCEPTED,
    });

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    const result = await this.friendshipsRepository.delete({
      id: friendship.id,
      status: FriendshipStatus.ACCEPTED,
    });

    if (!result.affected) {
      throw new NotFoundException('Friendship not found');
    }
  }

  private async respond(
    requestId: string,
    userId: string,
    status: FriendshipStatus.ACCEPTED | FriendshipStatus.REJECTED,
  ): Promise<FriendshipResponseDto> {
    const friendship = await this.findForUser(requestId, userId);

    if (friendship.requestedById === userId) {
      throw new ForbiddenException('You cannot answer your own friend request');
    }

    if (friendship.status !== FriendshipStatus.PENDING) {
      throw new ConflictException('Friend request is no longer pending');
    }

    const result = await this.friendshipsRepository.update(
      {
        id: friendship.id,
        status: FriendshipStatus.PENDING,
      },
      {
        status,
        respondedAt: new Date(),
      },
    );

    if (!result.affected) {
      throw new ConflictException('Friend request changed; please try again');
    }

    const updated = await this.friendshipsRepository.findOneBy({
      id: friendship.id,
    });

    if (!updated) {
      throw new NotFoundException('Friend request not found');
    }

    const otherUserId = this.otherUserId(updated, userId);
    const otherUser = await this.usersRepository.findOneBy({
      id: otherUserId,
      deletedAt: IsNull(),
    });

    if (!otherUser) {
      throw new NotFoundException('User not found');
    }

    return this.toResponse(updated, userId, otherUser);
  }

  private async findForUser(
    friendshipId: string,
    userId: string,
  ): Promise<Friendship> {
    const friendship = await this.friendshipsRepository.findOneBy({
      id: friendshipId,
    });

    if (
      !friendship ||
      (friendship.userAId !== userId && friendship.userBId !== userId)
    ) {
      throw new NotFoundException('Friend request not found');
    }

    return friendship;
  }

  private async addOtherUsers(
    friendships: Friendship[],
    userId: string,
  ): Promise<FriendshipResponseDto[]> {
    if (friendships.length === 0) {
      return [];
    }

    const otherIds = friendships.map((friendship) =>
      this.otherUserId(friendship, userId),
    );

    const users = await this.usersRepository.find({
      where: {
        id: In(otherIds),
        deletedAt: IsNull(),
      },
    });

    const usersById = new Map(users.map((user) => [user.id, user]));

    return friendships.flatMap((friendship) => {
      const otherUserId = this.otherUserId(friendship, userId);
      const otherUser = usersById.get(otherUserId);

      if (!otherUser) {
        return [];
      }

      return [this.toResponse(friendship, userId, otherUser)];
    });
  }

  private orderUserIds(firstId: string, secondId: string): [string, string] {
    return firstId < secondId ? [firstId, secondId] : [secondId, firstId];
  }

  private otherUserId(friendship: Friendship, userId: string): string {
    return friendship.userAId === userId
      ? friendship.userBId
      : friendship.userAId;
  }

  private toResponse(
    friendship: Friendship,
    userId: string,
    otherUser: User,
  ): FriendshipResponseDto {
    return {
      id: friendship.id,
      otherUser: {
        id: this.otherUserId(friendship, userId),
        username: otherUser.username,
        avatarUrl: otherUser.avatarUrl,
      },
      requestedById: friendship.requestedById,
      status: friendship.status,
      requestedAt: friendship.requestedAt,
      respondedAt: friendship.respondedAt,
    };
  }
}
