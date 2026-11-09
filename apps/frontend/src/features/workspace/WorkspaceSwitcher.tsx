import { useId, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { listActiveWorkspaces, SessionExpired, signOut, type Workspace } from '../WorkspacePicker';

type WorkspaceSwitcherProps = {
  workspaceId: string;
  workspaceName: string;
  token: string | null;
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(word => word.charAt(0)).join('').toUpperCase() || 'W';
}

export function WorkspaceSwitcher({ workspaceId, workspaceName, token }: WorkspaceSwitcherProps) {
  const popoverId = useId();
  const [workspaces, setWorkspaces] = useState<Workspace[]>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadWorkspaces() {
    if (!token || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      setWorkspaces(await listActiveWorkspaces(token));
    } catch (error) {
      if (error instanceof SessionExpired) signOut();
      else setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        className="wu-workspace-switcher"
        type="button"
        aria-label={`Switch workspace. Current workspace: ${workspaceName}`}
        popoverTarget={popoverId}
        onClick={() => { if (!workspaces) void loadWorkspaces(); }}
      >
        <span className="wu-workspace-monogram" aria-hidden="true">{initials(workspaceName)}</span>
        <span><strong>{workspaceName}</strong><small>Developer workspace</small></span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <nav id={popoverId} popover="auto" className="wu-workspace-popover" aria-label="Switch workspace">
        <strong className="wu-workspace-popover-title">Your workspaces</strong>
        {loading && <p role="status">Loading workspaces…</p>}
        {failed && (
          <div>
            <p role="alert">Couldn’t load workspaces.</p>
            <button className="wu-text-button" type="button" onClick={() => void loadWorkspaces()}>Try again</button>
          </div>
        )}
        {workspaces?.length === 0 && <p>No active workspaces.</p>}
        {!!workspaces?.length && (
          <ul>
            {workspaces.map(workspace => (
              <li key={workspace.id}>
                {workspace.id === workspaceId ? (
                  <span className="wu-workspace-option" aria-current="true">
                    <span className="wu-workspace-monogram" aria-hidden="true">{initials(workspaceName)}</span>
                    <span>{workspaceName}</span>
                    <Check size={16} aria-hidden="true" />
                  </span>
                ) : (
                  <a className="wu-workspace-option" href={'/workspaces/' + encodeURIComponent(workspace.id)}>
                    <span className="wu-workspace-monogram" aria-hidden="true">{initials(workspace.name)}</span>
                    <span>{workspace.name}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
        <a className="wu-workspace-manage" href="/workspaces">Manage workspaces</a>
      </nav>
    </>
  );
}
