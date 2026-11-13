import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

jest.mock('../../workspaces/services/workspaces.service', () => ({
  WorkspacesService: class WorkspacesService {},
}));

jest.mock('./github-oauth.service', () => ({
  GitHubOAuthService: class GitHubOAuthService {},
}));

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

import { GitHubService } from './github.service';
import { RepositoryVisibility } from '../../../database/enums/database.enums';

describe('GitHubService - Repository and Commits Read', () => {
  let service: GitHubService;

  const workspaceId = 'faf3d45e-e8d4-4acc-ac2d-b7e09a9a4f4a';
  const userId = '81a76e27-c57a-4607-8ee8-e7f531b81d8a';
  const repositoryId = '43181083-7955-41bf-bac8-425ac2f80ac2';

  const repository = {
    id: repositoryId,
    workspaceId,
    githubRepositoryId: '1376091667',
    fullName: 'mrfoxGN/transcendence',
    repositoryUrl: 'https://github.com/mrfoxGN/transcendence',
    defaultBranch: 'main',
    visibility: RepositoryVisibility.PUBLIC,
    createdAt: new Date('2026-11-01T10:00:00Z'),
    lastSyncedAt: new Date('2026-11-04T10:00:00Z'),
  };

  const commit = {
    id: 'commit-1',
    sha: 'a'.repeat(40),
    message: 'feat: add GitHub integration',
    authorName: 'Anass',
    committerName: 'Anass',
    committedAt: new Date('2026-11-04T12:00:00Z'),
    githubUrl: 'https://github.com/example/repo/commit/' + 'a'.repeat(40),
  };

  const workspacesService = {
    findOneForUser: jest.fn(),
  };

  const githubApiService = {
    getPublicRepository: jest.fn(),
    listRecentCommits: jest.fn(),
  };

  const connectedRepositories = {
    findOne: jest.fn(),
  };

  const repositoryCommits = {
    findAndCount: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    workspacesService.findOneForUser.mockResolvedValue(undefined);
    connectedRepositories.findOne.mockResolvedValue(repository);
    repositoryCommits.findAndCount.mockResolvedValue([[commit], 1]);

    service = new GitHubService(
      workspacesService as never,
      githubApiService as never,
      {} as never,
      {} as never,
      connectedRepositories as never,
      repositoryCommits as never,
      {} as never,
    );
  });

  it('returns connected repository information from MySQL', async () => {
    const result = await service.getWorkspaceRepository(workspaceId, userId);

    expect(result?.id).toBe(repositoryId);
    expect(result?.fullName).toBe(repository.fullName);
    expect(result?.lastSyncedAt).toEqual(repository.lastSyncedAt);

    expect(workspacesService.findOneForUser).toHaveBeenCalledWith(
      workspaceId,
      userId,
    );

    expect(githubApiService.getPublicRepository).not.toHaveBeenCalled();
  });

  it('rejects unauthorized repository access', async () => {
    workspacesService.findOneForUser.mockRejectedValueOnce(
      new ForbiddenException(),
    );

    await expect(
      service.getWorkspaceRepository(workspaceId, userId),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(connectedRepositories.findOne).not.toHaveBeenCalled();
  });

  it('returns no connection when no repository is connected', async () => {
    connectedRepositories.findOne.mockResolvedValueOnce(null);

    await expect(
      service.getWorkspaceRepository(workspaceId, userId),
    ).resolves.toBeNull();
  });

  it('retrieves stored commits from MySQL', async () => {
    const result = await service.listWorkspaceCommits(workspaceId, userId);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].sha).toBe(commit.sha);
    expect(result.total).toBe(1);

    expect(githubApiService.listRecentCommits).not.toHaveBeenCalled();
  });

  it('uses default pagination and newest-first sorting', async () => {
    await service.listWorkspaceCommits(workspaceId, userId);

    expect(repositoryCommits.findAndCount).toHaveBeenCalledWith({
      where: { repositoryId },
      order: {
        committedAt: 'DESC',
        sha: 'DESC',
      },
      skip: 0,
      take: 20,
    });
  });

  it('calculates pagination correctly', async () => {
    repositoryCommits.findAndCount.mockResolvedValueOnce([[commit], 25]);

    const result = await service.listWorkspaceCommits(
      workspaceId,
      userId,
      2,
      10,
    );

    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(3);

    expect(repositoryCommits.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      }),
    );
  });

  it('rejects invalid pagination', async () => {
    for (const [page, limit] of [
      [0, 20],
      [1, 0],
      [1, 101],
      [Number.NaN, 20],
      [1.5, 20],
    ]) {
      await expect(
        service.listWorkspaceCommits(workspaceId, userId, page, limit),
      ).rejects.toBeInstanceOf(BadRequestException);
    }

    expect(repositoryCommits.findAndCount).not.toHaveBeenCalled();
  });

  it('rejects unauthorized commit access', async () => {
    workspacesService.findOneForUser.mockRejectedValueOnce(
      new ForbiddenException(),
    );

    await expect(
      service.listWorkspaceCommits(workspaceId, userId),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(repositoryCommits.findAndCount).not.toHaveBeenCalled();
  });

  it('returns 404 for commits without a connected repository', async () => {
    connectedRepositories.findOne.mockResolvedValueOnce(null);

    await expect(
      service.listWorkspaceCommits(workspaceId, userId),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repositoryCommits.findAndCount).not.toHaveBeenCalled();
  });
});
