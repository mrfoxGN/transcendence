import { ArrowUpRight, Filter, MoreHorizontal, Plus } from 'lucide-react';
import { Panel } from '../components';
import { noteItems } from '../previewData';
import type { PageHeading, Task, FormHandler } from '../types';
import './notes.css';

type NotesPageProps = {
  pageHeading: PageHeading;
  selectedNote: number;
  setSelectedNote: (index: number) => void;
  editingNote: boolean;
  setEditingNote: (editing: boolean) => void;
  noteText: string;
  setNoteText: (text: string) => void;
  tasks: Task[];
  setSelectedTask: (task: Task) => void;
  setToast: (message: string) => void;
  saveNote: FormHandler;
};

export function NotesPage({
  pageHeading,
  selectedNote,
  setSelectedNote,
  editingNote,
  setEditingNote,
  noteText,
  setNoteText,
  tasks,
  setSelectedTask,
  setToast,
  saveNote,
}: NotesPageProps) {
  const note = noteItems[selectedNote];
  return <>{pageHeading(<button className="wu-button wu-button--primary" type="button" onClick={() => { setSelectedNote(0); setNoteText(''); setEditingNote(true); }}><Plus size={16} />New note</button>)}<div className="wu-notes-layout"><Panel className="wu-notes-list"><div className="wu-panel-heading"><h2>Workspace notes</h2><button className="wu-icon-button" aria-label="Filter notes" type="button"><Filter size={16} /></button></div>{noteItems.map((item, index) => <button className={`wu-note-item${index === selectedNote ? ' is-selected' : ''}`} key={item.title} type="button" onClick={() => { setSelectedNote(index); setNoteText(item.text); setEditingNote(false); }}><strong>{item.title}</strong><small>{item.meta}</small><span>{item.text}</span></button>)}</Panel><Panel className="wu-note-editor"><div className="wu-note-toolbar">{editingNote ? <button className="wu-button wu-button--primary" type="button" onClick={() => { setEditingNote(false); setToast('Note saved.'); }}>Save note</button> : <button className="wu-button wu-button--secondary" type="button" onClick={() => setEditingNote(true)}>Edit note</button>}<button className="wu-icon-button" aria-label="More note actions" type="button"><MoreHorizontal size={18} /></button></div>{editingNote ? <form onSubmit={saveNote}><label className="wu-field-label">Title<input defaultValue={note.title} /></label><label className="wu-field-label">Note<textarea rows={9} value={noteText} onChange={event => setNoteText(event.target.value)} /></label><p className="wu-muted">Use notes to keep decisions easy to find.</p></form> : <><h2>{note.title}</h2><p className="wu-note-meta">{note.meta}</p><div className="wu-note-body"><p>{noteText}</p></div><div className="wu-note-linked"><h3>Linked work</h3><button className="wu-task-link" type="button" onClick={() => { const task = tasks.find(item => item.id === 'DEV-12'); if (task) setSelectedTask(task); }}><span className="wu-task-id">DEV-12</span>Build login page<ArrowUpRight size={14} /></button></div></>}</Panel></div></>;
}
