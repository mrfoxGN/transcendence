import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { GitHubApiService } from './github-api.service';

describe('GitHubApiService', () => {
  let service: GitHubApiService;

  const publicRepository = {
    id: 123456,
    name: 'Hello-World',
    full_name: 'octocat/Hello-World',
    html_url: 'https://github.com/octocat/Hello-World',
    default_branch: 'main',
    private: false,
    visibility: 'public',
    owner: {
      login: 'octocat',
    },
  };

  beforeEach(() => {
    service = new GitHubApiService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retrieves and maps a public repository', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify(publicRepository), {
          status: 200,
        }),
      );

    const result = await service.getPublicRepository(
      'octocat',
      'Hello-World',
    );

    expect(result).toEqual({
      githubRepositoryId: '123456',
      ownerLogin: 'octocat',
      name: 'Hello-World',
      fullName: 'octocat/Hello-World',
      repositoryUrl: 'https://github.com/octocat/Hello-World',
      defaultBranch: 'main',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/octocat/Hello-World',
      expect.objectContaining({
        method: 'GET',
        redirect: 'error',
      }),
    );
  });

  it('rejects invalid repository identifiers', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');

    await expect(
      service.getPublicRepository('bad/owner', 'repo'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects private repositories', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ...publicRepository,
          private: true,
          visibility: 'private',
        }),
        { status: 200 },
      ),
    );

    await expect(
      service.getPublicRepository('octocat', 'Hello-World'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('handles repositories that do not exist', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 404 }),
    );

    await expect(
      service.getPublicRepository('octocat', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('handles GitHub rate limiting', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 429 }),
    );

    await expect(
      service.getPublicRepository('octocat', 'Hello-World'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('handles GitHub server errors', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 500 }),
    );

    await expect(
      service.getPublicRepository('octocat', 'Hello-World'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('rejects incomplete repository data', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 123 }), {
        status: 200,
      }),
    );

    await expect(
      service.getPublicRepository('octocat', 'Hello-World'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('handles GitHub connection failures', async () => {
    jest.spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Connection failed'));

    await expect(
      service.getPublicRepository('octocat', 'Hello-World'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
