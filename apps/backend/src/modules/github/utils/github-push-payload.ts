import { BadRequestException } from '@nestjs/common';

export interface GitHubPushCommit {
  sha: string;
  message: string;
  authorName: string | null;
  committerName: string | null;
  committedAt: Date;
  githubUrl: string | null;
}

export interface ParsedGitHubPush {
  githubRepositoryId: string;
  ref: string;
  branch: string | null;
  deleted: boolean;
  commits: GitHubPushCommit[];
}

function asRecord(
  value: unknown,
): Record<string, unknown> | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function parseGitHubPushPayload(
  payload: unknown,
): ParsedGitHubPush {
  const data = asRecord(payload);
  const repository = asRecord(data?.repository);

  if (
    !repository ||
    typeof repository.id !== 'number' ||
    !Number.isSafeInteger(repository.id) ||
    repository.id <= 0
  ) {
    throw new BadRequestException(
      'Invalid GitHub repository ID',
    );
  }

  const ref = data?.ref;

  if (
    typeof ref !== 'string' ||
    !(
      (ref.startsWith('refs/heads/') && ref.length > 11) ||
      (ref.startsWith('refs/tags/') && ref.length > 10)
    )
  ) {
    throw new BadRequestException(
      'Invalid GitHub push ref',
    );
  }

  if (typeof data?.deleted !== 'boolean') {
    throw new BadRequestException(
      'Invalid GitHub push deletion flag',
    );
  }

  const rawCommits = data.commits;

  if (
    !Array.isArray(rawCommits) ||
    rawCommits.length > 2048
  ) {
    throw new BadRequestException(
      'Invalid GitHub commits array',
    );
  }

  const recentCommits = rawCommits.slice(-30);

  const commits = recentCommits.map(
    (value: unknown): GitHubPushCommit => {
      const item = asRecord(value);

      if (!item) {
        throw new BadRequestException(
          'Invalid GitHub commit',
        );
      }

      const sha = item.id;
      const message = item.message;
      const timestamp = item.timestamp;

      if (
        typeof sha !== 'string' ||
        !/^[a-f0-9]{40,64}$/i.test(sha) ||
        typeof message !== 'string' ||
        typeof timestamp !== 'string'
      ) {
        throw new BadRequestException(
          'Invalid GitHub commit fields',
        );
      }

      const committedAt = new Date(timestamp);

      if (Number.isNaN(committedAt.getTime())) {
        throw new BadRequestException(
          'Invalid GitHub commit timestamp',
        );
      }

      const author = asRecord(item.author);
      const committer = asRecord(item.committer);

      return {
        sha,
        message,
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
          typeof item.url === 'string'
            ? item.url.slice(0, 1000)
            : null,
      };
    },
  );

  const branch = ref.startsWith('refs/heads/')
    ? ref.slice('refs/heads/'.length)
    : null;

  return {
    githubRepositoryId: String(repository.id),
    ref,
    branch,
    deleted: data.deleted,
    commits,
  };
}
