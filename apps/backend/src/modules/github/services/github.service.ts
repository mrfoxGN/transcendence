import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { WorkspacesService } from '../../workspaces/services/workspaces.service';
import { GitHubApiService } from './github-api.service';
import type {
  PublicGitHubRepository,
  PublicGitHubBranch,
} from './github-api.service';
import { GitHubOAuthService } from './github-oauth.service';
import { GitHubTokenCryptoService } from './github-token-crypto.service';
import { RepositoryVisibility } from '../../../database/enums/database.enums';
import { ConnectedRepositoryResponseDto } from '../dto/connected-repository-response.dto';
import { Repository as ConnectedRepository } from '../entities/repository.entity';
import { RepositoryCommit } from '../entities/repository-commit.entity';
import { GitHubInstallation } from '../entities/github-installation.entity';

@Injectable()
export class GitHubService {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly githubApiService: GitHubApiService,
    private readonly githubOAuthService: GitHubOAuthService,
    @InjectRepository(GitHubInstallation)
    private readonly installationsRepository: Repository<GitHubInstallation>,

    @InjectRepository(ConnectedRepository)
    private readonly connectedRepositories: Repository<ConnectedRepository>,

    @InjectRepository(RepositoryCommit)
    private readonly repositoryCommits: Repository<RepositoryCommit>,
    private readonly githubTokenCryptoService: GitHubTokenCryptoService,
  ) {}

  async listAvailableRepositories(
    workspaceId: string,
    userId: string,
    setupSessionId: string,
  ): Promise<PublicGitHubRepository[]> {
    await this.workspacesService.assertOwner(workspaceId, userId);

    const accessToken = await this.githubOAuthService.getSetupAccessToken(
      setupSessionId,
      workspaceId,
      userId,
    );

    return this.githubApiService.listAdminPublicRepositories(accessToken);
  }

  async connectPublicRepository(
    workspaceId: string,
    userId: string,
    setupSessionId: string,
    githubRepositoryId: string,
  ): Promise<ConnectedRepositoryResponseDto> {
    // Verify Transcendence workspace ownership.
    await this.workspacesService.assertOwner(workspaceId, userId, true);

    // Verify the temporary OAuth session belongs to
    // this workspace and Transcendence user.
    const accessToken = await this.githubOAuthService.getSetupAccessToken(
      setupSessionId,
      workspaceId,
      userId,
    );

    // Fetch current repository permissions from GitHub.
    // Never trust only the selected repository ID.
    const availableRepositories =
      await this.githubApiService.listAdminPublicRepositories(accessToken);

    const selected = availableRepositories.find(
      (repository) => repository.githubRepositoryId === githubRepositoryId,
    );

    if (!selected) {
      throw new ForbiddenException(
        'Repository is not public or GitHub admin permission is missing',
      );
    }

    // V1: allow one active repository per workspace.
    const activeConnection = await this.connectedRepositories.findOne({
      where: {
        workspaceId,
        disconnectedAt: IsNull(),
      },
    });

    if (activeConnection) {
      throw new ConflictException(
        'Workspace already has a connected GitHub repository',
      );
    }

    // Do not silently reactivate previously disconnected rows.
    const previousConnection = await this.connectedRepositories.findOne({
      where: {
        workspaceId,
        githubRepositoryId: selected.githubRepositoryId,
      },
    });

    if (previousConnection) {
      throw new ConflictException(
        'Repository was previously connected to this workspace',
      );
    }

    const now = new Date();

    const connection = this.connectedRepositories.create({
      id: randomUUID(),
      workspaceId,
      connectedById: userId,
      installationId: null,
      githubRepositoryId: selected.githubRepositoryId,
      ownerLogin: selected.ownerLogin,
      name: selected.name,
      fullName: selected.fullName,
      repositoryUrl: selected.repositoryUrl,
      defaultBranch: selected.defaultBranch,
      visibility: RepositoryVisibility.PUBLIC,
      lastSyncedAt: null,
      createdAt: now,
      updatedAt: now,
      disconnectedAt: null,
    });

    connection.encryptedOAuthToken = this.githubTokenCryptoService.encrypt(
      accessToken,
      connection.id,
    );

    const saved = await this.connectedRepositories.save(connection);

    // The OAuth setup session is no longer needed
    // after successful repository linking.
    this.githubOAuthService.deleteSetupSession(setupSessionId);

    return {
      id: saved.id,
      workspaceId: saved.workspaceId,
      githubRepositoryId: saved.githubRepositoryId,
      fullName: saved.fullName,
      repositoryUrl: saved.repositoryUrl,
      defaultBranch: saved.defaultBranch,
      visibility: saved.visibility,
      createdAt: saved.createdAt,
    };
  }

  async getWorkspaceRepository(
    workspaceId: string,
    userId: string,
  ): Promise<
    ConnectedRepositoryResponseDto & {
      lastSyncedAt: Date | null;
    }
  > {
    // Only workspace members can view the connection.
    await this.workspacesService.findOneForUser(workspaceId, userId);

    // Read stored data without calling the GitHub API.
    const repository = await this.connectedRepositories.findOne({
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

    return {
      id: repository.id,
      workspaceId: repository.workspaceId,
      githubRepositoryId: repository.githubRepositoryId,
      fullName: repository.fullName,
      repositoryUrl: repository.repositoryUrl,
      defaultBranch: repository.defaultBranch,
      visibility: repository.visibility,
      createdAt: repository.createdAt,
      lastSyncedAt: repository.lastSyncedAt,
    };
  }

  async listWorkspaceCommits(
    workspaceId: string,
    userId: string,
    page = 1,
    limit = 20,
  ) {
    if (
      !Number.isInteger(page) ||
      !Number.isInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      throw new BadRequestException('Invalid pagination parameters');
    }

    // Verify workspace membership.
    await this.workspacesService.findOneForUser(workspaceId, userId);

    // Read the connected repository from MySQL.
    const repository = await this.connectedRepositories.findOne({
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

    // Read stored commits. No GitHub API request.
    const [commits, total] = await this.repositoryCommits.findAndCount({
      where: {
        repositoryId: repository.id,
      },
      order: {
        committedAt: 'DESC',
        sha: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: commits.map((commit) => ({
        id: commit.id,
        sha: commit.sha,
        message: commit.message,
        authorName: commit.authorName,
        committerName: commit.committerName,
        committedAt: commit.committedAt,
        githubUrl: commit.githubUrl,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async getConnectedRepositoryForMember(
    workspaceId: string,
    userId: string,
  ): Promise<{ repository: ConnectedRepository; accessToken: string }> {
    await this.workspacesService.findOneForUser(workspaceId, userId);

    const repository = await this.connectedRepositories.findOne({
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

    const remote = await this.githubApiService.getPublicRepository(
      repository.ownerLogin,
      repository.name,
      accessToken,
    );

    if (remote.githubRepositoryId !== repository.githubRepositoryId) {
      throw new ConflictException(
        'Connected GitHub repository identity has changed',
      );
    }

    return { repository, accessToken };
  }

  async listWorkspaceBranches(
    workspaceId: string,
    userId: string,
  ): Promise<PublicGitHubBranch[]> {
    const { repository, accessToken } =
      await this.getConnectedRepositoryForMember(workspaceId, userId);

    return this.githubApiService.listBranches(
      repository.ownerLogin,
      repository.name,
      accessToken,
    );
  }
}
