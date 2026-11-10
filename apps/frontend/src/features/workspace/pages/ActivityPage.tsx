import { useState } from 'react';
import { FilterChips, Panel } from '../components';
import { useWorkspaceCollection } from '../workspace-api';
import type { Member } from '../workspace-tasks';
import type { PageHeading } from '../types';
import './activity.css';

export type ActivityEvent = {
  id: string; actorUserId: string | null; actionType: string; resourceType: string | null;
  resourceId: string | null; createdAt: string; metadata: Record<string, unknown> | null;
};
const eventLabels: Record<string, string> = {
  TASK_CREATED: 'Created a task', TASK_STATUS_CHANGED: 'Moved a task',
  FILE_UPLOADED: 'Uploaded a file', FILE_DELETED: 'Deleted a file',
  MEMBER_JOINED: 'A member joined', MEMBER_REMOVED: 'Removed a member',
};

export function WorkspaceActivityList({ items, members, openResource }: {
  items: ActivityEvent[]; members: Member[]; openResource: (event: ActivityEvent) => boolean;
}) {
  if (!items.length) return <p className="wu-muted">No activity in this view.</p>;
  return <ul className="wu-document-list">{items.map(event => {
    const description = eventLabels[event.actionType] ?? 'Updated the workspace';
    const title = event.metadata?.title ?? event.metadata?.displayName;
    return <li key={event.id} className="wu-activity-item">
      <div><strong>{members.find(member => member.userId === event.actorUserId)?.username ?? 'Workspace activity'}</strong>
        <p>{description}{typeof title === 'string' ? ': ' + title : ''}</p></div>
      <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
      {event.resourceId && (event.resourceType === 'task' || event.actionType === 'FILE_UPLOADED') && <button type="button" className="wu-text-button" onClick={() => openResource(event)}>Open</button>}
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
    <div className="wu-modal-actions">
      <button className="wu-button wu-button--secondary" type="button" disabled={page === 1} onClick={() => changePage(page - 1)}>Previous</button>
      <span className="wu-muted">Page {page}</span>
      <button className="wu-button wu-button--secondary" type="button" disabled={events.items?.length !== 20} onClick={() => changePage(page + 1)}>Next</button>
    </div>
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
