import {
  BadRequestException,
  ConflictException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { UserStatus } from '../../../database/enums/database.enums';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UsersService } from '../services/users.service';
import { UsersController } from './users.controller';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

describe('Users endpoints', () => {
  const id = '550e8400-e29b-41d4-a716-446655440000';
  const otherId = '550e8400-e29b-41d4-a716-446655440001';

  const user = {
    id,
    username: 'khaled',
    email: 'khaled@example.com',
    avatarUrl: null,
    appRole: 'USER',
    status: UserStatus.ACTIVE,
  };

  const usersService = {
    findById: jest.fn(),
    updateProfile: jest.fn(),
  };

  let app: INestApplication;
  let jwtService: JwtService;
  let token: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-only-secret' })],
      controllers: [UsersController],
      providers: [
        JwtAuthGuard,
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    jwtService = module.get(JwtService);
    token = await jwtService.signAsync({ sub: id });

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET requires a token', async () => {
    await request(app.getHttpServer())
      .get(`/users/${id}`)
      .expect(401);

    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('GET rejects an invalid token', async () => {
    await request(app.getHttpServer())
      .get(`/users/${id}`)
      .set('Authorization', 'Bearer invalid.token.value')
      .expect(401);
  });

  it('GET rejects a token without a user ID', async () => {
    const badToken = await jwtService.signAsync({ sub: 123 });

    await request(app.getHttpServer())
      .get(`/users/${id}`)
      .set('Authorization', `Bearer ${badToken}`)
      .expect(401);
  });

  it('GET rejects a deleted or missing account', async () => {
    usersService.findById.mockRejectedValue(
      new NotFoundException('User not found'),
    );

    await request(app.getHttpServer())
      .get(`/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('GET rejects a disabled account', async () => {
    usersService.findById.mockResolvedValue({
      ...user,
      status: UserStatus.DISABLED,
    });

    await request(app.getHttpServer())
      .get(`/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('GET returns the logged-in user', async () => {
    const response = await request(app.getHttpServer())
      .get(`/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchObject(user);
    expect(usersService.findById).toHaveBeenCalledWith(id);
  });

  it('GET forbids another user ID', async () => {
    await request(app.getHttpServer())
      .get(`/users/${otherId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET rejects an invalid UUID', async () => {
    await request(app.getHttpServer())
      .get('/users/not-a-uuid')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('PATCH requires a token', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${id}`)
      .send({ username: 'newname' })
      .expect(401);

    expect(usersService.updateProfile).not.toHaveBeenCalled();
  });

  it('PATCH updates the logged-in user', async () => {
    const changes = { username: 'newname' };
    usersService.updateProfile.mockResolvedValue({
      ...user,
      ...changes,
    });

    const response = await request(app.getHttpServer())
      .patch(`/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(changes)
      .expect(200);

    expect(response.body.username).toBe('newname');
    expect(usersService.updateProfile).toHaveBeenCalledWith(id, changes);
  });

  it('PATCH forbids another user ID', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${otherId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'newname' })
      .expect(403);

    expect(usersService.updateProfile).not.toHaveBeenCalled();
  });

  it('PATCH rejects an invalid UUID', async () => {
    await request(app.getHttpServer())
      .patch('/users/not-a-uuid')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'newname' })
      .expect(400);
  });

  it('PATCH rejects invalid and forbidden fields', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'ab' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ passwordHash: 'hacked' })
      .expect(400);

    expect(usersService.updateProfile).not.toHaveBeenCalled();
  });

  it('PATCH rejects an empty update', async () => {
    usersService.updateProfile.mockRejectedValue(
      new BadRequestException('No changes provided'),
    );

    await request(app.getHttpServer())
      .patch(`/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);
  });

  it('PATCH returns 404 if the account disappears during update', async () => {
    usersService.updateProfile.mockRejectedValue(
      new NotFoundException('User not found'),
    );

    await request(app.getHttpServer())
      .patch(`/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'newname' })
      .expect(404);
  });

  it('PATCH returns 409 for a duplicate username', async () => {
    usersService.updateProfile.mockRejectedValue(
      new ConflictException('Username already exists'),
    );

    await request(app.getHttpServer())
      .patch(`/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'takenname' })
      .expect(409);
  });
});