import { BadRequestException } from '@nestjs/common';
import { IsNull } from 'typeorm';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { GitHubWebhookRoutingService } from './github-webhook-routing.service';

describe('GitHubWebhookRoutingService', () => {
  const githubRepositoryId = 1376091667;

  const payload = {
    repository: {
      id: githubRepositoryId,
      full_name: 'mrfoxGN/transcendence',
    },
  };

  const connectionA = {
    id: 'repository-connection-a',
    workspaceId: 'workspace-a',
    githubRepositoryId: String(githubRepositoryId),
    fullName: 'mrfoxGN/transcendence',
  };

  const connectionB = {
    id: 'repository-connection-b',
    workspaceId: 'workspace-b',
    githubRepositoryId: String(githubRepositoryId),
    fullName: 'mrfoxGN/transcendence',
  };

  const repository = {
    find: jest.fn(),
  };

  let service: GitHubWebhookRoutingService;

  beforeEach(() => {
    jest.resetAllMocks();

    repository.find.mockResolvedValue([]);

    service = new GitHubWebhookRoutingService(
      repository as never,
    );
  });

  it('resolves a connected workspace', async () => {
    repository.find.mockResolvedValueOnce([
      connectionA,
    ]);

    const result = await service.resolveTargets(payload);

    expect(result).toHaveLength(1);

    expect(result[0]).toEqual({
      repositoryId: connectionA.id,
      workspaceId: connectionA.workspaceId,
      githubRepositoryId: String(githubRepositoryId),
      fullName: 'mrfoxGN/transcendence',
    });
  });

  it('resolves multiple workspaces for one repository', async () => {
    repository.find.mockResolvedValueOnce([
      connectionA,
      connectionB,
    ]);

    const result = await service.resolveTargets(payload);

    expect(result).toHaveLength(2);

    expect(result.map((target) => target.workspaceId)).toEqual([
      'workspace-a',
      'workspace-b',
    ]);
  });

  it('queries only active repository connections', async () => {
    await service.resolveTargets(payload);

    expect(repository.find).toHaveBeenCalledWith({
      where: {
        githubRepositoryId: String(githubRepositoryId),
        disconnectedAt: IsNull(),
      },
    });
  });

  it('returns an empty list for an unconnected repository', async () => {
    const result = await service.resolveTargets(payload);

    expect(result).toEqual([]);
  });

  it.each([
    null,
    {},
    { repository: null },
    { repository: {} },
    { repository: { id: '1376091667' } },
    { repository: { id: -1 } },
    { repository: { id: 1.5 } },
  ])('rejects an invalid repository payload: %p', async (invalid) => {
    await expect(
      service.resolveTargets(invalid),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.find).not.toHaveBeenCalled();
  });

  it('propagates database failures', async () => {
    repository.find.mockRejectedValueOnce(
      new Error('Database unavailable'),
    );

    await expect(
      service.resolveTargets(payload),
    ).rejects.toThrow('Database unavailable');
  });
});
