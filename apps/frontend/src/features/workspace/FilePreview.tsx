import { useEffect, useState } from 'react';
import { File, FileImage, FileText } from 'lucide-react';
import { workspaceRequest, type WorkspaceFile } from './workspace-api';

const rasterTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];
const textTypes = ['text/plain', 'text/csv'];

export function FileTypeIcon({ file }: { file: WorkspaceFile }) {
  const kind = file.mimeType?.startsWith('image/') ? 'image' : file.mimeType?.startsWith('text/') || file.mimeType === 'application/pdf' ? 'document' : 'other';
  const Icon = kind === 'image' ? FileImage : kind === 'document' ? FileText : File;
  return <span className="wu-file-type" data-kind={kind}><Icon size={17} aria-hidden="true" /></span>;
}

export function FilePreview({ file, path, token }: { file: WorkspaceFile; path: string; token: string | null }) {
  const mime = file.mimeType ?? '';
  const raster = rasterTypes.includes(mime);
  const supported = raster || (textTypes.includes(mime) && Number(file.sizeBytes) <= 256 * 1024);
  const [preview, setPreview] = useState<{ url: string } | { text: string }>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!supported || !token) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void workspaceRequest(path + '/' + encodeURIComponent(file.id) + '/download', token, { signal: controller.signal })
      .then(async response => {
        const data = raster ? await response.arrayBuffer() : await response.text();
        if (controller.signal.aborted) return;
        if (typeof data === 'string') setPreview({ text: data });
        else {
          objectUrl = URL.createObjectURL(new Blob([data], { type: mime }));
          setPreview({ url: objectUrl });
        }
      }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [file.id, mime, path, raster, supported, token]);

  if (!supported || failed) return <div className="wu-file-preview wu-file-preview--fallback">
    <FileTypeIcon file={file} /><span>{failed ? 'Preview could not be loaded.' : 'Download this file to view it.'}</span>
  </div>;
  return <div className="wu-file-preview">
    {!preview ? <p role="status">Loading preview…</p> : 'url' in preview
      ? <img src={preview.url} alt={file.displayName} onError={() => setFailed(true)} />
      : <pre tabIndex={0} aria-label="File preview">{preview.text || 'This file is empty.'}</pre>}
  </div>;
}
