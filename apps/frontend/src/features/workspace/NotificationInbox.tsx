import { useId, useState } from 'react';
import { Bell } from 'lucide-react';
import { signOut } from '../WorkspacePicker';

type Update = { id: string; message: string; createdAt: string; readAt: string | null };

export function NotificationInbox({ token }: { token: string | null }) {
  const id = useId();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(true);

  async function request<T>(path = '', method = 'GET'): Promise<T> {
    const response = await fetch('/api/notifications' + path, { method, headers: { Authorization: 'Bearer ' + token } });
    if (response.status === 401) signOut();
    if (!response.ok) throw new Error('Notification request failed');
    return response.json() as Promise<T>;
  }

  async function refresh(mark?: string) {
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
        setUpdates(await request<Update[]>('?limit=100'));
      }
    } catch {
      setError(mark ? 'Could not mark as read. Try again.' : 'Could not load notifications.');
    } finally {
      setBusy(false);
    }
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
    <button type="button" className="wu-icon-button" aria-label="Notifications" popoverTarget={id}
      onClick={() => { if (!document.getElementById(id)?.matches(':popover-open')) void refresh(); }}><Bell size={18} /></button>
    <section id={id} popover="auto" className="wu-inbox" aria-label="Notifications" aria-busy={busy}>
      <div className="wu-panel-heading">
        <h2>Notifications</h2>
        <button className="wu-text-button" type="button" disabled={busy || !updates.some(update => !update.readAt)} onClick={() => void refresh('all')}>Mark all as read</button>
      </div>
      <label className="wu-check-row"><input type="checkbox" checked={unreadOnly} onChange={event => setUnreadOnly(event.target.checked)} /> Unread only</label>
      {error && <p role="alert">{error} <button className="wu-text-button" type="button" onClick={() => void refresh()}>Refresh</button></p>}
      {busy && !updates.length && <p role="status">Loading notifications…</p>}
      {!busy && !error && !visible.length && <p className="wu-muted">{unreadOnly ? 'You’re all caught up.' : 'No notifications yet.'}</p>}
      {groups.map(group => group.items.length > 0 && <section key={group.label}>
        <h3>{group.label}</h3>
        <ul>{group.items.map(update => <li key={update.id} data-unread={!update.readAt}>
          <div>{update.message}<br /><time dateTime={update.createdAt}>{new Date(update.createdAt).toLocaleString()}</time></div>
          {!update.readAt && <button className="wu-text-button" type="button" disabled={busy} onClick={() => void refresh(update.id)}>Mark as read</button>}
        </li>)}</ul>
      </section>)}
    </section>
  </>;
}
