import {
  BadRequestException,
  UnauthorizedException,
  ServiceUnavailableException,
  ConflictException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import type { Server } from 'node:http';
import request from 'supertest';

import { UserStatus } from '../../../database/enums/database.enums';
import { WorkspaceChatGateway } from '../../chat/gateways/workspace-chat.gateway';
import { DirectChatGateway } from '../../social/gateways/direct-chat.gateway';
import { UsersService } from '../../users/services/users.service';
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
    changePassword: jest.fn(),
    createEmailVerificationCode: jest.fn(),
    confirmEmailVerification: jest.fn(),
  };

  const directChatGateway = { disconnectUser: jest.fn() };
  const workspaceChatGateway = { disconnectUser: jest.fn() };

  let app: INestApplication;
  let jwtService: JwtService;

  function httpServer(): Server {
    return app.getHttpServer() as Server;
  }

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

    const response = await request(httpServer())
      .post('/auth/register')
      .send(input)
      .expect(201);

    const body: unknown = response.body;

    expect(usersService.create).toHaveBeenCalledWith(input);
    expect(body).toMatchObject({ id });
    expect(body).not.toHaveProperty('passwordHash');
    expect(body).not.toHaveProperty('tokenVersion');
  });

  it('rejects invalid registration data', async () => {
    await request(httpServer())
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
    await request(httpServer())
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

    await request(httpServer())
      .post('/auth/register')
      .send({ username: 'khaled', email, password })
      .expect(409);
  });

  it('logs in and returns a JWT containing the user ID and version', async () => {
    usersService.findByEmail.mockResolvedValue(user);

    const response = await request(httpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const body: unknown = response.body;

    if (
      typeof body !== 'object' ||
      body === null ||
      !('accessToken' in body) ||
      typeof body.accessToken !== 'string'
    ) {
      throw new Error('Login response must contain an access token');
    }

    const payload = await jwtService.verifyAsync<{
      sub?: unknown;
      tokenVersion?: unknown;
    }>(body.accessToken);

    expect(payload.sub).toBe(id);
    expect(payload.tokenVersion).toBe(0);
    expect(payload).not.toHaveProperty('passwordHash');
  });

  it('rejects invalid login data', async () => {
    await request(httpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: '' })
      .expect(400);

    expect(usersService.findByEmail).not.toHaveBeenCalled();
  });

  it('returns 401 for an unknown email', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    const response = await request(httpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(401);

    const body: unknown = response.body;
    expect(body).toMatchObject({ message: 'Invalid credentials' });
  });

  it('returns 401 for a wrong password', async () => {
    usersService.findByEmail.mockResolvedValue(user);

    const response = await request(httpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);

    const body: unknown = response.body;
    expect(body).toMatchObject({ message: 'Invalid credentials' });
  });

  it('returns 401 for a disabled account', async () => {
    usersService.findByEmail.mockResolvedValue({
      ...user,
      status: UserStatus.DISABLED,
    });

    const response = await request(httpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(401);

    const body: unknown = response.body;
    expect(body).toMatchObject({ message: 'Invalid credentials' });
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

    const response = await request(httpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body: unknown = response.body;

    expect(body).toEqual(profile);
    expect(body).not.toHaveProperty('passwordHash');
    expect(body).not.toHaveProperty('tokenVersion');
    expect(usersService.findForAuth).toHaveBeenCalledWith(id);
  });

  it('rejects a profile request without a token', async () => {
    await request(httpServer()).get('/auth/profile').expect(401);

    expect(usersService.findForAuth).not.toHaveBeenCalled();
  });

  it('rejects an invalid token', async () => {
    await request(httpServer())
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

    await request(httpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(usersService.findForAuth).not.toHaveBeenCalled();
  });

  it('rejects an old token without a version', async () => {
    const token = await jwtService.signAsync({ sub: id });

    await request(httpServer())
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

    await request(httpServer())
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

    await request(httpServer())
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

    await request(httpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('logs out and rejects the same token afterward', async () => {
    let databaseVersion = 0;

    usersService.findForAuth.mockImplementation(() =>
      Promise.resolve({
        user: profile,
        tokenVersion: databaseVersion,
      }),
    );

    usersService.revokeTokens.mockImplementation(() => {
      databaseVersion += 1;
      return Promise.resolve();
    });

    const token = await jwtService.signAsync({
      sub: id,
      tokenVersion: 0,
    });

    await request(httpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const response = await request(httpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body: unknown = response.body;

    expect(body).toEqual({
      message: 'Logout successful',
      loggedOut: true,
    });
    expect(usersService.revokeTokens).toHaveBeenCalledWith(id);
    expect(directChatGateway.disconnectUser).toHaveBeenCalledWith(id);
    expect(workspaceChatGateway.disconnectUser).toHaveBeenCalledWith(id);

    await request(httpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rejects a second logout with the same token', async () => {
    let databaseVersion = 0;

    usersService.findForAuth.mockImplementation(() =>
      Promise.resolve({
        user: profile,
        tokenVersion: databaseVersion,
      }),
    );

    usersService.revokeTokens.mockImplementation(() => {
      databaseVersion += 1;
      return Promise.resolve();
    });

    const token = await jwtService.signAsync({
      sub: id,
      tokenVersion: 0,
    });

    await request(httpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(httpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(usersService.revokeTokens).toHaveBeenCalledTimes(1);
  });

  describe('password and email verification', () => {
    let token: string;

    beforeEach(async () => {
      usersService.findForAuth.mockResolvedValue({ user: profile, tokenVersion: 0 });
      token = await jwtService.signAsync({ sub: id, tokenVersion: 0 });
    });

    it.each([
      ['patch', '/auth/password', { currentPassword: password, newPassword: 'new-password' }],
      ['post', '/auth/email-verification/request', {}],
      ['post', '/auth/email-verification/confirm', { code: '123456' }],
    ] as const)('requires authentication for %s %s', async (method, path, body) => {
      await request(httpServer())[method](path).send(body).expect(401);
      expect(usersService.changePassword).not.toHaveBeenCalled();
      expect(usersService.createEmailVerificationCode).not.toHaveBeenCalled();
      expect(usersService.confirmEmailVerification).not.toHaveBeenCalled();
    });

    it('changes a password and disconnects both chats', async () => {
      await request(httpServer()).patch('/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: password, newPassword: 'new-password' }).expect(204);
      expect(usersService.changePassword).toHaveBeenCalledWith(id, password, 'new-password');
      expect(directChatGateway.disconnectUser).toHaveBeenCalledWith(id);
      expect(workspaceChatGateway.disconnectUser).toHaveBeenCalledWith(id);
    });

    it.each([
      [{ currentPassword: '', newPassword: 'new-password' }],
      [{ currentPassword: password, newPassword: 'short' }],
      [{ currentPassword: password, newPassword: 'new-password', tokenVersion: 0 }],
    ])('rejects invalid password changes: %j', async (body) => {
      await request(httpServer()).patch('/auth/password')
        .set('Authorization', `Bearer ${token}`).send(body).expect(400);
      expect(usersService.changePassword).not.toHaveBeenCalled();
    });

    it('rejects an incorrect current password without disconnecting chats', async () => {
      usersService.changePassword.mockRejectedValueOnce(new UnauthorizedException());
      await request(httpServer()).patch('/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'wrong-password', newPassword: 'new-password' }).expect(401);
      expect(directChatGateway.disconnectUser).not.toHaveBeenCalled();
      expect(workspaceChatGateway.disconnectUser).not.toHaveBeenCalled();
    });

    it('returns 204 when no verification email needs sending', async () => {
      usersService.createEmailVerificationCode.mockResolvedValue(null);
      await request(httpServer()).post('/auth/email-verification/request')
        .set('Authorization', `Bearer ${token}`).expect(204);
      expect(usersService.createEmailVerificationCode).toHaveBeenCalledWith(id);
    });

    it('returns 503 when verification is unavailable', async () => {
      usersService.createEmailVerificationCode.mockRejectedValueOnce(new ServiceUnavailableException());
      await request(httpServer()).post('/auth/email-verification/request')
        .set('Authorization', `Bearer ${token}`).expect(503);
    });

    it('confirms a verification code', async () => {
      await request(httpServer()).post('/auth/email-verification/confirm')
        .set('Authorization', `Bearer ${token}`).send({ code: '012345' }).expect(204);
      expect(usersService.confirmEmailVerification).toHaveBeenCalledWith(id, '012345');
    });

    it.each(['12345', '1234567', '12+456', 123456, null])('rejects invalid verification code %j', async (code) => {
      await request(httpServer()).post('/auth/email-verification/confirm')
        .set('Authorization', `Bearer ${token}`).send({ code }).expect(400);
      expect(usersService.confirmEmailVerification).not.toHaveBeenCalled();
    });

    it('returns 400 for an expired or incorrect verification code', async () => {
      usersService.confirmEmailVerification.mockRejectedValueOnce(new BadRequestException());
      await request(httpServer()).post('/auth/email-verification/confirm')
        .set('Authorization', `Bearer ${token}`).send({ code: '123456' }).expect(400);
    });
  });
});
