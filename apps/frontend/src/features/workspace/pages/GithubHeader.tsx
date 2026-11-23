import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { ActionMenu } from '../WorkspaceControls';

interface GithubHeaderProps {
  repositoryUrl: string; owner: boolean; busy: boolean;
  onSync: () => void; onDisconnect: () => void;
}

export function GithubHeader({ repositoryUrl, owner, busy, onSync, onDisconnect }: GithubHeaderProps) {
  return <div className="wu-github-header-actions">
    <a className="wu-button wu-button--secondary wu-button--with-icon" href={repositoryUrl} target="_blank" rel="noopener noreferrer">View on GitHub<ArrowUpRight size={15} aria-hidden="true" /></a>
    {owner && <>
      <button className="wu-button wu-button--primary wu-button--with-icon" type="button" disabled={busy} onClick={onSync}><RefreshCw size={15} aria-hidden="true" />{busy ? 'Syncing…' : 'Sync'}</button>
      {!busy && <ActionMenu label="Repository actions" actions={[{ label: 'Disconnect repository', run: onDisconnect }]} />}
    </>}
  </div>;
}
