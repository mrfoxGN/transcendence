import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';

import { UserStatus } from '../../../database/enums/database.enums';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UsersService } from '../../users/services/users.service';
import { SocialService } from '../services/social.service';
import { SocialController } from './social.controller';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

describe('SocialController endpoints', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const otherUserId = '22222222-2222-4222-8222-222222222222';
  const conversationId = '33333333-3333-4333-8333-333333333333';
  const messageId = '44444444-4444-4444-8444-444444444444';

  const user = {
    id: userId,
    username: 'social_test_user',
    email: 'socialtest@example.com',
    avatarUrl: null,
    appRole: 'USER',
    status: UserStatus.ACTIVE,
    createdAt: new Date('2026-10-30T15:00:00Z'),
    updatedAt: new Date('2026-10-30T15:00:00Z'),
  };

  const directMessage = {
    id: messageId,
    conversationId,
    senderId: userId,
    content: 'Hello friend!',
    createdAt: new Date('2026-10-30T15:10:00Z'),
  };

  const directConversation = {
    id: conversationId,
    otherUserId,
    otherUsername: 'friend',
    lastMessageAt: new Date('2026-10-30T15:10:00Z'),
    createdAt: new Date('2026-10-30T15:00:00Z'),
    unreadCount: 0,
  };

  const usersService = {
    findForAuth: jest.fn(),
  };

  const socialService = {
    unreadCount: jest.fn(),
    listConversations: jest.fn(),
    openConversation: jest.fn(),
    sendMessage: jest.fn(),
    listMessages: jest.fn(),
    markRead: jest.fn(),
  };

  let app: INestApplication;
  let jwtService: JwtService;
  let token: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-only-secret',
        }),
      ],
      controllers: [SocialController],
      providers: [
        JwtAuthGuard,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: SocialService,
          useValue: socialService,
        },
      ],
    }).compile();

    jwtService = module.get(JwtService);

    token = await jwtService.signAsync({
      sub: userId,
      tokenVersion: 0,
    });

    app = module.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();

    usersService.findForAuth.mockResolvedValue({ user, tokenVersion: 0 });
    socialService.unreadCount.mockResolvedValue(3);
    socialService.listConversations.mockResolvedValue([directConversation]);
    socialService.openConversation.mockResolvedValue(directConversation);
    socialService.sendMessage.mockResolvedValue(directMessage);
    socialService.listMessages.mockResolvedValue([directMessage]);
    socialService.markRead.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /direct-conversations/unread-count', () => {
    it('returns 401 without JWT token', async () => {
      await request(app.getHttpServer() as Server)
        .get('/direct-conversations/unread-count')
        .expect(401);
    });

    it('returns unread count', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/direct-conversations/unread-count')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(socialService.unreadCount).toHaveBeenCalledWith(userId);
      expect(response.body).toEqual({ count: 3 });
    });
  });

  describe('GET /direct-conversations', () => {
    it('lists conversations with default query', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/direct-conversations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(socialService.listConversations).toHaveBeenCalledWith(userId, {});
      expect(response.body).toHaveLength(1);
    });

    it('passes pagination parameters', async () => {
      await request(app.getHttpServer() as Server)
        .get('/direct-conversations?page=2&limit=15')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(socialService.listConversations).toHaveBeenCalledWith(userId, {
        page: 2,
        limit: 15,
      });
    });

    it('rejects invalid pagination', async () => {
      await request(app.getHttpServer() as Server)
        .get('/direct-conversations?page=0&limit=150')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(socialService.listConversations).not.toHaveBeenCalled();
    });
  });

  describe('POST /direct-conversations/:userId', () => {
    it('returns 400 for invalid UUID', async () => {
      await request(app.getHttpServer() as Server)
        .post('/direct-conversations/not-a-uuid')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(socialService.openConversation).not.toHaveBeenCalled();
    });

    it('opens or retrieves a conversation (200)', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post(`/direct-conversations/${otherUserId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(socialService.openConversation).toHaveBeenCalledWith(userId, otherUserId);
      expect(response.body).toEqual(expect.objectContaining({ id: conversationId }));
    });
  });

  describe('POST /direct-conversations/:id/messages', () => {
    it('sends direct message (201)', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post(`/direct-conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Hello friend!' })
        .expect(201);

      expect(socialService.sendMessage).toHaveBeenCalledWith(userId, conversationId, {
        content: 'Hello friend!',
      });
      expect(response.body).toEqual(expect.objectContaining({ id: messageId, content: 'Hello friend!' }));
    });

    it('sends direct message with replyToId and requestId', async () => {
      const replyToId = '88888888-8888-4888-8888-888888888888';
      const requestId = '77777777-7777-4777-8777-777777777777';

      await request(app.getHttpServer() as Server)
        .post(`/direct-conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          content: 'Replying',
          replyToId,
          requestId,
        })
        .expect(201);

      expect(socialService.sendMessage).toHaveBeenCalledWith(userId, conversationId, {
        content: 'Replying',
        replyToId,
        requestId,
      });
    });

    it('rejects empty content', async () => {
      await request(app.getHttpServer() as Server)
        .post(`/direct-conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: '' })
        .expect(400);

      expect(socialService.sendMessage).not.toHaveBeenCalled();
    });

    it('rejects unknown fields', async () => {
      await request(app.getHttpServer() as Server)
        .post(`/direct-conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Hello', extra: 'bad' })
        .expect(400);

      expect(socialService.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('GET /direct-conversations/:id/messages', () => {
    it('lists messages for a conversation', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get(`/direct-conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(socialService.listMessages).toHaveBeenCalledWith(userId, conversationId, {});
      expect(response.body).toHaveLength(1);
    });

    it('passes pagination to the service', async () => {
      await request(app.getHttpServer() as Server)
        .get(`/direct-conversations/${conversationId}/messages?page=3&limit=25`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(socialService.listMessages).toHaveBeenCalledWith(userId, conversationId, {
        page: 3,
        limit: 25,
      });
    });

    it('rejects invalid limit', async () => {
      await request(app.getHttpServer() as Server)
        .get(`/direct-conversations/${conversationId}/messages?limit=105`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(socialService.listMessages).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /direct-conversations/:id/read', () => {
    it('marks conversation read (204)', async () => {
      await request(app.getHttpServer() as Server)
        .patch(`/direct-conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(socialService.markRead).toHaveBeenCalledWith(userId, conversationId);
    });
  });
});
