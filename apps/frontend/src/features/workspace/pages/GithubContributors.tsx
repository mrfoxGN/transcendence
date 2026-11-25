import { ArrowUpRight, GitCommitHorizontal, Users } from 'lucide-react';
import './github-contributors.css';

interface Contributor {
  login: string;
  avatarUrl: string;
  profileUrl: string;
  contributions: number;
  isOwner: boolean;
}

interface GithubContributorsProps {
  contributors: Contributor[];
}

export function GithubContributors({ contributors }: GithubContributorsProps) {
  const sorted = [...contributors].sort((a, b) => b.contributions - a.contributions);

  const total = sorted.reduce((sum, contributor) => sum + contributor.contributions, 0);

  return (
    <section className="wu-gcontributors">
      <header className="wu-gcontributors__header">
        <div className="wu-gcontributors__heading">
          <span className="wu-gcontributors__heading-icon">
            <Users size={25} aria-hidden="true" />
          </span>

          <div>
            <h2>Contributors</h2>
            <p>People who have contributed to this repository.</p>
          </div>
        </div>

        <div className="wu-gcontributors__summary">
          <div className="wu-gcontributors__stat">
            <Users size={21} aria-hidden="true" />
            <div>
              <strong>{contributors.length}</strong>
              <span>Contributors</span>
            </div>
          </div>

          <div className="wu-gcontributors__stat">
            <GitCommitHorizontal size={21} aria-hidden="true" />
            <div>
              <strong>{total}</strong>
              <span>Attributed commits</span>
            </div>
          </div>
        </div>
      </header>

      {sorted.length === 0 ? (
        <p className="wu-gcontributors__empty">No contributors found.</p>
      ) : (
        <div className="wu-gcontributors__list">
          {sorted.map((contributor) => {
            const percentage = total > 0 ? (contributor.contributions / total) * 100 : 0;

            return (
              <article className="wu-gcontributors__row" key={contributor.login}>
                <div className="wu-gcontributors__identity">
                  <a
                    className="wu-gcontributors__avatar-link"
                    href={contributor.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View ${contributor.login} on GitHub`}
                  >
                    <img src={contributor.avatarUrl} alt="" width={58} height={58} loading="lazy" />
                  </a>

                  <div className="wu-gcontributors__person">
                    <div className="wu-gcontributors__name">
                      <a href={contributor.profileUrl} target="_blank" rel="noopener noreferrer">
                        {contributor.login}
                        <ArrowUpRight size={14} aria-hidden="true" />
                      </a>

                      {contributor.isOwner && (
                        <span className="wu-gcontributors__owner">Owner</span>
                      )}
                    </div>

                    <span className="wu-gcontributors__count">
                      <GitCommitHorizontal size={15} aria-hidden="true" />
                      {contributor.contributions} attributed
                      {contributor.contributions === 1 ? ' commit' : ' commits'}
                    </span>
                  </div>
                </div>

                <div className="wu-gcontributors__activity">
                  <div className="wu-gcontributors__percentage">
                    <strong>{Math.round(percentage)}%</strong>
                    <span>of attributed commits</span>
                  </div>

                  <div
                    className="wu-gcontributors__track"
                    role="progressbar"
                    aria-label={`${contributor.login}'s share of attributed commits`}
                    aria-valuenow={percentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="wu-gcontributors__fill" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="wu-gcontributors__note">
        Percentages represent each contributor's share of commits attributed by GitHub. They do not
        measure productivity or code quality.
      </p>
    </section>
  );
}
