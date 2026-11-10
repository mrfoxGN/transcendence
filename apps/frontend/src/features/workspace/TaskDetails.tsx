import { useState, type FormEvent } from 'react';
import { Drawer } from './WorkspaceControls';
import { jsonRequest, useWorkspaceCollection, workspaceRequest } from './workspace-api';
import { canTransition, statusCodes, type Member } from './workspace-tasks';
import type { Task } from './types';

type Comment = { id: string; authorId: string | null; content: string; createdAt: string };
type Dependency = { id: string; dependsOnTaskId: string };
const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export function TaskDetails({ task, tasks, members, token, profileId, onClose, onChange }: {
  task: Task; tasks: Task[]; members: Member[]; token: string | null; profileId: string;
  onClose: () => void; onChange: () => void;
}) {
  const path = 'tasks/' + task.id;
  const comments = useWorkspaceCollection<Comment>(path + '/comments', token);
  const dependencies = useWorkspaceCollection<Dependency>(path + '/dependencies', token);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingComment, setEditingComment] = useState<string>();

  async function mutate(suffix: string, method: string, body?: object) {
    if (busy || !token) return false;
    setBusy(true);
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
      setBusy(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get('dueAt') || '');
    void mutate('', 'PATCH', {
      title: String(form.get('title')).trim(),
      description: String(form.get('description')).trim() || null,
      acceptanceCriteria: String(form.get('criteria')).trim() || null,
      priority: form.get('priority') || null,
      dueAt: date ? new Date(date + 'T00:00:00').toISOString() : null,
    });
  }

  const localDue = task.dueAt ? new Date(task.dueAt).toLocaleDateString('sv-SE') : '';
  const destinations = Object.keys(statusCodes).filter(status => canTransition(task.status, status));

  return <Drawer title={task.title} onClose={onClose}>
    <p className="wu-muted">{task.status}{task.isBlocked ? ' · Blocked' : ''}</p>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <form className="wu-column-form" onSubmit={save}>
      <label className="wu-field-label">Title<input name="title" defaultValue={task.title} required /></label>
      <label className="wu-field-label">Description<textarea name="description" defaultValue={task.description} rows={3} /></label>
      <label className="wu-field-label">Acceptance criteria<textarea name="criteria" defaultValue={task.acceptanceCriteria ?? ''} rows={3} /></label>
      <label className="wu-field-label">Priority<select name="priority" defaultValue={task.priority === 'None' ? '' : task.priority.toUpperCase()}>
        <option value="">No priority</option>{priorities.map(priority => <option key={priority} value={priority}>{priority[0] + priority.slice(1).toLowerCase()}</option>)}
      </select></label>
      <label className="wu-field-label">Due date<input type="date" name="dueAt" defaultValue={localDue} /></label>
      <button className="wu-button wu-button--primary" disabled={busy}>Save task</button>
    </form>
    {!!destinations.length && <section className="wu-drawer-section">
      <h3>Move task</h3>
      <form key={task.status} onSubmit={event => {
        event.preventDefault();
        const status = String(new FormData(event.currentTarget).get('status'));
        void mutate('/transition', 'POST', { toStatus: statusCodes[status] });
      }}>
        <label className="wu-field-label">New status<select name="status" defaultValue="" required>
          <option value="" disabled>Choose a status</option>
          {destinations.map(status => <option key={status}>{status}</option>)}
        </select></label>
        <button className="wu-button wu-button--secondary" disabled={busy}>Move task</button>
      </form>
    </section>}
    <section className="wu-drawer-section">
      <h3>Assignee</h3>
      {task.assigneeId ? <><p>{task.person}</p><button className="wu-button wu-button--secondary" type="button" disabled={busy} onClick={() => void mutate('/assignment', 'DELETE')}>Unassign</button></>
        : <form onSubmit={event => { event.preventDefault(); void mutate('/assignment', 'POST', { userId: new FormData(event.currentTarget).get('member') }); }}>
          <label className="wu-field-label">Choose a member<select name="member" defaultValue="" required><option value="" disabled>Select a member</option>{members.map(member => <option key={member.userId} value={member.userId}>{member.username}</option>)}</select></label>
          <button className="wu-button wu-button--secondary" disabled={busy || !members.length}>Assign task</button>
        </form>}
    </section>
    <section className="wu-drawer-section">
      <h3>Blocker</h3>
      {task.isBlocked ? <><p>{task.blockedReason}</p><button className="wu-button wu-button--secondary" disabled={busy} onClick={() => void mutate('/block', 'DELETE')}>Unblock task</button></>
        : <form onSubmit={event => { event.preventDefault(); void mutate('/block', 'POST', { reason: new FormData(event.currentTarget).get('reason') }); }}>
          <label className="wu-field-label">Reason<input name="reason" required /></label>
          <button className="wu-button wu-button--secondary" disabled={busy}>Block task</button>
        </form>}
    </section>
    <section className="wu-drawer-section">
      <h3>Dependencies</h3>
      {dependencies.error ? <p role="alert">Could not load dependencies. <button type="button" onClick={dependencies.retry}>Retry</button></p>
        : !dependencies.items ? <p role="status">Loading dependencies…</p>
        : dependencies.items.map(item => <div key={item.id}>{tasks.find(candidate => candidate.id === item.dependsOnTaskId)?.title ?? 'Unavailable task'} <button className="wu-text-button" disabled={busy} onClick={() => void mutate('/dependencies/' + item.id, 'DELETE')}>Remove</button></div>)}
      <form onSubmit={event => { event.preventDefault(); void mutate('/dependencies', 'POST', { dependsOnTaskId: new FormData(event.currentTarget).get('dependency') }); }}>
        <label className="wu-field-label">Depends on<select name="dependency" defaultValue="" required><option value="" disabled>Select a task</option>{tasks.filter(item => item.id !== task.id).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <button className="wu-button wu-button--secondary" disabled={busy}>Add dependency</button>
      </form>
    </section>
    <section className="wu-drawer-section">
      <h3>Comments</h3>
      {comments.error ? <p role="alert">Could not load comments. <button type="button" onClick={comments.retry}>Retry</button></p>
        : !comments.items ? <p role="status">Loading comments…</p>
        : comments.items.map(comment => <div key={comment.id}>
          <strong>{members.find(member => member.userId === comment.authorId)?.username ?? 'Former member'}</strong>
          {editingComment === comment.id ? <form onSubmit={async event => {
            event.preventDefault();
            const content = String(new FormData(event.currentTarget).get('content')).trim();
            if (content && await mutate('/comments/' + comment.id, 'PATCH', { content })) setEditingComment(undefined);
          }}>
            <label className="wu-field-label">Edit comment<textarea name="content" defaultValue={comment.content} required /></label>
            <button type="button" className="wu-text-button" disabled={busy} onClick={() => setEditingComment(undefined)}>Cancel</button>
            <button className="wu-button wu-button--secondary" disabled={busy}>Save comment</button>
          </form> : <p>{comment.content}</p>}
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
        <label className="wu-field-label">Add a comment<textarea name="content" rows={2} required /></label>
        <button className="wu-button wu-button--secondary" disabled={busy}>Post comment</button>
      </form>
    </section>
    {confirmDelete ? <div className="wu-modal-actions">
      <button className="wu-button wu-button--secondary" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
      <button className="wu-button wu-button--primary" type="button" disabled={busy} onClick={async () => { if (await mutate('', 'DELETE')) onClose(); }}>Confirm task deletion</button>
    </div> : <button className="wu-text-button" type="button" onClick={() => setConfirmDelete(true)}>Delete task</button>}
  </Drawer>;
}
