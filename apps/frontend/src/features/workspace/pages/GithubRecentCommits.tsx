import {
  ArrowRight,
  Bug,
  GitCommitHorizontal,
  GitMerge,
  Plus,
  Wrench,
} from 'lucide-react';

import './github-recent-commits.css';

interface Commit {
  id: string;
  sha: string;
  message: string;
  authorName: string | null;
  committedAt: string;
  githubUrl: string | null;
}

interface GithubRecentCommitsProps {
  commits?: Commit[];
  onViewAll: () => void;
}

function getCommitType(message: string) {
  if (/^merge\b/i.test(message)) return 'merge';
  if (/^feat(?:\([^)]+\))?!?:/i.test(message)) return 'feature';
  if (/^fix(?:\([^)]+\))?!?:/i.test(message)) return 'fix';
  if (/^refactor(?:\([^)]+\))?!?:/i.test(message)) return 'refactor';

  return 'commit';
}

const commitIcons = {
  merge: GitMerge,
  feature: Plus,
  fix: Bug,
  refactor: Wrench,
  commit: GitCommitHorizontal,
};

const commitLabels = {
  merge: 'merge',
  feature: 'feat',
  fix: 'fix',
  refactor: 'refactor',
  commit: 'commit',
};

export function GithubRecentCommits({
  commits,
  onViewAll,
}: GithubRecentCommitsProps) {
  return (
    <section className="wu-github-recent">
      <header className="wu-github-recent__heading">
        <h2>Recent Commits</h2>

        <button
          type="button"
          className="wu-text-button"
          onClick={onViewAll}
        >
          View all
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </header>

      {!commits ? (
        <p role="status" className="wu-github-recent__empty">
          Loading commits…
        </p>
      ) : commits.length === 0 ? (
        <p className="wu-github-recent__empty">
          No synchronized commits yet.
        </p>
      ) : (
        <ol className="wu-github-recent__timeline">
          {commits.slice(0, 4).map(commit => {
            const type = getCommitType(commit.message);
            const Icon = commitIcons[type];
            const title = commit.message.split('\n')[0];

            return (
              <li
                key={commit.id}
                className={`wu-github-recent__item wu-github-recent__item--${type}`}
              >
                <span className="wu-github-recent__marker" />

                <span className="wu-github-recent__icon">
                  <Icon size={19} aria-hidden="true" />
                </span>

                <div className="wu-github-recent__content">
                  <div className="wu-github-recent__row">
                    <div className="wu-github-recent__details">
                      {commit.githubUrl ? (
                        <a
                          href={commit.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={title}
                        >
                          {title}
                        </a>
                      ) : (
                        <strong>{title}</strong>
                      )}

                      <div className="wu-github-recent__metadata">
                        <span>{commit.authorName ?? 'Unknown author'}</span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={commit.committedAt}>
                          {new Date(commit.committedAt).toLocaleDateString(
                            undefined,
                            { month: 'short', day: 'numeric' },
                          )}
                        </time>
                      </div>
                    </div>

                    <span className="wu-github-recent__badge">
                      {commitLabels[type]}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
