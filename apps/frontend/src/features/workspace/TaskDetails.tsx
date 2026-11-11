import { useRef, useState } from 'react';
import { Drawer } from './WorkspaceControls';
import { Pill } from './components';
import { jsonRequest, useWorkspaceCollection, workspaceRequest, type WorkspaceFile } from './workspace-api';
import { statusLabels, taskBoardColumn, type BoardColumnConfig, type Member } from './workspace-tasks';
import type { Task } from './types';
import { finishInputEdit, saveTextOnBlur } from './autosave';

type Comment = { id: string; authorId: string | null; content: string; createdAt: string };
type Dependency = { id: string; dependsOnTaskId: string };
const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export function TaskDetails({ task, tasks, members, token, profileId, onClose, onChange, files, openTask, openFile, onBack, boardColumns }: {
  task: Task; tasks: Task[]; members: Member[]; token: string | null; profileId: string;
  onClose: () => void; onChange: () => void;
  files: WorkspaceFile[]; openTask: (task: Task) => void; openFile: (file: WorkspaceFile) => void; onBack?: () => void;
  boardColumns: BoardColumnConfig[];
}) {
  const path = 'tasks/' + task.id;
  const comments = useWorkspaceCollection<Comment>(path + '/comments', token);
  const dependencies = useWorkspaceCollection<Dependency>(path + '/dependencies', token);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingComment, setEditingComment] = useState<string>();
  const [editingTask, setEditingTask] = useState(false);
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);

  function mutate(suffix: string, method: string, body?: object) {
    if (!token) return Promise.resolve(false);
    pending.current += 1;
    setBusy(true);
    const request = queue.current.then(async () => {
      setError('');
      setNotice('');
      try {
      await workspaceRequest(path + suffix, token, body ? jsonRequest(method, body) : { method });
      if (suffix.startsWith('/comments')) comments.retry();
      else if (suffix.startsWith('/dependencies')) dependencies.retry();
      else onChange();
      setNotice('Saved.');
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save the change.');
      return false;
      } finally {
        pending.current -= 1;
        if (!pending.current) setBusy(false);
      }
    });
    queue.current = request.then(() => undefined);
    return request;
  }

  const save = (key: string, value: string | null) => void mutate('', 'PATCH', { [key]: value });

  const currentColumn = taskBoardColumn(task, boardColumns);
  const destinations = boardColumns.filter(column => column.id !== currentColumn?.id);

  return <Drawer title={task.title} onClose={onClose}>
    <div className="wu-task-inspector">
    {onBack && <button className="wu-text-button" type="button" onClick={onBack}>Back to previous task</button>}
    <dl className="wu-task-summary">
      <div><dt>Column</dt><dd><Pill tone={task.status === 'Done' ? 'mint' : 'neutral'}>{currentColumn?.label ?? task.status}</Pill>{task.isBlocked && <Pill tone="red">Blocked</Pill>}</dd></div>
      <div><dt>Assignee</dt><dd>{task.person}</dd></div>
      <div><dt>Priority</dt><dd>{task.priority === 'None' ? 'No priority' : task.priority}</dd></div>
      <div><dt>Due date</dt><dd>{task.dueDate ? task.due : 'No due date'}</dd></div>
    </dl>
    {error && <p role="alert">{error}</p>}
    {(busy || notice) && <p role="status">{busy ? 'Saving changes…' : notice}</p>}
    {editingTask ? <section className="wu-column-form wu-task-editor">
      <div className="wu-panel-heading"><h3>Edit task</h3><button className="wu-text-button" type="button" disabled={busy || !!error} onClick={() => { if (!pending.current) setEditingTask(false); }}>Done editing</button></div>
      <label className="wu-field-label">Title<input name="title" defaultValue={task.title} placeholder="e.g. Fix login form validation" required maxLength={200}
        onBlur={event => saveTextOnBlur(event, task.title, value => save('title', value))} onKeyDown={finishInputEdit} /></label>
      <label className="wu-field-label">Description<textarea name="description" defaultValue={task.description} placeholder="Describe what needs to change and why" rows={3}
        onBlur={event => saveTextOnBlur(event, task.description, value => save('description', value || null))} /></label>
      <label className="wu-field-label">Acceptance criteria<textarea name="criteria" defaultValue={task.acceptanceCriteria ?? ''} placeholder="e.g. Invalid passwords show a helpful error" rows={3}
        onBlur={event => saveTextOnBlur(event, task.acceptanceCriteria ?? '', value => save('acceptanceCriteria', value || null))} /></label>
      <label className="wu-field-label">Priority<select name="priority" defaultValue={task.priority === 'None' ? '' : task.priority.toUpperCase()} onChange={event => save('priority', event.currentTarget.value || null)}>
        <option value="">No priority</option>{priorities.map(priority => <option key={priority} value={priority}>{priority[0] + priority.slice(1).toLowerCase()}</option>)}
      </select></label>
      <label className="wu-field-label">Due date<input type="date" name="dueDate" min="1000-01-01" max="9999-12-31" defaultValue={task.dueDate ?? ''} onChange={event => {
        const field = event.currentTarget;
        if (field.validity.valid) save('dueDate', field.value || null);
      }} /></label>
    </section> : <section className="wu-drawer-section">
      <div className="wu-panel-heading"><h3>Description</h3><button className="wu-text-button" type="button" onClick={() => setEditingTask(true)}>Edit task</button></div>
      <p className="wu-task-copy">{task.description || 'No description yet.'}</p>
      <h3>Acceptance criteria</h3>
      <p className="wu-task-copy">{task.acceptanceCriteria || 'No acceptance criteria yet.'}</p>
    </section>}
    {!!destinations.length && <section className="wu-drawer-section">
      <h3>Move task</h3>
        <label className="wu-field-label">Destination<select name="column" value="" disabled={busy} onChange={event => {
          const column = destinations.find(item => item.id === event.currentTarget.value);
          if (column) void mutate('/transition', 'POST', { toStatus: column.status, boardColumnId: column.id, placement: 'end' });
        }}>
          <option value="" disabled>Choose a column</option>
          {destinations.map(column => <option key={column.id} value={column.id}>{column.label}</option>)}
        </select></label>
    </section>}
    <section className="wu-drawer-section">
      <h3>Assignee</h3>
      {task.assigneeId ? <><p>{task.person}</p><button className="wu-button wu-button--secondary" type="button" disabled={busy} onClick={() => void mutate('/assignment', 'DELETE')}>Unassign</button></>
        : <label className="wu-field-label">Choose a member<select name="member" value="" disabled={busy || !members.length}
          onChange={event => void mutate('/assignment', 'POST', { userId: event.currentTarget.value })}>
          <option value="" disabled>{members.length ? 'Select a member' : 'No members available'}</option>{members.map(member => <option key={member.userId} value={member.userId}>{member.username}</option>)}</select></label>}
    </section>
    <section className="wu-drawer-section">
      <h3>Blocker</h3>
      {task.isBlocked ? <><p>{task.blockedReason}</p><button className="wu-button wu-button--secondary" disabled={busy} onClick={() => void mutate('/block', 'DELETE')}>Unblock task</button></>
        : <label className="wu-field-label">Reason<input name="reason" placeholder="e.g. Waiting for API access"
          onBlur={event => saveTextOnBlur(event, '', reason => void mutate('/block', 'POST', { reason }))} onKeyDown={finishInputEdit} /></label>}
    </section>
    <section className="wu-drawer-section">
      <h3>Dependencies</h3>
      {dependencies.error ? <p role="alert">Could not load dependencies. <button type="button" onClick={dependencies.retry}>Retry</button></p>
        : !dependencies.items ? <p role="status">Loading dependencies…</p>
        : dependencies.items.map(item => {
          const related = tasks.find(candidate => candidate.id === item.dependsOnTaskId);
          return <div key={item.id}>
            {related ? <button className="wu-text-button" type="button" onClick={() => openTask(related)}>{related.title}</button> : 'Unavailable task'}
            {' '}<button className="wu-text-button" disabled={busy} onClick={() => void mutate('/dependencies/' + item.id, 'DELETE')}>Remove</button>
          </div>;
        })}
      <label className="wu-field-label">Depends on<select name="dependency" value="" disabled={busy}
        onChange={event => void mutate('/dependencies', 'POST', { dependsOnTaskId: event.currentTarget.value })}>
        <option value="" disabled>Select a task that must finish first</option>
        {tasks.filter(item => item.id !== task.id && !dependencies.items?.some(dep => dep.dependsOnTaskId === item.id))
          .map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select></label>
    </section>
    {!!files.length && <section className="wu-drawer-section">
      <h3>Related files</h3>
      <ul className="wu-document-list">{files.map(file => <li key={file.id}><button className="wu-text-button" type="button" onClick={() => openFile(file)}>{file.displayName}</button></li>)}</ul>
    </section>}
    <section className="wu-drawer-section">
      <h3>Comments</h3>
      {comments.error ? <p role="alert">Could not load comments. <button type="button" onClick={comments.retry}>Retry</button></p>
        : !comments.items ? <p role="status">Loading comments…</p>
        : comments.items.map(comment => <div key={comment.id}>
          <strong>{members.find(member => member.userId === comment.authorId)?.username ?? 'Former member'}</strong>
          {editingComment === comment.id ? <label className="wu-field-label">Edit comment<textarea autoFocus name="content"
            defaultValue={comment.content} placeholder="Update your comment" required onBlur={event => {
              const value = event.currentTarget.value.trim();
              if (value === comment.content.trim()) setEditingComment(undefined);
              else saveTextOnBlur(event, comment.content, async content => {
                if (await mutate('/comments/' + comment.id, 'PATCH', { content })) setEditingComment(undefined);
              });
            }} /></label> : <p>{comment.content}</p>}
          <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time>
          {profileId === comment.authorId && editingComment !== comment.id && <>
            <button className="wu-text-button" type="button" disabled={busy} onClick={() => setEditingComment(comment.id)}>Edit comment</button>
            <button className="wu-text-button" type="button" disabled={busy} onClick={() => void mutate('/comments/' + comment.id, 'DELETE')}>Delete comment</button>
          </>}
        </div>)}
      <form onSubmit={async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const content = String(new FormData(form).get('content')).trim();
        if (content && await mutate('/comments', 'POST', { content })) form.reset();
      }}>
        <label className="wu-field-label">Add a comment<textarea name="content" rows={2} placeholder="Share an update or ask a question" required /></label>
        <button className="wu-button wu-button--secondary" disabled={busy}>Post comment</button>
      </form>
    </section>
    {confirmDelete ? <section className="wu-drawer-section" aria-label="Confirm deletion">
      <h3>Delete “{task.title}”?</h3>
      <p>This removes the task from the workspace board and backlog.</p>
      <div className="wu-modal-actions">
      <button className="wu-button wu-button--secondary" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
      <button className="wu-button wu-button--primary" type="button" disabled={busy} onClick={async () => { if (await mutate('', 'DELETE')) onClose(); }}>Confirm task deletion</button>
    </div></section> : <button className="wu-text-button" type="button" onClick={() => setConfirmDelete(true)}>Delete task</button>}
    </div>
  </Drawer>;
}
