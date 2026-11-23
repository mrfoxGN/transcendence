import { IllustratedEmptyState } from '../../../shared/illustrations/EmptyIllustration';
import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link2, Pencil, Pin, Plus, Search, Trash2 } from 'lucide-react';
import { Panel } from '../components';
import { Drawer, LoadingPanel } from '../WorkspaceControls';
import { documentPageSize, jsonRequest, useWorkspaceData, workspaceRequest } from '../workspace-api';
import type { PageHeading, Task } from '../types';
import type { Member } from '../workspace-tasks';
import './notes.css';
import './notes-design.css';
import {NoteCardPreview} from './NoteCardPreview';
import { useWorkspaceDocumentCollection } from '../workspace-documents';
import {projectAppearance} from '../project-appearance';

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
const NoteRichEditor=lazy(async()=>({default:(await import('./NoteRichEditor')).NoteRichEditor}));
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
  const list = useWorkspaceDocumentCollection<Note>(path, token);
  const filtered = (list.items ?? [])
    .filter(note=>!queryText||note.title.toLowerCase().includes(queryText)||(note.content??'').toLowerCase().includes(queryText))
    .sort((a,b)=>{
      const pinDiff=(b.pinnedAt?Date.parse(b.pinnedAt):0)-(a.pinnedAt?Date.parse(a.pinnedAt):0);
      return pinDiff || (sort==='name'?a.title.localeCompare(b.title):Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
    });
  const startIdx=(page-1)*documentPageSize;
  const visible=filtered.slice(startIdx,startIdx+documentPageSize);
  const hasNext=filtered.length>startIdx+documentPageSize;
  useEffect(()=>{
    if(list.items)setPage(value=>Math.min(value,Math.max(1,Math.ceil(filtered.length/documentPageSize))));
  },[list.items,filtered.length]);

  const [selectedId, setSelectedId] = useState(noteIdFromUrl);
  const activeId = selectedId;
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
  const canEdit = (note: Note) => !readOnly && (owner || note.creatorId === profileId);
  const authorName = (note: Note) => note.creatorId === profileId ? 'You' : members.find(member => member.userId === note.creatorId)?.username ?? 'Unknown author';

  useEffect(() => {
    const sync = () => setSelectedId(noteIdFromUrl());
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync); };
  }, []);

  function updateDraft(next: Draft) { draftRef.current = next; setDraft(next); setNotice(''); }
  function showNote(id: string) {
    setSelectedId(id);
    setError('');
    setNotice('');
    const url = new URL(location.href);
    url.hash = id ? 'note-' + id : '';
    history.replaceState(history.state, '', url);
  }

  function storeNote(note: Note) {
    detail.setData(current => current?.id === note.id ? note : current);
    list.setItems(items => items?.map(item => item.id === note.id ? note : item));
  }

  function start(note?: Note) {
    showNote(note?.id??'');
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

  useEffect(()=>{
    if(editing!=='edit'||!baseline.current)return;
    if(draft.title.trim()===baseline.current.title&&draft.content===(baseline.current.content??''))return;
    const timer=window.setTimeout(()=>{void saveDraft();},900);
    return()=>window.clearTimeout(timer);
  },[draft,editing]);

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
      showNote(note.id);
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

  const referenceKeys = new Set((selected?.content ?? '').match(/\b(?:TASK|DEV)-[1-9]\d*\b/gi)?.map(key => key.toUpperCase()));
  const referencedTasks = tasks.filter(task => task.taskKey && referenceKeys.has(task.taskKey.toUpperCase()));

  return <>
    {pageHeading(!readOnly && <button className="wu-button wu-button--primary wu-button--with-icon" type="button" disabled={busy || !!editing} onClick={() => start()}><Plus size={15} aria-hidden="true"/>New note</button>)}
    <div className="wu-notes-board">
      <div className="wu-notes-card-tools">
        <label className="wu-list-search"><Search size={16} aria-hidden="true"/><input type="search" aria-label="Search notes" placeholder="Search your notes" maxLength={200} value={search} onChange={event=>{setSearch(event.target.value);setPage(1);}}/></label>
        <select className="wu-select" aria-label="Sort notes" value={sort} onChange={event=>{setSort(event.target.value);setPage(1);}}><option value="updated">Recently updated</option><option value="name">Title A–Z</option></select>
        {list.items&&<span className="wu-notes-card-count">{filtered.length} {filtered.length===1?'note':'notes'}</span>}
      </div>
      {list.error&&<p role="alert">Could not load notes. <button className="wu-text-button" type="button" onClick={list.retry}>Try again</button></p>}
      {!list.items&&!list.error&&<LoadingPanel label="Loading workspace notes"/>}
      {error&&!editing&&!removing&&!activeId&&<p role="alert">{error}</p>}
      {list.items&&!visible.length&&<Panel><IllustratedEmptyState kind={search.trim()?'search':'notes'} title={search.trim()?'No matching notes':'Room for your next idea'} detail={search.trim()?'Try another title or a few words from the note.':'Keep decisions, ideas, and next steps together.'} action={!search.trim()&&!readOnly?'Create note':undefined} onAction={()=>start()}/></Panel>}
      {!!visible.length&&<ul className="wu-notes-card-grid">{visible.map(note=><li key={note.id}>
        <article className="wu-note-gradient-card" data-note-id={note.id} style={projectAppearance('note:'+note.id)}>
          <div className="wu-note-card-actions">
            {canEdit(note)?<>
              <button type="button" className="wu-icon-button" aria-label={(note.pinnedAt?'Unpin note: ':'Pin note: ')+note.title} title={note.pinnedAt?'Unpin note':'Pin note'} aria-pressed={!!note.pinnedAt} disabled={busy} onClick={()=>pin(note)}><Pin size={15} fill={note.pinnedAt?'currentColor':'none'} aria-hidden="true"/></button>
              <button type="button" className="wu-icon-button" aria-label={'Edit note: '+note.title} title="Edit note" disabled={busy} onClick={()=>start(note)}><Pencil size={15} aria-hidden="true"/></button>
              <button type="button" className="wu-icon-button wu-note-delete" aria-label={'Delete note: '+note.title} title="Delete note" disabled={busy} onClick={()=>{setError('');setRemoving(note);}}><Trash2 size={15} aria-hidden="true"/></button>
            </>:<span className="wu-note-readonly">Read only</span>}
          </div>
          <h2><button type="button" onClick={()=>showNote(note.id)}>{note.title}</button></h2>
          <button type="button" className="wu-note-card-read" aria-label={'Read note: '+note.title} onClick={()=>showNote(note.id)}><NoteCardPreview content={note.content??''}/></button>
          <footer><span>{authorName(note)}</span><time dateTime={note.updatedAt} title={formatTime(note.updatedAt)}>{new Date(note.updatedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</time></footer>
        </article>
      </li>)}</ul>}
      {(page>1||hasNext)&&<nav className="wu-document-pagination" aria-label="Document pages"><button className="wu-button wu-button--secondary" type="button" disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button><span aria-live="polite">Page {page}</span><button className="wu-button wu-button--secondary" type="button" disabled={!hasNext} onClick={()=>setPage(page+1)}>Next</button></nav>}
    </div>
    {(editing||activeId)&&<Drawer title={editing==='new'?'New note':editing==='edit'?'Edit note':selected?.title??'Note'} closeDisabled={busy||!!editing} onClose={()=>{setEditing(undefined);showNote('');}}>
      <div className="wu-note-workbench"><Suspense fallback={<LoadingPanel label="Loading note editor"/>}>
        {editing?<form className="wu-note-writing-form" onKeyDown={event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();if(!busy){if(editing==='edit')void saveDraft();else event.currentTarget.requestSubmit();}}}} onSubmit={editing==='new'?create:event=>{event.preventDefault();void saveDraft(true);}}>
          <label className="wu-field-label">Title<input value={draft.title} onChange={event=>updateDraft({...draftRef.current,title:event.target.value})} required maxLength={200} autoFocus placeholder="Give your note a title"/></label>
          <NoteRichEditor key={editing==='new'?'new':baseline.current?.id} value={draft.content} onChange={content=>updateDraft({...draftRef.current,content})}/>
          <p className="wu-note-writing-hint">Reference a task by its ID to keep your notes connected to your work.</p>
          {error&&<p role="alert">{error}</p>}
          <div className="wu-note-writing-actions">
            <span className="wu-muted" role="status">{busy?'Saving…':editing==='new'?'Unsaved draft':(draft.title.trim()!==baseline.current?.title||draft.content!==(baseline.current?.content??''))?'Unsaved changes':notice||'Changes save automatically'}</span>
            {editing==='new'?<><button className="wu-button wu-button--secondary" type="button" disabled={busy} onClick={()=>{setEditing(undefined);showNote('');}}>Cancel</button><button className="wu-button wu-button--primary" type="submit" disabled={busy}>{busy?'Creating…':'Create note'}</button></>:<button className="wu-button wu-button--primary" type="submit" disabled={busy}>Done editing</button>}
          </div>
        </form>:detail.error?<p role="alert">This note could not be opened. <button className="wu-text-button" type="button" onClick={detail.retry}>Try again</button></p>:selected?<>
          <div className="wu-note-reading-meta"><span>{authorName(selected)} · Updated {formatTime(selected.updatedAt)}{!canEdit(selected)&&' · Read only'}</span><div>{canEdit(selected)&&<button className="wu-button wu-button--secondary wu-button--with-icon" type="button" disabled={busy} onClick={()=>start(selected)}><Pencil size={15} aria-hidden="true"/>Edit</button>}<button className="wu-icon-button" type="button" aria-label="Copy note link" title="Copy note link" onClick={()=>void copyLink()}><Link2 size={16} aria-hidden="true"/></button></div></div>
          {error&&!removing&&<p role="alert">{error}</p>}{notice&&<p className="wu-muted" role="status">{notice}</p>}
          <NoteRichEditor key={'read-'+selected.id+'-'+selected.updatedAt} value={selected.content||'This note is empty.'} editable={false}/>
          {!!referencedTasks.length&&<section className="wu-note-linked"><h3>Referenced tasks</h3>{referencedTasks.map(task=><button key={task.id} type="button" className="wu-task-link" onClick={()=>onOpenTask(task.id)}><Link2 size={15} aria-hidden="true"/><span>{task.taskKey} · {task.title}</span></button>)}</section>}
        </>:<LoadingPanel label="Opening note"/>}
      </Suspense></div>
    </Drawer>}
    {removing&&<Drawer title={'Delete '+removing.title+'?'} confirmation closeDisabled={busy} onClose={()=>setRemoving(undefined)}>
      <p>This removes the note from the workspace.</p>{error&&<p role="alert">{error}</p>}
      <div className="wu-modal-actions"><button className="wu-button wu-button--secondary" autoFocus disabled={busy} onClick={()=>setRemoving(undefined)}>Cancel</button><button className="wu-button wu-button--primary" disabled={busy} onClick={()=>void changeNote(async()=>{await workspaceRequest(path+'/'+removing.id,token,{method:'DELETE'});list.setItems(items=>items?.filter(item=>item.id!==removing.id));if(activeId===removing.id)showNote('');setRemoving(undefined);list.retry();})}>Delete note</button></div>
    </Drawer>}
  </>;
}
