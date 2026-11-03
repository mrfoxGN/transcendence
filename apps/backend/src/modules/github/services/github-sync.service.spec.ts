import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

jest.mock('../../workspaces/services/workspaces.service', () => ({
  WorkspacesService: class WorkspacesService {},
}));

import { GitHubSyncService } from './github-sync.service';

describe('GitHubSyncService', () => {
  let service: GitHubSyncService;

  const workspaceId = 'faf3d45e-e8d4-4acc-ac2d-b7e09a9a4f4a';
  const userId = '81a76e27-c57a-4607-8ee8-e7f531b81d8a';
  const repositoryId = '43181083-7955-41bf-bac8-425ac2f80ac2';

  const localRepository = {
    id: repositoryId,
    workspaceId,
    githubRepositoryId: '1376091667',
    ownerLogin: 'mrfoxGN',
    name: 'transcendence',
    fullName: 'mrfoxGN/transcendence',
    disconnectedAt: null,
  };

  const remoteRepository = {
    githubRepositoryId: '1376091667',
    ownerLogin: 'mrfoxGN',
    name: 'transcendence',
    fullName: 'mrfoxGN/transcendence',
    repositoryUrl: 'https://github.com/mrfoxGN/transcendence',
    defaultBranch: 'main',
  };

  const commit = {
    sha: 'a'.repeat(40),
    message: 'feat: initial synchronization',
    authorGithubUserId: '179035905',
    authorName: 'Anass',
    committerName: 'Anass',
    committedAt: new Date('2026-11-01T12:00:00Z'),
    githubUrl: 'https://github.com/mrfoxGN/transcendence/commit/' +
      'a'.repeat(40),
  };

  const workspacesService = {
    assertOwner: jest.fn(),
  };

  const githubApiService = {
    getPublicRepository: jest.fn(),
    listRecentCommits: jest.fn(),
  };

  const databaseRepository = {
    findOne: jest.fn(),
  };

  const transactionRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const queryBuilder = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };

  const manager = {
    getRepository: jest.fn(),
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
  };

  const dataSource = {
    getRepository: jest.fn(),
    transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    workspacesService.assertOwner.mockResolvedValue(undefined);

    githubApiService.getPublicRepository.mockResolvedValue({
      ...remoteRepository,
    });

    githubApiService.listRecentCommits.mockResolvedValue([
      commit,
    ]);

    databaseRepository.findOne.mockResolvedValue({
      ...localRepository,
    });

    transactionRepository.findOne.mockResolvedValue({
      ...localRepository,
    });

    transactionRepository.save.mockImplementation(
      async (value: object) => value,
    );

    queryBuilder.insert.mockReturnValue(queryBuilder);
    queryBuilder.into.mockReturnValue(queryBuilder);
    queryBuilder.values.mockReturnValue(queryBuilder);
    queryBuilder.orIgnore.mockReturnValue(queryBuilder);

    queryBuilder.execute.mockResolvedValue({});

    manager.getRepository.mockReturnValue(
      transactionRepository,
    );

    manager.createQueryBuilder.mockReturnValue(
      queryBuilder,
    );

    manager.count.mockResolvedValue(1);

    dataSource.getRepository.mockReturnValue(
      databaseRepository,
    );

    dataSource.transaction.mockImplementation(
      async (
        callback: (manager: typeof manager) => Promise<unknown>,
      ) => callback(manager),
    );

    service = new GitHubSyncService(
      dataSource as never,
      workspacesService as never,
      githubApiService as never,
    );
  });

  const sync = () =>
    service.syncRepository(workspaceId, userId);

  it('synchronizes recent commits successfully', async () => {
    const result = await sync();

    expect(result.repositoryId).toBe(repositoryId);
    expect(result.fullName).toBe('mrfoxGN/transcendence');
    expect(result.fetchedCommits).toBe(1);
    expect(result.storedCommits).toBe(1);
    expect(result.lastSyncedAt).toBeInstanceOf(Date);
  });

  it('verifies workspace ownership', async () => {
    await sync();

    expect(
      workspacesService.assertOwner,
    ).toHaveBeenCalledWith(workspaceId, userId);
  });

  it('rejects unauthorized users', async () => {
    workspacesService.assertOwner.mockRejectedValueOnce(
      new ForbiddenException(),
    );

    await expect(sync()).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(
      githubApiService.listRecentCommits,
    ).not.toHaveBeenCalled();
  });

  it('rejects workspaces without a connected repository', async () => {
    databaseRepository.findOne.mockResolvedValueOnce(null);

    await expect(sync()).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects GitHub repository identity changes', async () => {
    githubApiService.getPublicRepository.mockResolvedValueOnce({
      ...remoteRepository,
      githubRepositoryId: '999999999',
    });

    await expect(sync()).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('uses idempotent commit insertion', async () => {
    await sync();

    expect(queryBuilder.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          repositoryId,
          sha: commit.sha,
          message: commit.message,
          matchedUserId: null,
        }),
      ]),
    );

    expect(queryBuilder.orIgnore).toHaveBeenCalledTimes(1);
    expect(queryBuilder.execute).toHaveBeenCalledTimes(1);
  });

  it('handles repositories without commits', async () => {
    githubApiService.listRecentCommits.mockResolvedValueOnce([]);

    manager.count.mockResolvedValueOnce(0);

    const result = await sync();

    expect(result.fetchedCommits).toBe(0);
    expect(result.storedCommits).toBe(0);

    expect(
      manager.createQueryBuilder,
    ).not.toHaveBeenCalled();

    expect(transactionRepository.save).toHaveBeenCalled();
  });

  it('rejects repositories disconnected during synchronization', async () => {
    transactionRepository.findOne.mockResolvedValueOnce(null);

    await expect(sync()).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('does not persist data when GitHub fails', async () => {
    githubApiService.listRecentCommits.mockRejectedValueOnce(
      new Error('GitHub unavailable'),
    );

    await expect(sync()).rejects.toThrow(
      'GitHub unavailable',
    );

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('propagates database insertion failures', async () => {
    queryBuilder.execute.mockRejectedValueOnce(
      new Error('Database insertion failed'),
    );

    await expect(sync()).rejects.toThrow(
      'Database insertion failed',
    );

    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('updates repository metadata and sync timestamp', async () => {
    await sync();

    expect(transactionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: remoteRepository.fullName,
        defaultBranch: remoteRepository.defaultBranch,
        lastSyncedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );
  });
});
