import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, IsNull } from 'typeorm';

import { WebhookStatus } from '../../../database/enums/database.enums';
import { GitHubWebhookDelivery } from '../entities/github-webhook-delivery.entity';
import { Repository as ConnectedRepository } from '../entities/repository.entity';
import { RepositoryCommit } from '../entities/repository-commit.entity';
import { parseGitHubPushPayload } from '../utils/github-push-payload';
import { GitHubWebhookDeliveryService } from './github-webhook-delivery.service';
import { GitHubWebhookRoutingService } from './github-webhook-routing.service';

export interface GitHubPushProcessingResult {
  status: 'processed' | 'duplicate' | 'ignored';
  githubRepositoryId: string;
  workspaceCount: number;
  commitCount: number;
}

@Injectable()
export class GitHubWebhookPushService {
  private readonly logger = new Logger(GitHubWebhookPushService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly routingService: GitHubWebhookRoutingService,
    private readonly deliveryService: GitHubWebhookDeliveryService,
  ) {}

  async processPush(
    deliveryId: string,
    payload: unknown,
  ): Promise<GitHubPushProcessingResult> {
    const push = parseGitHubPushPayload(payload);

    // The parser retains only the latest 30 commits.
    // Reject oversized or truncated events rather than losing history.
    const source = payload as {
      commits: unknown[];
      size?: unknown;
      distinct_size?: unknown;
    };

    const includedCommits = source.commits.length;

    if (
      includedCommits > 30 ||
      (
        typeof source.size === 'number' &&
        source.size > includedCommits
      ) ||
      (
        typeof source.distinct_size === 'number' &&
        source.distinct_size > includedCommits
      )
    ) {
      throw new ServiceUnavailableException(
        'Push exceeds the safe commit processing limit',
      );
    }

    // Tag pushes and branch deletions will be handled separately.
    if (push.deleted || push.branch === null) {
      throw new ServiceUnavailableException(
        'This push event type is not supported yet',
      );
    }

    // Find all workspaces connected to the GitHub repository.
    const targets = await this.routingService.resolveTargets(payload);

    // A delivery belongs to a GitHub event, not a workspace.
    const claim = await this.deliveryService.claimDeliveryWithLease({
      deliveryId,
      eventType: 'push',
      repositoryId:
        targets.length === 1 ? targets[0].repositoryId : null,
    });

    if (claim.status === 'duplicate') {
      return {
        status: 'duplicate',
        githubRepositoryId: push.githubRepositoryId,
        workspaceCount: targets.length,
        commitCount: 0,
      };
    }

    if (claim.status === 'in_progress') {
      throw new ServiceUnavailableException(
        'Webhook delivery is already being processed',
      );
    }

    if (claim.status !== 'claimed') {
      throw new ServiceUnavailableException(
        'Webhook delivery was not claimed',
      );
    }

    const attemptStartedAt = claim.attemptStartedAt;
    const now = new Date();

    try {
      await this.dataSource.transaction(async (manager) => {
        const repositoryManager =
          manager.getRepository(ConnectedRepository);

        // Revalidate connections inside the transaction.
        for (const target of targets) {
          const connection = await repositoryManager.findOne({
            where: {
              id: target.repositoryId,
              workspaceId: target.workspaceId,
              githubRepositoryId: push.githubRepositoryId,
              disconnectedAt: IsNull(),
            },
          });

          if (!connection) {
            throw new ConflictException(
              'Repository connection changed during webhook processing',
            );
          }
        }

        // Generate commit records for all connected workspaces.
        const records = targets.flatMap((target) =>
          push.commits.map((commit) => ({
            id: randomUUID(),
            repositoryId: target.repositoryId,
            sha: commit.sha,
            message: commit.message,
            authorGithubUserId: null,
            authorName: commit.authorName,
            committerName: commit.committerName,
            matchedUserId: null,
            committedAt: commit.committedAt,
            githubUrl: commit.githubUrl,
            createdAt: now,
          })),
        );

        // The existing (repository_id, sha) unique constraint
        // prevents duplicate commit records.
        if (records.length > 0) {
          await manager
            .createQueryBuilder()
            .insert()
            .into(RepositoryCommit)
            .values(records)
            .orIgnore()
            .execute();
        }

        // Mark the delivery completed in the same transaction.
        const status =
          targets.length > 0
            ? WebhookStatus.PROCESSED
            : WebhookStatus.IGNORED;

        const result = await manager
          .getRepository(GitHubWebhookDelivery)
          .update(
            {
              deliveryId,
              status: WebhookStatus.PROCESSING,
              receivedAt: attemptStartedAt,
            },
            {
              status,
              processedAt: now,
              errorMessage: null,
            },
          );

        if (result.affected !== 1) {
          throw new ConflictException(
            'Webhook delivery processing state changed',
          );
        }
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown webhook processing failure';

      try {
        await this.deliveryService.markFailedForAttempt(
          deliveryId,
          attemptStartedAt,
          message,
        );
      } catch {
        this.logger.error(
          'Failed to record webhook delivery failure',
        );
      }

      throw error;
    }

    return {
      status: targets.length > 0 ? 'processed' : 'ignored',
      githubRepositoryId: push.githubRepositoryId,
      workspaceCount: targets.length,
      commitCount: push.commits.length,
    };
  }
}
