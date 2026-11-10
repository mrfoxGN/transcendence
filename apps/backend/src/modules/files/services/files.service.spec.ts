import { access } from 'fs/promises';

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { FilesService } from './files.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
}));

const mockedAccess = access as jest.MockedFunction<typeof access>;

describe('FilesService', () => {
  let service: FilesService;

  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };

  let workspacesService: {
    findOneForUser: jest.Mock;
  };

  let tasksService: {
    findById: jest.Mock;
  };

  let activitiesService: {
    create: jest.Mock;
  };

  const workspaceId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  const fileId = '33333333-3333-4333-8333-333333333333';

  const storedFile = {
    id: fileId,
    workspaceId,
    uploaderId: userId,
    taskId: null,
    originalName: 'document.pdf',
    displayName: 'document.pdf',
    storageKey: `${workspaceId}/stored-file`,
    mimeType: 'application/pdf',
    sizeBytes: '5',
    createdAt: new Date('2026-10-30T12:00:00Z'),
    deletedAt: null,
  };

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    workspacesService = {
      findOneForUser: jest.fn().mockResolvedValue({
        id: workspaceId,
        ownerId: userId,
      }),
    };

    tasksService = {
      findById: jest.fn(),
    };

    activitiesService = {
      create: jest.fn().mockResolvedValue({
        id: 'activity-id',
      }),
    };

    service = new FilesService(
      repository as never,
      workspacesService as never,
      tasksService as never,
      activitiesService as never,
    );

    jest.clearAllMocks();
  });

  describe('upload', () => {
    const uploadedFile = {
      originalname: 'document.pdf',
      mimetype: 'application/pdf',
      size: 5,
      buffer: Buffer.from('hello'),
    } as Express.Multer.File;

    it('uploads a workspace file', async () => {
      repository.create.mockImplementation((value: unknown) => value);
      repository.save.mockImplementation((value: unknown) => value);

      const result = await service.upload(
        workspaceId,
        userId,
        uploadedFile,
        {},
      );

      expect(workspacesService.findOneForUser).toHaveBeenCalledWith(
        workspaceId,
        userId,
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          uploaderId: userId,
          taskId: null,
          originalName: 'document.pdf',
          displayName: 'document.pdf',
          mimeType: 'application/pdf',
          sizeBytes: '5',
          deletedAt: null,
        }),
      );

      expect(result.workspaceId).toBe(workspaceId);
      expect(result.uploaderId).toBe(userId);
      expect(result.originalName).toBe('document.pdf');

      const calls = activitiesService.create.mock.calls as unknown[][];
      const activityCall = calls[0]?.[0];

      expect(activityCall).toMatchObject({
        workspaceId,
        actorUserId: userId,
        actionType: 'FILE_UPLOADED',
        resourceType: 'workspace_file',
        metadata: {
          displayName: 'document.pdf',
          originalName: 'document.pdf',
          taskId: null,
        },
      });

      if (
        typeof activityCall !== 'object' ||
        activityCall === null ||
        !('resourceId' in activityCall)
      ) {
        throw new Error('Activity call must include a resource ID');
      }

      expect(typeof activityCall.resourceId).toBe('string');
    });

    it('still uploads when activity creation fails', async () => {
      repository.create.mockImplementation((value: unknown) => value);
      repository.save.mockImplementation((value: unknown) => value);

      activitiesService.create.mockRejectedValue(
        new Error('Activity unavailable'),
      );

      jest
        .spyOn(
          (
            service as unknown as {
              logger: {
                error: (...args: unknown[]) => void;
              };
            }
          ).logger,
          'error',
        )
        .mockImplementation(() => undefined);

      const result = await service.upload(
        workspaceId,
        userId,
        uploadedFile,
        {},
      );

      expect(result.workspaceId).toBe(workspaceId);
      expect(result.originalName).toBe('document.pdf');
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(activitiesService.create).toHaveBeenCalledTimes(1);
    });

    it('rejects upload when file is missing', async () => {
      await expect(
        service.upload(workspaceId, userId, undefined, {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows a file attached to a task in the same workspace', async () => {
      const taskId = '44444444-4444-4444-8444-444444444444';

      tasksService.findById.mockResolvedValue({
        id: taskId,
        workspaceId,
      });

      repository.create.mockImplementation((value: unknown) => value);
      repository.save.mockImplementation((value: unknown) => value);

      const result = await service.upload(workspaceId, userId, uploadedFile, {
        taskId,
      });

      expect(tasksService.findById).toHaveBeenCalledWith(taskId, userId);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ taskId }),
      );
      expect(result.taskId).toBe(taskId);
    });

    it('rejects a task belonging to another workspace', async () => {
      const taskId = '44444444-4444-4444-8444-444444444444';

      tasksService.findById.mockResolvedValue({
        id: taskId,
        workspaceId: '55555555-5555-4555-8555-555555555555',
      });

      await expect(
        service.upload(workspaceId, userId, uploadedFile, { taskId }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('filters literal filename text before sorting and fetching a lookahead row', async () => {
      repository.find.mockResolvedValue([]);

      await service.findAll(workspaceId, userId, {
        page: 2,
        limit: 20,
        search: '  report_100%!  ',
        sort: 'size',
        lookahead: '1',
      });

      const options = repository.find.mock.calls[0][0];
      expect(options.where.workspaceId).toBe(workspaceId);
      expect(options.where.displayName.objectLiteralParameters).toEqual({
        search: '%report!_100!%!!%',
      });
      expect(options.where.displayName.getSql('file.displayName')).toBe(
        "file.displayName LIKE :search ESCAPE '!'",
      );
      expect(options.order).toEqual({ sizeBytes: 'DESC', createdAt: 'DESC', id: 'DESC' });
      expect(options.skip).toBe(20);
      expect(options.take).toBe(21);
    });

    it('returns workspace files', async () => {
      repository.find.mockResolvedValue([storedFile]);

      const result = await service.findAll(workspaceId, userId, {});

      expect(workspacesService.findOneForUser).toHaveBeenCalledWith(
        workspaceId,
        userId,
      );
      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(fileId);
    });

    it('applies pagination', async () => {
      repository.find.mockResolvedValue([]);

      await service.findAll(workspaceId, userId, {
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
  });

  describe('findOne', () => {
    it('returns file metadata', async () => {
      repository.findOne.mockResolvedValue(storedFile);

      const result = await service.findOne(workspaceId, fileId, userId);

      expect(result.id).toBe(fileId);
      expect(result.workspaceId).toBe(workspaceId);
    });

    it('throws when file does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne(workspaceId, fileId, userId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('allows uploader to delete file', async () => {
      repository.findOne.mockResolvedValue({ ...storedFile });
      repository.save.mockImplementation((value: unknown) => value);

      await service.remove(workspaceId, fileId, userId);

      const calls = repository.save.mock.calls as unknown[][];
      const savedFile = calls[0]?.[0] as { deletedAt: unknown };

      expect(savedFile.deletedAt).toBeInstanceOf(Date);

      expect(activitiesService.create).toHaveBeenCalledWith({
        workspaceId,
        actorUserId: userId,
        actionType: 'FILE_DELETED',
        resourceType: 'workspace_file',
        resourceId: fileId,
        metadata: {
          displayName: 'document.pdf',
          originalName: 'document.pdf',
          taskId: null,
        },
      });
    });

    it('still deletes when activity creation fails', async () => {
      repository.findOne.mockResolvedValue({ ...storedFile });
      repository.save.mockImplementation((value: unknown) => value);

      activitiesService.create.mockRejectedValue(
        new Error('Activity unavailable'),
      );

      jest
        .spyOn(
          (
            service as unknown as {
              logger: {
                error: (...args: unknown[]) => void;
              };
            }
          ).logger,
          'error',
        )
        .mockImplementation(() => undefined);

      await expect(
        service.remove(workspaceId, fileId, userId),
      ).resolves.toBeUndefined();

      const calls = repository.save.mock.calls as unknown[][];
      const savedFile = calls[0]?.[0] as { deletedAt: unknown };

      expect(savedFile.deletedAt).toBeInstanceOf(Date);
      expect(activitiesService.create).toHaveBeenCalledTimes(1);
    });

    it('allows workspace owner to delete another user file', async () => {
      const ownerId = userId;

      workspacesService.findOneForUser.mockResolvedValue({
        id: workspaceId,
        ownerId,
      });

      repository.findOne.mockResolvedValue({
        ...storedFile,
        uploaderId: '66666666-6666-4666-8666-666666666666',
      });

      repository.save.mockImplementation((value: unknown) => value);

      await service.remove(workspaceId, fileId, ownerId);

      expect(repository.save).toHaveBeenCalled();
    });

    it('rejects another workspace member deleting the file', async () => {
      const memberId = '77777777-7777-4777-8777-777777777777';

      workspacesService.findOneForUser.mockResolvedValue({
        id: workspaceId,
        ownerId: '88888888-8888-4888-8888-888888888888',
      });

      repository.findOne.mockResolvedValue({
        ...storedFile,
        uploaderId: userId,
      });

      await expect(
        service.remove(workspaceId, fileId, memberId),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('throws when deleting a missing file', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.remove(workspaceId, fileId, userId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getDownloadInfo', () => {
    it('returns secure download information', async () => {
      repository.findOne.mockResolvedValue(storedFile);
      mockedAccess.mockResolvedValue(undefined);

      const result = await service.getDownloadInfo(workspaceId, fileId, userId);

      expect(workspacesService.findOneForUser).toHaveBeenCalledWith(
        workspaceId,
        userId,
      );
      expect(repository.findOne).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          originalName: 'document.pdf',
          mimeType: 'application/pdf',
          sizeBytes: '5',
        }),
      );
      expect(result.absolutePath).toContain(storedFile.storageKey);
    });

    it('throws when file metadata does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.getDownloadInfo(workspaceId, fileId, userId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when physical file is missing', async () => {
      repository.findOne.mockResolvedValue(storedFile);
      mockedAccess.mockRejectedValue(new Error('missing file'));

      await expect(
        service.getDownloadInfo(workspaceId, fileId, userId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
