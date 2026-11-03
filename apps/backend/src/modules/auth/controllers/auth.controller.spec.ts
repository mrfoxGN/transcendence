import {
  ConflictException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';

import { UserStatus } from '../../../database/enums/database.enums';
import { UsersService } from '../../users/services/users.service';
import { DirectChatGateway } from '../../social/gateways/direct-chat.gateway';
import { WorkspaceChatGateway } from '../../chat/gateways/workspace-chat.gateway';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuthService } from '../services/auth.service';
import { AuthController } from './auth.controller';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

describe('Auth endpoints', () => {
  const id = '550e8400-e29b-41d4-a716-446655440000';
  const email = 'khaled@example.com';
  const password = 'correct-password';

  const user = {
    id,
    email,
    passwordHash: '',
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };

  const profile = {
    id,
    username: 'khaled',
    email,
    status: UserStatus.ACTIVE,
  };

  const usersService = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findForAuth: jest.fn(),
    revokeTokens: jest.fn(),
  };

  const directChatGateway = { disconnectUser: jest.fn() };
  const workspaceChatGateway = { disconnectUser: jest.fn() };

  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    user.passwordHash = await argon2.hash(password);

    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-only-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtAuthGuard,
        { provide: UsersService, useValue: usersService },
        { provide: DirectChatGateway, useValue: directChatGateway },
        { provide: WorkspaceChatGateway, useValue: workspaceChatGateway },
      ],
    }).compile();

    jwtService = module.get(JwtService);
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a user and returns no password hash', async () => {
    usersService.create.mockResolvedValue({
      id,
      username: 'khaled',
      email,
    });

    const input = {
      username: 'khaled',
      email,
      password,
    };

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(input)
      .expect(201);

    expect(usersService.create).toHaveBeenCalledWith(input);
    expect(response.body.id).toBe(id);
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('tokenVersion');
  });

  it('rejects invalid registration data', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: 'ab',
        email: 'not-an-email',
        password: 'short',
      })
      .expect(400);

    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('rejects forbidden registration fields', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: 'khaled',
        email,
        password,
        appRole: 'ADMIN',
      })
      .expect(400);

    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('returns 409 for an existing username or email', async () => {
    usersService.create.mockRejectedValue(
      new ConflictException('Username or email already exists'),
    );

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'khaled', email, password })
      .expect(409);
  });

  it('logs in and returns a JWT containing the user ID and version', async () => {
    usersService.findByEmail.mockResolvedValue(user);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    expect(typeof response.body.accessToken).toBe('string');

    const payload = await jwtService.verifyAsync(
      response.body.accessToken,
    );

    expect(payload.sub).toBe(id);
    expect(payload.tokenVersion).toBe(0);
    expect(payload).not.toHaveProperty('passwordHash');
  });

  it('rejects invalid login data', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: '' })
      .expect(400);

    expect(usersService.findByEmail).not.toHaveBeenCalled();
  });

  it('returns 401 for an unknown email', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(401);

    expect(response.body.message).toBe('Invalid credentials');
  });

  it('returns 401 for a wrong password', async () => {
    usersService.findByEmail.mockResolvedValue(user);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);

    expect(response.body.message).toBe('Invalid credentials');
  });

  it('returns 401 for a disabled account', async () => {
    usersService.findByEmail.mockResolvedValue({
      ...user,
      status: UserStatus.DISABLED,
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(401);

    expect(response.body.message).toBe('Invalid credentials');
  });

  it('returns the current profile with a valid token', async () => {
    usersService.findForAuth.mockResolvedValue({
      user: profile,
      tokenVersion: 0,
    });

    const token = await jwtService.signAsync({
      sub: id,
      tokenVersion: 0,
    });

    const response = await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual(profile);
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('tokenVersion');
    expect(usersService.findForAuth).toHaveBeenCalledWith(id);
  });

  it('rejects a profile request without a token', async () => {
    await request(app.getHttpServer())
      .get('/auth/profile')
      .expect(401);

    expect(usersService.findForAuth).not.toHaveBeenCalled();
  });

  it('rejects an invalid token', async () => {
    await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    expect(usersService.findForAuth).not.toHaveBeenCalled();
  });

  it('rejects an expired token', async () => {
    const token = await jwtService.signAsync(
      { sub: id, tokenVersion: 0 },
      { expiresIn: -1 },
    );

    await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(usersService.findForAuth).not.toHaveBeenCalled();
  });

  it('rejects an old token without a version', async () => {
    const token = await jwtService.signAsync({ sub: id });

    await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(usersService.findForAuth).not.toHaveBeenCalled();
  });

  it('rejects a token for a missing user', async () => {
    usersService.findForAuth.mockRejectedValue(
      new NotFoundException('User not found'),
    );

    const token = await jwtService.signAsync({
      sub: id,
      tokenVersion: 0,
    });

    await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(usersService.findForAuth).toHaveBeenCalledWith(id);
  });

  it('rejects a disabled user', async () => {
    usersService.findForAuth.mockResolvedValue({
      user: { ...profile, status: UserStatus.DISABLED },
      tokenVersion: 0,
    });

    const token = await jwtService.signAsync({
      sub: id,
      tokenVersion: 0,
    });

    await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rejects a token whose version differs from the database', async () => {
    usersService.findForAuth.mockResolvedValue({
      user: profile,
      tokenVersion: 1,
    });

    const token = await jwtService.signAsync({
      sub: id,
      tokenVersion: 0,
    });

    await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('logs out and rejects the same token afterward', async () => {
    let databaseVersion = 0;

    usersService.findForAuth.mockImplementation(async () => ({
      user: profile,
      tokenVersion: databaseVersion,
    }));

    usersService.revokeTokens.mockImplementation(async () => {
      databaseVersion += 1;
    });

    const token = await jwtService.signAsync({
      sub: id,
      tokenVersion: 0,
    });

    await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      message: 'Logout successful',
      loggedOut: true,
    });
    expect(usersService.revokeTokens).toHaveBeenCalledWith(id);
    expect(directChatGateway.disconnectUser).toHaveBeenCalledWith(id);
    expect(workspaceChatGateway.disconnectUser).toHaveBeenCalledWith(id);

    await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rejects a second logout with the same token', async () => {
    let databaseVersion = 0;

    usersService.findForAuth.mockImplementation(async () => ({
      user: profile,
      tokenVersion: databaseVersion,
    }));

    usersService.revokeTokens.mockImplementation(async () => {
      databaseVersion += 1;
    });

    const token = await jwtService.signAsync({
      sub: id,
      tokenVersion: 0,
    });

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(usersService.revokeTokens).toHaveBeenCalledTimes(1);
  });
});