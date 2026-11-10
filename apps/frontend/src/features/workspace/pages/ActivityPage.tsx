import { useState } from 'react';
import { Activity, ArrowRight, ArrowRightLeft, FileMinus, FileUp, ListPlus, UserMinus, UserPlus, type LucideIcon } from 'lucide-react';
import { FilterChips, Panel } from '../components';
import { useWorkspaceCollection } from '../workspace-api';
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

const categories: Record<string, string> = { Tasks: 'TASK_', Files: 'FILE_', Members: 'MEMBER_' };

function ActivityResults({ path, token, page, filter, members, openResource, changePage }: {
  path: string; token: string | null; page: number; filter: string; members: Member[];
  openResource: (event: ActivityEvent) => boolean; changePage: (page: number) => void;
}) {
  const events = useWorkspaceCollection<ActivityEvent>(path + '/activities?limit=20&page=' + page, token);
  const shown = (events.items ?? []).filter(event => !categories[filter] || event.actionType.startsWith(categories[filter]));
  return <Panel className="wu-content-panel">
    {events.error ? <p role="alert">Could not load activity. <button type="button" onClick={events.retry}>Try again</button></p>
      : !events.items ? <p role="status">Loading activity…</p>
      : <WorkspaceActivityList items={shown} members={members} openResource={openResource} />}
    <nav className="wu-activity-pagination" aria-label="Activity pages">
      <button className="wu-button wu-button--secondary" type="button" disabled={page === 1} onClick={() => changePage(page - 1)}>Previous</button>
      <span className="wu-muted">Page {page}</span>
      <button className="wu-button wu-button--secondary" type="button" disabled={events.items?.length !== 20} onClick={() => changePage(page + 1)}>Next</button>
    </nav>
  </Panel>;
}

export function ActivityPage({ pageHeading, path, token, members, openResource }: {
  pageHeading: PageHeading; path: string; token: string | null; members: Member[];
  openResource: (event: ActivityEvent) => boolean;
}) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('All activity');
  return <>{pageHeading()}
    <div className="wu-activity-toolbar"><FilterChips items={['All activity', ...Object.keys(categories)]} active={filter} onChange={setFilter} /></div>
    <ActivityResults key={page} path={path} token={token} page={page} filter={filter} members={members} openResource={openResource} changePage={setPage} />
  </>;
}
