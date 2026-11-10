import { useEffect, useId, useState } from 'react';
import { Bell } from 'lucide-react';
import { workspaceRequest } from './workspace-api';

type Update = { id: string; message: string; createdAt: string; readAt: string | null; type: string; workspaceId: string | null; relatedResourceType: string | null; relatedResourceId: string | null };
const limit = 20;

export function NotificationInbox({ token, workspaceId }: { token: string | null; workspaceId?: string }) {
  const id = useId();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(true);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [resolved, setResolved] = useState<Record<string, string>>({});

  async function request<T>(path = '', method = 'GET'): Promise<T> {
    const response = await workspaceRequest('notifications' + path, token, { method });
    return response.json() as Promise<T>;
  }

  useEffect(() => {
    if (!token) return;
    let active = true;
    const check = () => { void request<{ count: number }>('/unread-count').then(result => { if (active) setCount(result.count); }).catch(() => {}); };
    check();
    window.addEventListener('focus', check);
    const timer = window.setInterval(check, 30_000);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', check); };
  }, [token]);

  async function refresh(mark?: string, nextPage = 1, onlyUnread = unreadOnly) {
    if (busy || !token) return;
    setBusy(true);
    setError('');
    try {
      if (mark) {
        if (mark === 'all') {
          await request('/read-all', 'PATCH');
          setUpdates(current => current.map(update => ({ ...update, readAt: update.readAt ?? new Date().toISOString() })));
        } else {
          const updated = await request<Update>('/' + encodeURIComponent(mark) + '/read', 'PATCH');
          setUpdates(current => current.map(update => update.id === mark ? updated : update));
        }
      } else {
        const results = await request<Update[]>(`?limit=${limit}&page=${nextPage}&unreadOnly=${onlyUnread}`);
        setUpdates(current => nextPage === 1 ? results : [...new Map([...current, ...results].map(item => [item.id, item])).values()]);
        setPage(nextPage);
        setMore(results.length === limit);
      }
      void request<{ count: number }>('/unread-count').then(result => setCount(result.count)).catch(() => {});
    } catch {
      setError(mark ? 'Could not mark as read. Try again.' : 'Could not load notifications.');
    } finally {
      setBusy(false);
    }
  }

  async function respond(update: Update, action: 'accept' | 'reject') {
    if (busy || !token || !update.workspaceId || !update.relatedResourceId) return;
    setBusy(true);
    setError('');
    try {
      await workspaceRequest(`workspaces/${update.workspaceId}/invitations/${update.relatedResourceId}/${action}`, token, { method: 'PATCH' });
      setResolved(current => ({ ...current, [update.id]: action === 'accept' ? 'Invitation accepted' : 'Invitation declined' }));
      if (!update.readAt) {
        const marked = await request<Update>('/' + update.id + '/read', 'PATCH').catch(() => undefined);
        if (marked) setUpdates(current => current.map(item => item.id === marked.id ? marked : item));
        void request<{ count: number }>('/unread-count').then(result => setCount(result.count)).catch(() => {});
      }
      if (action === 'accept') {
        location.assign('/workspaces/' + update.workspaceId);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update this invitation.');
    } finally {
      setBusy(false);
    }
  }

  function relatedLink(update: Update) {
    if (!update.relatedResourceId) return;
    const workspace = update.workspaceId ?? workspaceId;
    if (!workspace) return;
    const base = '/workspaces/' + encodeURIComponent(workspace);
    if (update.relatedResourceType === 'task') return base + '?page=board&task=' + encodeURIComponent(update.relatedResourceId);
    if (update.relatedResourceType === 'direct_conversation') return base + '?page=chat#dm-' + encodeURIComponent(update.relatedResourceId);
  }

  const visible = updates.filter(update => !unreadOnly || !update.readAt);
  const today = new Date().toDateString();
  const previousDay = new Date();
  previousDay.setDate(previousDay.getDate() - 1);
  const yesterday = previousDay.toDateString();
  const groups = [
    { label: 'Today', items: visible.filter(update => new Date(update.createdAt).toDateString() === today) },
    { label: 'Yesterday', items: visible.filter(update => new Date(update.createdAt).toDateString() === yesterday) },
    { label: 'Earlier', items: visible.filter(update => ![today, yesterday].includes(new Date(update.createdAt).toDateString())) },
  ];
  return <>
    <button type="button" className="wu-icon-button wu-inbox-trigger" aria-label={count ? `Notifications, ${count} unread` : 'Notifications'} popoverTarget={id}
      onClick={() => { if (!document.getElementById(id)?.matches(':popover-open')) void refresh(); }}><Bell size={18} />{!!count && <span aria-hidden="true">{count > 99 ? '99+' : count}</span>}</button>
    <section id={id} popover="auto" className="wu-inbox" aria-label="Notifications" aria-busy={busy}>
      <div className="wu-panel-heading">
        <h2>Notifications</h2>
        <button className="wu-text-button" type="button" disabled={busy || !updates.some(update => !update.readAt)} onClick={() => void refresh('all')}>Mark all as read</button>
      </div>
      <label className="wu-check-row"><input type="checkbox" checked={unreadOnly} disabled={busy} onChange={event => { const value = event.target.checked; setUnreadOnly(value); void refresh(undefined, 1, value); }} /> Unread only</label>
      {error && <p role="alert">{error} <button className="wu-text-button" type="button" onClick={() => void refresh()}>Refresh</button></p>}
      {busy && !updates.length && <p role="status">Loading notifications…</p>}
      {!busy && !error && !visible.length && <p className="wu-muted">{unreadOnly ? 'You’re all caught up.' : 'No notifications yet.'}</p>}
      {groups.map(group => group.items.length > 0 && <section key={group.label}>
        <h3>{group.label}</h3>
        <ul>{group.items.map(update => <li key={update.id} data-unread={!update.readAt}>
          <div>{update.message}<br /><time dateTime={update.createdAt}>{new Date(update.createdAt).toLocaleString()}</time></div>
          <div>
            {relatedLink(update) && <a className="wu-text-button" href={relatedLink(update)}>Open</a>}
            {update.type === 'WORKSPACE_INVITATION' && (resolved[update.id] ? <p role="status">{resolved[update.id]}</p> : <>
              <button className="wu-text-button" type="button" disabled={busy} onClick={() => void respond(update, 'accept')}>Accept</button>
              <button className="wu-text-button" type="button" disabled={busy} onClick={() => void respond(update, 'reject')}>Decline</button>
            </>)}
          {!update.readAt && <button className="wu-text-button" type="button" disabled={busy} onClick={() => void refresh(update.id)}>Mark as read</button>}
          </div>
        </li>)}</ul>
      </section>)}
      {more && <button className="wu-text-button" type="button" disabled={busy} onClick={() => void refresh(undefined, page + 1)}>Load more</button>}
    </section>
  </>;
}
