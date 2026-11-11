import { useRef, useState, type FormEvent } from 'react';
import { Plus, Search } from 'lucide-react';
import { Panel } from '../components';
import { WorkspaceIllustration } from '../WorkspaceIllustration';
import { ActionMenu, DocumentPagination, Drawer, LoadingPanel } from '../WorkspaceControls';
import { documentPagePath, documentPageSize, jsonRequest, useWorkspaceCollection, workspaceRequest } from '../workspace-api';
import { finishInputEdit, saveTextOnBlur } from '../autosave';
import type { PageHeading } from '../types';
import type { Member } from '../workspace-tasks';
import './notes.css';

type Note = { id: string; title: string; content: string | null; updatedAt: string; creatorId: string | null };

export function NotesPage({ pageHeading, path, token, owner, profileId, members, readOnly = false }: {
  pageHeading: PageHeading; path: string; token: string | null; owner: boolean; profileId: string; members: Member[]; readOnly?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('updated');
  const [page, setPage] = useState(1);
  const { items, setItems, error, retry } = useWorkspaceCollection<Note>(documentPagePath(path, page, search, sort), token);
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState<'new' | 'edit' | 'rename'>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [removing, setRemoving] = useState<Note>();
  const [saved, setSaved] = useState(false);
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  const visibleNotes = items?.slice(0, documentPageSize);
  const selected = visibleNotes?.find(note => note.id === selectedId) ?? visibleNotes?.[0];
  const canEdit = (note: Note) => !readOnly && (owner || note.creatorId === profileId);

  async function removeNote() {
    if (!removing || saving) return;
    setSaving(true);
    try {
      await workspaceRequest(path + '/' + encodeURIComponent(removing.id), token, { method: 'DELETE' });
      setItems(current => current?.filter(item => item.id !== removing.id));
      setRemoving(undefined);
      retry();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not delete the note.');
    } finally {
      setSaving(false);
    }
  }

  function start(mode: typeof editing, note?: Note) {
    if (note) setSelectedId(note.id);
    setSaveError('');
    setSaved(false);
    setEditing(mode);
  }

  function saveField(note: Note, field: 'title' | 'content', value: string) {
    pending.current += 1;
    setSaving(true);
    setSaved(false);
    queue.current = queue.current.then(async () => {
      setSaveError('');
      try {
        const response = await workspaceRequest(path + '/' + encodeURIComponent(note.id), token, jsonRequest('PATCH', { [field]: value }));
        const updated = await response.json() as Note;
        setItems(current => current?.map(item => item.id === updated.id ? updated : item));
        setSaved(true);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Could not save this note. Edit the field to retry.');
      } finally {
        pending.current -= 1;
        if (!pending.current) setSaving(false);
      }
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const fields = new FormData(event.currentTarget);
    const title = String(fields.get('title') ?? '').trim();
    if (!title) {
      setSaveError('Enter a title.');
      return;
    }
    const notePath = editing === 'new' ? path : selected && path + '/' + encodeURIComponent(selected.id);
    if (!notePath) return;
    setSaving(true);
    setSaveError('');
    try {
      const body = { title, ...(editing !== 'rename' && { content: String(fields.get('content') ?? '') }) };
      const response = await workspaceRequest(notePath, token, {
        method: editing === 'new' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const note = await response.json() as Note;
      setItems(current => [note, ...(current ?? []).filter(item => item.id !== note.id)]);
      setSelectedId(note.id);
      setEditing(undefined);
      setSearch('');
      setSort('updated');
      setPage(1);
      retry();
    } catch {
      setSaveError('Could not save this note. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return <>
    {pageHeading(!readOnly && <button className="wu-button wu-button--primary" type="button" disabled={saving || !!editing || !items} onClick={() => start('new')}><Plus size={16} />New note</button>)}
    <div className="wu-notes-layout">
      <Panel className="wu-notes-list">
        <div className="wu-panel-heading"><h2>Workspace notes</h2></div>
        <div className="wu-list-toolbar">
          <label className="wu-list-search"><Search size={16} aria-hidden="true" />
            <input type="search" aria-label="Search notes" placeholder="Search note titles" maxLength={200} disabled={!!editing}
              value={search} onChange={event => { setSearch(event.currentTarget.value); setPage(1); }} />
          </label>
          <select className="wu-select" aria-label="Sort notes" disabled={!!editing} value={sort}
            onChange={event => { setSort(event.currentTarget.value); setPage(1); }}>
            <option value="updated">Recently updated</option><option value="name">Title A–Z</option>
          </select>
        </div>
        {error && <p role="alert">Could not load notes. <button className="wu-text-button" onClick={retry}>Try again</button></p>}
        {!items && !error && <LoadingPanel label="Loading workspace notes" />}
        {items?.length === 0 && <div className="wu-object-empty"><WorkspaceIllustration kind="note" /><p className="wu-muted">{page > 1 ? 'No notes on this page.' : search.trim() ? 'No notes match your search.' : 'No notes yet. Create one to share a decision or idea.'}</p></div>}
        {!!items?.length && <ul className="wu-document-list">
          {visibleNotes?.map(note => <li key={note.id} data-current={note.id === selected?.id}>
            <button className="wu-document-select" type="button" disabled={!!editing} onClick={() => setSelectedId(note.id)}>
              <span><strong>{note.title}</strong><small>{new Date(note.updatedAt).toLocaleDateString()}</small></span>
            </button>
            {!editing && canEdit(note) && <ActionMenu label={'Actions for ' + note.title} actions={[
              { label: 'Rename note', run: () => start('rename', note) },
              { label: 'Edit note', run: () => start('edit', note) },
              { label: 'Delete note', run: () => { setSaveError(''); setRemoving(note); } },
            ]} />}
          </li>)}
        </ul>}
        <DocumentPagination page={page} count={items?.length} onPage={setPage} disabled={!!editing} />
      </Panel>
      {(editing || selected) && <Panel className="wu-note-editor">
        {editing ? <form key={editing + (selected?.id ?? '')} onSubmit={event => {
          if (editing === 'new') void save(event);
          else event.preventDefault();
        }}>
          <h2>{editing === 'new' ? 'New note' : editing === 'rename' ? 'Rename note' : 'Edit note'}</h2>
          <label className="wu-field-label">Title<input name="title" maxLength={200} autoFocus required placeholder="e.g. Notes from sprint planning" defaultValue={editing === 'new' ? '' : selected?.title}
            onKeyDown={editing === 'new' ? undefined : finishInputEdit}
            onBlur={event => { if (editing !== 'new' && selected) saveTextOnBlur(event, selected.title, value => saveField(selected, 'title', value)); }} /></label>
          {editing !== 'rename' && <label className="wu-field-label">Note<textarea name="content" rows={9} placeholder="Capture a decision, next steps, or an idea" defaultValue={editing === 'new' ? '' : selected?.content ?? ''}
            onBlur={event => { if (editing !== 'new' && selected) saveTextOnBlur(event, selected.content ?? '', value => saveField(selected, 'content', value)); }} /></label>}
          {saveError && <p role="alert">{saveError}</p>}
          {editing !== 'new' && (saving || saved) && <p role="status">{saving ? 'Saving…' : 'Saved.'}</p>}
          {editing === 'new' ? <div className="wu-note-toolbar">
            <button className="wu-button wu-button--secondary" type="button" disabled={saving} onClick={() => setEditing(undefined)}>Cancel</button>
            <button className="wu-button wu-button--primary" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create note'}</button>
          </div> : <button className="wu-text-button" type="button" disabled={saving || !!saveError} onClick={() => { if (!pending.current) { setEditing(undefined); retry(); } }}>Done editing</button>}
        </form> : <>
          <div className="wu-panel-heading"><h2>{selected?.title}</h2>{selected && canEdit(selected) && <button className="wu-text-button" type="button" onClick={() => start('edit')}>Edit note</button>}</div>
          {selected && <p className="wu-muted">{members.find(member => member.userId === selected.creatorId)?.username ?? 'Unknown author'} · Updated {new Date(selected.updatedAt).toLocaleDateString()}</p>}
          <div className="wu-note-body"><p>{selected?.content || 'This note is empty.'}</p></div>
        </>}
      </Panel>}
    </div>
    {removing && <Drawer title={`Delete ${removing.title}?`} confirmation onClose={() => setRemoving(undefined)}>
      <p>This removes the note from the workspace.</p>
      {saveError && <p role="alert">{saveError}</p>}
      <div className="wu-modal-actions"><button className="wu-button wu-button--secondary" autoFocus disabled={saving} onClick={() => setRemoving(undefined)}>Cancel</button>
        <button className="wu-button wu-button--primary" disabled={saving} onClick={() => void removeNote()}>Delete note</button></div>
    </Drawer>}
  </>;
}
