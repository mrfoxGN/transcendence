import { type CSSProperties, type ReactNode } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
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
  return <div className="wu-empty"><IconTile tone="violet">{icon}</IconTile><h3>{title}</h3><p>{detail}</p><button className="wu-button wu-button--primary" type="button" onClick={onAction}><Plus size={16} />{action}</button></div>;
}

export function TaskTable({ items, onSelect }: { items: Task[]; onSelect: (task: Task) => void }) {
  return <div className="wu-table-wrap"><table className="wu-table"><thead><tr><th>Task</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due date</th><th><span className="wu-visually-hidden">Actions</span></th></tr></thead><tbody>
    {items.map(task => <tr key={task.id} onClick={() => onSelect(task)} tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') onSelect(task); }}>
      <td><span className="wu-task-id">{task.id}</span><strong>{task.title}</strong></td>
      <td><Pill tone={task.status === 'Done' ? 'mint' : task.status === 'Review' ? 'pink' : task.status === 'In progress' ? 'violet' : task.status === 'Ready' ? 'blue' : 'neutral'}>{task.status}</Pill></td>
      <td><span className={`wu-priority wu-priority--${task.priority.toLowerCase()}`}><i />{task.priority}</span></td>
      <td><span className="wu-person"><Avatar initials={task.initials} tone={task.initials === 'SK' ? 'violet' : task.initials === 'MR' ? 'pink' : task.initials === 'OI' ? 'mint' : 'blue'} small />{task.person}</span></td>
      <td className="wu-muted">{task.due}</td><td><button className="wu-icon-button" aria-label={`More options for ${task.id}`} type="button" onClick={event => { event.stopPropagation(); onSelect(task); }}><MoreHorizontal size={17} /></button></td>
    </tr>)}
  </tbody></table></div>;
}

export function ActivityList({ items = activityItems, compact = false }: { items?: typeof activityItems; compact?: boolean }) {
  return <div className={`wu-activity-list${compact ? ' wu-activity-list--compact' : ''}`}>{items.map((item, index) => <div className="wu-activity-item" key={`${item.name}-${item.action}-${index}`}><Avatar initials={item.initials} tone={item.color} small /><div><strong>{item.name}</strong><p>{item.action}</p></div><time>{item.time}</time></div>)}</div>;
}

export function StatCard({ icon, label, value, note, tone, featured = false }: { icon: ReactNode; label: string; value: string; note: string; tone: string; featured?: boolean }) {
  return <Panel className={`wu-stat${featured ? ' wu-stat--featured' : ''}`}><div className="wu-stat-top"><IconTile tone={tone}>{icon}</IconTile><span>{label}</span></div><div className="wu-stat-bottom"><strong>{value}</strong><Pill tone={tone}>{note}</Pill></div></Panel>;
}
