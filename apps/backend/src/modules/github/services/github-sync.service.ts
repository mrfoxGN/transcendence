import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, IsNull } from 'typeorm';

import { WorkspacesService } from '../../workspaces/services/workspaces.service';
import { Repository as ConnectedRepository } from '../entities/repository.entity';
import { RepositoryCommit } from '../entities/repository-commit.entity';
import { GitHubApiService } from './github-api.service';
import { GitHubTokenCryptoService } from './github-token-crypto.service';

export interface GitHubSyncResult {
  repositoryId: string;
  fullName: string;
  fetchedCommits: number;
  storedCommits: number;
  lastSyncedAt: Date;
}

@Injectable()
export class GitHubSyncService {
  private readonly inFlightSyncs = new Map<
    string,
    Promise<GitHubSyncResult>
  >();

  constructor(
    private readonly dataSource: DataSource,
    private readonly workspacesService: WorkspacesService,
    private readonly githubApiService: GitHubApiService,
    private readonly githubTokenCryptoService: GitHubTokenCryptoService,
  ) {}

  async syncRepository(
    workspaceId: string,
    userId: string,
  ): Promise<GitHubSyncResult> {
    // Every caller must be an authorized workspace member.
    await this.workspacesService.findOneForUser(
      workspaceId,
      userId,
    );

    // Reuse an ongoing synchronization for this workspace.
    const existingSync = this.inFlightSyncs.get(workspaceId);

    if (existingSync) {
      return existingSync;
    }

    const syncPromise = this.performSync(workspaceId);
    this.inFlightSyncs.set(workspaceId, syncPromise);

    try {
      return await syncPromise;
    } finally {
      // Allow future manual refreshes, including after failures.
      this.inFlightSyncs.delete(workspaceId);
    }
  }

  private async performSync(
    workspaceId: string,
  ): Promise<GitHubSyncResult> {
    // Find the connected repository.
    const repository = await this.dataSource
      .getRepository(ConnectedRepository)
      .findOne({
        select: {
          id: true,
          workspaceId: true,
          githubRepositoryId: true,
          ownerLogin: true,
          name: true,
          encryptedOAuthToken: true,
        },
        where: {
          workspaceId,
          disconnectedAt: IsNull(),
        },
      });

    if (!repository) {
      throw new NotFoundException(
        'No GitHub repository connected to this workspace',
      );
    }

    if (!repository.encryptedOAuthToken) {
      throw new ConflictException(
        'GitHub authorization missing. Reconnect the repository.',
      );
    }

    const accessToken = this.githubTokenCryptoService.decrypt(
      repository.encryptedOAuthToken,
      repository.id,
    );

    // 3. Verify the repository still exists and is public.
    const remote = await this.githubApiService.getPublicRepository(
      repository.ownerLogin,
      repository.name,
      accessToken,
    );

    if (
      remote.githubRepositoryId !== repository.githubRepositoryId
    ) {
      throw new ConflictException(
        'GitHub repository identity has changed',
      );
    }

    // 4. Fetch recent commits.
    const commits = await this.githubApiService.listRecentCommits(
      remote.ownerLogin,
      remote.name,
      accessToken,
    );

    const now = new Date();

    // 5. Persist synchronization atomically.
    return this.dataSource.transaction(async (manager) => {
      const repositoryManager =
        manager.getRepository(ConnectedRepository);

      const active = await repositoryManager.findOne({
        where: {
          id: repository.id,
          workspaceId,
          disconnectedAt: IsNull(),
        },
      });

      if (!active) {
        throw new ConflictException(
          'Repository is no longer connected',
        );
      }

      // Avoid storing the same commit twice.
      if (commits.length > 0) {
        const records = commits.map((commit) => ({
          id: randomUUID(),
          repositoryId: active.id,
          sha: commit.sha,
          message: commit.message,
          authorGithubUserId: commit.authorGithubUserId,
          authorName: commit.authorName,
          committerName: commit.committerName,
          matchedUserId: null,
          committedAt: commit.committedAt,
          githubUrl: commit.githubUrl,
          createdAt: now,
        }));

        await manager
          .createQueryBuilder()
          .insert()
          .into(RepositoryCommit)
          .values(records)
          .orIgnore()
          .execute();
      }

      // Update repository metadata and synchronization time.
      active.ownerLogin = remote.ownerLogin;
      active.name = remote.name;
      active.fullName = remote.fullName;
      active.repositoryUrl = remote.repositoryUrl;
      active.defaultBranch = remote.defaultBranch;
      active.lastSyncedAt = now;
      active.updatedAt = now;

      await repositoryManager.save(active);

      const storedCommits = await manager.count(
        RepositoryCommit,
        {
          where: {
            repositoryId: active.id,
          },
        },
      );

      return {
        repositoryId: active.id,
        fullName: active.fullName,
        fetchedCommits: commits.length,
        storedCommits,
        lastSyncedAt: now,
      };
    });
  }
}
