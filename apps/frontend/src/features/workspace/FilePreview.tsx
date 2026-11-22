import { useEffect, useState } from 'react';
import { File, FileImage, FileText } from 'lucide-react';
import { workspaceRequest, type WorkspaceFile } from './workspace-api';

const rasterTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];
const textTypes = ['text/plain', 'text/csv'];

export function getFileKind(file: WorkspaceFile): 'image' | 'document' | 'text' | 'other' {
  const mime = (file.mimeType ?? '').toLowerCase();
  const name = (file.displayName ?? '').toLowerCase();

  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i.test(name)) {
    return 'image';
  }

  if (
    mime === 'application/pdf' ||
    mime === 'application/msword' ||
    mime === 'application/rtf' ||
    mime.startsWith('application/vnd.ms-') ||
    mime.startsWith('application/vnd.openxmlformats-officedocument.') ||
    mime.startsWith('application/vnd.oasis.opendocument.') ||
    /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|rtf)$/i.test(name)
  ) {
    return 'document';
  }

  if (
    mime.startsWith('text/') ||
    /\.(txt|csv|tsv|json|md|xml|log|yaml|yml)$/i.test(name)
  ) {
    return 'text';
  }

  return 'other';
}

export function FileTypeIcon({ file }: { file: WorkspaceFile }) {
  const kind = getFileKind(file);
  const Icon = kind === 'image' ? FileImage : kind === 'document' || kind === 'text' ? FileText : File;
  const dataKind = kind === 'image' ? 'image' : kind === 'document' || kind === 'text' ? 'document' : 'other';
  return <span className="wu-file-type" data-kind={dataKind}><Icon size={17} aria-hidden="true" /></span>;
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
