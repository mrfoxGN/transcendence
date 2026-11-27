import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import type { Server } from 'node:http';
import request from 'supertest';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

jest.mock('../../auth/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class JwtAuthGuard {
    canActivate(): boolean {
      return true;
    }
  },
}));

import { FriendshipsService } from '../services/friendships.service';
import { FriendshipsController } from './friendships.controller';

describe('Friendships endpoints', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const otherUserId = '22222222-2222-4222-8222-222222222222';
  const requestId = '33333333-3333-4333-8333-333333333333';

  const friendship = {
    id: requestId,
    otherUser: {
      id: otherUserId,
      username: 'friend',
      avatarUrl: null,
    },
    requestedById: userId,
    status: 'PENDING',
    requestedAt: new Date('2026-11-27T12:00:00.000Z'),
    respondedAt: null,
  };

  const friendshipsService = {
    request: jest.fn(),
    listRequests: jest.fn(),
    accept: jest.fn(),
    reject: jest.fn(),
    cancelRequest: jest.fn(),
    listFriends: jest.fn(),
    removeFriend: jest.fn(),
  };

  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FriendshipsController],
      providers: [
        {
          provide: FriendshipsService,
          useValue: friendshipsService,
        },
      ],
    }).compile();

    app = module.createNestApplication();

    app.use((httpRequest, _response, next) => {
      const authenticatedRequest = httpRequest as Request & {
        user?: { id: string };
      };

      authenticatedRequest.user = { id: userId };
      next();
    });

    await app.init();
    server = app.getHttpServer() as Server;
  });

  beforeEach(() => {
    jest.resetAllMocks();

    friendshipsService.request.mockResolvedValue(friendship);
    friendshipsService.listRequests.mockResolvedValue([friendship]);
    friendshipsService.accept.mockResolvedValue({
      ...friendship,
      status: 'ACCEPTED',
    });
    friendshipsService.reject.mockResolvedValue({
      ...friendship,
      status: 'REJECTED',
    });
    friendshipsService.cancelRequest.mockResolvedValue(undefined);
    friendshipsService.listFriends.mockResolvedValue([]);
    friendshipsService.removeFriend.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app.close();
  });

  it('sends a request using the authenticated user ID', async () => {
    await request(server)
      .post(`/friendships/requests/${otherUserId}`)
      .expect(201);

    expect(friendshipsService.request).toHaveBeenCalledWith(
      userId,
      otherUserId,
    );
  });

  it('rejects an invalid user ID before calling the service', async () => {
    await request(server).post('/friendships/requests/not-a-uuid').expect(400);

    expect(friendshipsService.request).not.toHaveBeenCalled();
  });

  it('lists pending requests', async () => {
    await request(server).get('/friendships/requests').expect(200);

    expect(friendshipsService.listRequests).toHaveBeenCalledWith(userId);
  });

  it('accepts a request', async () => {
    await request(server)
      .post(`/friendships/requests/${requestId}/accept`)
      .expect(200);

    expect(friendshipsService.accept).toHaveBeenCalledWith(requestId, userId);
  });

  it('removes a friend with no response body', async () => {
    await request(server).delete(`/friendships/${otherUserId}`).expect(204);

    expect(friendshipsService.removeFriend).toHaveBeenCalledWith(
      userId,
      otherUserId,
    );
  });
});
