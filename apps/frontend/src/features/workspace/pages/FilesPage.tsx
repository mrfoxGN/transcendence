import { useEffect, useRef, useState } from 'react';
import { Download, Link2, Pencil, Search, Upload } from 'lucide-react';
import { Panel } from '../components';
import { WorkspaceIllustration } from '../WorkspaceIllustration';
import { ActionMenu, DocumentPagination, Drawer, LoadingPanel } from '../WorkspaceControls';
import { documentPagePath, documentPageSize, fileSize, jsonRequest, useWorkspaceCollection, workspaceRequest, type WorkspaceFile } from '../workspace-api';
import { FilePreview, FileTypeIcon } from '../FilePreview';
import { uploadLimit, uploadWorkspaceFile } from '../upload-workspace-file';
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
  onRename: (file: WorkspaceFile) => void;
  onOpenTask: (id: string) => void;
  owner: boolean;
  readOnly?: boolean;
  profileId: string;
  onBackToTask?: () => void;
};

export function FilesPage({ pageHeading, path, token, files, members, onUpload, onDelete, onRename, onOpenTask, owner, profileId, onBackToTask, readOnly = false }: FilesPageProps) {
  const input = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState(() => window.location.hash.startsWith('#file-') ? window.location.hash.slice(6) : '');
  const [drawerOpen, setDrawerOpen] = useState(() => !!selectedId);
  const [sort, setSort] = useState('recent');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [uploader, setUploader] = useState('');
  const [page, setPage] = useState(1);
  const filters = new URLSearchParams();
  if (kind) filters.set('kind', kind);
  if (uploader) filters.set('uploaderId', uploader);
  const filtered = !!(kind || uploader || search.trim());
  const { items: listedFiles, setItems, error: loadError, retry } = useWorkspaceCollection<WorkspaceFile>(
    documentPagePath(path, page, search, sort) + (filters.size ? '&' + filters : ''), token,
  );
  const [linkedFile, setLinkedFile] = useState<WorkspaceFile>();
  const [fileError, setFileError] = useState(false);
  const [fileAttempt, setFileAttempt] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadName, setUploadName] = useState('');
  const uploadRequest = useRef<AbortController | null>(null);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<WorkspaceFile>();
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState<WorkspaceFile>();
  const [renameBusy, setRenameBusy] = useState(false);
  const file = listedFiles?.find(item => item.id === selectedId)
    ?? files?.find(item => item.id === selectedId)
    ?? (linkedFile?.id === selectedId ? linkedFile : undefined);
  const recent = files?.slice(0, 4) ?? [];
  useEffect(() => () => uploadRequest.current?.abort(), []);

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
    if (readOnly || !token || uploadRequest.current) return;
    if (file.size > uploadLimit) {
      setError('Choose a file no larger than 10 MiB.');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    setUploadName(file.name);
    setError('');
    const controller = new AbortController();
    uploadRequest.current = controller;
    try {
      const created = await uploadWorkspaceFile(path, token, file, setUploadProgress, controller.signal);
      onUpload(created);
      retry();
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not upload the file.');
    } finally {
      uploadRequest.current = null;
      setUploading(false);
    }
  }

  async function renameFile(name: string) {
    if (!renaming || renameBusy || readOnly) return;
    const displayName = name.trim();
    if (!displayName) { setError('Enter a filename.'); return; }
    setRenameBusy(true);
    setError('');
    try {
      const response = await workspaceRequest(path + '/' + renaming.id, token, jsonRequest('PATCH', { displayName }));
      const updated = await response.json() as WorkspaceFile;
      setItems(items => items?.map(item => item.id === updated.id ? updated : item));
      setLinkedFile(current => current?.id === updated.id ? updated : current);
      onRename(updated);
      retry();
      setRenaming(undefined);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not rename the file.');
    } finally {
      setRenameBusy(false);
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
      <FilePreview key={item.id} file={item} path={path} token={token} />
      <div><h3>{item.displayName}</h3>
        <p className="wu-muted">{fileSize(item.sizeBytes)} · Added {new Date(item.createdAt).toLocaleDateString()} · {uploaderNames.get(item.uploaderId ?? '') ?? 'Unknown uploader'}</p>
      </div>
      <div className="wu-file-detail-actions">
        <button className="wu-button wu-button--secondary" type="button" onClick={() => void download(item)}><Download size={16} />Download</button>
        {item.taskId && <button className="wu-button wu-button--secondary" type="button" onClick={() => { setDrawerOpen(false); onOpenTask(item.taskId!); }}><Link2 size={16} />Open linked task</button>}
        {!readOnly && (owner || item.uploaderId === profileId) && <button className="wu-button wu-button--secondary" type="button"
          onClick={() => { setError(''); setRenaming(item); }}><Pencil size={16} />Rename</button>}
      </div>
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
    {!readOnly && <div className="wu-file-upload-status">
      {uploading ? <><span role="status">{uploadProgress === 100 ? 'Saving ' + uploadName + '…' : 'Uploading ' + uploadName + ' · ' + uploadProgress + '%'}</span>
        <progress aria-label="Upload progress" max={100} value={uploadProgress} />
        <button className="wu-text-button" type="button" disabled={uploadProgress === 100} onClick={() => uploadRequest.current?.abort()}>Cancel upload</button></>
        : <span className="wu-muted">Maximum file size 10 MiB</span>}
    </div>}
    {error && !(drawerOpen && file) && !removing && !renaming && <p role="alert">{error}</p>}
    {!filtered && recent.length > 0 && <section className="wu-recent-files" aria-labelledby="wu-recent-files-heading">
      <h2 id="wu-recent-files-heading">Recent files</h2>
      <ul>
        {recent.map(item => <li key={item.id}>
          <button className="wu-recent-file" type="button" onClick={() => selectFile(item.id)}>
            <FileTypeIcon file={item} />
            <span><strong>{item.displayName}</strong><small>{fileSize(item.sizeBytes)}</small></span>
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
        <div className="wu-file-filters" role="group" aria-label="File filters">
          <label className="wu-field-label">File type<select value={kind} onChange={event => { setKind(event.target.value); setPage(1); }}>
            <option value="">All types</option><option value="image">Images</option><option value="document">Documents</option><option value="text">Text files</option><option value="other">Other files</option>
          </select></label>
          <label className="wu-field-label">Uploaded by<select value={uploader} onChange={event => { setUploader(event.target.value); setPage(1); }}>
            <option value="">Anyone</option>{members.map(member => <option key={member.userId} value={member.userId}>{member.username}</option>)}
          </select></label>
          {filtered && <button className="wu-text-button" type="button" onClick={() => { setKind(''); setUploader(''); setSearch(''); setPage(1); }}>Clear filters</button>}
        </div>
        {loadError && <p role="alert">Could not load files. <button className="wu-text-button" onClick={retry}>Try again</button></p>}
        {!listedFiles && !loadError && <LoadingPanel label="Loading workspace files" />}
        {listedFiles?.length === 0 && <div className="wu-object-empty"><WorkspaceIllustration kind="folder" /><p className="wu-muted">{page > 1 ? 'No files on this page.' : filtered ? 'No files match these filters.' : 'No files yet.'}</p></div>}
        {!!listedFiles?.length && <table className="wu-table wu-list-table wu-files-table" role="table" aria-label="Workspace files">
          <thead role="rowgroup"><tr role="row"><th scope="col">Name</th><th scope="col">Date added</th><th scope="col">Size</th><th scope="col">Uploaded by</th><th scope="col"><span className="wu-visually-hidden">Actions</span></th></tr></thead>
          <tbody role="rowgroup">
            {listedFiles.slice(0, documentPageSize).map(item => <tr key={item.id} role="row">
              <td role="cell"><button className="wu-list-item-name" type="button" onClick={() => selectFile(item.id)}><FileTypeIcon file={item} /><span>{item.displayName}</span></button></td>
              <td role="cell" data-label="Date added" className="wu-muted">{new Date(item.createdAt).toLocaleDateString()}</td>
              <td role="cell" data-label="Size" className="wu-muted">{fileSize(item.sizeBytes)}</td>
              <td role="cell" data-label="Uploaded by">{item.uploaderId === profileId ? 'You' : uploaderNames.get(item.uploaderId ?? '') ?? '—'}</td>
              <td role="cell" className="wu-file-actions-cell"><div className="wu-file-actions">
                <button className="wu-icon-button" type="button" aria-label={`Download ${item.displayName}`} title="Download file" onClick={() => void download(item)}><Download size={16} /></button>
                {!readOnly && (owner || item.uploaderId === profileId) && <ActionMenu label={'Actions for ' + item.displayName} actions={[
                  { label: 'Rename file', run: () => { setError(''); setRenaming(item); } },
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
        : file ? details(file) : <LoadingPanel label="Loading file details" />}{error && !renaming && <p role="alert">{error}</p>}</div>
    </Drawer>}
    {renaming && <Drawer title="Rename file" closeDisabled={renameBusy} onClose={() => { setRenaming(undefined); setError(''); }}>
      <form className="wu-file-rename" onSubmit={event => { event.preventDefault(); void renameFile(String(new FormData(event.currentTarget).get('name') ?? '')); }}>
        <label className="wu-field-label">Filename<input name="name" required maxLength={255} defaultValue={renaming.displayName} autoFocus /></label>
        {error && <p role="alert">{error}</p>}
        <button className="wu-button wu-button--primary" disabled={renameBusy}>{renameBusy ? 'Renaming…' : 'Rename file'}</button>
      </form>
    </Drawer>}
    {removing && <Drawer title={`Delete ${removing.displayName}?`} confirmation onClose={() => { setRemoving(undefined); setError(''); }}>
      <p>This removes the file from the workspace.</p>
      {error && <p role="alert">{error}</p>}
      <div className="wu-modal-actions"><button className="wu-button wu-button--secondary" autoFocus disabled={deleting} onClick={() => { setRemoving(undefined); setError(''); }}>Cancel</button>
        <button className="wu-button wu-button--primary" disabled={deleting} onClick={() => void removeFile()}>Delete file</button></div>
    </Drawer>}
  </>;
}
