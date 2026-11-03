import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { WebhookStatus } from '../../../database/enums/database.enums';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import {
  GitHubWebhookDeliveryService,
} from './github-webhook-delivery.service';

describe('GitHubWebhookDeliveryService', () => {
  let service: GitHubWebhookDeliveryService;

  const input = {
    deliveryId: 'delivery-123',
    eventType: 'push',
    eventAction: null,
    repositoryId: '43181083-7955-41bf-bac8-425ac2f80ac2',
  };

  const existingDelivery = {
    id: 'existing-delivery-id',
    deliveryId: input.deliveryId,
    eventType: input.eventType,
    status: WebhookStatus.PROCESSED,
  };

  const deliveries = {
    insert: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const duplicateError = {
    code: 'ER_DUP_ENTRY',
  };

  beforeEach(() => {
    jest.resetAllMocks();

    deliveries.insert.mockResolvedValue({});
    deliveries.findOne.mockResolvedValue(null);
    deliveries.update.mockResolvedValue({
      affected: 1,
    });

    service = new GitHubWebhookDeliveryService(
      deliveries as never,
    );
  });

  describe('claimDelivery', () => {
    it('claims a new delivery', async () => {
      const result = await service.claimDelivery(input);

      expect(result).toBe('claimed');

      expect(deliveries.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          deliveryId: input.deliveryId,
          eventType: 'push',
          repositoryId: input.repositoryId,
          status: WebhookStatus.PROCESSING,
          receivedAt: expect.any(Date),
          processedAt: null,
          errorMessage: null,
        }),
      );

      expect(deliveries.findOne).not.toHaveBeenCalled();
    });

    it('ignores an already processed delivery', async () => {
      deliveries.insert.mockRejectedValueOnce(
        duplicateError,
      );

      deliveries.findOne.mockResolvedValueOnce({
        ...existingDelivery,
        status: WebhookStatus.PROCESSED,
      });

      const result = await service.claimDelivery(input);

      expect(result).toBe('duplicate');

      expect(deliveries.update).not.toHaveBeenCalled();
    });

    it('ignores an already ignored delivery', async () => {
      deliveries.insert.mockRejectedValueOnce(
        duplicateError,
      );

      deliveries.findOne.mockResolvedValueOnce({
        ...existingDelivery,
        status: WebhookStatus.IGNORED,
      });

      const result = await service.claimDelivery(input);

      expect(result).toBe('duplicate');
    });

    it('detects an actively processing delivery', async () => {
      deliveries.insert.mockRejectedValueOnce(
        duplicateError,
      );

      deliveries.findOne.mockResolvedValueOnce({
        ...existingDelivery,
        status: WebhookStatus.PROCESSING,
      });

      const result = await service.claimDelivery(input);

      expect(result).toBe('in_progress');
    });

    it('recognizes a received delivery', async () => {
      deliveries.insert.mockRejectedValueOnce(
        duplicateError,
      );

      deliveries.findOne.mockResolvedValueOnce({
        ...existingDelivery,
        status: WebhookStatus.RECEIVED,
      });

      const result = await service.claimDelivery(input);

      expect(result).toBe('in_progress');
    });

    it('allows retrying a failed delivery', async () => {
      deliveries.insert.mockRejectedValueOnce(
        duplicateError,
      );

      deliveries.findOne.mockResolvedValueOnce({
        ...existingDelivery,
        status: WebhookStatus.FAILED,
      });

      const result = await service.claimDelivery(input);

      expect(result).toBe('claimed');

      expect(deliveries.update).toHaveBeenCalledWith(
        {
          id: existingDelivery.id,
          status: WebhookStatus.FAILED,
        },
        expect.objectContaining({
          status: WebhookStatus.PROCESSING,
          errorMessage: null,
          processedAt: null,
        }),
      );
    });

    it('prevents simultaneous retry claims', async () => {
      deliveries.insert.mockRejectedValueOnce(
        duplicateError,
      );

      deliveries.findOne.mockResolvedValueOnce({
        ...existingDelivery,
        status: WebhookStatus.FAILED,
      });

      deliveries.update.mockResolvedValueOnce({
        affected: 0,
      });

      const result = await service.claimDelivery(input);

      expect(result).toBe('in_progress');
    });

    it('rejects conflicting event types', async () => {
      deliveries.insert.mockRejectedValueOnce(
        duplicateError,
      );

      deliveries.findOne.mockResolvedValueOnce({
        ...existingDelivery,
        eventType: 'pull_request',
      });

      await expect(
        service.claimDelivery(input),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects invalid delivery metadata', async () => {
      await expect(
        service.claimDelivery({
          ...input,
          deliveryId: '',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(deliveries.insert).not.toHaveBeenCalled();
    });

    it('rejects malformed event names', async () => {
      await expect(
        service.claimDelivery({
          ...input,
          eventType: 'invalid event',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(deliveries.insert).not.toHaveBeenCalled();
    });

    it('propagates database errors', async () => {
      deliveries.insert.mockRejectedValueOnce(
        new Error('Database unavailable'),
      );

      await expect(
        service.claimDelivery(input),
      ).rejects.toThrow('Database unavailable');
    });

    it('handles a missing record after duplicate detection', async () => {
      deliveries.insert.mockRejectedValueOnce(
        duplicateError,
      );

      deliveries.findOne.mockResolvedValueOnce(null);

      await expect(
        service.claimDelivery(input),
      ).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('delivery status updates', () => {
    it('marks a delivery as processed', async () => {
      await service.markProcessed(input.deliveryId);

      expect(deliveries.update).toHaveBeenCalledWith(
        {
          deliveryId: input.deliveryId,
          status: WebhookStatus.PROCESSING,
        },
        expect.objectContaining({
          status: WebhookStatus.PROCESSED,
          processedAt: expect.any(Date),
          errorMessage: null,
        }),
      );
    });

    it('marks a delivery as ignored', async () => {
      await service.markIgnored(input.deliveryId);

      expect(deliveries.update).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          status: WebhookStatus.IGNORED,
        }),
      );
    });

    it('records processing failures', async () => {
      await service.markFailed(
        input.deliveryId,
        'Processing failed',
      );

      expect(deliveries.update).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          status: WebhookStatus.FAILED,
          errorMessage: 'Processing failed',
        }),
      );
    });

    it('limits stored error messages', async () => {
      const longMessage = 'x'.repeat(2000);

      await service.markFailed(
        input.deliveryId,
        longMessage,
      );

      expect(deliveries.update).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          errorMessage: 'x'.repeat(1000),
        }),
      );
    });

    it('rejects invalid status transitions', async () => {
      deliveries.update.mockResolvedValueOnce({
        affected: 0,
      });

      await expect(
        service.markProcessed(input.deliveryId),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
