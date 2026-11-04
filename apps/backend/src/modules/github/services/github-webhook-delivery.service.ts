import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';

import { WebhookStatus } from '../../../database/enums/database.enums';
import { GitHubWebhookDelivery } from '../entities/github-webhook-delivery.entity';

const PROCESSING_TIMEOUT_MS = 2 * 60 * 1000;

export interface ClaimWebhookDeliveryInput {
  deliveryId: string;
  eventType: string;
  eventAction?: string | null;
  repositoryId?: string | null;
}

export type WebhookClaimResult =
  | 'claimed'
  | 'duplicate'
  | 'in_progress';

export type WebhookLeaseClaimResult =
  | {
      status: 'claimed';
      attemptStartedAt: Date;
    }
  | {
      status: 'duplicate' | 'in_progress';
    };

@Injectable()
export class GitHubWebhookDeliveryService {
  constructor(
    @InjectRepository(GitHubWebhookDelivery)
    private readonly deliveries: Repository<GitHubWebhookDelivery>,
  ) {}

  // Preserve the original API for existing callers and tests.
  async claimDelivery(
    input: ClaimWebhookDeliveryInput,
  ): Promise<WebhookClaimResult> {
    const result = await this.claimDeliveryWithLease(input);
    return result.status;
  }

  // New API: returns the timestamp identifying this processing attempt.
  async claimDeliveryWithLease(
    input: ClaimWebhookDeliveryInput,
  ): Promise<WebhookLeaseClaimResult> {
    this.validateInput(input);

    const now = new Date();

    try {
      await this.deliveries.insert({
        id: randomUUID(),
        deliveryId: input.deliveryId,
        repositoryId: input.repositoryId ?? null,
        eventType: input.eventType,
        eventAction: input.eventAction ?? null,
        status: WebhookStatus.PROCESSING,
        receivedAt: now,
        processedAt: null,
        errorMessage: null,
      });

      return {
        status: 'claimed',
        attemptStartedAt: now,
      };
    } catch (error: unknown) {
      if (!this.isDuplicateKeyError(error)) {
        throw error;
      }
    }

    const existing = await this.deliveries.findOne({
      where: {
        deliveryId: input.deliveryId,
      },
    });

    if (!existing) {
      throw new ServiceUnavailableException(
        'Webhook delivery state is temporarily unavailable',
      );
    }

    if (existing.eventType !== input.eventType) {
      throw new ConflictException(
        'Delivery ID belongs to another event type',
      );
    }

    if (
      existing.status === WebhookStatus.PROCESSED ||
      existing.status === WebhookStatus.IGNORED
    ) {
      return { status: 'duplicate' };
    }

    const isProcessing =
      existing.status === WebhookStatus.PROCESSING ||
      existing.status === WebhookStatus.RECEIVED;

    if (isProcessing) {
      // A missing or invalid timestamp cannot be recovered safely.
      if (
        !(existing.receivedAt instanceof Date) ||
        Number.isNaN(existing.receivedAt.getTime())
      ) {
        return { status: 'in_progress' };
      }

      const ageMs =
        now.getTime() - existing.receivedAt.getTime();

      if (ageMs < PROCESSING_TIMEOUT_MS) {
        return { status: 'in_progress' };
      }
    }

    if (
      existing.status !== WebhookStatus.FAILED &&
      !isProcessing
    ) {
      throw new ConflictException(
        'Unexpected webhook delivery status',
      );
    }

    // Ensure every attempt has a different timestamp, even if a
    // failed delivery is immediately retried in the same millisecond.
    const previousTime =
      existing.receivedAt instanceof Date
        ? existing.receivedAt.getTime()
        : 0;

    const attemptStartedAt = new Date(
      Math.max(now.getTime(), previousTime + 1),
    );

    // Compare-and-swap prevents simultaneous recovery attempts.
    // For stale processing attempts, the old timestamp is part of
    // the condition, so only one worker can acquire the lease.
    const condition =
      existing.status === WebhookStatus.FAILED
        ? {
            id: existing.id,
            status: WebhookStatus.FAILED,
          }
        : {
            id: existing.id,
            status: existing.status,
            receivedAt: existing.receivedAt,
          };

    const result = await this.deliveries.update(
      condition,
      {
        status: WebhookStatus.PROCESSING,
        repositoryId: input.repositoryId ?? null,
        eventAction: input.eventAction ?? null,
        receivedAt: attemptStartedAt,
        processedAt: null,
        errorMessage: null,
      },
    );

    if (result.affected !== 1) {
      return { status: 'in_progress' };
    }

    return {
      status: 'claimed',
      attemptStartedAt,
    };
  }

  async markProcessed(deliveryId: string): Promise<void> {
    await this.finishDelivery(
      deliveryId,
      WebhookStatus.PROCESSED,
      null,
    );
  }

  async markIgnored(deliveryId: string): Promise<void> {
    await this.finishDelivery(
      deliveryId,
      WebhookStatus.IGNORED,
      null,
    );
  }

  async markFailed(
    deliveryId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.finishDelivery(
      deliveryId,
      WebhookStatus.FAILED,
      errorMessage.slice(0, 1000),
    );
  }

  // An outdated worker cannot mark a newer attempt as FAILED.
  async markFailedForAttempt(
    deliveryId: string,
    attemptStartedAt: Date,
    errorMessage: string,
  ): Promise<void> {
    await this.finishDelivery(
      deliveryId,
      WebhookStatus.FAILED,
      errorMessage.slice(0, 1000),
      attemptStartedAt,
    );
  }

  private async finishDelivery(
    deliveryId: string,
    status: WebhookStatus,
    errorMessage: string | null,
    attemptStartedAt?: Date,
  ): Promise<void> {
    const condition: {
      deliveryId: string;
      status: WebhookStatus;
      receivedAt?: Date;
    } = {
      deliveryId,
      status: WebhookStatus.PROCESSING,
    };

    if (attemptStartedAt !== undefined) {
      condition.receivedAt = attemptStartedAt;
    }

    const result = await this.deliveries.update(
      condition,
      {
        status,
        processedAt: new Date(),
        errorMessage,
      },
    );

    if (result.affected !== 1) {
      throw new ConflictException(
        'Webhook delivery is no longer owned by this attempt',
      );
    }
  }

  private validateInput(
    input: ClaimWebhookDeliveryInput,
  ): void {
    if (
      !/^[a-zA-Z0-9-]{1,100}$/.test(input.deliveryId) ||
      !/^[a-z_]{1,100}$/.test(input.eventType) ||
      (
        input.eventAction != null &&
        !/^[a-z_]{1,100}$/.test(input.eventAction)
      )
    ) {
      throw new BadRequestException(
        'Invalid webhook delivery metadata',
      );
    }
  }

  private isDuplicateKeyError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const value = error as {
      code?: unknown;
      driverError?: {
        code?: unknown;
        errno?: unknown;
      };
    };

    return (
      value.code === 'ER_DUP_ENTRY' ||
      value.driverError?.code === 'ER_DUP_ENTRY' ||
      value.driverError?.errno === 1062
    );
  }
}
