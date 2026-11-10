import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Folder, Plus } from 'lucide-react';
import './workspace-picker.css';
import { NotificationInbox } from './workspace/NotificationInbox';

export const sessionKey = 'devup.access-token';

type Profile = { username: string };
export type Workspace = { id: string; name: string; description: string | null; archivedAt: string | null };

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

export function signOut() {
  sessionStorage.removeItem(sessionKey);
  window.location.replace('/login');
}

export async function listActiveWorkspaces(token: string) {
  const workspaces = await request<Workspace[]>('workspaces', token);
  return workspaces.filter(workspace => !workspace.archivedAt);
}

export function WorkspacePicker({ workspaceId }: { workspaceId?: string }) {
  const token = sessionStorage.getItem(sessionKey);
  const [data, setData] = useState<{ profile: Profile; workspaces: Workspace[] }>();
  const [loadingError, setLoadingError] = useState('');
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!token) {
      signOut();
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
      if (error instanceof SessionExpired) signOut();
      else setLoadingError('Could not load your workspaces. Try again.');
    });
    return () => { active = false; };
  }, [token]);

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
      if (error instanceof SessionExpired) signOut();
      else setFormError(error instanceof Error ? error.message : 'Could not create your workspace.');
      setPending(false);
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
  const activeWorkspaces = data?.workspaces.filter(item => !item.archivedAt) ?? [];
  const archivedWorkspaces = data?.workspaces.filter(item => item.archivedAt) ?? [];

  return (
    <main className="auth-page workspace-picker">
      <header className="auth-header">
        <a href="/" className="brand" aria-label="DevUP home"><img src="/devup.svg" alt="" width="34" height="34" />DevUP</a>
        <div className="workspace-picker-actions workspace-picker-notifications">
          <NotificationInbox token={token} workspaceId={activeWorkspaces[0]?.id} />
          <button className="button button--secondary" type="button" onClick={() => void logout().catch(() => {})} disabled={leaving}>Log out</button>
        </div>
      </header>
      <section className="auth-shell workspace-picker-shell" aria-labelledby="workspace-picker-title">
        <h1 id="workspace-picker-title">{workspace ? workspace.name : 'Your workspaces'}</h1>
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
              <p>Welcome, {data.profile.username}.</p>
              {activeWorkspaces.length > 0 ? (
                <ul className="workspace-picker-list">
                  {activeWorkspaces.map(item => (
                    <li key={item.id}><a href={'/workspaces/' + encodeURIComponent(item.id)}>
                      <Folder size={20} aria-hidden="true" />
                      <span><strong>{item.name}</strong>{item.description && <small>{item.description}</small>}</span>
                      <ArrowRight size={18} aria-hidden="true" />
                    </a></li>
                  ))}
                </ul>
              ) : <p>No active workspaces. Create one to start organizing your team’s work.</p>}
              {!!archivedWorkspaces.length && <details>
                <summary>Archived workspaces ({archivedWorkspaces.length})</summary>
                <ul className="workspace-picker-list">{archivedWorkspaces.map(item => <li key={item.id}>
                  <a href={'/workspaces/' + encodeURIComponent(item.id) + '?page=settings'}><Folder size={20} aria-hidden="true" /><span><strong>{item.name}</strong><small>Archived</small></span><ArrowRight size={18} aria-hidden="true" /></a>
                </li>)}</ul>
              </details>}
              {creating ? (
                <form className="workspace-picker-form" onSubmit={createWorkspace}>
                  <label>Workspace name<input name="name" required maxLength={120} /></label>
                  <label>Description (optional)<textarea name="description" rows={3} /></label>
                  {formError && <p role="alert">{formError}</p>}
                  <div className="workspace-picker-actions">
                    <button className="button button--primary" disabled={pending}>{pending ? 'Creating…' : 'Create workspace'}</button>
                    <button className="button button--secondary" type="button" disabled={pending} onClick={() => { setCreating(false); setFormError(''); }}>Cancel</button>
                  </div>
                </form>
              ) : (
                <button className="button button--primary" type="button" onClick={() => setCreating(true)}>
                  <Plus size={18} aria-hidden="true" /> {data.workspaces.length ? 'Create workspace' : 'Create your first workspace'}
                </button>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
