import { useRef, useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { Panel } from '../components';
import { ActionMenu, Drawer, LoadingPanel } from '../WorkspaceControls';
import { fileSize, workspaceRequest, type WorkspaceFile } from '../workspace-api';
import type { PageHeading } from '../types';
import './files.css';

type FilesPageProps = {
  pageHeading: PageHeading;
  path: string;
  token: string | null;
  files?: WorkspaceFile[];
  loadError: boolean;
  onRetry: () => void;
  onUpload: (file: WorkspaceFile) => void;
  onDelete: (id: string) => void;
  owner: boolean;
  profileId: string;
};

export function FilesPage({ pageHeading, path, token, files, loadError, onRetry, onUpload, onDelete, owner, profileId }: FilesPageProps) {
  const input = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState(() => window.location.hash.startsWith('#file-') ? window.location.hash.slice(6) : '');
  const [drawerOpen, setDrawerOpen] = useState(() => !!selectedId && window.matchMedia('(max-width: 680px)').matches);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<WorkspaceFile>();
  const [deleting, setDeleting] = useState(false);
  const file = files?.find(item => item.id === selectedId) ?? files?.[0];

  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setError('Choose a file no larger than 10 MiB.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const body = new FormData();
      body.set('file', file);
      const response = await workspaceRequest(path, token, { method: 'POST', body });
      const created = await response.json() as WorkspaceFile;
      onUpload(created);
      setSelectedId(created.id);
    } catch {
      setError('Could not upload the file. Try again.');
    } finally {
      setUploading(false);
    }
  }

  async function removeFile() {
    if (!removing || deleting) return;
    setDeleting(true);
    try {
      await workspaceRequest(path + '/' + encodeURIComponent(removing.id), token, { method: 'DELETE' });
      onDelete(removing.id);
      if (selectedId === removing.id) setSelectedId('');
      setRemoving(undefined);
      setDrawerOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not delete the file.');
    } finally {
      setDeleting(false);
    }
  }

  async function download(file: WorkspaceFile) {
    setError('');
    try {
      const response = await workspaceRequest(path + '/' + encodeURIComponent(file.id) + '/download', token);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = file.displayName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      setError('Could not download the file. Try again.');
    }
  }

  function selectFile(id: string) {
    setSelectedId(id);
    if (window.matchMedia('(max-width: 680px)').matches) setDrawerOpen(true);
  }

  function details(item: WorkspaceFile) {
    return <>
      <div className="wu-file-preview"><FileText size={42} aria-hidden="true" /><span>{item.mimeType ?? 'File'}</span></div>
      <h3>{item.displayName}</h3>
      <p className="wu-muted">{fileSize(item.sizeBytes)} · Added {new Date(item.createdAt).toLocaleDateString()}</p>
      <button className="wu-button wu-button--secondary" type="button" onClick={() => void download(item)}>Download file</button>
    </>;
  }

  return <>
    {pageHeading(<button className="wu-button wu-button--primary" type="button" disabled={uploading || !files} onClick={() => input.current?.click()}><Upload size={15} />{uploading ? 'Uploading…' : 'Upload file'}</button>)}
    <input ref={input} type="file" hidden onChange={event => {
      const chosen = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (chosen) void upload(chosen);
    }} />
    {error && !drawerOpen && !removing && <p role="alert">{error}</p>}
    <div className="wu-files-layout">
      <Panel className="wu-content-panel">
        <div className="wu-panel-heading"><div><h2>Workspace files</h2><p>Files shared with this workspace. Maximum upload size: 10 MiB.</p></div></div>
        {loadError && <p role="alert">Could not load files. <button className="wu-text-button" onClick={onRetry}>Try again</button></p>}
        {!files && !loadError && <LoadingPanel label="Loading workspace files" />}
        {files?.length === 0 && <p className="wu-muted">No files yet. Upload a file to share it with the team.</p>}
        {!!files?.length && <ul className="wu-document-list">
          {files.map(item => <li key={item.id} data-current={item.id === file?.id}>
            <button className="wu-document-select" type="button" onClick={() => selectFile(item.id)}>
              <FileText size={18} aria-hidden="true" /><span><strong>{item.displayName}</strong><small>{fileSize(item.sizeBytes)}</small></span>
            </button>
            <ActionMenu label={'Actions for ' + item.displayName} actions={[
              { label: 'View details', run: () => selectFile(item.id) },
              { label: 'Download', run: () => void download(item) },
              ...(owner || item.uploaderId === profileId ? [{ label: 'Delete file', run: () => { setError(''); setRemoving(item); } }] : []),
            ]} />
          </li>)}
        </ul>}
      </Panel>
      {file && <Panel className="wu-file-inspector wu-desktop-file-inspector">
        <div className="wu-panel-heading"><h2>File details</h2></div>
        {details(file)}
      </Panel>}
    </div>
    {drawerOpen && file && <Drawer title="File details" onClose={() => setDrawerOpen(false)}>
      <div className="wu-file-inspector">{details(file)}{error && <p role="alert">{error}</p>}</div>
    </Drawer>}
    {removing && <Drawer title={`Delete ${removing.displayName}?`} confirmation onClose={() => { setRemoving(undefined); setError(''); }}>
      {error && <p role="alert">{error}</p>}
      <div className="wu-modal-actions"><button className="wu-button wu-button--secondary" autoFocus disabled={deleting} onClick={() => { setRemoving(undefined); setError(''); }}>Cancel</button>
        <button className="wu-button wu-button--primary" disabled={deleting} onClick={() => void removeFile()}>Delete file</button></div>
    </Drawer>}
  </>;
}
