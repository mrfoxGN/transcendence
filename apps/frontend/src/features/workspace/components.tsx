// Compatibility exports keep existing page imports stable during migration.
export {
  Avatar,
  EmptyState,
  FilterChips,
  IconTile,
  Card as Panel,
  Badge as Pill,
} from '../../shared/ui';
import { Avatar, Badge as Pill } from '../../shared/ui';
import type { Task } from './types';

export function TaskTable({ items, onSelect }: { items: Task[]; onSelect: (task: Task) => void }) {
  return (
    <table className="wu-table wu-list-table" role="table" aria-label="Backlog tasks">
      <thead role="rowgroup">
        <tr role="row">
          <th scope="col">Task</th>
          <th scope="col">Status</th>
          <th scope="col">Priority</th>
          <th scope="col">Assignee</th>
          <th scope="col">Due date</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {items.map((task) => (
          <tr role="row" className="wu-task-list-row" key={task.id} onClick={() => onSelect(task)}>
            <td role="cell">
              <button
                className="wu-list-item-name"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(task);
                }}
              >
                {task.title}
              </button>
            </td>
            <td role="cell" data-label="Status">
              <Pill
                status={task.status}
                tone={
                  task.status === 'Done'
                    ? 'mint'
                    : task.status === 'Review'
                      ? 'pink'
                      : task.status === 'In progress'
                        ? 'violet'
                        : task.status === 'Ready'
                          ? 'blue'
                          : 'neutral'
                }
              >
                {task.status}
              </Pill>
            </td>
            <td role="cell" data-label="Priority">
              <span className={`wu-priority wu-priority--${task.priority.toLowerCase()}`}>
                <i />
                {task.priority}
              </span>
            </td>
            <td role="cell" data-label="Assignee">
              <span className="wu-person">
                {task.assigneeId && <Avatar initials={task.initials} preview={false} small />}
                {task.person}
              </span>
            </td>
            <td role="cell" data-label="Due date" className="wu-muted">
              {task.due}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ActivityList({
  items = [],
  compact = false,
}: {
  items?: { name: string; action: string; time: string; initials: string; color: string }[];
  compact?: boolean;
}) {
  return (
    <div className={`wu-activity-list${compact ? ' wu-activity-list--compact' : ''}`}>
      {items.map((item, index) => (
        <div className="wu-activity-item" key={`${item.name}-${item.action}-${index}`}>
          <Avatar initials={item.initials} tone={item.color} small />
          <div>
            <strong>{item.name}</strong>
            <p>{item.action}</p>
          </div>
          <time>{item.time}</time>
        </div>
      ))}
    </div>
  );
}
