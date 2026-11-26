import { Download, LayoutGrid, Link2, List, Pencil, Search, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Select } from '../../../shared/controls/Select';
import { IllustratedEmptyState } from '../../../shared/illustrations/EmptyIllustration';
import { Button, IconButton, Input } from '../../../shared/ui';
import { Panel } from '../components';
import { FilePreview, FileThumbnail, FileTypeIcon, fileTypeAppearance } from '../FilePreview';
import type { PageHeading } from '../types';
import { uploadLimit, uploadWorkspaceFile } from '../upload-workspace-file';
import {
  documentPageSize,
  fileSize,
  jsonRequest,
  workspaceRequest,
  type WorkspaceFile,
} from '../workspace-api';
import { useWorkspaceFiles } from '../workspace-files';
import type { Member } from '../workspace-tasks';
import { ActionMenu, DocumentPagination, Drawer, LoadingPanel } from '../WorkspaceControls';
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

export function FilesPage({
  pageHeading,
  path,
  token,
  files,
  members,
  onUpload,
  onDelete,
  onRename,
  onOpenTask,
  owner,
  profileId,
  onBackToTask,
  readOnly = false,
}: FilesPageProps) {
  const input = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState(() =>
    window.location.hash.startsWith('#file-') ? window.location.hash.slice(6) : '',
  );
  const [drawerOpen, setDrawerOpen] = useState(() => !!selectedId);
  const [view, setView] = useState<'list' | 'grid'>(() => {
    try {
      return localStorage.getItem('devup:files:view') === 'grid' ? 'grid' : 'list';
    } catch {
      return 'list';
    }
  });
  function changeView(value: 'list' | 'grid') {
    setView(value);
    try {
      localStorage.setItem('devup:files:view', value);
    } catch {
      /* Browsing still works without storage. */
    }
  }
  const [sort, setSort] = useState('recent');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [uploader, setUploader] = useState('');
  const [page, setPage] = useState(1);
  const filtered = !!(kind || uploader || search.trim());
  const {
    items: allFiles,
    setItems,
    error: loadError,
    errorMessage: loadErrorMessage,
    retry,
  } = useWorkspaceFiles(path, token);
  const matchingFiles = allFiles
    ?.filter((item) => {
      const type = fileTypeAppearance(item).kind;
      const text =
        (item.mimeType ?? '').startsWith('text/') || /\.(txt|md|rtf)$/i.test(item.displayName);
      const category =
        type === 'image'
          ? 'image'
          : text
            ? 'text'
            : ['pdf', 'document', 'spreadsheet', 'presentation'].includes(type)
              ? 'document'
              : 'other';
      return (
        (!kind || category === kind) &&
        (!uploader || item.uploaderId === uploader) &&
        item.displayName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
      );
    })
    .sort((a, b) =>
      sort === 'name'
        ? a.displayName.localeCompare(b.displayName)
        : sort === 'size'
          ? Number(b.sizeBytes) - Number(a.sizeBytes)
          : Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  const listedFiles = matchingFiles?.slice(
    (page - 1) * documentPageSize,
    page * documentPageSize + 1,
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
  const file =
    allFiles?.find((item) => item.id === selectedId) ??
    files?.find((item) => item.id === selectedId) ??
    (linkedFile?.id === selectedId ? linkedFile : undefined);
  const recent = [...(files ?? [])]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 4);
  useEffect(() => () => uploadRequest.current?.abort(), []);

  useEffect(() => {
    if (!drawerOpen || !selectedId || !token) return;
    const controller = new AbortController();
    void workspaceRequest(path + '/' + encodeURIComponent(selectedId), token, {
      signal: controller.signal,
    })
      .then((response) => response.json() as Promise<WorkspaceFile>)
      .then((result) => {
        if (!controller.signal.aborted) setLinkedFile(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFileError(true);
      });
    return () => controller.abort();
  }, [drawerOpen, selectedId, token, path, fileAttempt]);

  function person(item: WorkspaceFile) {
    const member = members.find((member) => member.userId === item.uploaderId);
    const name = item.uploaderId === profileId ? 'You' : (member?.username ?? 'Unknown uploader');
    const initials = (member?.username ?? name)
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    return (
      <span className="wu-file-person">
        <span className="wu-file-avatar" aria-hidden="true">
          {initials}
          {member?.avatarUrl && (
            <img
              src={member.avatarUrl}
              alt=""
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          )}
        </span>
        <span>{name}</span>
      </span>
    );
  }

  function actions(item: WorkspaceFile) {
    return (
      <div className="wu-file-actions">
        <IconButton
          type="button"
          aria-label={`Download ${item.displayName}`}
          title="Download file"
          onClick={() => void download(item)}
        >
          <Download size={16} aria-hidden="true" />
        </IconButton>
        {!readOnly && (owner || item.uploaderId === profileId) && (
          <ActionMenu
            label={'Actions for ' + item.displayName}
            actions={[
              {
                label: 'Rename file',
                run: () => {
                  setError('');
                  setRenaming(item);
                },
              },
              {
                label: 'Delete file',
                run: () => {
                  setError('');
                  setRemoving(item);
                },
              },
            ]}
          />
        )}
      </div>
    );
  }

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
      const created = await uploadWorkspaceFile(
        path,
        token,
        file,
        setUploadProgress,
        controller.signal,
      );
      onUpload(created);
      retry();
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : 'Could not upload the file.');
    } finally {
      uploadRequest.current = null;
      setUploading(false);
    }
  }

  async function renameFile(name: string) {
    if (!renaming || renameBusy || readOnly) return;
    const displayName = name.trim();
    if (!displayName) {
      setError('Enter a filename.');
      return;
    }
    setRenameBusy(true);
    setError('');
    try {
      const response = await workspaceRequest(
        path + '/' + renaming.id,
        token,
        jsonRequest('PATCH', { displayName }),
      );
      const updated = (await response.json()) as WorkspaceFile;
      setItems((items) => items?.map((item) => (item.id === updated.id ? updated : item)));
      setLinkedFile((current) => (current?.id === updated.id ? updated : current));
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
      await workspaceRequest(path + '/' + encodeURIComponent(removing.id), token, {
        method: 'DELETE',
      });
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
      const response = await workspaceRequest(
        path + '/' + encodeURIComponent(file.id) + '/download',
        token,
      );
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
    return (
      <>
        <FilePreview key={item.id} file={item} path={path} token={token} />
        <div className="wu-file-detail-heading">
          <FileTypeIcon file={item} />
          <h3>{item.displayName}</h3>
        </div>
        <dl className="wu-file-metadata">
          <div>
            <dt>File type</dt>
            <dd>{fileTypeAppearance(item).label}</dd>
          </div>
          <div>
            <dt>Size</dt>
            <dd>{fileSize(item.sizeBytes)}</dd>
          </div>
          <div>
            <dt>Uploaded</dt>
            <dd>{new Date(item.createdAt).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt>Uploaded by</dt>
            <dd>{person(item)}</dd>
          </div>
        </dl>
        <div className="wu-file-detail-actions">
          <Button
            variant="secondary"
            className="wu-button--with-icon"
            type="button"
            onClick={() => void download(item)}
          >
            <Download size={15} aria-hidden="true" />
            Download
          </Button>
          {item.taskId && (
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                onOpenTask(item.taskId!);
              }}
            >
              <Link2 size={16} />
              Open linked task
            </Button>
          )}
          {!readOnly && (owner || item.uploaderId === profileId) && (
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setError('');
                setRenaming(item);
              }}
            >
              <Pencil size={16} />
              Rename
            </Button>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="wu-files-workbench">
      {pageHeading(
        !readOnly && (
          <div className="wu-file-upload-control">
            <span className="wu-muted">Up to 10 MiB per file</span>
            <Button
              variant="primary"
              className="wu-button--with-icon"
              type="button"
              disabled={uploading || !token}
              onClick={() => input.current?.click()}
            >
              <Upload size={15} aria-hidden="true" />
              {uploading ? 'Uploading…' : 'Upload file'}
            </Button>
          </div>
        ),
      )}
      {onBackToTask && (
        <button className="wu-text-button" type="button" onClick={onBackToTask}>
          Back to task
        </button>
      )}
      <input
        ref={input}
        type="file"
        hidden
        onChange={(event) => {
          const chosen = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (chosen) void upload(chosen);
        }}
      />
      {!readOnly && uploading && (
        <div className="wu-file-upload-status">
          {
            <>
              <span role="status">
                {uploadProgress === 100
                  ? 'Saving ' + uploadName + '…'
                  : 'Uploading ' + uploadName + ' · ' + uploadProgress + '%'}
              </span>
              <progress aria-label="Upload progress" max={100} value={uploadProgress} />
              <button
                className="wu-text-button"
                type="button"
                disabled={uploadProgress === 100}
                onClick={() => uploadRequest.current?.abort()}
              >
                Cancel upload
              </button>
            </>
          }
        </div>
      )}
      {error && !(drawerOpen && file) && !removing && !renaming && <p role="alert">{error}</p>}
      {recent.length > 0 && (
        <section className="wu-recent-files" aria-labelledby="wu-recent-files-heading">
          <h2 id="wu-recent-files-heading">Recent files</h2>
          <ul>
            {recent.map((item) => (
              <li key={item.id}>
                <button
                  className="wu-recent-file"
                  type="button"
                  onClick={() => selectFile(item.id)}
                >
                  <FileTypeIcon file={item} />
                  <span>
                    <strong title={item.displayName}>{item.displayName}</strong>
                    <small>
                      {fileSize(item.sizeBytes)} ·{' '}
                      {new Date(item.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Panel className="wu-list-panel">
        <div className="wu-list-toolbar wu-files-toolbar">
          <h2>All files</h2>
          <label className="wu-list-search">
            <Search size={16} aria-hidden="true" />
            <Input
              type="search"
              aria-label="Search files"
              placeholder="Search filenames"
              maxLength={200}
              value={search}
              onChange={(event) => {
                setSearch(event.currentTarget.value);
                setPage(1);
              }}
            />
          </label>
          <label className="wu-file-sort">
            Sort by
            <Select
              className="wu-select"
              value={sort}
              onChange={(event) => {
                setSort(event.currentTarget.value);
                setPage(1);
              }}
            >
              <option value="recent">Newest first</option>
              <option value="name">Name A–Z</option>
              <option value="size">Largest first</option>
            </Select>
          </label>
        </div>
        <div className="wu-file-filters" role="group" aria-label="File filters">
          <div className="wu-file-type-tabs" role="group" aria-label="File type">
            {[
              ['', 'All files'],
              ['image', 'Images'],
              ['document', 'Documents'],
              ['text', 'Text files'],
              ['other', 'Other'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={kind === value}
                onClick={() => {
                  setKind(value);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="wu-field-label">
            Uploaded by
            <Select
              value={uploader}
              onChange={(event) => {
                setUploader(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Anyone</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.username}
                </option>
              ))}
            </Select>
          </label>
          {filtered && (
            <button
              className="wu-text-button"
              type="button"
              onClick={() => {
                setKind('');
                setUploader('');
                setSearch('');
                setPage(1);
              }}
            >
              Clear filters
            </button>
          )}
          <div className="wu-file-view-toggle" role="group" aria-label="File view">
            <button
              type="button"
              aria-label="List view"
              aria-pressed={view === 'list'}
              onClick={() => changeView('list')}
            >
              <List size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
              onClick={() => changeView('grid')}
            >
              <LayoutGrid size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
        {loadError && (
          <p role="alert">
            {loadErrorMessage || 'Could not load files.'}{' '}
            <button className="wu-text-button" onClick={retry}>
              Try again
            </button>
          </p>
        )}
        {!listedFiles && !loadError && <LoadingPanel label="Loading workspace files" />}
        {listedFiles?.length === 0 && (
          <div className="wu-object-empty">
            <IllustratedEmptyState
              kind={filtered ? 'search' : 'files'}
              title={filtered ? 'No matching files' : 'No files shared yet'}
              detail={
                filtered
                  ? 'Try a different search or clear your filters.'
                  : 'Upload the documents your team needs.'
              }
              action={filtered ? 'Clear filters' : !readOnly ? 'Upload file' : undefined}
              onAction={
                filtered
                  ? () => {
                      setSearch('');
                      setKind('');
                      setUploader('');
                      setPage(1);
                    }
                  : () => input.current?.click()
              }
            />
          </div>
        )}
        {!!listedFiles?.length && view === 'list' && (
          <table
            className="wu-table wu-list-table wu-files-table"
            role="table"
            aria-label="Workspace files"
          >
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col">Name</th>
                <th scope="col">Date added</th>
                <th scope="col">Size</th>
                <th scope="col">Uploaded by</th>
                <th scope="col">
                  <span className="wu-visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {listedFiles.slice(0, documentPageSize).map((item) => (
                <tr key={item.id} role="row">
                  <td role="cell">
                    <button
                      className="wu-list-item-name"
                      type="button"
                      onClick={() => selectFile(item.id)}
                    >
                      <FileTypeIcon file={item} />
                      <span>{item.displayName}</span>
                    </button>
                  </td>
                  <td role="cell" data-label="Date added" className="wu-muted">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                  <td role="cell" data-label="Size" className="wu-muted">
                    {fileSize(item.sizeBytes)}
                  </td>
                  <td role="cell" data-label="Uploaded by">
                    {person(item)}
                  </td>
                  <td role="cell" className="wu-file-actions-cell">
                    {actions(item)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!!listedFiles?.length && view === 'grid' && (
          <ul className="wu-files-grid" aria-label="Workspace files">
            {listedFiles.slice(0, documentPageSize).map((item) => (
              <li className="wu-file-card" key={item.id}>
                <button
                  className="wu-file-card-open"
                  type="button"
                  onClick={() => selectFile(item.id)}
                >
                  <div className="wu-file-card-visual">
                    <FileThumbnail file={item} path={path} token={token} />
                  </div>
                  <span className="wu-file-card-name" title={item.displayName}>
                    {item.displayName}
                  </span>
                  <span className="wu-file-card-caption">
                    {fileTypeAppearance(item).label} · {fileSize(item.sizeBytes)}
                  </span>
                </button>
                <div className="wu-file-card-footer">
                  {person(item)}
                  {actions(item)}
                </div>
              </li>
            ))}
          </ul>
        )}
        <DocumentPagination page={page} count={listedFiles?.length} onPage={setPage} />
      </Panel>
      {drawerOpen && (
        <Drawer title="File details" onClose={() => setDrawerOpen(false)}>
          <div className="wu-file-inspector">
            {fileError ? (
              <p role="alert">
                This file could not be opened. It may have been removed or you may not have access.{' '}
                <button
                  className="wu-text-button"
                  onClick={() => {
                    setFileError(false);
                    setFileAttempt((value) => value + 1);
                  }}
                >
                  Try again
                </button>
              </p>
            ) : file ? (
              details(file)
            ) : (
              <LoadingPanel label="Loading file details" />
            )}
            {error && !renaming && <p role="alert">{error}</p>}
          </div>
        </Drawer>
      )}
      {renaming && (
        <Drawer
          title="Rename file"
          closeDisabled={renameBusy}
          onClose={() => {
            setRenaming(undefined);
            setError('');
          }}
        >
          <form
            className="wu-file-rename"
            onSubmit={(event) => {
              event.preventDefault();
              void renameFile(String(new FormData(event.currentTarget).get('name') ?? ''));
            }}
          >
            <label className="wu-field-label">
              Filename
              <Input
                name="name"
                required
                maxLength={255}
                defaultValue={renaming.displayName}
                autoFocus
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <button className="wu-button wu-button--primary" disabled={renameBusy}>
              {renameBusy ? 'Renaming…' : 'Rename file'}
            </button>
          </form>
        </Drawer>
      )}
      {removing && (
        <Drawer
          title={`Delete ${removing.displayName}?`}
          confirmation
          onClose={() => {
            setRemoving(undefined);
            setError('');
          }}
        >
          <p>This removes the file from the workspace.</p>
          {error && <p role="alert">{error}</p>}
          <div className="wu-modal-actions">
            <button
              className="wu-button wu-button--secondary"
              autoFocus
              disabled={deleting}
              onClick={() => {
                setRemoving(undefined);
                setError('');
              }}
            >
              Cancel
            </button>
            <button
              className="wu-button wu-button--primary"
              disabled={deleting}
              onClick={() => void removeFile()}
            >
              Delete file
            </button>
          </div>
        </Drawer>
      )}
    </div>
  );
}
