import {
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { WebhookStatus } from '../../../database/enums/database.enums';
import { Repository as ConnectedRepository } from '../entities/repository.entity';
import { GitHubWebhookDelivery } from '../entities/github-webhook-delivery.entity';

jest.mock('./github-webhook-routing.service', () => ({
  GitHubWebhookRoutingService: class GitHubWebhookRoutingService {},
}));

jest.mock('./github-webhook-delivery.service', () => ({
  GitHubWebhookDeliveryService: class GitHubWebhookDeliveryService {},
}));

import { GitHubWebhookPushService } from './github-webhook-push.service';

describe('GitHubWebhookPushService', () => {
  let service: GitHubWebhookPushService;

  const deliveryId = 'test-delivery-123';

  const workspaceId =
    'e54413c9-6d57-4dfe-83ee-43befd82bbe8';

  const repositoryId =
    'c6a05a9c-930b-4cc1-a0be-8c1f09e507fa';

  const githubRepositoryId = '1053516808';

  const commit = {
    id: 'a'.repeat(40),
    message: 'test: verify GitHub webhook processing',
    timestamp: '2026-11-03T12:00:00Z',
    url: 'https://github.com/mrfoxGN/cpp00/commit/' +
      'a'.repeat(40),
    author: {
      name: 'mrfoxGN',
    },
    committer: {
      name: 'mrfoxGN',
    },
  };

  const payload = {
    ref: 'refs/heads/webhook-test',
    deleted: false,
    repository: {
      id: 1053516808,
      full_name: 'mrfoxGN/cpp00',
    },
    commits: [commit],
  };

  const target = {
    repositoryId,
    workspaceId,
    githubRepositoryId,
    fullName: 'mrfoxGN/cpp00',
  };

  const routingService = {
    resolveTargets: jest.fn(),
  };

  const deliveryService = {
    claimDeliveryWithLease: jest.fn(),
    markFailedForAttempt: jest.fn(),
  };

  const connectedRepository = {
    findOne: jest.fn(),
  };

  const deliveryRepository = {
    update: jest.fn(),
  };

  const queryBuilder = {
    insert: jest.fn(),
    into: jest.fn(),
    values: jest.fn(),
    orIgnore: jest.fn(),
    execute: jest.fn(),
  };

  const transactionManager = {
    getRepository: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const dataSource = {
    transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    routingService.resolveTargets.mockResolvedValue([target]);

    deliveryService.claimDeliveryWithLease.mockResolvedValue({
      status: 'claimed',
      attemptStartedAt: new Date('2026-11-03T12:00:00Z'),
    });

    deliveryService.markFailedForAttempt.mockResolvedValue(undefined);

    connectedRepository.findOne.mockResolvedValue({
      id: repositoryId,
      workspaceId,
      githubRepositoryId,
    });

    deliveryRepository.update.mockResolvedValue({
      affected: 1,
    });

    queryBuilder.insert.mockReturnValue(queryBuilder);
    queryBuilder.into.mockReturnValue(queryBuilder);
    queryBuilder.values.mockReturnValue(queryBuilder);
    queryBuilder.orIgnore.mockReturnValue(queryBuilder);
    queryBuilder.execute.mockResolvedValue({});

    transactionManager.getRepository.mockImplementation(
      (entity: unknown) => {
        if (entity === ConnectedRepository) {
          return connectedRepository;
        }

        if (entity === GitHubWebhookDelivery) {
          return deliveryRepository;
        }

        throw new Error('Unexpected repository entity');
      },
    );

    transactionManager.createQueryBuilder.mockReturnValue(
      queryBuilder,
    );

    dataSource.transaction.mockImplementation(
      async (
        callback: (
          manager: typeof transactionManager,
        ) => Promise<unknown>,
      ) => callback(transactionManager),
    );

    service = new GitHubWebhookPushService(
      dataSource as never,
      routingService as never,
      deliveryService as never,
    );
  });

  const process = () =>
    service.processPush(deliveryId, payload);

  it('processes a valid GitHub push', async () => {
    const result = await process();

    expect(result).toEqual({
      status: 'processed',
      githubRepositoryId,
      workspaceCount: 1,
      commitCount: 1,
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('resolves the correct workspace', async () => {
    await process();

    expect(routingService.resolveTargets).toHaveBeenCalledWith(
      payload,
    );

    expect(connectedRepository.findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: repositoryId,
        workspaceId,
        githubRepositoryId,
      }),
    });
  });

  it('claims the GitHub delivery before processing', async () => {
    await process();

    expect(deliveryService.claimDeliveryWithLease).toHaveBeenCalledWith({
      deliveryId,
      eventType: 'push',
      repositoryId,
    });
  });

  it('inserts commits with correct metadata', async () => {
    await process();

    expect(queryBuilder.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          repositoryId,
          sha: commit.id,
          message: commit.message,
          authorName: 'mrfoxGN',
          committerName: 'mrfoxGN',
          matchedUserId: null,
          committedAt: new Date(commit.timestamp),
        }),
      ]),
    );
  });

  it('uses idempotent commit insertion', async () => {
    await process();

    expect(queryBuilder.orIgnore).toHaveBeenCalledTimes(1);
    expect(queryBuilder.execute).toHaveBeenCalledTimes(1);
  });

  it('marks a successfully processed delivery', async () => {
    await process();

    expect(deliveryRepository.update).toHaveBeenCalledWith(
      {
        deliveryId,
        status: WebhookStatus.PROCESSING,
        receivedAt: expect.any(Date),
      },
      expect.objectContaining({
        status: WebhookStatus.PROCESSED,
        processedAt: expect.any(Date),
        errorMessage: null,
      }),
    );
  });

  it('does not process duplicate deliveries', async () => {
    deliveryService.claimDeliveryWithLease.mockResolvedValueOnce(
      { status: 'duplicate' },
    );

    const result = await process();

    expect(result.status).toBe('duplicate');

    expect(dataSource.transaction).not.toHaveBeenCalled();

    expect(queryBuilder.execute).not.toHaveBeenCalled();
  });

  it('rejects deliveries already being processed', async () => {
    deliveryService.claimDeliveryWithLease.mockResolvedValueOnce(
      { status: 'in_progress' },
    );

    await expect(process()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('supports multiple workspaces', async () => {
    const secondTarget = {
      ...target,
      repositoryId: 'second-connection-id',
      workspaceId: 'second-workspace-id',
    };

    routingService.resolveTargets.mockResolvedValueOnce([
      target,
      secondTarget,
    ]);

    const result = await process();

    expect(result.workspaceCount).toBe(2);

    expect(deliveryService.claimDeliveryWithLease).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryId: null,
      }),
    );

    expect(queryBuilder.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          repositoryId,
          sha: commit.id,
        }),
        expect.objectContaining({
          repositoryId: secondTarget.repositoryId,
          sha: commit.id,
        }),
      ]),
    );

    expect(connectedRepository.findOne).toHaveBeenCalledTimes(2);
  });

  it('ignores events for unconnected repositories', async () => {
    routingService.resolveTargets.mockResolvedValueOnce([]);

    const result = await process();

    expect(result.status).toBe('ignored');
    expect(result.workspaceCount).toBe(0);

    expect(queryBuilder.execute).not.toHaveBeenCalled();

    expect(deliveryRepository.update).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        status: WebhookStatus.IGNORED,
      }),
    );
  });

  it('handles push events without commits', async () => {
    const emptyPayload = {
      ...payload,
      commits: [],
    };

    const result = await service.processPush(
      deliveryId,
      emptyPayload,
    );

    expect(result.commitCount).toBe(0);

    expect(queryBuilder.execute).not.toHaveBeenCalled();

    expect(deliveryRepository.update).toHaveBeenCalled();
  });

  it('records database insertion failures', async () => {
    queryBuilder.execute.mockRejectedValueOnce(
      new Error('Commit insertion failed'),
    );

    await expect(process()).rejects.toThrow(
      'Commit insertion failed',
    );

    expect(deliveryService.markFailedForAttempt).toHaveBeenCalledWith(
      deliveryId,
      expect.any(Date),
      'Commit insertion failed',
    );

    expect(deliveryRepository.update).not.toHaveBeenCalled();
  });

  it('rejects disconnected repositories', async () => {
    connectedRepository.findOne.mockResolvedValueOnce(null);

    await expect(process()).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(queryBuilder.execute).not.toHaveBeenCalled();

    expect(deliveryService.markFailedForAttempt).toHaveBeenCalled();
  });

  it('rejects failed delivery status updates', async () => {
    deliveryRepository.update.mockResolvedValueOnce({
      affected: 0,
    });

    await expect(process()).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(deliveryService.markFailedForAttempt).toHaveBeenCalled();
  });

  it('rejects unsupported tag pushes before claiming', async () => {
    const tagPayload = {
      ...payload,
      ref: 'refs/tags/v1.0.0',
    };

    await expect(
      service.processPush(deliveryId, tagPayload),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(deliveryService.claimDeliveryWithLease).not.toHaveBeenCalled();
  });

  it('rejects branch deletion pushes before claiming', async () => {
    const deletedPayload = {
      ...payload,
      deleted: true,
      commits: [],
    };

    await expect(
      service.processPush(deliveryId, deletedPayload),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(deliveryService.claimDeliveryWithLease).not.toHaveBeenCalled();
  });

  it('rejects invalid payloads before routing', async () => {
    await expect(
      service.processPush(deliveryId, {
        repository: {
          id: 'invalid',
        },
      }),
    ).rejects.toThrow();

    expect(routingService.resolveTargets).not.toHaveBeenCalled();

    expect(deliveryService.claimDeliveryWithLease).not.toHaveBeenCalled();
  });

  it('rejects pushes exceeding 30 commits', async () => {
    const largePayload = {
      ...payload,
      commits: Array.from(
        { length: 31 },
        (_, index) => ({
          ...commit,
          id: index.toString(16).padStart(40, '0'),
        }),
      ),
    };

    await expect(
      service.processPush(deliveryId, largePayload),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(deliveryService.claimDeliveryWithLease).not.toHaveBeenCalled();
  });

});
