import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ClipboardCopy,
  GitBranch,
  GitCommitHorizontal,
} from 'lucide-react';
import { useState } from 'react';

import './github-commits.css';

type Commit = {
  id: string;
  sha: string;
  message: string;
  authorGithubUserId: string | null;
  authorName: string | null;
  committedAt: string;
  githubUrl: string | null;
};

interface GithubCommitsProps {
  commits: Commit[];
  defaultBranch: string;
}

function getCommitType(message: string) {
  const value = message.trim().toLowerCase();

  if (/^merge\b/.test(value)) {
    return { label: 'Merge', type: 'merge' };
  }

  if (/^(fix|bugfix|hotfix)(\(|:|\s|!)/.test(value)) {
    return { label: 'Fix', type: 'fix' };
  }

  if (/^(docs?|documentation)(\(|:|\s|!)/.test(value)) {
    return { label: 'Docs', type: 'docs' };
  }

  if (/^(feat|feature)(\(|:|\s|!)/.test(value)) {
    return { label: 'Feature', type: 'feature' };
  }

  if (/^revert\b/.test(value)) {
    return { label: 'Revert', type: 'revert' };
  }

  return null;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(date);
}

export function GithubCommits({ commits, defaultBranch }: GithubCommitsProps) {
  const [copiedSha, setCopiedSha] = useState<string | null>(null);
  const [copyError, setCopyError] = useState('');

  const groups = new Map<string, Commit[]>();

  const sorted = [...commits].sort(
    (a, b) => new Date(b.committedAt).getTime() - new Date(a.committedAt).getTime(),
  );

  for (const commit of sorted) {
    const key = Number.isNaN(new Date(commit.committedAt).getTime())
      ? 'unknown'
      : new Date(commit.committedAt).toISOString().slice(0, 10);

    const existing = groups.get(key) ?? [];
    existing.push(commit);
    groups.set(key, existing);
  }

  async function copySha(sha: string) {
    try {
      await navigator.clipboard.writeText(sha);
      setCopiedSha(sha);
      setCopyError('');
    } catch {
      setCopyError('Unable to copy the commit SHA.');
      setCopiedSha(null);
    }
  }

  return (
    <section className="wu-gcommits">
      <header className="wu-gcommits__header">
        <div className="wu-gcommits__heading">
          <span className="wu-gcommits__heading-icon">
            <GitCommitHorizontal size={24} aria-hidden="true" />
          </span>

          <div>
            <h2>Commits</h2>
            <p>A chronological history of repository changes.</p>
          </div>
        </div>

        <div className="wu-gcommits__branch" title="Default branch history">
          <GitBranch size={17} aria-hidden="true" />
          <span>{defaultBranch}</span>
        </div>
      </header>

      {copyError && (
        <p className="wu-gcommits__error" role="alert">
          {copyError}
        </p>
      )}

      {!commits.length ? (
        <div className="wu-gcommits__empty">
          <GitCommitHorizontal size={30} aria-hidden="true" />
          <strong>No commits found</strong>
          <p>No commit history is available for this page.</p>
        </div>
      ) : (
        <div className="wu-gcommits__timeline">
          {[...groups.entries()].map(([day, dayCommits]) => (
            <section className="wu-gcommits__group" key={day}>
              <h3 className="wu-gcommits__date">
                <CalendarDays size={15} aria-hidden="true" />
                {formatDate(day)}
              </h3>

              <ol className="wu-gcommits__list">
                {dayCommits.map((commit) => {
                  const title = commit.message.split(/\r?\n/)[0]?.trim() || 'Untitled commit';

                  const commitType = getCommitType(title);
                  const author = commit.authorName || 'Unknown author';

                  return (
                    <li className="wu-gcommits__item" key={commit.id}>
                      <span className="wu-gcommits__timeline-dot" aria-hidden="true" />

                      <article className="wu-gcommits__card">
                        <div className="wu-gcommits__content">
                          <div className="wu-gcommits__title">
                            <GitCommitHorizontal size={16} aria-hidden="true" />

                            <strong title={title}>{title}</strong>
                          </div>

                          <div className="wu-gcommits__metadata">
                            <button
                              type="button"
                              className="wu-gcommits__sha"
                              onClick={() => void copySha(commit.sha)}
                              title="Copy full commit SHA"
                              aria-label={`Copy commit SHA ${commit.sha}`}
                            >
                              {commit.sha.slice(0, 7)}
                              {copiedSha === commit.sha ? (
                                <Check size={12} aria-hidden="true" />
                              ) : (
                                <ClipboardCopy size={12} aria-hidden="true" />
                              )}
                            </button>

                            <span className="wu-gcommits__separator">·</span>

                            <span className="wu-gcommits__author">
                              <span className="wu-gcommits__avatar" aria-hidden="true">
                                {commit.authorGithubUserId &&
                                /^[0-9]+$/.test(commit.authorGithubUserId) ? (
                                  <img
                                    src={`https://avatars.githubusercontent.com/u/${commit.authorGithubUserId}?v=4`}
                                    alt=""
                                    width={29}
                                    height={29}
                                    loading="lazy"
                                  />
                                ) : (
                                  author.charAt(0).toUpperCase()
                                )}
                              </span>

                              {author}
                            </span>
                          </div>
                        </div>

                        <div className="wu-gcommits__end">
                          {commitType && (
                            <span
                              className={
                                'wu-gcommits__tag ' + `wu-gcommits__tag--${commitType.type}`
                              }
                            >
                              {commitType.label}
                            </span>
                          )}

                          <time dateTime={commit.committedAt}>
                            {formatTime(commit.committedAt)}
                            <span className="wu-gcommits__timezone">UTC</span>
                          </time>

                          {commit.githubUrl && (
                            <a
                              className="wu-gcommits__external"
                              href={commit.githubUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View commit on GitHub"
                              aria-label={`View commit ${commit.sha.slice(0, 7)} on GitHub`}
                            >
                              <ArrowUpRight size={17} aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      {copiedSha && (
        <span className="wu-gcommits__sr-only" role="status">
          Commit SHA copied.
        </span>
      )}
    </section>
  );
}
