import { useEffect, useRef, useState } from 'react';
import { Download, FileText, Search, Upload } from 'lucide-react';
import { Panel } from '../components';
import { WorkspaceIllustration } from '../WorkspaceIllustration';
import { ActionMenu, DocumentPagination, Drawer, LoadingPanel } from '../WorkspaceControls';
import { documentPagePath, documentPageSize, fileSize, useWorkspaceCollection, workspaceRequest, type WorkspaceFile } from '../workspace-api';
import type { PageHeading } from '../types';
import type { Member } from '../workspace-tasks';
import './files.css';

type FilesPageProps = {
  pageHeading: PageHeading;
  path: string;
  token: string | null;
  files?: WorkspaceFile[];
  members: Member[];
  onUpload: (file: WorkspaceFile) => void;
  onDelete: (id: string) => void;
  owner: boolean;
  readOnly?: boolean;
  profileId: string;
  onBackToTask?: () => void;
};

export function FilesPage({ pageHeading, path, token, files, members, onUpload, onDelete, owner, profileId, onBackToTask, readOnly = false }: FilesPageProps) {
  const input = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState(() => window.location.hash.startsWith('#file-') ? window.location.hash.slice(6) : '');
  const [drawerOpen, setDrawerOpen] = useState(() => !!selectedId);
  const [sort, setSort] = useState('recent');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { items: listedFiles, error: loadError, retry } = useWorkspaceCollection<WorkspaceFile>(documentPagePath(path, page, search, sort), token);
  const [linkedFile, setLinkedFile] = useState<WorkspaceFile>();
  const [fileError, setFileError] = useState(false);
  const [fileAttempt, setFileAttempt] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<WorkspaceFile>();
  const [deleting, setDeleting] = useState(false);
  const file = listedFiles?.find(item => item.id === selectedId)
    ?? files?.find(item => item.id === selectedId)
    ?? (linkedFile?.id === selectedId ? linkedFile : undefined);
  const recent = files?.slice(0, 4) ?? [];

  useEffect(() => {
    if (!drawerOpen || !selectedId || !token) return;
    const controller = new AbortController();
    void workspaceRequest(path + '/' + encodeURIComponent(selectedId), token, { signal: controller.signal })
      .then(response => response.json() as Promise<WorkspaceFile>)
      .then(result => { if (!controller.signal.aborted) setLinkedFile(result); })
      .catch(() => { if (!controller.signal.aborted) setFileError(true); });
    return () => controller.abort();
  }, [drawerOpen, selectedId, token, path, fileAttempt]);

  const uploaderNames = new Map(members.map(member => [member.userId, member.username]));

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
      retry();
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
      retry();
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
    setFileError(false);
    setError('');
    setDrawerOpen(true);
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
    {pageHeading(!readOnly && <button className="wu-button wu-button--primary" type="button" disabled={uploading || !token} onClick={() => input.current?.click()}><Upload size={15} />{uploading ? 'Uploading…' : 'Upload file'}</button>)}
    {onBackToTask && <button className="wu-text-button" type="button" onClick={onBackToTask}>Back to task</button>}
    <input ref={input} type="file" hidden onChange={event => {
      const chosen = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (chosen) void upload(chosen);
    }} />
    {error && !(drawerOpen && file) && !removing && <p role="alert">{error}</p>}
    {recent.length > 0 && <section className="wu-recent-files" aria-labelledby="wu-recent-files-heading">
      <h2 id="wu-recent-files-heading">Recent files</h2>
      <ul>
        {recent.map(item => <li key={item.id}>
          <button className="wu-recent-file" type="button" onClick={() => selectFile(item.id)}>
            <span className="wu-recent-file-art"><WorkspaceIllustration kind="note" size={48} /></span>
            <strong>{item.displayName}</strong>
            <small>{fileSize(item.sizeBytes)}</small>
          </button>
        </li>)}
      </ul>
    </section>}
    <Panel className="wu-list-panel">
        <div className="wu-list-toolbar wu-files-toolbar">
          <h2>Workspace files</h2>
          <label className="wu-list-search"><Search size={16} aria-hidden="true" />
            <input type="search" aria-label="Search files" placeholder="Search filenames" maxLength={200} value={search} onChange={event => { setSearch(event.currentTarget.value); setPage(1); }} />
          </label>
          <label className="wu-file-sort">Sort by
            <select className="wu-select" value={sort} onChange={event => { setSort(event.currentTarget.value); setPage(1); }}>
              <option value="recent">Newest first</option><option value="name">Name A–Z</option><option value="size">Largest first</option>
            </select>
          </label>
        </div>
        {loadError && <p role="alert">Could not load files. <button className="wu-text-button" onClick={retry}>Try again</button></p>}
        {!listedFiles && !loadError && <LoadingPanel label="Loading workspace files" />}
        {listedFiles?.length === 0 && <div className="wu-object-empty"><WorkspaceIllustration kind="folder" /><p className="wu-muted">{page > 1 ? 'No files on this page.' : search.trim() ? 'No files match your search.' : 'No files yet. Upload a file to share it with the team.'}</p></div>}
        {!!listedFiles?.length && <table className="wu-table wu-list-table wu-files-table" role="table" aria-label="Workspace files">
          <thead role="rowgroup"><tr role="row"><th scope="col">Name</th><th scope="col">Date added</th><th scope="col">Size</th><th scope="col">Uploaded by</th><th scope="col"><span className="wu-visually-hidden">Actions</span></th></tr></thead>
          <tbody role="rowgroup">
            {listedFiles.slice(0, documentPageSize).map(item => <tr key={item.id} role="row">
              <td role="cell"><button className="wu-list-item-name" type="button" onClick={() => selectFile(item.id)}><FileText size={17} aria-hidden="true" />{item.displayName}</button></td>
              <td role="cell" data-label="Date added" className="wu-muted">{new Date(item.createdAt).toLocaleDateString()}</td>
              <td role="cell" data-label="Size" className="wu-muted">{fileSize(item.sizeBytes)}</td>
              <td role="cell" data-label="Uploaded by">{item.uploaderId === profileId ? 'You' : uploaderNames.get(item.uploaderId ?? '') ?? '—'}</td>
              <td role="cell" className="wu-file-actions-cell"><div className="wu-file-actions">
                <button className="wu-icon-button" type="button" aria-label={`Download ${item.displayName}`} title="Download file" onClick={() => void download(item)}><Download size={16} /></button>
                {!readOnly && (owner || item.uploaderId === profileId) && <ActionMenu label={'Actions for ' + item.displayName} actions={[
                  { label: 'Delete file', run: () => { setError(''); setRemoving(item); } },
                ]} />}
              </div></td>
            </tr>)}
          </tbody>
        </table>}
        <DocumentPagination page={page} count={listedFiles?.length} onPage={setPage} />
    </Panel>
    {drawerOpen && <Drawer title="File details" onClose={() => setDrawerOpen(false)}>
      <div className="wu-file-inspector">{fileError ? <p role="alert">This file could not be opened. It may have been removed or you may not have access. <button className="wu-text-button" onClick={() => { setFileError(false); setFileAttempt(value => value + 1); }}>Try again</button></p>
        : file ? details(file) : <LoadingPanel label="Loading file details" />}{error && <p role="alert">{error}</p>}</div>
    </Drawer>}
    {removing && <Drawer title={`Delete ${removing.displayName}?`} confirmation onClose={() => { setRemoving(undefined); setError(''); }}>
      <p>This removes the file from the workspace.</p>
      {error && <p role="alert">{error}</p>}
      <div className="wu-modal-actions"><button className="wu-button wu-button--secondary" autoFocus disabled={deleting} onClick={() => { setRemoving(undefined); setError(''); }}>Cancel</button>
        <button className="wu-button wu-button--primary" disabled={deleting} onClick={() => void removeFile()}>Delete file</button></div>
    </Drawer>}
  </>;
}
