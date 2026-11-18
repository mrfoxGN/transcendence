import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FileText, Link2, Pencil, Pin, Plus, Search } from 'lucide-react';
import { Panel } from '../components';
import { WorkspaceIllustration } from '../WorkspaceIllustration';
import { ActionMenu, Drawer, LoadingPanel } from '../WorkspaceControls';
import { documentPageSize, jsonRequest, useWorkspaceCollection, useWorkspaceData, workspaceRequest } from '../workspace-api';
import type { PageHeading, Task } from '../types';
import type { Member } from '../workspace-tasks';
import './notes.css';

type Note = {
  id: string;
  workspaceId: string;
  creatorId: string | null;
  title: string;
  content: string | null;
  pinnedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
type Draft = { title: string; content: string };
const noteIdFromUrl = () => location.hash.startsWith('#note-') ? location.hash.slice(6) : '';
const formatTime = (date: string) => new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function NotesPage({ pageHeading, path, token, owner, profileId, members, tasks, onOpenTask, readOnly = false }: {
  pageHeading: PageHeading; path: string; token: string | null; owner: boolean; profileId: string; members: Member[];
  tasks: Task[]; onOpenTask: (id: string) => void; readOnly?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('updated');
  const [page, setPage] = useState(1);
  const queryText = search.trim().toLowerCase();
  const clientSideFilter = Boolean(queryText) || sort !== 'updated';
  const listPath = clientSideFilter
    ? `${path}?page=1&limit=100`
    : `${path}?page=${page}&limit=${documentPageSize}`;
  const list = useWorkspaceCollection<Note>(listPath, token);

  const filtered = clientSideFilter
    ? (list.items ?? [])
        .filter(note =>
          !queryText ||
          note.title.toLowerCase().includes(queryText) ||
          (note.content ?? '').toLowerCase().includes(queryText),
        )
        .sort((a, b) => {
          const pinDiff = (b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0) - (a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0);
          if (pinDiff !== 0) return pinDiff;
          return sort === 'name'
            ? a.title.localeCompare(b.title)
            : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        })
    : (list.items ?? []);

  const startIdx = clientSideFilter ? (page - 1) * documentPageSize : 0;
  const visible = clientSideFilter ? filtered.slice(startIdx, startIdx + documentPageSize) : filtered;
  const hasNext = clientSideFilter
    ? filtered.length > startIdx + documentPageSize
    : (list.items?.length ?? 0) >= documentPageSize;

  const [selectedId, setSelectedId] = useState(noteIdFromUrl);
  const activeId = selectedId || visible[0]?.id;
  const notePath = activeId ? path + '/' + encodeURIComponent(activeId) : '';
  const detail = useWorkspaceData<Note>(notePath, activeId ? token : null);
  const selected = detail.error ? undefined
    : (detail.data?.id === activeId ? detail.data : undefined) ?? visible.find(note => note.id === activeId);
  const [editing, setEditing] = useState<'new' | 'edit'>();
  const [draft, setDraft] = useState<Draft>({ title: '', content: '' });
  const draftRef = useRef(draft);
  const baseline = useRef<Note | null>(null);
  const savingRef = useRef(false);
  const queuedSave = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [removing, setRemoving] = useState<Note>();
  const reader = useRef<HTMLElement>(null);
  const canEdit = (note: Note) => !readOnly && (owner || note.creatorId === profileId);
  const authorName = (note: Note) => note.creatorId === profileId ? 'You' : members.find(member => member.userId === note.creatorId)?.username ?? 'Unknown author';

  useEffect(() => {
    const sync = () => setSelectedId(noteIdFromUrl());
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync); };
  }, []);

  function updateDraft(next: Draft) { draftRef.current = next; setDraft(next); }
  function showNote(id: string, moveFocus = false) {
    setSelectedId(id);
    setError('');
    setNotice('');
    const url = new URL(location.href);
    url.hash = id ? 'note-' + id : '';
    history.replaceState(history.state, '', url);
    if (moveFocus && matchMedia('(max-width: 780px)').matches) requestAnimationFrame(() => reader.current?.focus());
  }

  function storeNote(note: Note) {
    detail.setData(current => current?.id === note.id ? note : current);
    list.setItems(items => items?.map(item => item.id === note.id ? note : item));
  }

  function start(note?: Note) {
    baseline.current = note ?? null;
    queuedSave.current = false;
    setError('');
    setNotice('');
    updateDraft({ title: note?.title ?? '', content: note?.content ?? '' });
    setEditing(note ? 'edit' : 'new');
  }

  async function saveDraft(close = false) {
    if (readOnly || !baseline.current) return;
    if (savingRef.current) { queuedSave.current = true; return; }
    savingRef.current = true;
    setBusy(true);
    setError('');
    try {
      do {
        queuedSave.current = false;
        const base = baseline.current;
        if (!base) return;
        const { title, content } = draftRef.current;
        const trimmedTitle = title.trim();
        if (!trimmedTitle) { setError('Enter a title.'); return; }
        const changed: { title?: string; content?: string } = {
          ...(trimmedTitle !== base.title && { title: trimmedTitle }),
          ...(content !== (base.content ?? '') && { content }),
        };
        if (Object.keys(changed).length) {
          const response = await workspaceRequest(path + '/' + base.id, token, jsonRequest('PATCH', changed));
          const updated = await response.json() as Note;
          baseline.current = updated;
          storeNote(updated);
          setNotice('Saved');
        }
      } while (queuedSave.current);
      if (close) { setEditing(undefined); list.retry(); }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save the note.');
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }

  async function changeNote(action: () => Promise<void>) {
    if (readOnly || savingRef.current) return;
    savingRef.current = true;
    setBusy(true);
    setError('');
    try { await action(); }
    catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update the note.');
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) { setError('Enter a title.'); return; }
    void changeNote(async () => {
      const response = await workspaceRequest(path, token, jsonRequest('POST', { title, content: draft.content }));
      const note = await response.json() as Note;
      list.setItems(items => [note, ...(items ?? [])]);
      detail.setData(note);
      setEditing(undefined);
      setSearch('');
      setPage(1);
      showNote(note.id, true);
      list.retry();
    });
  }

  function pin(note: Note) {
    void changeNote(async () => {
      const response = await workspaceRequest(path + '/' + note.id, token, jsonRequest('PATCH', { pinned: !note.pinnedAt }));
      storeNote(await response.json() as Note);
      list.retry();
    });
  }

  async function copyLink() {
    if (!selected) return;
    const url = new URL(location.href);
    url.searchParams.set('page', 'notes');
    url.searchParams.delete('task');
    url.hash = 'note-' + selected.id;
    try { await navigator.clipboard.writeText(url.href); setNotice('Link copied'); }
    catch { showNote(selected.id); setError('Copy the note link from the address bar.'); }
  }

  const referenceKeys = new Set((selected?.content ?? '').match(/\bTASK-[1-9]\d*\b/gi)?.map(key => key.toUpperCase()));
  const referencedTasks = tasks.filter(task => task.taskKey && referenceKeys.has(task.taskKey.toUpperCase()));

  return <>
    {pageHeading(!readOnly && <button className="wu-button wu-button--primary" type="button" disabled={busy || !!editing} onClick={() => start()}><Plus size={16} />New note</button>)}
    <div className="wu-notes-layout">
      <Panel className="wu-notes-list">
        <h2>Workspace notes</h2>
        <div className="wu-notes-tools">
          <label className="wu-list-search"><Search size={16} aria-hidden="true" />
            <input type="search" aria-label="Search notes" placeholder="Search notes" maxLength={200} disabled={!!editing}
              value={search} onChange={event => { setSearch(event.target.value); setPage(1); showNote(''); }} />
          </label>
          <select className="wu-select" aria-label="Sort notes" disabled={!!editing} value={sort}
            onChange={event => { setSort(event.target.value); setPage(1); showNote(''); }}>
            <option value="updated">Recently updated</option><option value="name">Title A–Z</option>
          </select>
        </div>
        {list.error && <p role="alert">Could not load notes. <button className="wu-text-button" onClick={list.retry}>Try again</button></p>}
        {!list.items && !list.error && <LoadingPanel label="Loading workspace notes" />}
        {list.items && visible.length === 0 && <div className="wu-object-empty"><WorkspaceIllustration kind="note" />
          <p className="wu-muted">{page > 1 ? 'No notes on this page.' : search.trim() ? 'No notes match your search.' : 'No notes yet.'}</p></div>}
        {!!visible.length && <ul className="wu-notes-items">
          {visible.map(note => <li key={note.id}>
            <button className="wu-note-item" data-current={note.id === activeId} aria-current={note.id === activeId ? 'true' : undefined}
              type="button" disabled={!!editing} onClick={() => showNote(note.id, true)}>
              <span className="wu-note-list-icon">{note.pinnedAt ? <Pin size={16} aria-label="Pinned" /> : <FileText size={16} aria-hidden="true" />}</span>
              <span><strong>{note.title}</strong><small>{authorName(note)} · {new Date(note.updatedAt).toLocaleDateString()}</small></span>
            </button>
          </li>)}
        </ul>}
        {(page > 1 || hasNext) && <nav className="wu-document-pagination" aria-label="Document pages">
          <button className="wu-button wu-button--secondary" type="button" disabled={!!editing || page === 1} onClick={() => { setPage(page - 1); showNote(''); }}>Previous</button>
          <span aria-live="polite">Page {page}</span>
          <button className="wu-button wu-button--secondary" type="button" disabled={!!editing || !hasNext} onClick={() => { setPage(page + 1); showNote(''); }}>Next</button>
        </nav>}
      </Panel>
      <section ref={reader} tabIndex={-1} aria-label="Note reader" className="wu-panel wu-note-editor">
        {editing ? <form className="wu-note-form" onSubmit={editing === 'new' ? create : event => { event.preventDefault(); void saveDraft(true); }}>
          <h2>{editing === 'new' ? 'New note' : 'Edit note'}</h2>
          <label className="wu-field-label">Title<input value={draft.title} onChange={event => updateDraft({ ...draftRef.current, title: event.target.value })}
            onBlur={() => { if (editing === 'edit') void saveDraft(); }} required maxLength={200} autoFocus placeholder="e.g. Sprint planning notes" /></label>
          <label className="wu-field-label">Note<textarea value={draft.content} onChange={event => updateDraft({ ...draftRef.current, content: event.target.value })}
            onBlur={() => { if (editing === 'edit') void saveDraft(); }} rows={12} placeholder="Capture decisions, next steps, or open questions" /></label>
          <p className="wu-muted">Use a task ID like TASK-42 to link to a workspace task.</p>
          {error && <p role="alert">{error}</p>}
          <div className="wu-note-toolbar">
            {editing === 'new' ? <><button className="wu-button wu-button--secondary" type="button" disabled={busy} onClick={() => setEditing(undefined)}>Cancel</button>
              <button className="wu-button wu-button--primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create note'}</button></>
              : <><span className="wu-muted" role="status">{busy ? 'Saving…' : notice}</span><button className="wu-button wu-button--secondary" type="button"
                disabled={busy} onClick={() => void saveDraft(true)}>Done editing</button></>}
          </div>
        </form> : detail.error ? <p role="alert">This note could not be opened. <button className="wu-text-button" type="button" onClick={detail.retry}>Try again</button></p>
          : selected ? <>
            <header className="wu-note-header">
              <div><h2>{selected.title}</h2><p className="wu-note-meta">{authorName(selected)} · Updated {formatTime(selected.updatedAt)}{!canEdit(selected) && ' · Read only'}</p></div>
              <div className="wu-note-actions">
                {canEdit(selected) && <button className="wu-button wu-button--secondary" type="button" disabled={busy} onClick={() => start(selected)}><Pencil size={15} />Edit</button>}
                <button className="wu-icon-button" type="button" aria-label="Copy note link" title="Copy link" onClick={() => void copyLink()}><Link2 size={17} /></button>
                {canEdit(selected) && <ActionMenu label="Note actions" actions={[
                  { label: selected.pinnedAt ? 'Unpin note' : 'Pin note', disabled: busy, run: () => pin(selected) },
                  { label: 'Delete note', disabled: busy, run: () => { setError(''); setRemoving(selected); } },
                ]} />}
              </div>
            </header>
            {error && !removing && <p role="alert">{error}</p>}
            {notice && <p className="wu-muted" role="status">{notice}</p>}
            <div className="wu-note-body"><p>{selected.content || 'This note is empty.'}</p></div>
            {!!referencedTasks.length && <section className="wu-note-linked"><h3>Referenced tasks</h3>
              {referencedTasks.map(task => <button key={task.id} type="button" className="wu-task-link" onClick={() => onOpenTask(task.id)}>
                <Link2 size={15} /><span>{task.taskKey} · {task.title}</span></button>)}</section>}
          </> : activeId ? <LoadingPanel label="Opening note" />
            : <div className="wu-note-reader-empty"><WorkspaceIllustration kind="note" /><p className="wu-muted">{search.trim() ? 'Select a note from the search results.' : 'Select a note to read it here.'}</p></div>}
      </section>
    </div>
    {removing && <Drawer title={'Delete ' + removing.title + '?'} confirmation closeDisabled={busy} onClose={() => setRemoving(undefined)}>
      <p>This removes the note from the workspace.</p>
      {error && <p role="alert">{error}</p>}
      <div className="wu-modal-actions"><button className="wu-button wu-button--secondary" autoFocus disabled={busy} onClick={() => setRemoving(undefined)}>Cancel</button>
        <button className="wu-button wu-button--primary" disabled={busy} onClick={() => void changeNote(async () => {
          await workspaceRequest(path + '/' + removing.id, token, { method: 'DELETE' });
          list.setItems(items => items?.filter(item => item.id !== removing.id));
          showNote('');
          setRemoving(undefined);
          list.retry();
        })}>Delete note</button></div>
    </Drawer>}
  </>;
}
