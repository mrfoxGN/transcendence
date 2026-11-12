import { type CSSProperties, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { activityItems } from './previewData';
import { type Task } from './types';

const portraitPositions: Record<string, string> = {
  AM: '1.6% 22.2%', LN: '34% 22.2%', SK: '66.4% 22.2%',
  OI: '98.7% 22.2%', MR: '34% 75.3%', JC: '66.4% 75.3%',
};

export function IconTile({ children, tone = 'blue' }: { children: ReactNode; tone?: string }) {
  return <span className={`wu-icon-tile wu-icon-tile--${tone}`} aria-hidden="true">{children}</span>;
}

export function Avatar({ initials, tone = 'blue', small = false, preview = true }: { initials: string; tone?: string; small?: boolean; preview?: boolean }) {
  const position = preview ? portraitPositions[initials] : undefined;
  return <span className={`wu-avatar wu-avatar--${tone}${small ? ' wu-avatar--small' : ''}`} aria-hidden="true">
    {initials}{position && <span className="wu-avatar-portrait" style={{ '--portrait-position': position } as CSSProperties} />}
  </span>;
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`wu-pill wu-pill--${tone}`}>{children}</span>;
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`wu-panel ${className}`}>{children}</section>;
}

export function FilterChips({ items, active, onChange }: { items: string[]; active: string; onChange: (value: string) => void }) {
  return <div className="wu-chips" role="group" aria-label="Filter items">
    {items.map(item => <button key={item} type="button" className={`wu-chip${active === item ? ' is-active' : ''}`} aria-pressed={active === item} onClick={() => onChange(item)}>{item}</button>)}
  </div>;
}

export function EmptyState({ icon, title, detail, action, onAction }: { icon: ReactNode; title: string; detail: string; action: string; onAction: () => void }) {
  return <div className="wu-empty"><div aria-hidden="true">{icon}</div><h3>{title}</h3><p>{detail}</p><button className="wu-button wu-button--primary" type="button" onClick={onAction}><Plus size={16} />{action}</button></div>;
}

export function TaskTable({ items, onSelect }: { items: Task[]; onSelect: (task: Task) => void }) {
  return <table className="wu-table wu-list-table" role="table" aria-label="Backlog tasks"><thead role="rowgroup"><tr role="row"><th scope="col">Task</th><th scope="col">Status</th><th scope="col">Priority</th><th scope="col">Assignee</th><th scope="col">Due date</th></tr></thead><tbody role="rowgroup">
    {items.map(task => <tr role="row" className="wu-task-list-row" key={task.id} onClick={() => onSelect(task)}>
      <td role="cell"><button className="wu-list-item-name" type="button" onClick={event => { event.stopPropagation(); onSelect(task); }}>{task.title}</button></td>
      <td role="cell" data-label="Status"><Pill tone={task.status === 'Done' ? 'mint' : task.status === 'Review' ? 'pink' : task.status === 'In progress' ? 'violet' : task.status === 'Ready' ? 'blue' : 'neutral'}>{task.status}</Pill></td>
      <td role="cell" data-label="Priority"><span className={`wu-priority wu-priority--${task.priority.toLowerCase()}`}><i />{task.priority}</span></td>
      <td role="cell" data-label="Assignee"><span className="wu-person">{task.assigneeId && <Avatar initials={task.initials} preview={false} small />}{task.person}</span></td>
      <td role="cell" data-label="Due date" className="wu-muted">{task.due}</td>
    </tr>)}
  </tbody></table>;
}

export function ActivityList({ items = activityItems, compact = false }: { items?: typeof activityItems; compact?: boolean }) {
  return <div className={`wu-activity-list${compact ? ' wu-activity-list--compact' : ''}`}>{items.map((item, index) => <div className="wu-activity-item" key={`${item.name}-${item.action}-${index}`}><Avatar initials={item.initials} tone={item.color} small /><div><strong>{item.name}</strong><p>{item.action}</p></div><time>{item.time}</time></div>)}</div>;
}

export function StatCard({ icon, label, value, note, tone, featured = false }: { icon: ReactNode; label: string; value: string; note: string; tone: string; featured?: boolean }) {
  return <Panel className={`wu-stat${featured ? ' wu-stat--featured' : ''}`}><div className="wu-stat-top"><IconTile tone={tone}>{icon}</IconTile><span>{label}</span></div><div className="wu-stat-bottom"><strong>{value}</strong><Pill tone={tone}>{note}</Pill></div></Panel>;
}
