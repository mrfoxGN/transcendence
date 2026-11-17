import {
  BadRequestException,
  ConflictException,
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
    ownerLogin: 'mrfoxGN',
    name: 'transcendence',
    encryptedOAuthToken: 'encrypted-token',
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
    assertOwner: jest.fn(),
  };

  const githubApiService = {
    getPublicRepository: jest.fn(),
    listRecentCommits: jest.fn(),
    listContributors: jest.fn(),
    listCollaborators: jest.fn(),
  };

  const connectedRepositories = {
    findOne: jest.fn(),
  };

  const repositoryCommits = {
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const githubTokenCryptoService = {
    decrypt: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    workspacesService.assertOwner.mockResolvedValue(undefined);
    githubTokenCryptoService.decrypt.mockReturnValue('github-token');
    githubApiService.getPublicRepository.mockResolvedValue(repository);

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
      githubTokenCryptoService as never,
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

  it('allows members to retrieve contributors', async () => {
    const contributors = [{ login: 'developer', contributions: 12 }];
    githubApiService.listContributors.mockResolvedValue(contributors);

    await expect(
      service.listWorkspaceContributors(workspaceId, userId),
    ).resolves.toEqual(contributors);

    expect(workspacesService.findOneForUser).toHaveBeenCalledWith(
      workspaceId,
      userId,
    );

    expect(githubApiService.listContributors).toHaveBeenCalledWith(
      'mrfoxGN',
      'transcendence',
      'github-token',
    );
  });

  it('rejects unauthorized contributor access', async () => {
    workspacesService.findOneForUser.mockRejectedValueOnce(
      new ForbiddenException(),
    );

    await expect(
      service.listWorkspaceContributors(workspaceId, userId),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(githubApiService.listContributors).not.toHaveBeenCalled();
  });

  it('rejects contributors without a connected repository', async () => {
    connectedRepositories.findOne.mockResolvedValueOnce(null);

    await expect(
      service.listWorkspaceContributors(workspaceId, userId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects missing OAuth authorization', async () => {
    connectedRepositories.findOne.mockResolvedValueOnce({
      ...repository,
      encryptedOAuthToken: null,
    });

    await expect(
      service.listWorkspaceContributors(workspaceId, userId),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(githubApiService.listContributors).not.toHaveBeenCalled();
  });

  it('rejects a changed repository identity', async () => {
    githubApiService.getPublicRepository.mockResolvedValueOnce({
      githubRepositoryId: 'different-id',
    });

    await expect(
      service.listWorkspaceContributors(workspaceId, userId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('propagates contributor API errors', async () => {
    githubApiService.listContributors.mockRejectedValueOnce(
      new Error('GitHub unavailable'),
    );

    await expect(
      service.listWorkspaceContributors(workspaceId, userId),
    ).rejects.toThrow('GitHub unavailable');
  });

  it('allows workspace owners to retrieve collaborators', async () => {
    const collaborators = [{ login: 'developer', role: 'write' }];
    githubApiService.listCollaborators.mockResolvedValue(collaborators);

    await expect(
      service.listWorkspaceCollaborators(workspaceId, userId),
    ).resolves.toEqual(collaborators);

    expect(workspacesService.assertOwner).toHaveBeenCalledWith(
      workspaceId,
      userId,
    );

    expect(githubApiService.listCollaborators).toHaveBeenCalledWith(
      'mrfoxGN',
      'transcendence',
      'github-token',
    );
  });

  it('rejects collaborator access by non-owners', async () => {
    workspacesService.assertOwner.mockRejectedValueOnce(
      new ForbiddenException(),
    );

    await expect(
      service.listWorkspaceCollaborators(workspaceId, userId),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(githubApiService.listCollaborators).not.toHaveBeenCalled();
  });

  it('calculates seven-day commit statistics including empty days', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-16T12:00:00Z'));

    try {
      const query = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { day: '2026-11-10', count: '3' },
          { day: '2026-11-16', count: '5' },
        ]),
      };

      repositoryCommits.createQueryBuilder.mockReturnValue(query);

      const result = await service.getDailyCommitStatistics(
        workspaceId,
        userId,
      );

      expect(result.days).toBe(7);
      expect(result.timezone).toBe('UTC');
      expect(result.total).toBe(8);

      expect(result.items.map((item) => item.commits)).toEqual([
        3, 0, 0, 0, 0, 0, 5,
      ]);

      expect(result.items[0].date).toBe('2026-11-10');
      expect(result.items[6].date).toBe('2026-11-16');

      expect(query.where).toHaveBeenCalledWith(
        'commit.repositoryId = :repositoryId',
        { repositoryId },
      );

      expect(query.andWhere).toHaveBeenCalledWith(
        'commit.committedAt >= :start',
        { start: new Date('2026-11-10T00:00:00Z') },
      );

      expect(query.andWhere).toHaveBeenCalledWith('commit.committedAt < :end', {
        end: new Date('2026-11-17T00:00:00Z'),
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects unauthorized commit statistics access', async () => {
    workspacesService.findOneForUser.mockRejectedValueOnce(
      new ForbiddenException(),
    );

    await expect(
      service.getDailyCommitStatistics(workspaceId, userId),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(repositoryCommits.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('rejects statistics without a connected repository', async () => {
    connectedRepositories.findOne.mockResolvedValueOnce(null);

    await expect(
      service.getDailyCommitStatistics(workspaceId, userId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
