import { Download, FileText, Filter, MoreHorizontal, Upload } from 'lucide-react';
import { IconTile, Panel } from '../components';
import { files } from '../previewData';
import type { PageHeading, Task } from '../types';
import './files.css';

type FilesPageProps = {
  pageHeading: PageHeading;
  selectedFile: string;
  setSelectedFile: (id: string) => void;
  tasks: Task[];
  setSelectedTask: (task: Task) => void;
  setToast: (message: string) => void;
};

export function FilesPage({
  pageHeading,
  selectedFile,
  setSelectedFile,
  tasks,
  setSelectedTask,
  setToast,
}: FilesPageProps) {
  const file = files.find(item => item.id === selectedFile) ?? files[0];
  return <>{pageHeading(<button className="wu-button wu-button--primary" type="button" onClick={() => setToast('Choose a file from your device to upload.')}><Upload size={15} />Upload file</button>)}<div className="wu-files-layout"><Panel className="wu-content-panel"><div className="wu-panel-heading"><div><h2>Workspace files</h2><p>Shared files attached to team work.</p></div><button className="wu-icon-button" type="button" aria-label="Filter files"><Filter size={17} /></button></div><div className="wu-table-wrap"><table className="wu-table"><thead><tr><th>Name</th><th>Type</th><th>Added by</th><th>Date</th><th>Task</th></tr></thead><tbody>{files.map(item => <tr className={selectedFile === item.id ? 'is-row-selected' : ''} key={item.id} onClick={() => setSelectedFile(item.id)} tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') setSelectedFile(item.id); }}><td><span className="wu-file-cell"><IconTile tone={item.color}><FileText size={16} /></IconTile><strong>{item.name}</strong></span></td><td>{item.kind} · {item.size}</td><td>{item.owner}</td><td>{item.date}</td><td><span className="wu-task-id">{item.task}</span></td></tr>)}</tbody></table></div></Panel><Panel className="wu-file-inspector"><div className="wu-panel-heading"><h2>File details</h2><button className="wu-icon-button" aria-label="More file actions" type="button"><MoreHorizontal size={18} /></button></div><div className={`wu-file-preview wu-file-preview--${file.color}`}><FileText size={42} /><span>Preview unavailable</span></div><h3>{file.name}</h3><p className="wu-muted">{file.kind} · {file.size}</p><div className="wu-inspector-meta"><span>Added by</span><strong>{file.owner}</strong><span>Date added</span><strong>{file.date}</strong><span>Linked task</span><button className="wu-text-button" type="button" onClick={() => { const task = tasks.find(item => item.id === file.task); if (task) setSelectedTask(task); }}>{file.task}</button></div><button className="wu-button wu-button--secondary wu-full-button" type="button" onClick={() => setToast(`Preparing ${file.name} for download.`)}><Download size={15} />Download file</button></Panel></div></>;
}
