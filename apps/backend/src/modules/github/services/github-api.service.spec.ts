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
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(publicRepository), {
        status: 200,
      }),
    );

    const result = await service.getPublicRepository('octocat', 'Hello-World');

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
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 404 }));

    await expect(
      service.getPublicRepository('octocat', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('handles GitHub rate limiting', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 429 }));

    await expect(
      service.getPublicRepository('octocat', 'Hello-World'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('handles GitHub server errors', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 500 }));

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
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Connection failed'));

    await expect(
      service.getPublicRepository('octocat', 'Hello-World'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  describe('Commit pagination', () => {
    const endpoint = 'https://api.github.com/repos/octocat/Hello-World/commits';

    const since = new Date('2026-11-10T00:00:00Z');

    const makeCommit = (letter: string) => ({
      sha: letter.repeat(40),
      html_url:
        'https://github.com/octocat/Hello-World/commit/' + letter.repeat(40),
      commit: {
        message: 'Test commit',
        author: {
          name: 'Developer',
          date: '2026-11-15T12:00:00Z',
        },
        committer: {
          name: 'Developer',
          date: '2026-11-15T12:00:00Z',
        },
      },
      author: { id: 123 },
    });

    const first = makeCommit('a');
    const second = makeCommit('b');

    const nextPage = endpoint + '?per_page=100&page=2';

    it('preserves the original 30-commit behavior', async () => {
      const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify([first]), {
          status: 200,
          headers: {
            link: '<' + nextPage + '>; rel="next"',
          },
        }),
      );

      const result = await service.listRecentCommits(
        'octocat',
        'Hello-World',
        'test-token',
      );

      expect(result).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      expect(fetchMock).toHaveBeenCalledWith(
        endpoint + '?per_page=30&page=1',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('retrieves multiple pages and removes duplicate commits', async () => {
      const fetchMock = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify([first]), {
            status: 200,
            headers: {
              link: '<' + nextPage + '>; rel="next"',
            },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify([first, second]), {
            status: 200,
          }),
        );

      const result = await service.listRecentCommits(
        'octocat',
        'Hello-World',
        'test-token',
        since,
      );

      expect(result.map((commit) => commit.sha)).toEqual([
        first.sha,
        second.sha,
      ]);

      expect(fetchMock).toHaveBeenCalledTimes(2);

      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        endpoint +
          '?per_page=100&page=1&since=' +
          encodeURIComponent(since.toISOString()),
        expect.objectContaining({ method: 'GET' }),
      );

      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        nextPage,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('rejects unsafe external pagination URLs', async () => {
      const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify([first]), {
          status: 200,
          headers: {
            link: '<https://example.com/commits>; rel="next"',
          },
        }),
      );

      await expect(
        service.listRecentCommits(
          'octocat',
          'Hello-World',
          'test-token',
          since,
        ),
      ).rejects.toBeInstanceOf(BadGatewayException);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('rejects partial results when a subsequent page fails', async () => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify([first]), {
            status: 200,
            headers: {
              link: '<' + nextPage + '>; rel="next"',
            },
          }),
        )
        .mockResolvedValueOnce(new Response('{}', { status: 500 }));

      await expect(
        service.listRecentCommits(
          'octocat',
          'Hello-World',
          'test-token',
          since,
        ),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('handles empty repositories', async () => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('{}', { status: 409 }));

      await expect(
        service.listRecentCommits(
          'octocat',
          'Hello-World',
          'test-token',
          since,
        ),
      ).resolves.toEqual([]);
    });

    it('rejects invalid commit responses', async () => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('{}', { status: 200 }));

      await expect(
        service.listRecentCommits(
          'octocat',
          'Hello-World',
          'test-token',
          since,
        ),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });
  });
});
