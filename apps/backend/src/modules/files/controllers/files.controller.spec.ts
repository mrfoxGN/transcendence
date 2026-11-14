import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { unlink, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import request from 'supertest';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FilesService } from '../services/files.service';
import { FilesController } from './files.controller';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

type UploadedFile = {
  originalname: string;
  buffer: Buffer;
};

describe('FilesController', () => {
  let app: INestApplication;

  const workspaceId = '11111111-1111-4111-8111-111111111111';
  const fileId = '22222222-2222-4222-8222-222222222222';
  const userId = '33333333-3333-4333-8333-333333333333';

  const fileResponse = {
    id: fileId,
    workspaceId,
    uploaderId: userId,
    taskId: null,
    originalName: 'document.pdf',
    displayName: 'Project document',
    mimeType: 'application/pdf',
    sizeBytes: '5',
    createdAt: new Date('2026-10-30T12:00:00Z'),
  };

  const filesService = {
    upload: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    getDownloadInfo: jest.fn(),
  };

  function httpServer(): Server {
    return app.getHttpServer() as Server;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        {
          provide: FilesService,
          useValue: filesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context
            .switchToHttp()
            .getRequest<{ user?: { id: string } }>();

          req.user = { id: userId };
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

  it('uploads a file', async () => {
    filesService.upload.mockResolvedValue(fileResponse);

    const response = await request(httpServer())
      .post(`/workspaces/${workspaceId}/files`)
      .field('displayName', 'Project document')
      .attach('file', Buffer.from('hello'), {
        filename: 'document.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    const body: unknown = response.body;

    expect(body).toMatchObject({
      id: fileId,
      workspaceId,
      originalName: 'document.pdf',
    });

    expect(filesService.upload).toHaveBeenCalledTimes(1);

    const [calledWorkspaceId, calledUserId, calledFile, calledDto] =
      filesService.upload.mock.calls[0] as [
        string,
        string,
        UploadedFile,
        unknown,
      ];

    expect(calledWorkspaceId).toBe(workspaceId);
    expect(calledUserId).toBe(userId);
    expect(calledFile.originalname).toBe('document.pdf');
    expect(calledFile.buffer.toString()).toBe('hello');

    expect(calledDto).toEqual(
      expect.objectContaining({
        displayName: 'Project document',
      }),
    );
  });

  it('rejects an unknown upload field', async () => {
    await request(httpServer())
      .post(`/workspaces/${workspaceId}/files`)
      .field('unknownField', 'test')
      .attach('file', Buffer.from('hello'), 'document.pdf')
      .expect(400);

    expect(filesService.upload).not.toHaveBeenCalled();
  });

  it('lists workspace files', async () => {
    filesService.findAll.mockResolvedValue([fileResponse]);

    const response = await request(httpServer())
      .get(`/workspaces/${workspaceId}/files?page=1&limit=20`)
      .expect(200);

    const body: unknown = response.body;

    expect(body).toHaveLength(1);

    expect(filesService.findAll).toHaveBeenCalledWith(
      workspaceId,
      userId,
      expect.objectContaining({
        page: 1,
        limit: 20,
      }),
    );
  });

  it('rejects invalid pagination', async () => {
    await request(httpServer())
      .get(`/workspaces/${workspaceId}/files?page=0&limit=20`)
      .expect(400);

    expect(filesService.findAll).not.toHaveBeenCalled();
  });

  it('gets one file metadata', async () => {
    filesService.findOne.mockResolvedValue(fileResponse);

    const response = await request(httpServer())
      .get(`/workspaces/${workspaceId}/files/${fileId}`)
      .expect(200);

    const body: unknown = response.body;

    expect(body).toMatchObject({ id: fileId });

    expect(filesService.findOne).toHaveBeenCalledWith(
      workspaceId,
      fileId,
      userId,
    );
  });

  it('deletes a file with 204', async () => {
    filesService.remove.mockResolvedValue(undefined);

    await request(httpServer())
      .delete(`/workspaces/${workspaceId}/files/${fileId}`)
      .expect(204);

    expect(filesService.remove).toHaveBeenCalledWith(
      workspaceId,
      fileId,
      userId,
    );
  });

  it('downloads a file', async () => {
    const temporaryPath = '/tmp/files-controller-test.txt';

    await writeFile(temporaryPath, Buffer.from('hello'));

    filesService.getDownloadInfo.mockResolvedValue({
      absolutePath: temporaryPath,
      originalName: 'document.txt',
      mimeType: 'text/plain',
      sizeBytes: '5',
    });

    try {
      const response = await request(httpServer())
        .get(`/workspaces/${workspaceId}/files/${fileId}/download`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');

      expect(response.headers['content-disposition']).toBe(
        'attachment; filename="document.txt"',
      );

      expect(response.text).toBe('hello');

      expect(filesService.getDownloadInfo).toHaveBeenCalledWith(
        workspaceId,
        fileId,
        userId,
      );
    } finally {
      await unlink(temporaryPath).catch(() => undefined);
    }
  });

  it('rejects invalid workspace UUID', async () => {
    await request(httpServer()).get('/workspaces/not-a-uuid/files').expect(400);
  });

  it('rejects invalid file UUID', async () => {
    await request(httpServer())
      .get(`/workspaces/${workspaceId}/files/not-a-uuid`)
      .expect(400);
  });
});
