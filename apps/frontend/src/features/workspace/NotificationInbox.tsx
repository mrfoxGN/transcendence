import { useHoverPopover } from '../../shared/controls/useHoverPopover';
import { Select } from '../../shared/controls/Select';
import { EmptyIllustration, IllustratedEmptyState } from '../../shared/illustrations/EmptyIllustration';
import { useEffect, useId, useState, type Ref } from 'react';
import { Bell, Settings2, Users, Check, X, CheckCircle2 } from 'lucide-react';
import { jsonRequest, workspaceRequest } from './workspace-api';

const preferenceLabels = { assignments: 'Task assignments', comments: 'Comments on watched tasks', status: 'Task status changes' };
const invitationLabels: Record<string, string> = { ACCEPTED: 'Invitation accepted', REJECTED: 'Invitation declined', CANCELLED: 'Invitation withdrawn', EXPIRED: 'Invitation expired', UNAVAILABLE: 'Invitation unavailable' };
type Preferences = Record<keyof typeof preferenceLabels, boolean>;
type Update = { id: string; message: string; createdAt: string; readAt: string | null; type: string; workspaceId: string | null; relatedResourceType: string | null; relatedResourceId: string | null; invitationStatus?: string };
const limit = 20;

export function NotificationInbox({ token, workspaceId, triggerRef, showBadge = true }: {
  token: string | null; workspaceId?: string; triggerRef?: Ref<HTMLButtonElement>; showBadge?: boolean;
}) {
  const id = useId();
  const [panelPosition, setPanelPosition] = useState({
    left: 12,
    top: 68,
  });

  function positionPanel(trigger: HTMLElement) {
    const rect = trigger.getBoundingClientRect();

    const width = Math.min(430, window.innerWidth - 24);

    const left = Math.max(
      12,
      Math.min(
        rect.right - width,
        window.innerWidth - width - 12,
      ),
    );

    setPanelPosition({
      left,
      top: rect.bottom + 10,
    });
  }

  const [updates, setUpdates] = useState<Update[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [category, setCategory] = useState('');
  const [showPreferences, setShowPreferences] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>();
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [preferenceError, setPreferenceError] = useState('');

  async function loadPreferences() {
    setPreferenceBusy(true);
    setPreferenceError('');
    try {
      setPreferences(await request<Preferences>('/preferences'));
    } catch {
      setPreferenceError('Could not load notification preferences.');
    } finally {
      setPreferenceBusy(false);
    }
  }

  async function savePreference(key: keyof Preferences, enabled: boolean) {
    setPreferenceBusy(true);
    setPreferenceError('');
    try {
      await workspaceRequest('notifications/preferences', token, jsonRequest('PATCH', { category: key, enabled }));
      setPreferences(current => current && { ...current, [key]: enabled });
    } catch {
      setPreferenceError('Could not save this preference. Try again.');
    } finally {
      setPreferenceBusy(false);
    }
  }

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

  async function refresh(mark?: string, nextPage = 1, onlyUnread = unreadOnly, filter = category) {
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
          setUpdates(current => current.map(update => update.id === mark ? { ...update, readAt: updated.readAt } : update));
        }
      }
      if (!mark || onlyUnread) {
        if (mark) nextPage = 1;
        const results = await request<Update[]>(`?limit=${limit}&page=${nextPage}&unreadOnly=${onlyUnread}${filter ? '&category=' + encodeURIComponent(filter) : ''}`);
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
      const invitationStatus = action === 'accept' ? 'ACCEPTED' : 'REJECTED';
      setUpdates(current => current.map(item => item.id === update.id ? { ...item, invitationStatus } : item));
      if (!update.readAt) {
        const marked = await request<Update>('/' + update.id + '/read', 'PATCH').catch(() => undefined);
        if (marked) setUpdates(current => current.map(item => item.id === marked.id ? { ...item, readAt: marked.readAt } : item));
        void request<{ count: number }>('/unread-count').then(result => setCount(result.count)).catch(() => {});
      }
      if (action === 'accept') location.assign('/workspaces/' + update.workspaceId);
      else if (unreadOnly) {
        const results = await request<Update[]>(`?limit=${limit}&unreadOnly=true${category ? '&category=' + encodeURIComponent(category) : ''}`);
        setUpdates(results);
        setPage(1);
        setMore(results.length === limit);
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
    if (update.type === 'WORKSPACE_INVITATION' && update.invitationStatus === 'ACCEPTED') return base;
    if (update.relatedResourceType === 'workspace_chat') return base + '?page=chat';
    if (update.relatedResourceType === 'task') return base + '?page=board&task=' + encodeURIComponent(update.relatedResourceId);
    if (update.relatedResourceType === 'direct_conversation') return base + '?page=chat#dm-' + encodeURIComponent(update.relatedResourceId);
  }

  const visible = updates.filter(update => !unreadOnly || !update.readAt);
  const displayedNotifications = showAllNotifications
    ? visible
    : visible.slice(0, 2);
  const today = new Date().toDateString();
  const previousDay = new Date();
  previousDay.setDate(previousDay.getDate() - 1);
  const yesterday = previousDay.toDateString();
  const groups = [
    { label: 'Today', items: displayedNotifications.filter(update => new Date(update.createdAt).toDateString() === today) },
    { label: 'Yesterday', items: displayedNotifications.filter(update => new Date(update.createdAt).toDateString() === yesterday) },
    { label: 'Earlier', items: displayedNotifications.filter(update => ![today, yesterday].includes(new Date(update.createdAt).toDateString())) },
  ];
  const menu = useHoverPopover<HTMLElement>(trigger => { if (trigger) positionPanel(trigger); void refresh(); });
  return <>
    <button {...menu.triggerProps} ref={node => { menu.triggerProps.ref.current = node; if (typeof triggerRef === 'function') triggerRef(node); else if (triggerRef) triggerRef.current = node; }} type="button" className="wu-icon-button wu-inbox-trigger" aria-label={showBadge && count ? `Notifications, ${count} unread` : 'Notifications'} popoverTarget={id}
><Bell size={18} />{showBadge && !!count && <span aria-hidden="true">{count > 99 ? '99+' : count}</span>}</button>
    <section {...menu.panelProps} id={id} popover="auto" className="wu-inbox"
      aria-label="Notifications"
      aria-busy={busy}
      style={{
        left: panelPosition.left,
        top: panelPosition.top,
        right: 'auto',
        bottom: 'auto',
      }}>
      <div className="wu-panel-heading">
        <div className="wu-inbox-title">
          <h2>Notifications</h2>
          <p>Stay updated on your workspaces</p>
        </div>
        <div className="wu-inbox-actions">
          <button className="wu-text-button" type="button" disabled={busy || !count} onClick={() => void refresh('all')}>Mark all as read</button>
          <button className="wu-icon-button" type="button" aria-label="Notification preferences" aria-expanded={showPreferences}
            onClick={() => { setShowPreferences(!showPreferences); if (!showPreferences && !preferences) void loadPreferences(); }}><Settings2 size={17} /></button>
        </div>
      </div>
      {showPreferences && <fieldset className="wu-inbox-preferences" disabled={preferenceBusy}>
        <legend>Notify me about</legend>
        {preferenceBusy && !preferences && <p role="status">Loading preferences…</p>}
        {preferenceError && <p role="alert">{preferenceError} {!preferences && <button className="wu-text-button" type="button" onClick={() => void loadPreferences()}>Retry</button>}</p>}
        {preferences && (Object.keys(preferenceLabels) as (keyof Preferences)[]).map(key => <label className="wu-check-row" key={key}>
          <input type="checkbox" checked={preferences[key]} onChange={event => void savePreference(key, event.currentTarget.checked)} /> {preferenceLabels[key]}
        </label>)}
      </fieldset>}
      {showPreferences && (
<div className="wu-inbox-filters">
      <Select aria-label="Notification category" value={category} disabled={busy} onChange={event => {
        const value = event.currentTarget.value;
        setCategory(value);
        void refresh(undefined, 1, unreadOnly, value);
      }}>
        <option value="">All categories</option>
        <option value="assignments">Assignments</option><option value="mentions">Mentions</option>
        <option value="comments">Comments</option><option value="status">Status changes</option>
        <option value="invitations">Invitations</option><option value="messages">Messages</option>
      </Select>
      <label className="wu-check-row"><input type="checkbox" checked={unreadOnly} disabled={busy} onChange={event => { const value = event.target.checked; setUnreadOnly(value); void refresh(undefined, 1, value); }} /> Unread only</label>
      </div>
)}
      {error && <p role="alert">{error} <button className="wu-text-button" type="button" onClick={() => void refresh()}>Refresh</button></p>}
      {busy && !updates.length && <p role="status">Loading notifications…</p>}
      {!busy && !error && !visible.length && <IllustratedEmptyState compact kind="notifications" title={unreadOnly ? 'You’re all caught up' : 'No notifications yet'} detail="New notifications will appear here." />}
      {groups.map(group => group.items.length > 0 && (
        <section key={group.label} className="wu-notification-group">
          <h3>{group.label}</h3>

          <ul className="wu-notification-list">
            {group.items.map(update => {
              const isInvitation = update.type === 'WORKSPACE_INVITATION';
              const isPending = isInvitation && update.invitationStatus === 'PENDING';
              const isAccepted = isInvitation && update.invitationStatus === 'ACCEPTED';
              const link = relatedLink(update);

              return (
                <li
                  key={update.id}
                  className="wu-notification-card"
                  data-unread={!update.readAt}
                >
                  <div className="wu-notification-content">
                    <span
                      className={
                        'wu-notification-icon' +
                        (isAccepted ? ' wu-notification-icon--success' : '')
                      }
                    >
                      {isAccepted ? (
                        <CheckCircle2 size={20} aria-hidden="true" />
                      ) : (
                        <Users size={20} aria-hidden="true" />
                      )}
                    </span>

                    <div className="wu-notification-copy">
                      <p>
                        {isInvitation && update.invitationStatus === 'ACCEPTED'
                          ? update.message.replace(
                              /^You were invited to/,
                              'You accepted the invitation to',
                            )
                          : isInvitation && update.invitationStatus === 'REJECTED'
                            ? update.message.replace(
                                /^You were invited to/,
                                'You declined the invitation to',
                              )
                            : update.message}
                      </p>
                      <time dateTime={update.createdAt}>
                        {new Date(update.createdAt).toLocaleString()}
                      </time>

                      {isInvitation && !isPending &&
                        !['ACCEPTED', 'REJECTED'].includes(update.invitationStatus ?? '') && (
                          <p className="wu-notification-status">
                            {invitationLabels[update.invitationStatus ?? 'UNAVAILABLE']}
                          </p>
                        )}
                    </div>

                    {!update.readAt && (
                      <span
                        className="wu-notification-unread-dot"
                        aria-label="Unread"
                      />
                    )}
                  </div>

                  <div className="wu-notification-actions">
                    {isPending && (
                      <>
                        <button
                          className="wu-notification-action wu-notification-action--accept"
                          type="button"
                          disabled={busy}
                          onClick={() => void respond(update, 'accept')}
                        >
                          <Check size={15} aria-hidden="true" />
                          Accept
                        </button>

                        <button
                          className="wu-notification-action"
                          type="button"
                          disabled={busy}
                          onClick={() => void respond(update, 'reject')}
                        >
                          <X size={15} aria-hidden="true" />
                          Decline
                        </button>
                      </>
                    )}

                    {link && !(isInvitation && !isPending) && (
                      <a
                        className="wu-notification-action"
                        href={link}
                        onClick={event => {
                          if (
                            update.readAt ||
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.altKey
                          ) return;

                          event.preventDefault();
                          const href = event.currentTarget.href;

                          void request('/' + update.id + '/read', 'PATCH')
                            .finally(() => location.assign(href))
                            .catch(() => {});
                        }}
                      >
                        Open
                      </a>
                    )}

                    {!update.readAt && (
                      <button
                        className="wu-text-button wu-notification-secondary"
                        type="button"
                        disabled={busy}
                        onClick={() => void refresh(update.id)}
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <div className="wu-inbox-footer">
        <button
          type="button"
          className="wu-inbox-view-all"
          onClick={() => setShowAllNotifications(value => !value)}
        >
          {showAllNotifications
            ? 'Show fewer notifications'
            : 'View all notifications'}
          <span aria-hidden="true">
            {showAllNotifications ? '↑' : '→'}
          </span>
        </button>
      </div>

      {showAllNotifications && more && <button className="wu-text-button" type="button" disabled={busy} onClick={() => void refresh(undefined, page + 1)}>Load more</button>}
    </section>
  </>;
}
