import {
  BadRequestException,
  ForbiddenException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { UserStatus } from '../../../database/enums/database.enums';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UsersService } from '../../users/services/users.service';
import { WorkspacesService } from '../services/workspaces.service';
import { WorkspacesController } from './workspaces.controller';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

describe('Workspaces endpoints', () => {
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const workspaceId = '660e8400-e29b-41d4-a716-446655440000';

  const user = {
    id: userId,
    username: 'anass',
    email: 'anass@example.com',
    avatarUrl: null,
    appRole: 'USER',
    status: UserStatus.ACTIVE,
    createdAt: new Date('2026-09-01'),
    updatedAt: new Date('2026-09-01'),
  };

  const workspace = {
    id: workspaceId,
    ownerId: userId,
    name: 'Transcendence Team',
    description: 'Main workspace',
    createdAt: new Date('2026-09-26'),
    updatedAt: new Date('2026-09-26'),
    archivedAt: null,
  };

  const usersService = {
    findById: jest.fn(),
  };

  const workspacesService = {
    create: jest.fn(),
    findAllForUser: jest.fn(),
    findOneForUser: jest.fn(),
    update: jest.fn(),
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
      controllers: [WorkspacesController],
      providers: [
        JwtAuthGuard,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: WorkspacesService,
          useValue: workspacesService,
        },
      ],
    }).compile();

    jwtService = module.get(JwtService);

    token = await jwtService.signAsync({
      sub: userId,
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

    usersService.findById.mockResolvedValue(user);
    workspacesService.create.mockResolvedValue(workspace);
    workspacesService.findAllForUser.mockResolvedValue([workspace]);
    workspacesService.findOneForUser.mockResolvedValue(workspace);
    workspacesService.update.mockResolvedValue(workspace);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /workspaces requires authentication', async () => {
    await request(app.getHttpServer())
      .get('/workspaces')
      .expect(401);

    expect(workspacesService.findAllForUser).not.toHaveBeenCalled();
  });

  it('GET /workspaces returns workspaces for the authenticated user', async () => {
    const response = await request(app.getHttpServer())
      .get('/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(workspacesService.findAllForUser).toHaveBeenCalledWith(
      userId,
    );

    expect(response.body).toHaveLength(1);

    expect(response.body[0]).toMatchObject({
      id: workspaceId,
      ownerId: userId,
      name: 'Transcendence Team',
      archivedAt: null,
    });
  });

  it('GET /workspaces returns an empty list when the user has no workspaces', async () => {
    workspacesService.findAllForUser.mockResolvedValue([]);

    const response = await request(app.getHttpServer())
      .get('/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('GET /workspaces/:id returns one workspace for a member', async () => {
    const response = await request(app.getHttpServer())
      .get(`/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(workspacesService.findOneForUser).toHaveBeenCalledWith(
      workspaceId,
      userId,
    );

    expect(response.body).toMatchObject({
      id: workspaceId,
      ownerId: userId,
      name: 'Transcendence Team',
    });
  });

  it('GET /workspaces/:id rejects an invalid UUID', async () => {
    await request(app.getHttpServer())
      .get('/workspaces/not-a-uuid')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(workspacesService.findOneForUser).not.toHaveBeenCalled();
  });

  it('GET /workspaces/:id returns 404 when workspace does not exist', async () => {
    workspacesService.findOneForUser.mockRejectedValue(
      new NotFoundException('Workspace not found'),
    );

    await request(app.getHttpServer())
      .get(`/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('GET /workspaces/:id returns 403 when user is not a member', async () => {
    workspacesService.findOneForUser.mockRejectedValue(
      new ForbiddenException(),
    );

    await request(app.getHttpServer())
      .get(`/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('POST requires authentication', async () => {
    await request(app.getHttpServer())
      .post('/workspaces')
      .send({
        name: 'Transcendence Team',
      })
      .expect(401);

    expect(workspacesService.create).not.toHaveBeenCalled();
  });

  it('POST creates a workspace for the authenticated user', async () => {
    const dto = {
      name: 'Transcendence Team',
      description: 'Main workspace',
    };

    const response = await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(201);

    expect(workspacesService.create).toHaveBeenCalledWith(
      userId,
      dto,
    );

    expect(response.body).toMatchObject({
      id: workspace.id,
      ownerId: userId,
      name: 'Transcendence Team',
      description: 'Main workspace',
      archivedAt: null,
    });

    expect(response.body).not.toHaveProperty('deletedAt');
  });

  it('POST rejects a client-supplied ownerId', async () => {
    await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Fake Owner Workspace',
        ownerId: '11111111-1111-1111-1111-111111111111',
      })
      .expect(400);

    expect(workspacesService.create).not.toHaveBeenCalled();
  });

  it('POST rejects an empty name', async () => {
    await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '',
      })
      .expect(400);

    expect(workspacesService.create).not.toHaveBeenCalled();
  });

  it('POST rejects a missing name', async () => {
    await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'Missing workspace name',
      })
      .expect(400);

    expect(workspacesService.create).not.toHaveBeenCalled();
  });

  it('POST rejects a name longer than 120 characters', async () => {
    await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'A'.repeat(121),
      })
      .expect(400);

    expect(workspacesService.create).not.toHaveBeenCalled();
  });

  it('PATCH requires authentication', async () => {
    await request(app.getHttpServer())
      .patch(`/workspaces/${workspaceId}`)
      .send({
        name: 'Updated Workspace',
      })
      .expect(401);

    expect(workspacesService.update).not.toHaveBeenCalled();
  });

  it('PATCH allows the owner to update a workspace', async () => {
    const dto = {
      name: 'Updated Workspace',
      description: 'Updated description',
    };

    workspacesService.update.mockResolvedValue({
      ...workspace,
      ...dto,
    });

    const response = await request(app.getHttpServer())
      .patch(`/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(200);

    expect(workspacesService.update).toHaveBeenCalledWith(
      workspaceId,
      userId,
      dto,
    );

    expect(response.body.name).toBe('Updated Workspace');
    expect(response.body.description).toBe('Updated description');
  });

  it('PATCH rejects an invalid workspace UUID', async () => {
    await request(app.getHttpServer())
      .patch('/workspaces/not-a-uuid')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Workspace',
      })
      .expect(400);

    expect(workspacesService.update).not.toHaveBeenCalled();
  });

  it('PATCH rejects a name longer than 120 characters', async () => {
    await request(app.getHttpServer())
      .patch(`/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'A'.repeat(121),
      })
      .expect(400);

    expect(workspacesService.update).not.toHaveBeenCalled();
  });

  it('PATCH rejects protected fields such as ownerId', async () => {
    await request(app.getHttpServer())
      .patch(`/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        ownerId: '11111111-1111-4111-8111-111111111111',
      })
      .expect(400);

    expect(workspacesService.update).not.toHaveBeenCalled();
  });

  it('PATCH rejects an empty update', async () => {
    workspacesService.update.mockRejectedValue(
      new BadRequestException('No changes provided'),
    );

    await request(app.getHttpServer())
      .patch(`/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);

    expect(workspacesService.update).toHaveBeenCalledWith(
      workspaceId,
      userId,
      {},
    );
  });

  it('PATCH returns 404 when workspace does not exist', async () => {
    workspacesService.update.mockRejectedValue(
      new NotFoundException('Workspace not found'),
    );

    await request(app.getHttpServer())
      .patch(`/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Workspace',
      })
      .expect(404);
  });

  it('PATCH returns 403 when user is not the owner', async () => {
    workspacesService.update.mockRejectedValue(
      new ForbiddenException(),
    );

    await request(app.getHttpServer())
      .patch(`/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Unauthorized Update',
      })
      .expect(403);
  });

});
