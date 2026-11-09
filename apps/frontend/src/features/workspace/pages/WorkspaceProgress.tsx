import { ArrowRight } from 'lucide-react';
import { Panel, Pill } from '../components';
import { taskStatuses } from '../previewData';
import type { Task } from '../types';

export function WorkspaceProgress({ tasks, onOpenBoard }: { tasks: Task[]; onOpenBoard: () => void }) {
  const counts = taskStatuses.map(status => ({
    status,
    count: tasks.filter(task => task.status === status).length,
  }));
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);
  const done = counts.find(entry => entry.status === 'Done')?.count ?? 0;
  const blocked = tasks.filter(task => task.isBlocked && task.status !== 'Done' && taskStatuses.includes(task.status)).length;
  const percentage = total ? Math.floor(done / total * 100) : 0;

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
        </>
      ) : <p className="wu-muted">Add a task to start tracking progress.</p>}
    </Panel>
  );
}
