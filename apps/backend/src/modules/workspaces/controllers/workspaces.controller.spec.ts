import {
  INestApplication,
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
    id: '660e8400-e29b-41d4-a716-446655440000',
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
  });

  afterAll(async () => {
    await app.close();
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
});
