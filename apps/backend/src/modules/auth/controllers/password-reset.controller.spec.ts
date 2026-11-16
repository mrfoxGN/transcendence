import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';

import { AuthService } from '../services/auth.service';
import { AuthController } from './auth.controller';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

jest.mock('../guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class JwtAuthGuard {
    canActivate(): boolean {
      return true;
    }
  },
}));

describe('Password reset endpoints', () => {
  const email = 'khaled@example.com';

  const authService = {
    requestPasswordReset: jest.fn(),
    confirmPasswordReset: jest.fn(),
  };

  let app: INestApplication;

  function httpServer(): Server {
    return app.getHttpServer() as Server;
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

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
    authService.requestPasswordReset.mockResolvedValue(undefined);
    authService.confirmPasswordReset.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a reset request without a JWT', async () => {
    await request(httpServer())
      .post('/auth/password-reset/request')
      .send({ email })
      .expect(204);

    expect(authService.requestPasswordReset).toHaveBeenCalledWith(email);
  });

  it('rejects an invalid email', async () => {
    await request(httpServer())
      .post('/auth/password-reset/request')
      .send({ email: 'not-an-email' })
      .expect(400);

    expect(authService.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('rejects extra request fields', async () => {
    await request(httpServer())
      .post('/auth/password-reset/request')
      .send({ email, appRole: 'ADMIN' })
      .expect(400);

    expect(authService.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('passes the code and new password to the service', async () => {
    await request(httpServer())
      .post('/auth/password-reset/confirm')
      .send({
        email,
        code: '123456',
        newPassword: 'NewPassword123!',
      })
      .expect(204);

    expect(authService.confirmPasswordReset).toHaveBeenCalledWith(
      email,
      '123456',
      'NewPassword123!',
    );
  });

  it('rejects an invalid code and a short password', async () => {
    await request(httpServer())
      .post('/auth/password-reset/confirm')
      .send({ email, code: '12+456', newPassword: 'NewPassword123!' })
      .expect(400);

    await request(httpServer())
      .post('/auth/password-reset/confirm')
      .send({ email, code: '123456', newPassword: 'short' })
      .expect(400);

    expect(authService.confirmPasswordReset).not.toHaveBeenCalled();
  });

  it('returns 400 when the service rejects a code', async () => {
    authService.confirmPasswordReset.mockRejectedValueOnce(
      new BadRequestException('Invalid or expired reset code'),
    );

    await request(httpServer())
      .post('/auth/password-reset/confirm')
      .send({
        email,
        code: '123456',
        newPassword: 'NewPassword123!',
      })
      .expect(400);
  });
});
