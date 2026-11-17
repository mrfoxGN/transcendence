import { ArrowUpRight, RefreshCw, Unplug } from 'lucide-react';

interface GithubHeaderProps {
  repositoryUrl: string;
  owner: boolean;
  busy: boolean;
  onSync: () => void;
  onDisconnect: () => void;
}

export function GithubHeader({
  repositoryUrl,
  owner,
  busy,
  onSync,
  onDisconnect,
}: GithubHeaderProps) {
  return (
    <header className="wu-github-intro">
      <div className="wu-github-intro__identity">
        <div className="wu-github-intro__logo">
          <img
            src="/github-invertocat.svg"
            alt=""
            width={42}
            height={42}
          />
        </div>

        <div>
          <h1>
            GitHub <span>Integration</span>
          </h1>
          <p>Repository Pulse — Explore your code and team activity.</p>
        </div>
      </div>

      <div className="wu-github-intro__actions">
        <span className="wu-github-connection">
          <span className="wu-github-connection__dot" />
          Connected
        </span>

        <a
          className="wu-button wu-button--secondary"
          href={repositoryUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on GitHub
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>

        {owner && (
          <>
            <button
              type="button"
              className="wu-github-sync"
              disabled={busy}
              onClick={onSync}
            >
              <RefreshCw size={16} aria-hidden="true" />
              {busy ? 'Syncing…' : 'Sync commits'}
            </button>

            <button
              type="button"
              className="wu-button wu-button--secondary"
              disabled={busy}
              onClick={onDisconnect}
            >
              <Unplug size={16} aria-hidden="true" />
              Disconnect
            </button>
          </>
        )}
      </div>
    </header>
  );
}
