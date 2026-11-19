import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Folder, Plus, LayoutDashboard, Bell } from 'lucide-react';
import './workspace-picker.css';
import { NotificationInbox } from './workspace/NotificationInbox';
import { authRoute } from './auth-routing';
import { canSearchWorkspaces } from './workspace/workspace-history';

export const sessionKey = 'devup.access-token';

type Profile = {
  id: string;
  username: string;
  email: string;
  emailVerified?: boolean;
  avatarUrl: string | null;
  createdAt: string;
  notificationBadge?: boolean;
};
export type Workspace = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  archivedAt: string | null;
};

type WorkspaceMember = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isOwner: boolean;
};

type WorkspaceInvitationNotification = {
  id: string;
  workspaceId: string | null;
  type: string;
  message: string;
  relatedResourceId: string | null;
  invitationStatus?: string;
  createdAt: string;
};

export class SessionExpired extends Error {}

async function request<T>(path: string, token: string, method = 'GET', body?: object): Promise<T> {
  const response = await fetch('/api/' + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, ...(body && { 'Content-Type': 'application/json' }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 401) throw new SessionExpired();
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(Array.isArray(result?.message) ? result.message.join(' ') :
      result?.message || 'Something went wrong. Please try again.');
  }
  return response.json();
}

export function signOut(restoreDestination = false) {
  sessionStorage.removeItem(sessionKey);
  window.location.replace(restoreDestination ? authRoute('/login', location.pathname + location.search + location.hash) : '/login');
}

export function switchAccount(destination = '/workspaces') {
  sessionStorage.removeItem(sessionKey);
  location.assign(authRoute('/login', destination));
}

function WorkspaceList({
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
      {items.map(item => {
        const isOwner = item.ownerId === currentUserId;

        return (
          <li key={item.id} className="workspace-picker-card-wrapper">
            <a
              className="workspace-picker-card"
              href={'/workspaces/' + encodeURIComponent(item.id)}
            >
              <div className="workspace-picker-card-header">
                <span className="workspace-picker-card-icon">
                  <Folder size={22} aria-hidden="true" />
                </span>
                <strong>{item.name}</strong>
              </div>

              <div className="workspace-picker-card-details">
                <span className="workspace-picker-card-label">DESCRIPTION</span>
                <p>
                  {item.archivedAt
                    ? 'Archived workspace'
                    : item.description?.trim() || 'No description provided'}
                </p>
              </div>

              <div className="workspace-picker-card-footer">
                <span>Open workspace</span>
                <ArrowRight size={16} aria-hidden="true" />
              </div>
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

export async function listActiveWorkspaces(token: string) {
  const workspaces = await request<Workspace[]>('workspaces', token);
  return workspaces.filter(workspace => !workspace.archivedAt);
}

export function WorkspacePicker({ workspaceId }: { workspaceId?: string }) {
  const token = sessionStorage.getItem(sessionKey);
  const [data, setData] = useState<{ profile: Profile; workspaces: Workspace[] }>();
  const [invitations, setInvitations] = useState<WorkspaceInvitationNotification[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [invitationsError, setInvitationsError] = useState('');

  const [loadingError, setLoadingError] = useState('');
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<Workspace | null>(null);
  const [transferTarget, setTransferTarget] = useState<Workspace | null>(null);
  const [transferMembers, setTransferMembers] = useState<WorkspaceMember[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [selectedNewOwner, setSelectedNewOwner] = useState('');
  const [transferPending, setTransferPending] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null);
  const [formError, setFormError] = useState('');
  const [joining, setJoining] = useState(false);
  const [search, setSearch] = useState('');
  const inboxButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!token) {
      signOut(true);
      return;
    }
    let active = true;
    Promise.all([
      request<Profile>('auth/profile', token),
      request<Workspace[]>('workspaces', token),
    ]).then(([profile, workspaces]) => {
      if (active) setData({ profile, workspaces });
    }).catch(error => {
      if (!active) return;
      if (error instanceof SessionExpired) signOut(true);
      else setLoadingError('Could not load your workspaces. Try again.');
    });
    return () => { active = false; };
  }, [token]);

  // Reset temporary form state when returning via browser Back/Forward.
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;

      // Reset the creation modal restored by browser history.
      setPending(false);
      setCreating(false);
      setFormError('');
      setJoining(false);

      // Reload workspace data instead of showing cached results.
      const currentToken = sessionStorage.getItem(sessionKey);
      if (!currentToken) {
        signOut(true);
        return;
      }

      Promise.all([
        request<Profile>('auth/profile', currentToken),
        request<Workspace[]>('workspaces', currentToken),
      ]).then(([profile, workspaces]) => {
        setData({ profile, workspaces });
        setLoadingError('');
      }).catch(error => {
        if (error instanceof SessionExpired) signOut(true);
        else setLoadingError('Could not refresh your workspaces. Try again.');
      });
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  useEffect(() => {
    if (!token || workspaceId) return;

    let active = true;

    async function loadInvitations() {
      if (!token) return;

      try {
        const results = await request<WorkspaceInvitationNotification[]>(
          'notifications?category=invitations&limit=100',
          token,
        );

        if (!active) return;

        setInvitations(results.filter(item =>
          item.type === 'WORKSPACE_INVITATION' &&
          item.invitationStatus === 'PENDING'
        ));
        setInvitationsError('');
      } catch {
        if (active) setInvitationsError('Could not load invitations.');
      } finally {
        if (active) setInvitationsLoading(false);
      }
    }

    void loadInvitations();
    window.addEventListener('focus', loadInvitations);

    return () => {
      active = false;
      window.removeEventListener('focus', loadInvitations);
    };
  }, [token, workspaceId]);

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || pending) return;
    const fields = new FormData(event.currentTarget);
    const name = String(fields.get('name') ?? '').trim();
    const description = String(fields.get('description') ?? '').trim();
    if (!name) {
      setFormError('Enter a workspace name.');
      return;
    }
    setPending(true);
    setFormError('');
    try {
      const workspace = await request<Workspace>('workspaces', token, 'POST', { name, ...(description && { description }) });
      window.location.assign('/workspaces/' + encodeURIComponent(workspace.id));
    } catch (error) {
      if (error instanceof SessionExpired) signOut(true);
      else setFormError(error instanceof Error ? error.message : 'Could not create your workspace.');
      setPending(false);
    }
  }

  const [invitationBusy, setInvitationBusy] = useState<string | null>(null);

  async function respondToInvitation(
    invitation: WorkspaceInvitationNotification,
    action: 'accept' | 'reject',
  ) {
    if (!token || !invitation.workspaceId || !invitation.relatedResourceId || invitationBusy) return;

    setInvitationBusy(invitation.id);
    setInvitationsError('');

    try {
      await request(
        `workspaces/${encodeURIComponent(invitation.workspaceId)}/invitations/${encodeURIComponent(invitation.relatedResourceId)}/${action}`,
        token,
        'PATCH',
      );

      setInvitations(current => current.filter(item => item.id !== invitation.id));

      if (action === 'accept') {
        window.location.assign('/workspaces/' + encodeURIComponent(invitation.workspaceId));
      }
    } catch (error) {
      if (error instanceof SessionExpired) {
        signOut(true);
        return;
      }

      setInvitationsError(
        error instanceof Error ? error.message : 'Could not respond to invitation.',
      );
    } finally {
      setInvitationBusy(null);
    }
  }

  useEffect(() => {
    if (!transferTarget || !token) return;

    let active = true;

    setTransferLoading(true);
    setTransferError('');
    setSelectedNewOwner('');
    setTransferMembers([]);

    request<WorkspaceMember[]>(
      `workspaces/${encodeURIComponent(transferTarget.id)}/members`,
      token,
    )
      .then(members => {
        if (active) {
          setTransferMembers(members.filter(member => !member.isOwner));
        }
      })
      .catch(error => {
        if (active) {
          setTransferError(
            error instanceof Error ? error.message : 'Could not load workspace members.',
          );
        }
      })
      .finally(() => {
        if (active) setTransferLoading(false);
      });

    return () => {
      active = false;
    };
  }, [transferTarget, token]);

  async function confirmOwnershipTransfer() {
    if (!token || !transferTarget || !selectedNewOwner || transferPending) return;

    setTransferPending(true);
    setTransferError('');

    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(transferTarget.id)}/owner/${encodeURIComponent(selectedNewOwner)}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.status === 401) {
        signOut(true);
        return;
      }

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.message || 'Could not transfer ownership.');
      }

      setData(current => current && ({
        ...current,
        workspaces: current.workspaces.map(workspace =>
          workspace.id === transferTarget.id
            ? { ...workspace, ownerId: selectedNewOwner }
            : workspace,
        ),
      }));

      setTransferTarget(null);
      setSelectedNewOwner('');
    } catch (error) {
      setTransferError(
        error instanceof Error ? error.message : 'Could not transfer ownership.',
      );
    } finally {
      setTransferPending(false);
    }
  }

  const [leavePending, setLeavePending] = useState(false);
  const [leaveError, setLeaveError] = useState('');

  async function confirmLeaveWorkspace() {
    if (!token || !leaveTarget || leavePending) return;

    setLeavePending(true);
    setLeaveError('');

    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(leaveTarget.id)}/membership`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.status === 401) {
        signOut(true);
        return;
      }

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(
          Array.isArray(result?.message)
            ? result.message.join(' ')
            : result?.message || 'Could not leave workspace.',
        );
      }

      setData(current => current && ({
        ...current,
        workspaces: current.workspaces.filter(
          workspace => workspace.id !== leaveTarget.id,
        ),
      }));

      setLeaveTarget(null);
    } catch (error) {
      setLeaveError(
        error instanceof Error ? error.message : 'Could not leave workspace.',
      );
    } finally {
      setLeavePending(false);
    }
  }

  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function confirmDeleteWorkspace() {
    if (!token || !deleteTarget || deletePending) return;
    if (deleteConfirmation !== deleteTarget.name) return;

    setDeletePending(true);
    setDeleteError('');

    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(deleteTarget.id)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.status === 401) {
        signOut(true);
        return;
      }

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(
          Array.isArray(result?.message)
            ? result.message.join(' ')
            : result?.message || 'Could not delete workspace.',
        );
      }

      setData(current => current && ({
        ...current,
        workspaces: current.workspaces.filter(
          workspace => workspace.id !== deleteTarget.id,
        ),
      }));

      setDeleteTarget(null);
      setDeleteConfirmation('');
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : 'Could not delete workspace.',
      );
    } finally {
      setDeletePending(false);
    }
  }

  async function logout() {
    if (!token || leaving) return;
    setLeaving(true);
    try {
      await request('auth/logout', token, 'POST');
    } finally {
      signOut();
    }
  }

  if (!token) return null;
  const workspace = data?.workspaces.find(item => item.id === workspaceId);
  const allWorkspaces = data?.workspaces ?? [];
  const showSearch = canSearchWorkspaces(allWorkspaces.length);
  const query = showSearch ? search.trim().toLowerCase() : '';
  const matches = allWorkspaces.filter(item => item.name.toLowerCase().includes(query));
  const activeWorkspaces = matches.filter(item => !item.archivedAt);
  const archivedWorkspaces = matches.filter(item => item.archivedAt);


  return (
    <main className="auth-page workspace-picker workspace-dashboard">
      <header className="auth-header">
        <a href="/" className="brand" aria-label="DevUP home"><img src="/devup.svg" alt="" width="34" height="34" />DevUP</a>
        <div className="workspace-picker-actions workspace-picker-notifications">
          <NotificationInbox token={token} workspaceId={allWorkspaces.find(item => !item.archivedAt)?.id} triggerRef={inboxButton} showBadge={data?.profile.notificationBadge} />
          <button className="button button--secondary" type="button" onClick={() => switchAccount()}>Switch account</button>
          <button className="button button--secondary" type="button" onClick={() => void logout().catch(() => {})} disabled={leaving}>Log out</button>
        </div>
      </header>
      <div className="workspace-dashboard-layout">
        <aside className="workspace-dashboard-sidebar" aria-label="Dashboard navigation">
          <div className="workspace-dashboard-sidebar-title">PERSONAL SPACE</div>
          <nav className="workspace-dashboard-nav" aria-label="Personal space">
            <a className="workspace-dashboard-nav-active" href="/workspaces">
              <LayoutDashboard size={18} aria-hidden="true" />
              Overview
            </a>
            <a href="#workspace-picker-title">
              <Folder size={18} aria-hidden="true" />
              Workspaces
            </a>
            <button type="button" onClick={() => inboxButton.current?.click()}>
              <Bell size={18} aria-hidden="true" />
              Invitations
            </button>
          </nav>
          <div className="workspace-dashboard-sidebar-footer">
            <span className="workspace-dashboard-online-dot" />
            Your personal workspace
          </div>
        </aside>

        <div className="workspace-dashboard-main">
      <section className="auth-shell workspace-picker-shell" aria-labelledby="workspace-picker-title">
        <h1 id="workspace-picker-title">{workspace ? workspace.name : 'Your workspaces'}</h1>
        {!workspaceId && data && (
          <div className="workspace-dashboard-hero">
            <span className="workspace-dashboard-eyebrow">YOUR PERSONAL SPACE</span>
            <h2>Welcome back, {data.profile.username} <span aria-hidden="true">👋</span></h2>
            <p>Everything you need to keep your work moving, all in one place.</p>
            <div className="workspace-dashboard-hero-actions">
              <button type="button" className="button button--primary"
                onClick={() => { setJoining(false); setCreating(true); }}>
                <Plus size={17} aria-hidden="true" /> Create workspace
              </button>
              <a className="button button--secondary" href="#workspace-picker-title">
                View workspaces <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
        )}
        <div className="auth-panel workspace-picker-panel">
          {loadingError ? (
            <><p role="alert">{loadingError}</p><button type="button" className="button button--secondary" onClick={() => location.reload()}>Try again</button></>
          ) : !data ? <p role="status">Loading your workspaces…</p> : workspaceId ? (
            <>
              <p>{workspace ? workspace.description || 'Your workspace is ready.' : 'This workspace is unavailable.'}</p>
              <a className="button button--secondary" href="/workspaces">All workspaces</a>
            </>
          ) : (
            <>
              {showSearch && <label className="workspace-picker-search">Search workspaces
                <input type="search" placeholder="Search by workspace name" value={search} onChange={event => setSearch(event.target.value)} />
              </label>}
              {!!activeWorkspaces.length && (
                <h2>All Active Workspaces</h2>
              )}
              {!!activeWorkspaces.length && <WorkspaceList items={activeWorkspaces} currentUserId={data.profile.id} onLeave={setLeaveTarget} onTransfer={setTransferTarget} onDelete={setDeleteTarget} />}
              {!matches.length && query && <p role="status">No workspaces match your search.</p>}
              {!allWorkspaces.length && <p>Create a workspace for your team or join one by accepting an invitation.</p>}
              {!!archivedWorkspaces.length && <details open={query ? true : undefined}>
                <summary>Archived workspaces ({archivedWorkspaces.length})</summary>
                <WorkspaceList items={archivedWorkspaces} currentUserId={data.profile.id} onLeave={setLeaveTarget} onTransfer={setTransferTarget} onDelete={setDeleteTarget} />
              </details>}
              {joining && <p role="status">Ask a workspace owner for an invitation, then open the link they send. You can also accept an in-app invitation from Notifications.</p>}
            </>
          )}
        </div>
      </section>

      {!workspaceId && data && (
        <div className="workspace-dashboard-bottom-grid">
          <section
            className="workspace-dashboard-invitations"
            id="pending-invitations"
            aria-labelledby="dashboard-invitations-title"
          >
            <div className="workspace-dashboard-invitations-heading">
              <h2 id="dashboard-invitations-title">Pending Invitations</h2>
              <span>{invitations.length}</span>
            </div>

            {invitationsLoading && <p role="status">Loading invitations…</p>}

            {invitationsError && (
              <p role="alert" className="workspace-dashboard-invitation-error">
                {invitationsError}
              </p>
            )}

            {!invitationsLoading && !invitationsError && !invitations.length && (
              <div className="workspace-dashboard-invitations-empty">
                <p>No pending invitations</p>
                <span>You're all caught up!</span>
              </div>
            )}

            {!!invitations.length && (
              <ul className="workspace-dashboard-invitation-list">
                {invitations.map(invitation => (
                  <li key={invitation.id}>
                    <div className="workspace-dashboard-invitation-info">
                      <strong>{invitation.message}</strong>
                      <small>
                        {new Date(invitation.createdAt).toLocaleDateString()}
                      </small>
                    </div>

                    <div className="workspace-dashboard-invitation-actions">
                      <button
                        className="button button--primary"
                        type="button"
                        disabled={!!invitationBusy}
                        onClick={() => void respondToInvitation(invitation, 'accept')}
                      >
                        {invitationBusy === invitation.id ? 'Please wait…' : 'Accept'}
                      </button>
                      <button
                        className="button button--secondary"
                        type="button"
                        disabled={!!invitationBusy}
                        onClick={() => void respondToInvitation(invitation, 'reject')}
                      >
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="workspace-dashboard-profile" id="my-profile" aria-labelledby="profile-card-title">
          <div className="workspace-dashboard-profile-heading">
            <h2 id="profile-card-title">Your Profile</h2>
            <span className="workspace-dashboard-profile-status">
              {data.profile.emailVerified ? 'Verified' : 'Unverified'}
            </span>
          </div>

          <div className="workspace-dashboard-profile-body">
            <div className="workspace-dashboard-avatar">
              {data.profile.avatarUrl ? (
                <img src={data.profile.avatarUrl} alt="" />
              ) : (
                data.profile.username.charAt(0).toUpperCase()
              )}
            </div>

            <div className="workspace-dashboard-profile-info">
              <strong>{data.profile.username}</strong>
              <span>{data.profile.email}</span>
            </div>
          </div>

          <div className="workspace-dashboard-profile-footer">
            <span>Member since</span>
            <strong>
              {new Date(data.profile.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                year: 'numeric',
              })}
            </strong>
          </div>
        </section>
        </div>
      )}
        </div>
      </div>

      {deleteTarget && (
        <div className="workspace-create-overlay" role="presentation">
          <section
            className="workspace-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-workspace-title"
          >
            <h2 id="delete-workspace-title">Delete workspace?</h2>

            <p>
              You're about to delete
              <strong> {deleteTarget.name}</strong>.
              Members will lose access to this workspace.
            </p>

            <label className="workspace-delete-label">
              Type <strong>{deleteTarget.name}</strong> to confirm
              <input
                type="text"
                value={deleteConfirmation}
                onChange={event => setDeleteConfirmation(event.target.value)}
                placeholder={deleteTarget.name}
                autoComplete="off"
              />
            </label>

            {deleteError && <p role="alert">{deleteError}</p>}

            <div className="workspace-create-modal-actions">
              <button
                className="button button--secondary"
                type="button"
                disabled={deletePending}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirmation('');
                  setDeleteError('');
                }}
              >
                Cancel
              </button>

              <button
                className="button workspace-danger-button"
                type="button"
                disabled={
                  deletePending ||
                  deleteConfirmation !== deleteTarget.name
                }
                onClick={() => void confirmDeleteWorkspace()}
              >
                {deletePending ? 'Deleting…' : 'Delete Workspace'}
              </button>
            </div>
          </section>
        </div>
      )}

      {leaveTarget && (
        <div className="workspace-create-overlay" role="presentation">
          <section
            className="workspace-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-workspace-title"
          >
            <h2 id="leave-workspace-title">Leave workspace?</h2>

            <p>
              Are you sure you want to leave
              <strong> {leaveTarget.name}</strong>?
            </p>

            <p>
              You'll lose access to this workspace and its resources.
              To rejoin, you'll need a new invitation or an approved request.
            </p>

            {leaveError && <p role="alert">{leaveError}</p>}

            <div className="workspace-create-modal-actions">
              <button
                className="button button--secondary"
                type="button"
                disabled={leavePending}
                onClick={() => {
                  setLeaveTarget(null);
                  setLeaveError('');
                }}
              >
                Cancel
              </button>

              <button
                className="button workspace-danger-button"
                type="button"
                disabled={leavePending}
                onClick={() => void confirmLeaveWorkspace()}
              >
                {leavePending ? 'Leaving…' : 'Leave Workspace'}
              </button>
            </div>
          </section>
        </div>
      )}

      {transferTarget && (
        <div className="workspace-create-overlay" role="presentation">
          <section
            className="workspace-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transfer-ownership-title"
          >
            <div className="workspace-create-modal-header">
              <h2 id="transfer-ownership-title">Transfer Ownership</h2>
              <button
                type="button"
                className="workspace-create-close"
                aria-label="Close"
                disabled={transferPending}
                onClick={() => setTransferTarget(null)}
              >
                ×
              </button>
            </div>

            <p>
              Choose a new owner for <strong>{transferTarget.name}</strong>.
            </p>

            {transferLoading ? (
              <p role="status">Loading workspace members…</p>
            ) : transferMembers.length === 0 ? (
              <p>No other members available. Invite someone first.</p>
            ) : (
              <label className="workspace-transfer-label">
                New owner
                <select
                  value={selectedNewOwner}
                  disabled={transferPending}
                  onChange={event => setSelectedNewOwner(event.target.value)}
                >
                  <option value="">Select a member</option>
                  {transferMembers.map(member => (
                    <option key={member.userId} value={member.userId}>
                      {member.username}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {selectedNewOwner && (
              <p className="workspace-transfer-warning">
                The selected member will become the workspace owner.
                You will remain a member and can leave afterward.
              </p>
            )}

            {transferError && <p role="alert">{transferError}</p>}

            <div className="workspace-create-modal-actions">
              <button
                className="button button--secondary"
                type="button"
                disabled={transferPending}
                onClick={() => setTransferTarget(null)}
              >
                Cancel
              </button>
              {!transferLoading && transferMembers.length > 0 && (
                <button
                  className="button button--primary"
                  type="button"
                  disabled={!selectedNewOwner || transferPending}
                  onClick={() => void confirmOwnershipTransfer()}
                >
                  {transferPending ? 'Transferring…' : 'Confirm Transfer'}
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {creating && !workspaceId && (
        <div
          className="workspace-create-overlay"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !pending) {
              setCreating(false);
              setFormError('');
            }
          }}
        >
          <section
            className="workspace-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-create-title"
            aria-describedby="workspace-create-description"
          >
            <div className="workspace-create-modal-header">
              <div className="workspace-create-modal-icon">
                <Plus size={22} aria-hidden="true" />
              </div>

              <button
                type="button"
                className="workspace-create-close"
                aria-label="Close dialog"
                disabled={pending}
                onClick={() => {
                  setCreating(false);
                  setFormError('');
                }}
              >
                ×
              </button>
            </div>

            <h2 id="workspace-create-title">Create a workspace</h2>
            <p id="workspace-create-description">
              Bring your team and projects together in one place.
            </p>

            <form className="workspace-picker-form" onSubmit={createWorkspace}>
              <label>
                Workspace name
                <input
                  name="name"
                  placeholder="e.g. Platform engineering"
                  required
                  maxLength={120}
                  autoFocus
                />
              </label>

              <label>
                Description <span className="workspace-create-optional">(optional)</span>
                <textarea
                  name="description"
                  placeholder="What's this workspace for?"
                  rows={3}
                />
              </label>

              {formError && <p role="alert">{formError}</p>}

              <div className="workspace-create-modal-actions">
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setCreating(false);
                    setFormError('');
                  }}
                >
                  Cancel
                </button>

                <button
                  className="button button--primary"
                  type="submit"
                  disabled={pending}
                >
                  {pending ? 'Creating…' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

    </main>
  );
}
