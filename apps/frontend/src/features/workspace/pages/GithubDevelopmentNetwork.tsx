import type { CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import './github-network.css';

interface Collaborator {
  login: string;
  avatarUrl: string;
  profileUrl: string;
  role: string;
  isOwner: boolean;
}

interface GithubDevelopmentNetworkProps {
  collaborators?: Collaborator[];
  error?: string;
  onRetry: () => void;
  onViewAll: () => void;
}

export function GithubDevelopmentNetwork({
  collaborators,
  error,
  onRetry,
  onViewAll,
}: GithubDevelopmentNetworkProps) {
  const visibleCollaborators = [...(collaborators ?? [])]
    .sort((a, b) => Number(b.isOwner) - Number(a.isOwner))
    .slice(0, 4);

  return (
    <section className="wu-github-network">
      <header className="wu-github-network__heading">
        <div>
          <h2>Collaboration Network</h2>
          <p>Repository collaborators</p>
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
        <div role="alert">
          <p>Could not load collaborators: {error}</p>
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : !collaborators ? (
        <p role="status">Loading collaborators…</p>
      ) : visibleCollaborators.length === 0 ? (
        <p>No collaborators found.</p>
      ) : (
        <>
          <div
            className="wu-github-network__orbit"
            role="list"
            aria-label="Repository collaborators"
          >
            <div
              className="wu-github-network__center"
              aria-hidden="true"
            >
              <img
                src="/github-invertocat.svg"
                alt=""
                width={38}
                height={38}
              />
            </div>

            {visibleCollaborators.map((collaborator, index) => {
              const angle =
                (2 * Math.PI * index) /
                  visibleCollaborators.length -
                Math.PI / 2;

              const position: CSSProperties = {
                left: `${50 + 39 * Math.cos(angle)}%`,
                top: `${50 + 39 * Math.sin(angle)}%`,
              };

              return (
                <div
                  key={collaborator.login}
                  className="wu-github-network__node"
                  role="listitem"
                  style={position}
                >
                  <a
                    href={collaborator.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${collaborator.login}: ${collaborator.role} contributions`}
                    aria-label={`View ${collaborator.login} on GitHub`}
                  >
                    <img
                      src={collaborator.avatarUrl}
                      alt=""
                      width={46}
                      height={46}
                      loading="lazy"
                    />
                  </a>
                </div>
              );
            })}
          </div>

          <p className="wu-github-network__footer">
            {collaborators.length} repository collaborators
          </p>
        </>
      )}
    </section>
  );
}
