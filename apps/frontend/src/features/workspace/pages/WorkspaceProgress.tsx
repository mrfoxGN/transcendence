import { ArrowRight } from 'lucide-react';
import { Panel, Pill } from '../components';
import { AvatarGroup } from '../WorkspaceControls';
import type { Task } from '../types';

export function WorkspaceProgress({ tasks, columns, onOpenBoard }: { tasks: Task[]; columns: string[]; onOpenBoard: () => void }) {
  const counts = columns.map(status => ({
    status,
    count: tasks.filter(task => task.status === status).length,
  }));
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);
  const done = counts.find(entry => entry.status === 'Done')?.count ?? 0;
  const blocked = tasks.filter(task => task.isBlocked && task.status !== 'Done').length;
  const percentage = total ? Math.floor(done / total * 100) : 0;
  const contributors = [...new Map(tasks.filter(task => task.initials && task.person)
    .map(task => [task.person, { name: task.person, initials: task.initials }])).values()];

  return (
    <Panel className="wu-home-progress">
      <div className="wu-panel-heading">
        <h2>Workspace progress</h2>
        <button className="wu-text-button" type="button" onClick={onOpenBoard}>View board <ArrowRight size={14} /></button>
      </div>
      {total ? (
        <>
          <div className="wu-home-progress-summary">
            <strong>{percentage}%</strong>
            <span>{done} of {total} tasks done</span>
          </div>
          <progress className="wu-home-progress-bar" value={done} max={total} aria-label="Tasks completed" aria-valuetext={`${done} of ${total} tasks done`} />
          <dl className="wu-home-progress-breakdown">
            {counts.filter(entry => entry.status !== 'Done').map(({ status, count }) => (
              <div key={status}><dt>{status === 'Review' ? 'In review' : status}</dt><dd>{count}</dd></div>
            ))}
          </dl>
          {blocked > 0 && <Pill tone="red">{blocked} blocked</Pill>}
          {contributors.length > 0 && <div className="wu-progress-contributors">
            <span>Contributors</span><AvatarGroup people={contributors} />
          </div>}
        </>
      ) : <p className="wu-muted">Add a task to start tracking progress.</p>}
    </Panel>
  );
}
