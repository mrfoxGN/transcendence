import { ArrowUpRight, GitBranch, Globe2, RefreshCw } from 'lucide-react';

interface GithubRepositoryIdentityProps {
  fullName: string;
  repositoryUrl: string;
  defaultBranch: string;
  lastSyncedAt: string | null;
}

export function GithubRepositoryIdentity({
  fullName,
  repositoryUrl,
  defaultBranch,
  lastSyncedAt,
}: GithubRepositoryIdentityProps) {
  return (
    <section
      className="wu-github-repository"
      aria-label="Connected GitHub repository"
    >
      <div className="wu-github-repository__logo">
        <img
          src="/github-invertocat.svg"
          alt=""
          width={42}
          height={42}
        />
      </div>

      <div className="wu-github-repository__content">
        <h2>
          <a
            href={repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {fullName}
            <ArrowUpRight size={19} aria-hidden="true" />
          </a>
        </h2>

        <div className="wu-github-repository__badges">
          <span className="wu-github-repository__badge">
            <GitBranch size={14} aria-hidden="true" />
            {defaultBranch}
          </span>

          <span className="wu-github-repository__badge">
            <Globe2 size={14} aria-hidden="true" />
            Public
          </span>
        </div>

        <div className="wu-github-repository__sync">
          <RefreshCw size={14} aria-hidden="true" />

          {lastSyncedAt ? (
            <time dateTime={lastSyncedAt}>
              Last synchronized:{' '}
              {new Date(lastSyncedAt).toLocaleString()}
            </time>
          ) : (
            <span>Not synchronized yet</span>
          )}
        </div>
      </div>
    </section>
  );
}
