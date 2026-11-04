import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

jest.mock('../services/github-webhook-routing.service', () => ({
  GitHubWebhookRoutingService: class GitHubWebhookRoutingService {},
}));

jest.mock('../services/github-webhook-push.service', () => ({
  GitHubWebhookPushService: class GitHubWebhookPushService {},
}));

import { GitHubWebhookController } from './github-webhook.controller';

describe('GitHubWebhookController', () => {
  const secret = 'test-webhook-secret';
  const deliveryId = 'test-delivery-id';

  const payload = {
    ref: 'refs/heads/main',
    repository: {
      id: 1376091667,
      full_name: 'mrfoxGN/transcendence',
    },
  };

  const configService = {
    get: jest.fn(),
  };

  const routingService = {
    resolveTargets: jest.fn(),
  };

  const pushService = {
    processPush: jest.fn(),
  };

  let controller: GitHubWebhookController;

  function createRequest(
    data: object,
  ): RawBodyRequest<Request> {
    return {
      body: data,
      rawBody: Buffer.from(JSON.stringify(data)),
    } as RawBodyRequest<Request>;
  }

  function sign(data: object): string {
    return (
      'sha256=' +
      createHmac('sha256', secret)
        .update(JSON.stringify(data))
        .digest('hex')
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();

    configService.get.mockReturnValue(secret);

    routingService.resolveTargets.mockResolvedValue([
      {
        repositoryId: '43181083-7955-41bf-bac8-425ac2f80ac2',
        workspaceId: 'faf3d45e-e8d4-4acc-ac2d-b7e09a9a4f4a',
        githubRepositoryId: '1376091667',
        fullName: 'mrfoxGN/transcendence',
      },
    ]);

    pushService.processPush.mockResolvedValue({
      status: 'processed',
      githubRepositoryId: '1376091667',
      workspaceCount: 1,
      commitCount: 1,
    });

    controller = new GitHubWebhookController(
      configService as never,
      routingService as never,
      pushService as never,
    );
  });

  it('accepts a correctly signed ping', async () => {
    const ping = { zen: 'Testing webhook' };

    const result = await controller.receiveWebhook(
      createRequest(ping),
      sign(ping),
      'ping',
      deliveryId,
    );

    expect(result).toEqual({
      verified: true,
      event: 'ping',
    });

    expect(
      routingService.resolveTargets,
    ).not.toHaveBeenCalled();
  });

  it('rejects unsigned events before routing', async () => {
    await expect(
      controller.receiveWebhook(
        createRequest(payload),
        undefined,
        'push',
        deliveryId,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(
      routingService.resolveTargets,
    ).not.toHaveBeenCalled();
  });

  it('rejects tampered payloads before routing', async () => {
    const modified = {
      ...payload,
      ref: 'refs/heads/other',
    };

    await expect(
      controller.receiveWebhook(
        createRequest(modified),
        sign(payload),
        'push',
        deliveryId,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(
      routingService.resolveTargets,
    ).not.toHaveBeenCalled();
  });

  it.each([
    'pull_request',
    'create',
    'delete',
  ])('routes signed %s events without acknowledging them', async (event) => {
    await expect(
      controller.receiveWebhook(
        createRequest(payload),
        sign(payload),
        event,
        deliveryId,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(
      routingService.resolveTargets,
    ).toHaveBeenCalledWith(payload);
  });

  it('propagates invalid repository payload errors', async () => {
    pushService.processPush.mockRejectedValueOnce(
      new BadRequestException('Invalid repository ID'),
    );

    await expect(
      controller.receiveWebhook(
        createRequest(payload),
        sign(payload),
        'push',
        deliveryId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(pushService.processPush).toHaveBeenCalledWith(
      deliveryId,
      payload,
    );

    expect(
      routingService.resolveTargets,
    ).not.toHaveBeenCalled();
  });

  it('rejects unsupported events before routing', async () => {
    await expect(
      controller.receiveWebhook(
        createRequest(payload),
        sign(payload),
        'issues',
        deliveryId,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(
      routingService.resolveTargets,
    ).not.toHaveBeenCalled();
  });

  it('processes a correctly signed push', async () => {
    const result = await controller.receiveWebhook(
      createRequest(payload),
      sign(payload),
      'push',
      deliveryId,
    );

    expect(result).toEqual({
      status: 'processed',
      githubRepositoryId: '1376091667',
      workspaceCount: 1,
      commitCount: 1,
    });

    expect(pushService.processPush).toHaveBeenCalledWith(
      deliveryId,
      payload,
    );

    expect(routingService.resolveTargets).not.toHaveBeenCalled();
  });

  it('does not process an unsigned push', async () => {
    await expect(
      controller.receiveWebhook(
        createRequest(payload),
        undefined,
        'push',
        deliveryId,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(pushService.processPush).not.toHaveBeenCalled();
  });

  it('propagates push processing failures', async () => {
    pushService.processPush.mockRejectedValueOnce(
      new ServiceUnavailableException(
        'Push processing unavailable',
      ),
    );

    await expect(
      controller.receiveWebhook(
        createRequest(payload),
        sign(payload),
        'push',
        deliveryId,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

});
