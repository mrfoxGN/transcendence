import { ConflictException, ForbiddenException } from '@nestjs/common';

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

describe('GitHubService - Repository Connection', () => {
  let service: GitHubService;

  const workspaceId = 'faf3d45e-e8d4-4acc-ac2d-b7e09a9a4f4a';
  const userId = '81a76e27-c57a-4607-8ee8-e7f531b81d8a';
  const setupSessionId = 'test-setup-session';

  const selectedRepository = {
    githubRepositoryId: '1376091667',
    ownerLogin: 'mrfoxGN',
    name: 'transcendence',
    fullName: 'mrfoxGN/transcendence',
    repositoryUrl: 'https://github.com/mrfoxGN/transcendence',
    defaultBranch: 'main',
  };

  const workspacesService = {
    assertOwner: jest.fn(),
  };

  const githubApiService = {
    listAdminPublicRepositories: jest.fn(),
  };

  const githubOAuthService = {
    getSetupAccessToken: jest.fn(),
    deleteSetupSession: jest.fn(),
  };

  const connectedRepositories = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    workspacesService.assertOwner.mockResolvedValue(undefined);

    githubOAuthService.getSetupAccessToken.mockResolvedValue(
      'test-github-token',
    );

    githubApiService.listAdminPublicRepositories.mockResolvedValue([
      selectedRepository,
    ]);

    connectedRepositories.findOne.mockResolvedValue(null);
    connectedRepositories.create.mockImplementation((data: object) => data);
    connectedRepositories.save.mockImplementation((data: object) =>
      Promise.resolve(data),
    );

    service = new GitHubService(
      workspacesService as never,
      githubApiService as never,
      githubOAuthService as never,
      {} as never,
      connectedRepositories as never,
      {} as never,
      { encrypt: jest.fn().mockReturnValue('encrypted-test-token') } as never,
    );
  });

  const connect = () =>
    service.connectPublicRepository(
      workspaceId,
      userId,
      setupSessionId,
      selectedRepository.githubRepositoryId,
    );

  it('connects a verified public repository', async () => {
    const result = await connect();

    expect(result.githubRepositoryId).toBe('1376091667');
    expect(result.fullName).toBe('mrfoxGN/transcendence');
    expect(result.visibility).toBe(RepositoryVisibility.PUBLIC);
    expect(connectedRepositories.save).toHaveBeenCalledTimes(1);
  });

  it('verifies workspace ownership', async () => {
    await connect();

    expect(workspacesService.assertOwner).toHaveBeenCalledWith(
      workspaceId,
      userId,
      true,
    );
  });

  it('rejects non-workspace owners', async () => {
    workspacesService.assertOwner.mockRejectedValueOnce(
      new ForbiddenException(),
    );

    await expect(connect()).rejects.toBeInstanceOf(ForbiddenException);
    expect(connectedRepositories.save).not.toHaveBeenCalled();
  });

  it('rejects invalid OAuth setup sessions', async () => {
    githubOAuthService.getSetupAccessToken.mockRejectedValueOnce(
      new ForbiddenException(),
    );

    await expect(connect()).rejects.toBeInstanceOf(ForbiddenException);
    expect(connectedRepositories.save).not.toHaveBeenCalled();
  });

  it('rejects repositories without admin permission', async () => {
    githubApiService.listAdminPublicRepositories.mockResolvedValueOnce([]);

    await expect(connect()).rejects.toBeInstanceOf(ForbiddenException);
    expect(connectedRepositories.save).not.toHaveBeenCalled();
  });

  it('rejects duplicate active connections', async () => {
    connectedRepositories.findOne.mockResolvedValueOnce({
      id: 'existing-repository',
    });

    await expect(connect()).rejects.toBeInstanceOf(ConflictException);
    expect(connectedRepositories.save).not.toHaveBeenCalled();
  });

  it('rejects previously disconnected repositories', async () => {
    connectedRepositories.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'previous-repository',
        disconnectedAt: new Date(),
      });

    await expect(connect()).rejects.toBeInstanceOf(ConflictException);
    expect(connectedRepositories.save).not.toHaveBeenCalled();
  });

  it('stores correct repository metadata', async () => {
    await connect();

    expect(connectedRepositories.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        connectedById: userId,
        githubRepositoryId: '1376091667',
        ownerLogin: 'mrfoxGN',
        fullName: 'mrfoxGN/transcendence',
        defaultBranch: 'main',
        visibility: RepositoryVisibility.PUBLIC,
        installationId: null,
        disconnectedAt: null,
        lastSyncedAt: null,
      }),
    );
  });

  it('deletes the setup session after successful connection', async () => {
    await connect();

    expect(githubOAuthService.deleteSetupSession).toHaveBeenCalledWith(
      setupSessionId,
    );
  });

  it('preserves the setup session if database insertion fails', async () => {
    connectedRepositories.save.mockRejectedValueOnce(
      new Error('Database unavailable'),
    );

    await expect(connect()).rejects.toThrow('Database unavailable');
    expect(githubOAuthService.deleteSetupSession).not.toHaveBeenCalled();
  });

  it('does not save a repository when GitHub fails', async () => {
    githubApiService.listAdminPublicRepositories.mockRejectedValueOnce(
      new Error('GitHub unavailable'),
    );

    await expect(connect()).rejects.toThrow('GitHub unavailable');
    expect(connectedRepositories.save).not.toHaveBeenCalled();
  });
});
