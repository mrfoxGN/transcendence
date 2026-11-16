import { useState } from 'react';
import { Activity, ArrowRight, ArrowRightLeft, CircleAlert, FileMinus, FilePenLine, FileUp, GitBranch, ListPlus, Settings, Shield, StickyNote, UserMinus, UserPlus, type LucideIcon } from 'lucide-react';
import { FilterChips, Panel } from '../components';
import { useWorkspaceData } from '../workspace-api';
import type { Member } from '../workspace-tasks';
import type { PageHeading } from '../types';
import './activity.css';

export type ActivityEvent = {
  id: string; actorUserId: string | null; actionType: string; resourceType: string | null;
  resourceId: string | null; createdAt: string; metadata: Record<string, unknown> | null;
  resourceState?: 'available' | 'deleted';
  actorName?: string; subjectName?: string;
};
const eventStyles: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  TASK_CREATED: { label: 'Created a task', icon: ListPlus, tone: 'blue' },
  TASK_STATUS_CHANGED: { label: 'Moved a task', icon: ArrowRightLeft, tone: 'violet' },
  TASK_ASSIGNED: { label: 'Assigned a task', icon: UserPlus, tone: 'blue' },
  TASK_UNASSIGNED: { label: 'Unassigned a task', icon: UserMinus, tone: 'violet' },
  TASK_BLOCKED: { label: 'Blocked a task', icon: CircleAlert, tone: 'orange' },
  TASK_UNBLOCKED: { label: 'Unblocked a task', icon: Activity, tone: 'mint' },
  TASK_DELETED: { label: 'Deleted a task', icon: FileMinus, tone: 'red' },
  FILE_UPLOADED: { label: 'Uploaded a file', icon: FileUp, tone: 'orange' },
  FILE_DELETED: { label: 'Deleted a file', icon: FileMinus, tone: 'red' },
  FILE_RENAMED: { label: 'Renamed a file', icon: FilePenLine, tone: 'blue' },
  MEMBER_JOINED: { label: 'A member joined', icon: UserPlus, tone: 'mint' },
  MEMBER_REMOVED: { label: 'Removed a member', icon: UserMinus, tone: 'red' },
  MEMBER_LEFT: { label: 'A member left', icon: UserMinus, tone: 'neutral' },
  NOTE_CREATED: { label: 'Created a note', icon: StickyNote, tone: 'blue' },
  NOTE_UPDATED: { label: 'Edited a note', icon: StickyNote, tone: 'violet' },
  NOTE_PINNED: { label: 'Pinned a note', icon: StickyNote, tone: 'mint' },
  NOTE_UNPINNED: { label: 'Unpinned a note', icon: StickyNote, tone: 'neutral' },
  NOTE_RESTORED: { label: 'Restored a note revision', icon: StickyNote, tone: 'violet' },
  NOTE_DELETED: { label: 'Deleted a note', icon: FileMinus, tone: 'red' },
  BOARD_SETTINGS_UPDATED: { label: 'Updated board settings', icon: Settings, tone: 'violet' },
  GITHUB_SYNC_COMPLETED: { label: 'Synced GitHub commits', icon: GitBranch, tone: 'mint' },
  GITHUB_SYNC_FAILED: { label: 'GitHub sync failed', icon: GitBranch, tone: 'red' },
  AUDIT_MEMBER_REMOVED: { label: 'Revoked workspace membership', icon: Shield, tone: 'red' },
  AUDIT_OWNERSHIP_TRANSFERRED: { label: 'Transferred workspace ownership', icon: Shield, tone: 'violet' },
  AUDIT_WORKSPACE_ARCHIVED: { label: 'Archived the workspace', icon: Shield, tone: 'orange' },
  AUDIT_WORKSPACE_RESTORED: { label: 'Restored the workspace', icon: Shield, tone: 'mint' },
  AUDIT_INVITATION_CREATED: { label: 'Created an invitation', icon: Shield, tone: 'blue' },
  AUDIT_INVITATION_RESENT: { label: 'Resent an invitation', icon: Shield, tone: 'blue' },
  AUDIT_INVITATION_REVOKED: { label: 'Revoked an invitation', icon: Shield, tone: 'red' },
};
const resourceActions: Record<string, string> = {
  task: 'Open task', workspace_file: 'Open file', note: 'Open note', github: 'View GitHub', board_settings: 'Open board settings',
  workspace_access: 'View team', workspace_invitation: 'View invitations', workspace_membership: 'View team', workspace_archive: 'Open archive settings',
};
const fallbackEvent = { label: 'Updated the workspace', icon: Activity, tone: 'neutral' };
const eventTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function WorkspaceActivityList({ items, members, openResource }: {
  items: ActivityEvent[]; members: Member[]; openResource: (event: ActivityEvent) => boolean;
}) {
  if (!items.length) return <p className="wu-muted">No activity in this view.</p>;
  return <ul className="wu-event-feed">{items.map(event => {
    const { label, icon: Icon, tone } = eventStyles[event.actionType] ?? fallbackEvent;
    const title = event.metadata?.title ?? event.metadata?.displayName;
    const resourceLabel = resourceActions[event.resourceType ?? ''];
    const deleted = event.resourceState === 'deleted' || ['TASK_DELETED', 'FILE_DELETED', 'NOTE_DELETED'].includes(event.actionType);
    const target = event.metadata?.assigneeId ?? event.metadata?.memberUserId;
    const person = event.subjectName ?? (typeof target === 'string' ? members.find(member => member.userId === target)?.username : undefined);
    const fields = Array.isArray(event.metadata?.fields) ? event.metadata.fields.filter(field => typeof field === 'string').join(', ') : '';
    return <li key={event.id} className="wu-event-row">
      <span className={`wu-event-icon wu-event-icon--${tone}`} aria-hidden="true"><Icon size={17} /></span>
      <div className="wu-event-copy">
        <p>{label}{typeof title === 'string' && title && <>: <strong>{title}</strong></>}</p>
        <span>{event.actorName ?? members.find(member => member.userId === event.actorUserId)?.username ?? (event.actorUserId ? 'Former member' : 'Workspace activity')}
          {person && <> · {person}</>}{fields && <> · {fields}</>}</span>
      </div>
      <time className="wu-event-time" dateTime={event.createdAt}>{eventTime.format(new Date(event.createdAt))}</time>
      <div className="wu-event-action">
        {deleted ? <span className="wu-muted">Deleted</span> : event.resourceId && resourceLabel &&
          <button type="button" className="wu-text-button" aria-label={typeof title === 'string' ? resourceLabel + ': ' + title : resourceLabel}
            onClick={() => openResource(event)}>{resourceLabel}<ArrowRight size={13} aria-hidden="true" /></button>}
      </div>
    </li>;
  })}</ul>;
}

const categories: Record<string, string> = { Tasks: 'tasks', Files: 'files', Notes: 'notes', Members: 'members', Board: 'board', GitHub: 'github' };

function ActivityResults({ path, token, page, members, openResource, changePage }: {
  path: string; token: string | null; page: number; members: Member[];
  openResource: (event: ActivityEvent) => boolean; changePage: (page: number) => void;
}) {
  const events = useWorkspaceData<{ items: ActivityEvent[]; hasNext: boolean }>(path, token);
  return <Panel className="wu-content-panel">
    {events.error ? <p role="alert">Could not load activity. <button type="button" onClick={events.retry}>Try again</button></p>
      : !events.data ? <p role="status">Loading activity…</p>
      : <WorkspaceActivityList items={events.data.items} members={members} openResource={openResource} />}
    <nav className="wu-activity-pagination" aria-label="Activity pages">
      <button className="wu-button wu-button--secondary" type="button" disabled={page === 1} onClick={() => changePage(page - 1)}>Previous</button>
      <span className="wu-muted">Page {page}</span>
      <button className="wu-button wu-button--secondary" type="button" disabled={events.error || !events.data?.hasNext} onClick={() => changePage(page + 1)}>Next</button>
    </nav>
  </Panel>;
}

export function ActivityPage({ pageHeading, path, token, members, openResource, canAudit }: {
  pageHeading: PageHeading; path: string; token: string | null; members: Member[];
  openResource: (event: ActivityEvent) => boolean;
  canAudit: boolean;
}) {
  const [scope, setScope] = useState('Activity');
  const audit = canAudit && scope === 'Audit trail';
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('All activity');
  const [actor, setActor] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [throughDate, setThroughDate] = useState('');
  const from = fromDate ? new Date(fromDate + 'T00:00:00') : undefined;
  const before = throughDate ? new Date(throughDate + 'T00:00:00') : undefined;
  if (before) before.setDate(before.getDate() + 1);
  const invalidRange = (from && !Number.isFinite(from.getTime()))
    || (before && !Number.isFinite(before.getTime()))
    || (from && before && from >= before);
  const query = new URLSearchParams({ page: String(page) });
  if (!audit && categories[filter]) query.set('category', categories[filter]);
  if (actor) query.set('actorUserId', actor);
  if (!invalidRange && from) query.set('from', from.toISOString());
  if (!invalidRange && before) query.set('before', before.toISOString());
  const resultsPath = path + '/activities/' + (audit ? 'audit?' : 'page?') + query;

  return <>{pageHeading()}
    <div className="wu-activity-toolbar">
      {canAudit && <div role="group" aria-label="History view"><FilterChips items={['Activity', 'Audit trail']} active={audit ? 'Audit trail' : 'Activity'}
        onChange={value => { setScope(value); setPage(1); }} /></div>}
      {!audit && <FilterChips items={['All activity', ...Object.keys(categories)]} active={filter} onChange={value => { setFilter(value); setPage(1); }} />}
      <div className="wu-activity-fields">
        <label className="wu-field-label">Actor
          <select value={actor} onChange={event => { setActor(event.currentTarget.value); setPage(1); }}>
            <option value="">Anyone</option>
            {members.map(member => <option key={member.userId} value={member.userId}>{member.username}</option>)}
          </select>
        </label>
        <label className="wu-field-label">From
          <input type="date" value={fromDate} aria-invalid={!!invalidRange}
            onChange={event => { setFromDate(event.currentTarget.value); setPage(1); }} />
        </label>
        <label className="wu-field-label">Through
          <input type="date" value={throughDate} aria-invalid={!!invalidRange}
            onChange={event => { setThroughDate(event.currentTarget.value); setPage(1); }} />
        </label>
      </div>
    </div>
    {invalidRange ? <p role="alert">Choose valid dates with From on or before Through.</p>
      : <ActivityResults key={resultsPath} path={resultsPath} token={token} page={page} members={members} openResource={openResource} changePage={setPage} />}
  </>;
}
