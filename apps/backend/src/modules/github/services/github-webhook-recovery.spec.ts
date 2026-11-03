import { WebhookStatus } from '../../../database/enums/database.enums';
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { GitHubWebhookDeliveryService } from './github-webhook-delivery.service';

describe('GitHub webhook interrupted delivery recovery', () => {
  const deliveryId = 'test-recovery-delivery';
  const repositoryId = 'test-repository';

  const input = {
    deliveryId,
    eventType: 'push',
    repositoryId,
  };

  const repository = {
    insert: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  let service: GitHubWebhookDeliveryService;

  beforeEach(() => {
    jest.resetAllMocks();

    service = new GitHubWebhookDeliveryService(
      repository as never,
    );
  });

  function simulateExistingDelivery(
    status: WebhookStatus,
    receivedAt: Date,
  ): void {
    repository.insert.mockRejectedValueOnce({
      code: 'ER_DUP_ENTRY',
    });

    repository.findOne.mockResolvedValueOnce({
      id: 'existing-delivery-id',
      deliveryId,
      repositoryId,
      eventType: 'push',
      eventAction: null,
      status,
      receivedAt,
      processedAt: null,
      errorMessage: null,
    });
  }

  it('returns a lease for a new delivery', async () => {
    repository.insert.mockResolvedValueOnce({
      identifiers: [],
    });

    const result = await service.claimDeliveryWithLease(input);

    expect(result).toEqual({
      status: 'claimed',
      attemptStartedAt: expect.any(Date),
    });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it('does not reclaim an active delivery', async () => {
    simulateExistingDelivery(
      WebhookStatus.PROCESSING,
      new Date(),
    );

    const result = await service.claimDeliveryWithLease(input);

    expect(result).toEqual({ status: 'in_progress' });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('reclaims a delivery stuck for more than two minutes', async () => {
    const oldTimestamp = new Date(
      Date.now() - 3 * 60 * 1000,
    );

    simulateExistingDelivery(
      WebhookStatus.PROCESSING,
      oldTimestamp,
    );

    repository.update.mockResolvedValueOnce({
      affected: 1,
    });

    const result = await service.claimDeliveryWithLease(input);

    expect(result).toEqual({
      status: 'claimed',
      attemptStartedAt: expect.any(Date),
    });

    expect(repository.update).toHaveBeenCalledWith(
      {
        id: 'existing-delivery-id',
        status: WebhookStatus.PROCESSING,
        receivedAt: oldTimestamp,
      },
      expect.objectContaining({
        status: WebhookStatus.PROCESSING,
        receivedAt: expect.any(Date),
        processedAt: null,
      }),
    );

    if (result.status === 'claimed') {
      expect(
        result.attemptStartedAt.getTime(),
      ).toBeGreaterThan(oldTimestamp.getTime());
    }
  });

  it('allows only one worker to reclaim a stale delivery', async () => {
    simulateExistingDelivery(
      WebhookStatus.PROCESSING,
      new Date(Date.now() - 3 * 60 * 1000),
    );

    repository.update.mockResolvedValueOnce({
      affected: 0,
    });

    const result = await service.claimDeliveryWithLease(input);

    expect(result).toEqual({ status: 'in_progress' });
  });

  it('allows failed deliveries to be retried immediately', async () => {
    simulateExistingDelivery(
      WebhookStatus.FAILED,
      new Date(),
    );

    repository.update.mockResolvedValueOnce({
      affected: 1,
    });

    const result = await service.claimDeliveryWithLease(input);

    expect(result.status).toBe('claimed');
  });

  it('keeps processed deliveries idempotent', async () => {
    simulateExistingDelivery(
      WebhookStatus.PROCESSED,
      new Date(),
    );

    const result = await service.claimDeliveryWithLease(input);

    expect(result).toEqual({ status: 'duplicate' });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('fences failure updates to the owning attempt', async () => {
    const attemptStartedAt = new Date(
      '2026-11-03T12:00:00Z',
    );

    repository.update.mockResolvedValueOnce({
      affected: 1,
    });

    await service.markFailedForAttempt(
      deliveryId,
      attemptStartedAt,
      'Processing interrupted',
    );

    expect(repository.update).toHaveBeenCalledWith(
      {
        deliveryId,
        status: WebhookStatus.PROCESSING,
        receivedAt: attemptStartedAt,
      },
      expect.objectContaining({
        status: WebhookStatus.FAILED,
        errorMessage: 'Processing interrupted',
      }),
    );
  });

  it('rejects failure updates from an outdated attempt', async () => {
    repository.update.mockResolvedValueOnce({
      affected: 0,
    });

    await expect(
      service.markFailedForAttempt(
        deliveryId,
        new Date('2026-11-03T12:00:00Z'),
        'Old worker failed',
      ),
    ).rejects.toThrow(
      'Webhook delivery is no longer owned by this attempt',
    );
  });

  it('preserves the original claimDelivery return type', async () => {
    repository.insert.mockResolvedValueOnce({
      identifiers: [],
    });

    const result = await service.claimDelivery(input);

    expect(result).toBe('claimed');
  });
});
