import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';

import { UserStatus } from '../../../database/enums/database.enums';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UsersService } from '../../users/services/users.service';
import { ChatService } from '../services/chat.service';
import { ChatController } from './chat.controller';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

describe('Chat endpoints', () => {
  const userId = '9afb3d2a-5d0a-4544-a9fc-6cdb465de34b';
  const workspaceId = '62a9bb1e-bf7b-4d38-a986-14f730579045';
  const messageId = '73362c61-b9c9-45f0-aeec-30542510fc79';

  const user = {
    id: userId,
    username: 'workspace_chat_test',
    email: 'workspacechat@example.com',
    avatarUrl: null,
    appRole: 'USER',
    status: UserStatus.ACTIVE,
    createdAt: new Date('2026-10-30T15:00:00Z'),
    updatedAt: new Date('2026-10-30T15:00:00Z'),
  };

  const message = {
    id: messageId,
    workspaceId,
    senderId: userId,
    content: 'Hello workspace!',
    createdAt: new Date('2026-10-30T15:12:49.749Z'),
  };

  const usersService = {
    findForAuth: jest.fn(),
  };

  const chatService = {
    sendMessage: jest.fn(),
    listMessages: jest.fn(),
    unreadCount: jest.fn(),
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
      controllers: [ChatController],
      providers: [
        JwtAuthGuard,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: ChatService,
          useValue: chatService,
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
    chatService.sendMessage.mockResolvedValue(message);
    chatService.listMessages.mockResolvedValue([message]);
    chatService.unreadCount.mockResolvedValue(5);
    chatService.markRead.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 when sending without a JWT', async () => {
    await request(app.getHttpServer() as Server)
      .post(`/workspaces/${workspaceId}/messages`)
      .send({
        content: 'Hello workspace!',
      })
      .expect(401);

    expect(chatService.sendMessage).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid workspace UUID', async () => {
    await request(app.getHttpServer() as Server)
      .post('/workspaces/not-a-uuid/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'Hello workspace!',
      })
      .expect(400);

    expect(chatService.sendMessage).not.toHaveBeenCalled();
  });

  it('sends a workspace message', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post(`/workspaces/${workspaceId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'Hello workspace!',
      })
      .expect(201);

    expect(chatService.sendMessage).toHaveBeenCalledWith(workspaceId, userId, {
      content: 'Hello workspace!',
    });

    const body: unknown = response.body;

    expect(body).toEqual(
      expect.objectContaining({
        id: messageId,
        workspaceId,
        senderId: userId,
        content: 'Hello workspace!',
      }),
    );
  });

  it('sends a workspace message with replyToId and requestId', async () => {
    const replyToId = '88888888-8888-4888-8888-888888888888';
    const requestId = '77777777-7777-4777-8777-777777777777';

    await request(app.getHttpServer() as Server)
      .post(`/workspaces/${workspaceId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'Replying now',
        replyToId,
        requestId,
      })
      .expect(201);

    expect(chatService.sendMessage).toHaveBeenCalledWith(workspaceId, userId, {
      content: 'Replying now',
      replyToId,
      requestId,
    });
  });

  it('returns 400 when content is empty', async () => {
    await request(app.getHttpServer() as Server)
      .post(`/workspaces/${workspaceId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: '',
      })
      .expect(400);

    expect(chatService.sendMessage).not.toHaveBeenCalled();
  });

  it('rejects unknown fields', async () => {
    await request(app.getHttpServer() as Server)
      .post(`/workspaces/${workspaceId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'Hello workspace!',
        senderId: '11111111-1111-4111-8111-111111111111',
      })
      .expect(400);

    expect(chatService.sendMessage).not.toHaveBeenCalled();
  });

  it('gets unread message count', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get(`/workspaces/${workspaceId}/messages/unread-count`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(chatService.unreadCount).toHaveBeenCalledWith(workspaceId, userId);
    expect(response.body).toEqual({ count: 5 });
  });

  it('marks a message as read', async () => {
    await request(app.getHttpServer() as Server)
      .patch(`/workspaces/${workspaceId}/messages/${messageId}/read`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    expect(chatService.markRead).toHaveBeenCalledWith(workspaceId, userId, messageId);
  });

  it('lists workspace messages', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get(`/workspaces/${workspaceId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(chatService.listMessages).toHaveBeenCalledWith(
      workspaceId,
      userId,
      {},
    );

    const body: unknown = response.body;

    expect(body).toHaveLength(1);
    expect(body).toEqual([
      expect.objectContaining({
        id: messageId,
        workspaceId,
        senderId: userId,
        content: 'Hello workspace!',
      }),
    ]);
  });

  it('passes pagination to the service', async () => {
    await request(app.getHttpServer() as Server)
      .get(`/workspaces/${workspaceId}/messages?page=2&limit=10`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(chatService.listMessages).toHaveBeenCalledWith(workspaceId, userId, {
      page: 2,
      limit: 10,
    });
  });

  it('rejects invalid pagination', async () => {
    await request(app.getHttpServer() as Server)
      .get(`/workspaces/${workspaceId}/messages?page=0&limit=101`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(chatService.listMessages).not.toHaveBeenCalled();
  });
});
