import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { WorkspacesService } from '../../workspaces/services/workspaces.service';
import { GitHubApiService } from './github-api.service';
import type {
  PublicGitHubRepository,
  PublicGitHubBranch,
  PublicGitHubPullRequest,
} from './github-api.service';
import { GitHubOAuthService } from './github-oauth.service';
import { RepositoryVisibility } from '../../../database/enums/database.enums';
import { ConnectedRepositoryResponseDto } from '../dto/connected-repository-response.dto';
import { Repository as ConnectedRepository } from '../entities/repository.entity';
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
  ) {}

  async listAvailableRepositories(
    workspaceId: string,
    userId: string,
    setupSessionId: string,
  ): Promise<PublicGitHubRepository[]> {
    await this.workspacesService.assertOwner(
      workspaceId,
      userId,
    );

    const accessToken =
      await this.githubOAuthService.getSetupAccessToken(
        setupSessionId,
        workspaceId,
        userId,
      );

    return this.githubApiService.listAdminPublicRepositories(
      accessToken,
    );
  }


  async connectPublicRepository(
    workspaceId: string,
    userId: string,
    setupSessionId: string,
    githubRepositoryId: string,
  ): Promise<ConnectedRepositoryResponseDto> {
    // Verify Transcendence workspace ownership.
    await this.workspacesService.assertOwner(
      workspaceId,
      userId,
    );

    // Verify the temporary OAuth session belongs to
    // this workspace and Transcendence user.
    const accessToken =
      await this.githubOAuthService.getSetupAccessToken(
        setupSessionId,
        workspaceId,
        userId,
      );

    // Fetch current repository permissions from GitHub.
    // Never trust only the selected repository ID.
    const availableRepositories =
      await this.githubApiService.listAdminPublicRepositories(
        accessToken,
      );

    const selected = availableRepositories.find(
      (repository) =>
        repository.githubRepositoryId === githubRepositoryId,
    );

    if (!selected) {
      throw new ForbiddenException(
        'Repository is not public or GitHub admin permission is missing',
      );
    }

    // V1: allow one active repository per workspace.
    const activeConnection =
      await this.connectedRepositories.findOne({
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
    const previousConnection =
      await this.connectedRepositories.findOne({
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

    const saved = await this.connectedRepositories.save(
      connection,
    );

    // The OAuth setup session is no longer needed
    // after successful repository linking.
    this.githubOAuthService.deleteSetupSession(
      setupSessionId,
    );

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


  private async getConnectedRepositoryForMember(
    workspaceId: string,
    userId: string,
  ): Promise<ConnectedRepository> {
    // Members may read the repository's public data.
    await this.workspacesService.findOneForUser(
      workspaceId,
      userId,
    );

    const connection = await this.connectedRepositories.findOne({
      where: {
        workspaceId,
        disconnectedAt: IsNull(),
      },
    });

    if (!connection) {
      throw new NotFoundException(
        'No GitHub repository connected to this workspace',
      );
    }

    // Confirm that the GitHub repository still has
    // the identity originally connected to this workspace.
    const remote = await this.githubApiService.getPublicRepository(
      connection.ownerLogin,
      connection.name,
    );

    if (
      remote.githubRepositoryId !== connection.githubRepositoryId
    ) {
      throw new ConflictException(
        'Connected GitHub repository identity has changed',
      );
    }

    return connection;
  }

  async listWorkspaceBranches(
    workspaceId: string,
    userId: string,
  ): Promise<PublicGitHubBranch[]> {
    const repository = await this.getConnectedRepositoryForMember(
      workspaceId,
      userId,
    );

    return this.githubApiService.listBranches(
      repository.ownerLogin,
      repository.name,
    );
  }

  async listWorkspacePullRequests(
    workspaceId: string,
    userId: string,
  ): Promise<PublicGitHubPullRequest[]> {
    const repository = await this.getConnectedRepositoryForMember(
      workspaceId,
      userId,
    );

    return this.githubApiService.listOpenPullRequests(
      repository.ownerLogin,
      repository.name,
    );
  }

}
