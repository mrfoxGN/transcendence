import { NotFoundException } from '@nestjs/common';

import { NotificationsService } from './notifications.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

describe('NotificationsService', () => {
  let service: NotificationsService;

  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
  };

  const userId = '11111111-1111-4111-8111-111111111111';

  const workspaceId = '22222222-2222-4222-8222-222222222222';

  const notificationId = '33333333-3333-4333-8333-333333333333';

  const notification = {
    id: notificationId,
    userId,
    workspaceId,
    type: 'TASK_ASSIGNED',
    message: 'You were assigned to Backend API',
    relatedResourceType: 'task',
    relatedResourceId: '44444444-4444-4444-8444-444444444444',
    payload: null,
    createdAt: new Date('2026-10-30T12:00:00Z'),
    readAt: null,
  };

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    };

    service = new NotificationsService(repository as never);

    jest.clearAllMocks();
  });

  describe('createForUser', () => {
    it('creates an unread notification', async () => {
      repository.create.mockImplementation((value: unknown) => value);

      repository.save.mockImplementation((value: unknown) => value);

      const result = await service.createForUser({
        userId,
        workspaceId,
        type: 'TASK_ASSIGNED',
        message: 'You were assigned to Backend API',
        relatedResourceType: 'task',
        relatedResourceId: '44444444-4444-4444-8444-444444444444',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          workspaceId,
          type: 'TASK_ASSIGNED',
          readAt: null,
        }),
      );

      expect(repository.save).toHaveBeenCalled();

      expect(result.type).toBe('TASK_ASSIGNED');
      expect(result.readAt).toBeNull();
    });
  });

  describe('findAll', () => {
    it('returns user notifications', async () => {
      repository.find.mockResolvedValue([notification]);

      const result = await service.findAll(userId, {});

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(notificationId);
    });

    it('applies pagination', async () => {
      repository.find.mockResolvedValue([]);

      await service.findAll(userId, {
        page: 3,
        limit: 10,
      });

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('filters unread notifications', async () => {
      repository.find.mockResolvedValue([]);

      await service.findAll(userId, {
        unreadOnly: true,
      });

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            readAt: expect.anything() as unknown,
          }) as unknown,
        }),
      );
    });
  });

  describe('countUnread', () => {
    it('returns unread count', async () => {
      repository.count.mockResolvedValue(4);

      const result = await service.countUnread(userId);

      expect(result).toEqual({
        count: 4,
      });

      expect(repository.count).toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('marks notification as read', async () => {
      repository.findOne.mockResolvedValue({
        ...notification,
      });

      repository.save.mockImplementation((value: unknown) => value);

      const result = await service.markAsRead(notificationId, userId);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          id: notificationId,
          userId,
        },
      });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          readAt: expect.any(Date) as unknown,
        }),
      );

      expect(result.readAt).toBeInstanceOf(Date);
    });

    it('does not save again if already read', async () => {
      repository.findOne.mockResolvedValue({
        ...notification,
        readAt: new Date(),
      });

      await service.markAsRead(notificationId, userId);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('throws if notification is not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.markAsRead(notificationId, userId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('marks all unread notifications as read', async () => {
      repository.update.mockResolvedValue({
        affected: 3,
      });

      const result = await service.markAllAsRead(userId);

      expect(repository.update).toHaveBeenCalled();

      expect(result).toEqual({
        updated: 3,
      });
    });

    it('returns zero when nothing was updated', async () => {
      repository.update.mockResolvedValue({
        affected: 0,
      });

      const result = await service.markAllAsRead(userId);

      expect(result).toEqual({
        updated: 0,
      });
    });
  });
});
