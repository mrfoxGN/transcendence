import { useState } from 'react';
import { Activity, ArrowRight, ArrowRightLeft, FileMinus, FileUp, ListPlus, UserMinus, UserPlus, type LucideIcon } from 'lucide-react';
import { FilterChips, Panel } from '../components';
import { useWorkspaceData } from '../workspace-api';
import type { Member } from '../workspace-tasks';
import type { PageHeading } from '../types';
import './activity.css';

export type ActivityEvent = {
  id: string; actorUserId: string | null; actionType: string; resourceType: string | null;
  resourceId: string | null; createdAt: string; metadata: Record<string, unknown> | null;
};
const eventStyles: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  TASK_CREATED: { label: 'Created a task', icon: ListPlus, tone: 'blue' },
  TASK_STATUS_CHANGED: { label: 'Moved a task', icon: ArrowRightLeft, tone: 'violet' },
  FILE_UPLOADED: { label: 'Uploaded a file', icon: FileUp, tone: 'orange' },
  FILE_DELETED: { label: 'Deleted a file', icon: FileMinus, tone: 'red' },
  MEMBER_JOINED: { label: 'A member joined', icon: UserPlus, tone: 'mint' },
  MEMBER_REMOVED: { label: 'Removed a member', icon: UserMinus, tone: 'red' },
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
    const resourceLabel = event.resourceType === 'task' ? 'Open task' : 'Open file';
    return <li key={event.id} className="wu-event-row">
      <span className={`wu-event-icon wu-event-icon--${tone}`} aria-hidden="true"><Icon size={17} /></span>
      <div className="wu-event-copy">
        <p>{label}{typeof title === 'string' && title && <>: <strong>{title}</strong></>}</p>
        <span>{members.find(member => member.userId === event.actorUserId)?.username ?? 'Workspace activity'}</span>
      </div>
      <time className="wu-event-time" dateTime={event.createdAt}>{eventTime.format(new Date(event.createdAt))}</time>
      <div className="wu-event-action">
        {event.resourceId && (event.resourceType === 'task' || event.actionType === 'FILE_UPLOADED') &&
          <button type="button" className="wu-text-button" aria-label={typeof title === 'string' ? resourceLabel + ': ' + title : resourceLabel}
            onClick={() => openResource(event)}>{resourceLabel}<ArrowRight size={13} aria-hidden="true" /></button>}
      </div>
    </li>;
  })}</ul>;
}

const categories: Record<string, string> = { Tasks: 'tasks', Files: 'files', Members: 'members' };

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

export function ActivityPage({ pageHeading, path, token, members, openResource }: {
  pageHeading: PageHeading; path: string; token: string | null; members: Member[];
  openResource: (event: ActivityEvent) => boolean;
}) {
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
  if (categories[filter]) query.set('category', categories[filter]);
  if (actor) query.set('actorUserId', actor);
  if (!invalidRange && from) query.set('from', from.toISOString());
  if (!invalidRange && before) query.set('before', before.toISOString());
  const resultsPath = path + '/activities/page?' + query;

  return <>{pageHeading()}
    <div className="wu-activity-toolbar">
      <FilterChips items={['All activity', ...Object.keys(categories)]} active={filter} onChange={value => { setFilter(value); setPage(1); }} />
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
