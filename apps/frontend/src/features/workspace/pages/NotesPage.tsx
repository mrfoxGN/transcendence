import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Panel } from '../components';
import { ActionMenu, LoadingPanel } from '../WorkspaceControls';
import { useWorkspaceCollection, workspaceRequest } from '../workspace-api';
import type { PageHeading } from '../types';
import './notes.css';

type Note = { id: string; title: string; content: string | null; updatedAt: string };

export function NotesPage({ pageHeading, path, token }: { pageHeading: PageHeading; path: string; token: string | null }) {
  const { items, setItems, error, retry } = useWorkspaceCollection<Note>(path, token);
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState<'new' | 'edit' | 'rename'>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const selected = items?.find(note => note.id === selectedId) ?? items?.[0];

  function start(mode: typeof editing, note?: Note) {
    if (note) setSelectedId(note.id);
    setSaveError('');
    setEditing(mode);
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
    } catch {
      setSaveError('Could not save this note. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return <>
    {pageHeading(<button className="wu-button wu-button--primary" type="button" disabled={saving || !!editing || !items} onClick={() => start('new')}><Plus size={16} />New note</button>)}
    <div className="wu-notes-layout">
      <Panel className="wu-notes-list">
        <div className="wu-panel-heading"><h2>Workspace notes</h2></div>
        {error && <p role="alert">Could not load notes. <button className="wu-text-button" onClick={retry}>Try again</button></p>}
        {!items && !error && <LoadingPanel label="Loading workspace notes" />}
        {items?.length === 0 && <p className="wu-muted">No notes yet.</p>}
        {!!items?.length && <ul className="wu-document-list">
          {items.map(note => <li key={note.id} data-current={note.id === selected?.id}>
            <button className="wu-document-select" type="button" disabled={!!editing} onClick={() => setSelectedId(note.id)}>
              <span><strong>{note.title}</strong><small>{new Date(note.updatedAt).toLocaleDateString()}</small></span>
            </button>
            {!editing && <ActionMenu label={'Actions for ' + note.title} actions={[
              { label: 'Rename note', run: () => start('rename', note) },
              { label: 'Edit note', run: () => start('edit', note) },
            ]} />}
          </li>)}
        </ul>}
      </Panel>
      {(editing || selected) && <Panel className="wu-note-editor">
        {editing ? <form key={editing + (selected?.id ?? '')} onSubmit={save}>
          <h2>{editing === 'new' ? 'New note' : editing === 'rename' ? 'Rename note' : 'Edit note'}</h2>
          <label className="wu-field-label">Title<input name="title" maxLength={200} autoFocus required defaultValue={editing === 'new' ? '' : selected?.title} /></label>
          {editing !== 'rename' && <label className="wu-field-label">Note<textarea name="content" rows={9} defaultValue={editing === 'new' ? '' : selected?.content ?? ''} /></label>}
          {saveError && <p role="alert">{saveError}</p>}
          <div className="wu-note-toolbar">
            <button className="wu-button wu-button--secondary" type="button" disabled={saving} onClick={() => setEditing(undefined)}>Cancel</button>
            <button className="wu-button wu-button--primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save note'}</button>
          </div>
        </form> : <>
          <div className="wu-panel-heading"><h2>{selected?.title}</h2><button className="wu-text-button" type="button" onClick={() => start('edit')}>Edit note</button></div>
          <div className="wu-note-body"><p>{selected?.content || 'This note is empty.'}</p></div>
        </>}
      </Panel>}
    </div>
  </>;
}
