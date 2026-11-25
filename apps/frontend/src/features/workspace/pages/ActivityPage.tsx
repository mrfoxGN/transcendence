import {
  Activity,
  ArrowRight,
  ArrowRightLeft,
  CircleAlert,
  FileMinus,
  FilePenLine,
  FileUp,
  GitBranch,
  ListPlus,
  Settings,
  Shield,
  StickyNote,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useId, useState } from 'react';
import { Select } from '../../../shared/controls/Select';
import { IllustratedEmptyState } from '../../../shared/illustrations/EmptyIllustration';
import { Button, Input } from '../../../shared/ui';
import { Avatar, FilterChips, Panel, Pill } from '../components';
import type { PageHeading } from '../types';
import { useWorkspaceData } from '../workspace-api';
import { addCalendarDays, calendarDate, formatCalendarDate } from '../workspace-calendar';
import { statusLabels, type Member } from '../workspace-tasks';
import './activity.css';

export type ActivityEvent = {
  id: string;
  actorUserId: string | null;
  actionType: string;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
  resourceState?: 'available' | 'deleted';
  actorName?: string;
  subjectName?: string;
};
const eventStyles: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  TASK_CREATED: { label: 'Created a task', icon: ListPlus, tone: 'blue' },
  TASK_STATUS_CHANGED: { label: 'Moved a task', icon: ArrowRightLeft, tone: 'violet' },
  TASK_ASSIGNED: { label: 'Assigned a task', icon: UserPlus, tone: 'blue' },
  TASK_UNASSIGNED: { label: 'Unassigned a task', icon: UserMinus, tone: 'violet' },
  TASK_BLOCKED: { label: 'Blocked a task', icon: CircleAlert, tone: 'orange' },
  TASK_UNBLOCKED: { label: 'Unblocked a task', icon: Activity, tone: 'mint' },
  TASK_DELETED: { label: 'Deleted a task', icon: FileMinus, tone: 'red' },
  FILE_UPLOADED: { label: 'Uploaded a file', icon: FileUp, tone: 'blue' },
  FILE_DELETED: { label: 'Deleted a file', icon: FileMinus, tone: 'red' },
  FILE_RENAMED: { label: 'Renamed a file', icon: FilePenLine, tone: 'blue' },
  MEMBER_JOINED: { label: 'A member joined', icon: UserPlus, tone: 'mint' },
  MEMBER_REMOVED: { label: 'Removed a member', icon: UserMinus, tone: 'red' },
  MEMBER_LEFT: { label: 'A member left', icon: UserMinus, tone: 'neutral' },
  NOTE_CREATED: { label: 'Created a note', icon: StickyNote, tone: 'blue' },
  NOTE_UPDATED: { label: 'Edited a note', icon: StickyNote, tone: 'violet' },
  NOTE_PINNED: { label: 'Pinned a note', icon: StickyNote, tone: 'violet' },
  NOTE_UNPINNED: { label: 'Unpinned a note', icon: StickyNote, tone: 'neutral' },
  NOTE_RESTORED: { label: 'Restored a note revision', icon: StickyNote, tone: 'violet' },
  NOTE_DELETED: { label: 'Deleted a note', icon: FileMinus, tone: 'red' },
  BOARD_SETTINGS_UPDATED: { label: 'Updated board settings', icon: Settings, tone: 'violet' },
  GITHUB_SYNC_COMPLETED: { label: 'Synced GitHub commits', icon: GitBranch, tone: 'mint' },
  GITHUB_SYNC_FAILED: { label: 'GitHub sync failed', icon: GitBranch, tone: 'red' },
  AUDIT_MEMBER_REMOVED: { label: 'Revoked workspace membership', icon: Shield, tone: 'red' },
  AUDIT_OWNERSHIP_TRANSFERRED: {
    label: 'Transferred workspace ownership',
    icon: Shield,
    tone: 'violet',
  },
  AUDIT_WORKSPACE_ARCHIVED: { label: 'Archived the workspace', icon: Shield, tone: 'orange' },
  AUDIT_WORKSPACE_RESTORED: { label: 'Restored the workspace', icon: Shield, tone: 'mint' },
  AUDIT_INVITATION_CREATED: { label: 'Created an invitation', icon: Shield, tone: 'blue' },
  AUDIT_INVITATION_RESENT: { label: 'Resent an invitation', icon: Shield, tone: 'blue' },
  AUDIT_INVITATION_REVOKED: { label: 'Revoked an invitation', icon: Shield, tone: 'red' },
};
const resourceActions: Record<string, string> = {
  task: 'Open task',
  workspace_file: 'Open file',
  note: 'Open note',
  github: 'View GitHub',
  board_settings: 'Open board settings',
  workspace_access: 'View team',
  workspace_invitation: 'View invitations',
  workspace_membership: 'View team',
  workspace_archive: 'Open archive settings',
};
const fallbackEvent = { label: 'Updated the workspace', icon: Activity, tone: 'neutral' };

function HomeActivityFeed({
  items,
  members,
  openResource,
  today,
  timeZone,
}: {
  items: ActivityEvent[];
  members: Member[];
  openResource: (event: ActivityEvent) => boolean;
  today: string;
  timeZone: string;
}) {
  const id = useId();
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const clock = new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  });
  const stamp = new Intl.DateTimeFormat(undefined, {
    timeZone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const sorted = [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return (
    <div className="wu-home-activity-groups">
      {['Today', 'Earlier'].map((group, index) => {
        const events = sorted.filter(
          (event) => (day.format(new Date(event.createdAt)) === today) === (group === 'Today'),
        );
        if (!events.length) return null;
        return (
          <section key={group} aria-labelledby={id + '-' + index}>
            <h3 id={id + '-' + index}>{group}</h3>
            <ul>
              {events.map((event) => {
                const member = members.find((person) => person.userId === event.actorUserId);
                const actor =
                  event.actorName ??
                  member?.username ??
                  (event.actorUserId ? 'Former member' : 'Workspace');
                const initials = actor
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join('')
                  .toUpperCase();
                const label = eventStyles[event.actionType]?.label ?? fallbackEvent.label;
                const action =
                  event.actionType === 'MEMBER_JOINED'
                    ? 'joined the workspace'
                    : event.actionType === 'MEMBER_LEFT'
                      ? 'left the workspace'
                      : label.toLowerCase();
                const title = event.metadata?.title ?? event.metadata?.displayName;
                const deleted =
                  event.resourceState === 'deleted' ||
                  ['TASK_DELETED', 'FILE_DELETED', 'NOTE_DELETED'].includes(event.actionType);
                const resourceAction = resourceActions[event.resourceType ?? ''];
                return (
                  <li key={event.id}>
                    <span className="wu-home-activity-avatar" aria-hidden="true">
                      {member?.avatarUrl ? (
                        <img src={member.avatarUrl} alt="" />
                      ) : (
                        <Avatar initials={initials} preview={false} small />
                      )}
                    </span>
                    <div className="wu-home-activity-copy">
                      <p>
                        <strong>{actor}</strong> {action}
                      </p>
                      {typeof title === 'string' &&
                        title &&
                        (event.resourceId && resourceAction && !deleted ? (
                          <button
                            type="button"
                            aria-label={resourceAction + ': ' + title}
                            onClick={() => openResource(event)}
                          >
                            {title}
                          </button>
                        ) : (
                          <span className="wu-home-activity-resource">
                            {title}
                            {deleted ? ' · Deleted' : ''}
                          </span>
                        ))}
                    </div>
                    <time
                      dateTime={event.createdAt}
                      title={stamp.format(new Date(event.createdAt))}
                    >
                      {group === 'Today'
                        ? clock.format(new Date(event.createdAt))
                        : stamp.format(new Date(event.createdAt))}
                    </time>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function WorkspaceActivityList({
  items,
  members,
  openResource,
  home = false,
  today,
  timeZone = 'Africa/Casablanca',
}: {
  items: ActivityEvent[];
  members: Member[];
  openResource: (event: ActivityEvent) => boolean;
  home?: boolean;
  today?: string;
  timeZone?: string;
}) {
  if (!items.length)
    return (
      <IllustratedEmptyState
        compact
        kind="activity"
        title="No activity in this view"
        detail="Updates will appear as your team works."
      />
    );
  if (home && today)
    return (
      <HomeActivityFeed
        items={items}
        members={members}
        openResource={openResource}
        today={today}
        timeZone={timeZone}
      />
    );
  const currentDay = today ?? calendarDate(new Date(), timeZone);
  const clock = new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  });
  const fullTime = new Intl.DateTimeFormat(undefined, {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const groups = new Map<string, ActivityEvent[]>();
  for (const event of [...items].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )) {
    const day = calendarDate(new Date(event.createdAt), timeZone);
    groups.set(day, [...(groups.get(day) ?? []), event]);
  }
  const labelForDay = (day: string) =>
    day === currentDay
      ? 'Today'
      : day === addCalendarDays(currentDay, -1)
        ? 'Yesterday'
        : formatCalendarDate(day, { month: 'long', day: 'numeric', year: 'numeric' });
  return (
    <div className="wu-activity-timeline">
      {[...groups].map(([day, events]) => (
        <section className="wu-activity-day" key={day} aria-label={labelForDay(day)}>
          <h2 className="wu-activity-day-heading">
            {labelForDay(day)}
            <span>
              {events.length} {events.length === 1 ? 'event' : 'events'}
            </span>
          </h2>
          <ul className="wu-event-feed">
            {events.map((event) => {
              const { label, icon: Icon, tone } = eventStyles[event.actionType] ?? fallbackEvent;
              const member = members.find((person) => person.userId === event.actorUserId);
              const actor =
                event.actorName ??
                member?.username ??
                (event.actorUserId ? 'Former member' : 'Workspace');
              const initials = actor
                .split(/\s+/)
                .slice(0, 2)
                .map((word) => word[0])
                .join('')
                .toUpperCase();
              const title =
                event.metadata?.title ?? event.metadata?.displayName ?? event.subjectName;
              const resourceLabel = resourceActions[event.resourceType ?? ''];
              const deleted =
                event.resourceState === 'deleted' ||
                ['TASK_DELETED', 'FILE_DELETED', 'NOTE_DELETED'].includes(event.actionType);
              const target = event.metadata?.assigneeId ?? event.metadata?.memberUserId;
              const person =
                typeof target === 'string'
                  ? members.find((member) => member.userId === target)?.username
                  : undefined;
              const fields = Array.isArray(event.metadata?.fields)
                ? event.metadata.fields.filter((field) => typeof field === 'string').join(', ')
                : '';
              const from = event.metadata?.fromStatus,
                to = event.metadata?.toStatus;
              const validStatus = (value: unknown): value is keyof typeof statusLabels =>
                typeof value === 'string' && Object.hasOwn(statusLabels, value);
              const action =
                event.actionType === 'MEMBER_JOINED'
                  ? 'joined the workspace'
                  : event.actionType === 'MEMBER_LEFT'
                    ? 'left the workspace'
                    : label.toLowerCase();
              return (
                <li key={event.id} className="wu-event-row">
                  <span className="wu-event-avatar" aria-hidden="true">
                    <Avatar initials={initials} tone="violet" preview={false} />
                    {member?.avatarUrl && (
                      <img
                        src={member.avatarUrl}
                        alt=""
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <span className={`wu-event-marker wu-event-icon--${tone}`}>
                      <Icon size={11} />
                    </span>
                  </span>
                  <div className="wu-event-copy">
                    <p>
                      <strong>{actor}</strong> {action}
                    </p>
                    {typeof title === 'string' && title && (
                      <div className="wu-event-subject">{title}</div>
                    )}
                    {event.actionType === 'TASK_STATUS_CHANGED' &&
                      validStatus(from) &&
                      validStatus(to) && (
                        <div className="wu-event-transition">
                          <Pill status={from}>{statusLabels[from]}</Pill>
                          <ArrowRight size={12} aria-hidden="true" />
                          <Pill status={to}>{statusLabels[to]}</Pill>
                        </div>
                      )}
                    {(person || fields) && (
                      <small>{[person, fields].filter(Boolean).join(' · ')}</small>
                    )}
                  </div>
                  <time
                    className="wu-event-time"
                    dateTime={event.createdAt}
                    title={fullTime.format(new Date(event.createdAt))}
                  >
                    {clock.format(new Date(event.createdAt))}
                  </time>
                  <div className="wu-event-action">
                    {deleted ? (
                      <span className="wu-muted">Deleted</span>
                    ) : (
                      event.resourceId &&
                      resourceLabel && (
                        <button
                          type="button"
                          className="wu-text-button"
                          aria-label={
                            typeof title === 'string' ? resourceLabel + ': ' + title : resourceLabel
                          }
                          onClick={() => openResource(event)}
                        >
                          {resourceLabel}
                          <ArrowRight size={13} aria-hidden="true" />
                        </button>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

const categories: Record<string, string> = {
  Tasks: 'tasks',
  Files: 'files',
  Notes: 'notes',
  Members: 'members',
  Board: 'board',
  GitHub: 'github',
};

function ActivityResults({
  path,
  token,
  page,
  members,
  openResource,
  changePage,
  today,
  timeZone,
}: {
  path: string;
  token: string | null;
  page: number;
  members: Member[];
  openResource: (event: ActivityEvent) => boolean;
  changePage: (page: number) => void;
  today: string;
  timeZone: string;
}) {
  const events = useWorkspaceData<{ items: ActivityEvent[]; hasNext: boolean }>(path, token);
  return (
    <Panel className="wu-content-panel wu-activity-results">
      {events.error ? (
        <p role="alert">
          Could not load activity.{' '}
          <button type="button" onClick={events.retry}>
            Try again
          </button>
        </p>
      ) : !events.data ? (
        <p role="status">Loading activity…</p>
      ) : (
        <WorkspaceActivityList
          items={events.data.items}
          members={members}
          openResource={openResource}
          today={today}
          timeZone={timeZone}
        />
      )}
      <nav className="wu-activity-pagination" aria-label="Activity pages">
        <Button
          variant="secondary"
          type="button"
          disabled={page === 1}
          onClick={() => changePage(page - 1)}
        >
          Previous
        </Button>
        <span className="wu-muted">Page {page}</span>
        <Button
          variant="secondary"
          type="button"
          disabled={events.error || !events.data?.hasNext}
          onClick={() => changePage(page + 1)}
        >
          Next
        </Button>
      </nav>
    </Panel>
  );
}

export function ActivityPage({
  pageHeading,
  path,
  token,
  members,
  openResource,
  canAudit,
  today,
  timeZone,
}: {
  pageHeading: PageHeading;
  path: string;
  token: string | null;
  members: Member[];
  openResource: (event: ActivityEvent) => boolean;
  canAudit: boolean;
  today: string;
  timeZone: string;
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
  const invalidRange =
    (from && !Number.isFinite(from.getTime())) ||
    (before && !Number.isFinite(before.getTime())) ||
    (from && before && from >= before);
  const query = new URLSearchParams({ page: String(page) });
  if (!audit && categories[filter]) query.set('category', categories[filter]);
  if (actor) query.set('actorUserId', actor);
  if (!invalidRange && from) query.set('from', from.toISOString());
  if (!invalidRange && before) query.set('before', before.toISOString());
  const resultsPath = path + '/activities/' + (audit ? 'audit?' : 'page?') + query;

  return (
    <>
      {pageHeading()}
      <div className="wu-activity-workbench">
        <div className="wu-activity-toolbar">
          {canAudit && (
            <div role="group" aria-label="History view">
              <FilterChips
                items={['Activity', 'Audit trail']}
                active={audit ? 'Audit trail' : 'Activity'}
                onChange={(value) => {
                  setScope(value);
                  setPage(1);
                }}
              />
            </div>
          )}
          {!audit && (
            <FilterChips
              items={['All activity', ...Object.keys(categories)]}
              active={filter}
              onChange={(value) => {
                setFilter(value);
                setPage(1);
              }}
            />
          )}
          <div className="wu-activity-fields">
            <label className="wu-field-label">
              Actor
              <Select
                value={actor}
                onChange={(event) => {
                  setActor(event.currentTarget.value);
                  setPage(1);
                }}
              >
                <option value="">Anyone</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.username}
                  </option>
                ))}
              </Select>
            </label>
            <label className="wu-field-label">
              From
              <Input
                type="date"
                value={fromDate}
                aria-invalid={!!invalidRange}
                onChange={(event) => {
                  setFromDate(event.currentTarget.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="wu-field-label">
              Through
              <Input
                type="date"
                value={throughDate}
                aria-invalid={!!invalidRange}
                onChange={(event) => {
                  setThroughDate(event.currentTarget.value);
                  setPage(1);
                }}
              />
            </label>
          </div>
          {(filter !== 'All activity' || actor || fromDate || throughDate) && (
            <button
              type="button"
              className="wu-text-button wu-activity-clear"
              onClick={() => {
                setFilter('All activity');
                setActor('');
                setFromDate('');
                setThroughDate('');
                setPage(1);
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        <p className="wu-activity-context">
          {audit ? 'Workspace access and administration history' : 'Workspace updates'}
          <span>Times shown in {timeZone}</span>
        </p>
        {invalidRange ? (
          <p role="alert">Choose valid dates with From on or before Through.</p>
        ) : (
          <ActivityResults
            key={resultsPath}
            path={resultsPath}
            token={token}
            page={page}
            members={members}
            openResource={openResource}
            changePage={setPage}
            today={today}
            timeZone={timeZone}
          />
        )}
      </div>
    </>
  );
}
