import { ArrowRight } from 'lucide-react';
import './github-top-contributors.css';

interface Contributor {
  login: string;
  avatarUrl: string;
  profileUrl: string;
  contributions: number;
}

interface GithubTopContributorsProps {
  contributors?: Contributor[];
  error?: string;
  onRetry: () => void;
  onViewAll: () => void;
}

export function GithubTopContributors({
  contributors,
  error,
  onRetry,
  onViewAll,
}: GithubTopContributorsProps) {
  const rankedContributors = [...(contributors ?? [])]
    .sort((a, b) => b.contributions - a.contributions)
    .slice(0, 4);

  const totalContributions = (contributors ?? []).reduce(
    (total, contributor) => total + contributor.contributions,
    0,
  );

  return (
    <section className="wu-github-top-contributors">
      <header className="wu-github-top-contributors__heading">
        <div>
          <h2>Top Contributors</h2>
          <p>Repository contribution activity</p>
        </div>

        <button
          type="button"
          className="wu-text-button"
          onClick={onViewAll}
        >
          View all
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </header>

      {error ? (
        <div role="alert" className="wu-github-top-contributors__state">
          <p>Could not load contributors: {error}</p>
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : !contributors ? (
        <p role="status" className="wu-github-top-contributors__state">
          Loading contributors…
        </p>
      ) : rankedContributors.length === 0 ? (
        <p className="wu-github-top-contributors__state">
          No contributors found.
        </p>
      ) : (
        <ol className="wu-github-top-contributors__list">
          {rankedContributors.map(contributor => {
            const percentage =
              totalContributions > 0
                ? Math.round(
                    (contributor.contributions / totalContributions) * 100,
                  )
                : 0;

            return (
              <li
                key={contributor.login}
                className="wu-github-top-contributors__item"
              >
                <a
                  href={contributor.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View ${contributor.login} on GitHub`}
                >
                  <img
                    src={contributor.avatarUrl}
                    alt=""
                    width={40}
                    height={40}
                    loading="lazy"
                  />
                </a>

                <div className="wu-github-top-contributors__details">
                  <a
                    href={contributor.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wu-github-top-contributors__name"
                  >
                    {contributor.login}
                  </a>

                  <span className="wu-github-top-contributors__commits">
                    {contributor.contributions} contributions
                  </span>

                  <div
                    className="wu-github-top-contributors__track"
                    role="meter"
                    aria-label={`${contributor.login}'s share of reported contributions`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percentage}
                  >
                    <span style={{ width: `${percentage}%` }} />
                  </div>
                </div>

                <strong className="wu-github-top-contributors__percentage">
                  {percentage}%
                </strong>
              </li>
            );
          })}
        </ol>
      )}

      <p className="wu-github-top-contributors__note">
        Based on contributions reported by GitHub.
      </p>
    </section>
  );
}
