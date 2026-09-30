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
    findMembers: jest.fn(),
    removeMember: jest.fn(),
    update: jest.fn(),
    archive: jest.fn(),
    unarchive: jest.fn(),
    softDelete: jest.fn(),
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
    workspacesService.findMembers.mockResolvedValue([
      {
        membershipId: '12499996-b915-4109-8061-749d82dd5ab0',
        userId,
        username: 'anass',
        avatarUrl: null,
        joinedAt: new Date('2026-09-26T13:31:56.955Z'),
        isOwner: true,
      },
    ]);
    workspacesService.removeMember.mockResolvedValue(undefined);
    workspacesService.update.mockResolvedValue(workspace);
    workspacesService.archive.mockResolvedValue({
      ...workspace,
      archivedAt: new Date('2026-09-30T13:00:00Z'),
    });
    workspacesService.unarchive.mockResolvedValue({
      ...workspace,
      archivedAt: null,
    });
    workspacesService.softDelete.mockResolvedValue(undefined);
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


  it('PATCH /workspaces/:id/archive requires authentication', async () => {
    await request(app.getHttpServer())
      .patch(`/workspaces/${workspaceId}/archive`)
      .expect(401);

    expect(workspacesService.archive).not.toHaveBeenCalled();
  });

  it('PATCH /workspaces/:id/archive archives a workspace', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/workspaces/${workspaceId}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(workspacesService.archive).toHaveBeenCalledWith(
      workspaceId,
      userId,
    );

    expect(response.body.archivedAt).not.toBeNull();
  });

  it('PATCH /workspaces/:id/archive rejects an invalid UUID', async () => {
    await request(app.getHttpServer())
      .patch('/workspaces/not-a-uuid/archive')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(workspacesService.archive).not.toHaveBeenCalled();
  });

  it('PATCH /workspaces/:id/archive returns 404 when workspace does not exist', async () => {
    workspacesService.archive.mockRejectedValue(
      new NotFoundException('Workspace not found'),
    );

    await request(app.getHttpServer())
      .patch(`/workspaces/${workspaceId}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('PATCH /workspaces/:id/archive returns 403 for a non-owner', async () => {
    workspacesService.archive.mockRejectedValue(
      new ForbiddenException(),
    );

    await request(app.getHttpServer())
      .patch(`/workspaces/${workspaceId}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('PATCH /workspaces/:id/unarchive requires authentication', async () => {
    await request(app.getHttpServer())
      .patch(`/workspaces/${workspaceId}/unarchive`)
      .expect(401);

    expect(workspacesService.unarchive).not.toHaveBeenCalled();
  });

  it('PATCH /workspaces/:id/unarchive unarchives a workspace', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/workspaces/${workspaceId}/unarchive`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(workspacesService.unarchive).toHaveBeenCalledWith(
      workspaceId,
      userId,
    );

    expect(response.body.archivedAt).toBeNull();
  });

  it('PATCH /workspaces/:id/unarchive rejects an invalid UUID', async () => {
    await request(app.getHttpServer())
      .patch('/workspaces/not-a-uuid/unarchive')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(workspacesService.unarchive).not.toHaveBeenCalled();
  });

  it('PATCH /workspaces/:id/unarchive returns 404 when workspace does not exist', async () => {
    workspacesService.unarchive.mockRejectedValue(
      new NotFoundException('Workspace not found'),
    );

    await request(app.getHttpServer())
      .patch(`/workspaces/${workspaceId}/unarchive`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('PATCH /workspaces/:id/unarchive returns 403 for a non-owner', async () => {
    workspacesService.unarchive.mockRejectedValue(
      new ForbiddenException(),
    );

    await request(app.getHttpServer())
      .patch(`/workspaces/${workspaceId}/unarchive`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('DELETE /workspaces/:id requires authentication', async () => {
    await request(app.getHttpServer())
      .delete(`/workspaces/${workspaceId}`)
      .expect(401);

    expect(workspacesService.softDelete).not.toHaveBeenCalled();
  });

  it('DELETE /workspaces/:id soft deletes a workspace', async () => {
    await request(app.getHttpServer())
      .delete(`/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(workspacesService.softDelete).toHaveBeenCalledWith(
      workspaceId,
      userId,
    );
  });

  it('DELETE /workspaces/:id rejects an invalid UUID', async () => {
    await request(app.getHttpServer())
      .delete('/workspaces/not-a-uuid')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(workspacesService.softDelete).not.toHaveBeenCalled();
  });

  it('DELETE /workspaces/:id returns 404 when workspace does not exist', async () => {
    workspacesService.softDelete.mockRejectedValue(
      new NotFoundException('Workspace not found'),
    );

    await request(app.getHttpServer())
      .delete(`/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('DELETE /workspaces/:id returns 403 for a non-owner', async () => {
    workspacesService.softDelete.mockRejectedValue(
      new ForbiddenException(),
    );

    await request(app.getHttpServer())
      .delete(`/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });


  it('GET /workspaces/:id/members requires authentication', async () => {
    await request(app.getHttpServer())
      .get(`/workspaces/${workspaceId}/members`)
      .expect(401);

    expect(workspacesService.findMembers).not.toHaveBeenCalled();
  });

  it('GET /workspaces/:id/members returns workspace members', async () => {
    const response = await request(app.getHttpServer())
      .get(`/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(workspacesService.findMembers).toHaveBeenCalledWith(
      workspaceId,
      userId,
    );

    expect(response.body).toHaveLength(1);

    expect(response.body[0]).toMatchObject({
      membershipId: '12499996-b915-4109-8061-749d82dd5ab0',
      userId,
      username: 'anass',
      avatarUrl: null,
      isOwner: true,
    });

    expect(response.body[0]).not.toHaveProperty('email');
    expect(response.body[0]).not.toHaveProperty('passwordHash');
  });

  it('GET /workspaces/:id/members rejects an invalid UUID', async () => {
    await request(app.getHttpServer())
      .get('/workspaces/not-a-uuid/members')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(workspacesService.findMembers).not.toHaveBeenCalled();
  });

  it('GET /workspaces/:id/members returns 404 when workspace does not exist', async () => {
    workspacesService.findMembers.mockRejectedValue(
      new NotFoundException('Workspace not found'),
    );

    await request(app.getHttpServer())
      .get(`/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('GET /workspaces/:id/members returns 403 for a non-member', async () => {
    workspacesService.findMembers.mockRejectedValue(
      new ForbiddenException(),
    );

    await request(app.getHttpServer())
      .get(`/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });


  it('DELETE /workspaces/:id/members/:userId requires authentication', async () => {
    const memberId = 'dfc8ad56-f9c0-4918-9190-31bdba2341fe';

    await request(app.getHttpServer())
      .delete(`/workspaces/${workspaceId}/members/${memberId}`)
      .expect(401);

    expect(workspacesService.removeMember).not.toHaveBeenCalled();
  });

  it('DELETE /workspaces/:id/members/:userId removes a member', async () => {
    const memberId = 'dfc8ad56-f9c0-4918-9190-31bdba2341fe';

    await request(app.getHttpServer())
      .delete(`/workspaces/${workspaceId}/members/${memberId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(workspacesService.removeMember).toHaveBeenCalledWith(
      workspaceId,
      userId,
      memberId,
    );
  });

  it('DELETE member rejects an invalid workspace UUID', async () => {
    const memberId = 'dfc8ad56-f9c0-4918-9190-31bdba2341fe';

    await request(app.getHttpServer())
      .delete(`/workspaces/not-a-uuid/members/${memberId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(workspacesService.removeMember).not.toHaveBeenCalled();
  });

  it('DELETE member rejects an invalid member UUID', async () => {
    await request(app.getHttpServer())
      .delete(`/workspaces/${workspaceId}/members/not-a-uuid`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(workspacesService.removeMember).not.toHaveBeenCalled();
  });

  it('DELETE member returns 403 when current user is not allowed', async () => {
    const memberId = 'dfc8ad56-f9c0-4918-9190-31bdba2341fe';

    workspacesService.removeMember.mockRejectedValue(
      new ForbiddenException(),
    );

    await request(app.getHttpServer())
      .delete(`/workspaces/${workspaceId}/members/${memberId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('DELETE member rejects removing the workspace owner', async () => {
    workspacesService.removeMember.mockRejectedValue(
      new BadRequestException('Workspace owner cannot be removed'),
    );

    await request(app.getHttpServer())
      .delete(`/workspaces/${workspaceId}/members/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('DELETE member returns 404 when target membership does not exist', async () => {
    const memberId = 'dfc8ad56-f9c0-4918-9190-31bdba2341fe';

    workspacesService.removeMember.mockRejectedValue(
      new NotFoundException('Workspace member not found'),
    );

    await request(app.getHttpServer())
      .delete(`/workspaces/${workspaceId}/members/${memberId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

});
