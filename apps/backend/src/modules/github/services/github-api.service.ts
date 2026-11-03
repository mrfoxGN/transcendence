import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

export interface PublicGitHubRepository {
  githubRepositoryId: string;
  ownerLogin: string;
  name: string;
  fullName: string;
  repositoryUrl: string;
  defaultBranch: string;
}


export interface PublicGitHubCommit {
  sha: string;
  message: string;
  authorGithubUserId: string | null;
  authorName: string | null;
  committerName: string | null;
  committedAt: Date;
  githubUrl: string | null;
}


export interface PublicGitHubBranch {
  name: string;
  sha: string;
  protected: boolean;
}

export interface PublicGitHubPullRequest {
  number: number;
  title: string;
  githubUrl: string;
  authorLogin: string | null;
  sourceBranch: string;
  targetBranch: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class GitHubApiService {
  private readonly baseUrl = 'https://api.github.com';

  async getPublicRepository(
    owner: string,
    repo: string,
  ): Promise<PublicGitHubRepository> {
    const validOwner =
      /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(
        owner,
      );

    const validRepo =
      /^[a-zA-Z0-9_.-]{1,100}$/.test(repo) &&
      repo !== '.' &&
      repo !== '..';

    if (!validOwner || !validRepo) {
      throw new BadRequestException(
        'Invalid GitHub repository identifier',
      );
    }

    const url =
      `${this.baseUrl}/repos/` +
      `${encodeURIComponent(owner)}/` +
      `${encodeURIComponent(repo)}`;

    let response: Response;

    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Transcendence',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'GitHub API is unavailable',
      );
    }

    if (response.status === 404) {
      throw new NotFoundException(
        'GitHub repository not found',
      );
    }

    if (
      response.status === 403 ||
      response.status === 429
    ) {
      throw new ServiceUnavailableException(
        'GitHub API request temporarily unavailable',
      );
    }

    if (!response.ok) {
      throw new BadGatewayException(
        'GitHub API request failed',
      );
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new BadGatewayException(
        'Invalid response from GitHub API',
      );
    }

    if (!this.isRecord(payload)) {
      throw new BadGatewayException(
        'Invalid GitHub repository data',
      );
    }

    const repository = payload;

    if (
      typeof repository.id !== 'number' ||
      !Number.isSafeInteger(repository.id) ||
      typeof repository.name !== 'string' ||
      typeof repository.full_name !== 'string' ||
      typeof repository.html_url !== 'string' ||
      typeof repository.default_branch !== 'string' ||
      typeof repository.private !== 'boolean' ||
      typeof repository.visibility !== 'string' ||
      !this.isRecord(repository.owner) ||
      typeof repository.owner.login !== 'string'
    ) {
      throw new BadGatewayException(
        'Incomplete GitHub repository data',
      );
    }

    if (
      repository.private ||
      repository.visibility !== 'public'
    ) {
      throw new ForbiddenException(
        'Only public GitHub repositories are supported',
      );
    }

    return {
      githubRepositoryId: String(repository.id),
      ownerLogin: repository.owner.login,
      name: repository.name,
      fullName: repository.full_name,
      repositoryUrl: repository.html_url,
      defaultBranch: repository.default_branch,
    };
  }


  async listAdminPublicRepositories(
    accessToken: string,
  ): Promise<PublicGitHubRepository[]> {
    const repositories: PublicGitHubRepository[] = [];

    for (let page = 1; page <= 10; page++) {
      const url = new URL(`${this.baseUrl}/user/repos`);

      url.searchParams.set('visibility', 'public');
      url.searchParams.set(
        'affiliation',
        'owner,collaborator,organization_member',
      );
      url.searchParams.set('per_page', '100');
      url.searchParams.set('page', String(page));

      let response: Response;

      try {
        response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${accessToken}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'Transcendence',
          },
          redirect: 'error',
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        throw new ServiceUnavailableException(
          'GitHub API is unavailable',
        );
      }

      if (response.status === 401) {
        throw new UnauthorizedException(
          'GitHub authorization expired or invalid',
        );
      }

      if (
        response.status === 403 ||
        response.status === 429
      ) {
        throw new ServiceUnavailableException(
          'GitHub API temporarily unavailable',
        );
      }

      if (!response.ok) {
        throw new BadGatewayException(
          'Failed to retrieve GitHub repositories',
        );
      }

      let payload: unknown;

      try {
        payload = await response.json();
      } catch {
        throw new BadGatewayException(
          'Invalid GitHub API response',
        );
      }

      if (!Array.isArray(payload)) {
        throw new BadGatewayException(
          'Invalid GitHub repositories response',
        );
      }

      for (const item of payload) {
        if (
          !this.isRecord(item) ||
          !this.isRecord(item.owner) ||
          !this.isRecord(item.permissions)
        ) {
          continue;
        }

        // V1 only supports public repositories.
        if (
          item.private !== false ||
          item.visibility !== 'public'
        ) {
          continue;
        }

        // Only repositories the user can administer.
        if (item.permissions.admin !== true) {
          continue;
        }

        if (
          typeof item.id !== 'number' ||
          !Number.isSafeInteger(item.id) ||
          typeof item.name !== 'string' ||
          typeof item.full_name !== 'string' ||
          typeof item.html_url !== 'string' ||
          typeof item.default_branch !== 'string' ||
          typeof item.owner.login !== 'string'
        ) {
          continue;
        }

        repositories.push({
          githubRepositoryId: String(item.id),
          ownerLogin: item.owner.login,
          name: item.name,
          fullName: item.full_name,
          repositoryUrl: item.html_url,
          defaultBranch: item.default_branch,
        });
      }

      if (payload.length < 100) {
        break;
      }
    }

    return repositories;
  }


  async listRecentCommits(
    owner: string,
    repo: string,
  ): Promise<PublicGitHubCommit[]> {
    const url = new URL(
      `${this.baseUrl}/repos/` +
      `${encodeURIComponent(owner)}/` +
      `${encodeURIComponent(repo)}/commits`,
    );

    url.searchParams.set('per_page', '30');
    url.searchParams.set('page', '1');

    let response: Response;

    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Transcendence',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'GitHub API is unavailable',
      );
    }

    // GitHub returns 409 for repositories without Git history.
    if (response.status === 409) {
      return [];
    }

    if (response.status === 404) {
      throw new NotFoundException(
        'GitHub repository not found',
      );
    }

    if (
      response.status === 403 ||
      response.status === 429
    ) {
      throw new ServiceUnavailableException(
        'GitHub API temporarily unavailable',
      );
    }

    if (!response.ok) {
      throw new BadGatewayException(
        'Failed to retrieve GitHub commits',
      );
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new BadGatewayException(
        'Invalid GitHub commits response',
      );
    }

    if (!Array.isArray(payload)) {
      throw new BadGatewayException(
        'Invalid GitHub commits response',
      );
    }

    return payload.map((item: unknown): PublicGitHubCommit => {
      if (
        !this.isRecord(item) ||
        typeof item.sha !== 'string' ||
        !/^[a-f0-9]{40,64}$/i.test(item.sha) ||
        !this.isRecord(item.commit) ||
        typeof item.commit.message !== 'string'
      ) {
        throw new BadGatewayException(
          'Invalid GitHub commit data',
        );
      }

      const commit = item.commit;
      const message = commit.message;

      if (typeof message !== 'string') {
        throw new BadGatewayException(
          'Invalid GitHub commit message',
        );
      }

      const author = this.isRecord(commit.author)
        ? commit.author
        : null;

      const committer = this.isRecord(commit.committer)
        ? commit.committer
        : null;

      const dateString =
        typeof committer?.date === 'string'
          ? committer.date
          : typeof author?.date === 'string'
            ? author.date
            : null;

      if (!dateString) {
        throw new BadGatewayException(
          'GitHub commit is missing its date',
        );
      }

      const committedAt = new Date(dateString);

      if (Number.isNaN(committedAt.getTime())) {
        throw new BadGatewayException(
          'Invalid GitHub commit date',
        );
      }

      const githubAuthor = this.isRecord(item.author)
        ? item.author
        : null;

      return {
        sha: item.sha,
        message,
        authorGithubUserId:
          typeof githubAuthor?.id === 'number' &&
          Number.isSafeInteger(githubAuthor.id)
            ? String(githubAuthor.id)
            : null,
        authorName:
          typeof author?.name === 'string'
            ? author.name.slice(0, 255)
            : null,
        committerName:
          typeof committer?.name === 'string'
            ? committer.name.slice(0, 255)
            : null,
        committedAt,
        githubUrl:
          typeof item.html_url === 'string'
            ? item.html_url.slice(0, 1000)
            : null,
      };
    });
  }


  private async fetchPublicRepositoryItems(
    owner: string,
    repo: string,
    resource: 'branches' | 'pulls',
    parameters: Record<string, string> = {},
  ): Promise<unknown[]> {
    const items: unknown[] = [];

    for (let page = 1; page <= 3; page++) {
      const url = new URL(
        `${this.baseUrl}/repos/` +
        `${encodeURIComponent(owner)}/` +
        `${encodeURIComponent(repo)}/` +
        resource,
      );

      url.searchParams.set('per_page', '100');
      url.searchParams.set('page', String(page));

      for (const [key, value] of Object.entries(parameters)) {
        url.searchParams.set(key, value);
      }

      let response: Response;

      try {
        response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'Transcendence',
          },
          redirect: 'error',
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        throw new ServiceUnavailableException(
          'GitHub API is unavailable',
        );
      }

      if (response.status === 404) {
        throw new NotFoundException(
          'GitHub repository not found',
        );
      }

      if (
        response.status === 403 ||
        response.status === 429
      ) {
        throw new ServiceUnavailableException(
          'GitHub API rate limit or availability error',
        );
      }

      if (!response.ok) {
        throw new BadGatewayException(
          'GitHub repository request failed',
        );
      }

      let payload: unknown;

      try {
        payload = await response.json();
      } catch {
        throw new BadGatewayException(
          'Invalid GitHub API response',
        );
      }

      if (!Array.isArray(payload)) {
        throw new BadGatewayException(
          'Expected an array from GitHub',
        );
      }

      items.push(...payload);

      if (payload.length < 100) {
        break;
      }
    }

    return items;
  }

  async listBranches(
    owner: string,
    repo: string,
  ): Promise<PublicGitHubBranch[]> {
    const items = await this.fetchPublicRepositoryItems(
      owner,
      repo,
      'branches',
    );

    return items.map((item): PublicGitHubBranch => {
      if (!this.isRecord(item)) {
        throw new BadGatewayException(
          'Invalid GitHub branch response',
        );
      }

      const name = item.name;
      const protectedBranch = item.protected;
      const commit = item.commit;

      if (
        typeof name !== 'string' ||
        typeof protectedBranch !== 'boolean' ||
        !this.isRecord(commit)
      ) {
        throw new BadGatewayException(
          'Invalid GitHub branch data',
        );
      }

      const sha = commit.sha;

      if (
        typeof sha !== 'string' ||
        !/^[a-f0-9]{40,64}$/i.test(sha)
      ) {
        throw new BadGatewayException(
          'Invalid GitHub branch commit SHA',
        );
      }

      return {
        name,
        sha,
        protected: protectedBranch,
      };
    });
  }

  async listOpenPullRequests(
    owner: string,
    repo: string,
  ): Promise<PublicGitHubPullRequest[]> {
    const items = await this.fetchPublicRepositoryItems(
      owner,
      repo,
      'pulls',
      {
        state: 'open',
        sort: 'updated',
        direction: 'desc',
      },
    );

    return items.map((item): PublicGitHubPullRequest => {
      if (!this.isRecord(item)) {
        throw new BadGatewayException(
          'Invalid GitHub pull request response',
        );
      }

      const number = item.number;
      const title = item.title;
      const githubUrl = item.html_url;
      const head = item.head;
      const base = item.base;
      const user = item.user;
      const createdAt = item.created_at;
      const updatedAt = item.updated_at;

      if (
        typeof number !== 'number' ||
        !Number.isSafeInteger(number) ||
        number <= 0 ||
        typeof title !== 'string' ||
        typeof githubUrl !== 'string' ||
        !this.isRecord(head) ||
        !this.isRecord(base) ||
        typeof createdAt !== 'string' ||
        typeof updatedAt !== 'string'
      ) {
        throw new BadGatewayException(
          'Invalid GitHub pull request data',
        );
      }

      const sourceBranch = head.ref;
      const targetBranch = base.ref;

      if (
        typeof sourceBranch !== 'string' ||
        typeof targetBranch !== 'string'
      ) {
        throw new BadGatewayException(
          'Invalid pull request branches',
        );
      }

      const createdDate = new Date(createdAt);
      const updatedDate = new Date(updatedAt);

      if (
        Number.isNaN(createdDate.getTime()) ||
        Number.isNaN(updatedDate.getTime())
      ) {
        throw new BadGatewayException(
          'Invalid pull request timestamps',
        );
      }

      const authorLogin =
        this.isRecord(user) &&
        typeof user.login === 'string'
          ? user.login
          : null;

      return {
        number,
        title,
        githubUrl,
        authorLogin,
        sourceBranch,
        targetBranch,
        isDraft: item.draft === true,
        createdAt: createdDate.toISOString(),
        updatedAt: updatedDate.toISOString(),
      };
    });
  }

  private isRecord(
    value: unknown,
  ): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    );
  }
}
