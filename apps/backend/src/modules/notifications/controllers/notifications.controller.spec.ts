import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from '../services/notifications.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

describe('NotificationsController', () => {
  let app: INestApplication;

  const userId = '11111111-1111-4111-8111-111111111111';

  const notificationId = '22222222-2222-4222-8222-222222222222';

  const notification = {
    id: notificationId,
    workspaceId: '33333333-3333-4333-8333-333333333333',
    type: 'TASK_ASSIGNED',
    message: 'You were assigned to Backend API',
    relatedResourceType: 'task',
    relatedResourceId: '44444444-4444-4444-8444-444444444444',
    payload: null,
    createdAt: new Date('2026-10-30T12:00:00Z'),
    readAt: null,
  };

  const notificationsService = {
    findAll: jest.fn(),
    countUnread: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest();

          req.user = {
            id: userId,
          };

          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();

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
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists notifications', async () => {
    notificationsService.findAll.mockResolvedValue([notification]);

    const response = await request(app.getHttpServer())
      .get('/notifications?page=1&limit=20')
      .expect(200);

    expect(response.body).toHaveLength(1);

    expect(notificationsService.findAll).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        page: 1,
        limit: 20,
      }),
    );
  });

  it('lists unread notifications only', async () => {
    notificationsService.findAll.mockResolvedValue([notification]);

    await request(app.getHttpServer())
      .get('/notifications?unreadOnly=true')
      .expect(200);

    expect(notificationsService.findAll).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        unreadOnly: true,
      }),
    );
  });

  it('rejects invalid pagination', async () => {
    await request(app.getHttpServer()).get('/notifications?page=0').expect(400);

    expect(notificationsService.findAll).not.toHaveBeenCalled();
  });

  it('rejects invalid unreadOnly value', async () => {
    await request(app.getHttpServer())
      .get('/notifications?unreadOnly=test')
      .expect(400);

    expect(notificationsService.findAll).not.toHaveBeenCalled();
  });

  it('returns unread count', async () => {
    notificationsService.countUnread.mockResolvedValue({
      count: 3,
    });

    const response = await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .expect(200);

    expect(response.body).toEqual({
      count: 3,
    });

    expect(notificationsService.countUnread).toHaveBeenCalledWith(userId);
  });

  it('marks one notification as read', async () => {
    notificationsService.markAsRead.mockResolvedValue({
      ...notification,
      readAt: new Date(),
    });

    const response = await request(app.getHttpServer())
      .patch(`/notifications/${notificationId}/read`)
      .expect(200);

    expect(response.body.id).toBe(notificationId);

    expect(notificationsService.markAsRead).toHaveBeenCalledWith(
      notificationId,
      userId,
    );
  });

  it('rejects invalid notification UUID', async () => {
    await request(app.getHttpServer())
      .patch('/notifications/not-a-uuid/read')
      .expect(400);

    expect(notificationsService.markAsRead).not.toHaveBeenCalled();
  });

  it('marks all notifications as read', async () => {
    notificationsService.markAllAsRead.mockResolvedValue({
      updated: 4,
    });

    const response = await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .expect(200);

    expect(response.body).toEqual({
      updated: 4,
    });

    expect(notificationsService.markAllAsRead).toHaveBeenCalledWith(userId);
  });
});
