import { ArrowRight, Folder } from 'lucide-react';
import type { Workspace } from './workspace-picker-api';

export function WorkspaceList({
  items,
  currentUserId,
  onLeave,
  onTransfer,
  onDelete,
}: {
  items: Workspace[];
  currentUserId: string;
  onLeave: (workspace: Workspace) => void;
  onTransfer: (workspace: Workspace) => void;
  onDelete: (workspace: Workspace) => void;
}) {
  return (
    <ul className="workspace-picker-list">
      {items.map((item) => {
        const isOwner = item.ownerId === currentUserId;

        return (
          <li key={item.id} className="workspace-picker-card-wrapper">
            <a
              className="workspace-picker-card"
              href={'/workspaces/' + encodeURIComponent(item.id)}
            >
              <span className="workspace-picker-card-icon">
                <Folder size={21} aria-hidden="true" />
              </span>
              <span className="workspace-picker-card-copy">
                <strong>{item.name}</strong>
                <small>
                  {item.archivedAt
                    ? 'Archived workspace'
                    : item.description?.trim() || (isOwner ? 'Your workspace' : 'Team workspace')}
                </small>
              </span>
              <span className="workspace-picker-role">
                {item.archivedAt ? 'Archived' : isOwner ? 'Owner' : 'Member'}
              </span>
              <ArrowRight className="workspace-picker-open" size={17} aria-hidden="true" />
            </a>

            <details className="workspace-picker-card-menu">
              <summary aria-label={'Options for ' + item.name}>
                <span aria-hidden="true">⋯</span>
              </summary>

              <div className="workspace-picker-card-menu-popover">
                {isOwner && (
                  <button type="button" onClick={() => onTransfer(item)}>
                    Transfer ownership
                  </button>
                )}

                <button
                  type="button"
                  className="workspace-picker-leave-option"
                  disabled={isOwner}
                  title={isOwner ? 'Transfer ownership before leaving' : undefined}
                  onClick={() => onLeave(item)}
                >
                  Leave workspace
                </button>

                {isOwner && (
                  <>
                    <p className="workspace-picker-owner-hint">
                      Transfer ownership before leaving.
                    </p>
                    <hr />
                    <button
                      type="button"
                      className="workspace-picker-leave-option"
                      onClick={() => onDelete(item)}
                    >
                      Delete workspace
                    </button>
                  </>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
