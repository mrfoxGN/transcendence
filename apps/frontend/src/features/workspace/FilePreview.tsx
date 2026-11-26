import {
  Figma,
  File,
  FileArchive,
  FileAudio,
  FileChartColumn,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { workspaceRequest, type WorkspaceFile } from './workspace-api';

const rasterTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];
const textTypes = ['text/plain', 'text/csv'];

/** Extensions take precedence: uploads may arrive with a generic MIME type. */
export function fileTypeAppearance(file: Pick<WorkspaceFile, 'displayName' | 'mimeType'>) {
  const extension = file.displayName.toLowerCase().split('.').pop() ?? '';
  const mime = (file.mimeType ?? '').toLowerCase().split(';')[0];
  if (extension === 'pdf' || mime === 'application/pdf')
    return { kind: 'pdf', label: 'PDF document', Icon: FileText };
  if (['fig', 'figma'].includes(extension) || mime.includes('figma'))
    return { kind: 'design', label: 'Figma design', Icon: Figma };
  if (
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(extension) ||
    /zip|compressed|x-tar|gzip/.test(mime)
  )
    return { kind: 'archive', label: 'Archive', Icon: FileArchive };
  if (
    ['xls', 'xlsx', 'ods', 'csv', 'tsv'].includes(extension) ||
    /spreadsheet|excel|csv/.test(mime)
  )
    return { kind: 'spreadsheet', label: 'Spreadsheet', Icon: FileSpreadsheet };
  if (['ppt', 'pptx', 'odp', 'key'].includes(extension) || /presentation|powerpoint/.test(mime))
    return { kind: 'presentation', label: 'Presentation', Icon: FileChartColumn };
  if (
    [
      'png',
      'jpg',
      'jpeg',
      'gif',
      'webp',
      'avif',
      'svg',
      'heic',
      'bmp',
      'tif',
      'tiff',
      'ico',
    ].includes(extension) ||
    mime.startsWith('image/')
  )
    return { kind: 'image', label: 'Image', Icon: FileImage };
  if (['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v'].includes(extension) || mime.startsWith('video/'))
    return { kind: 'video', label: 'Video', Icon: FileVideo };
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(extension) || mime.startsWith('audio/'))
    return { kind: 'audio', label: 'Audio', Icon: FileAudio };
  if (
    [
      'js',
      'jsx',
      'ts',
      'tsx',
      'json',
      'html',
      'css',
      'scss',
      'py',
      'sh',
      'sql',
      'xml',
      'yaml',
      'yml',
      'c',
      'cpp',
      'h',
      'rs',
      'go',
      'java',
    ].includes(extension) ||
    /json|javascript|xml/.test(mime)
  )
    return { kind: 'code', label: 'Code file', Icon: FileCode };
  if (
    ['txt', 'md', 'rtf', 'doc', 'docx', 'odt', 'pages'].includes(extension) ||
    mime.startsWith('text/') ||
    /word|opendocument.text/.test(mime)
  )
    return { kind: 'document', label: 'Document', Icon: FileText };
  return { kind: 'other', label: 'File', Icon: File };
}

export function FileTypeIcon({ file }: { file: WorkspaceFile }) {
  const { kind, label, Icon } = fileTypeAppearance(file);
  return (
    <span className="wu-file-type" data-kind={kind} role="img" aria-label={label} title={label}>
      <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
    </span>
  );
}

export function FilePreview({
  file,
  path,
  token,
}: {
  file: WorkspaceFile;
  path: string;
  token: string | null;
}) {
  const mime = file.mimeType ?? '';
  const raster = rasterTypes.includes(mime);
  const supported = raster || (textTypes.includes(mime) && Number(file.sizeBytes) <= 256 * 1024);
  const [preview, setPreview] = useState<{ url: string } | { text: string }>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!supported || !token) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void workspaceRequest(path + '/' + encodeURIComponent(file.id) + '/download', token, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = raster ? await response.arrayBuffer() : await response.text();
        if (controller.signal.aborted) return;
        if (typeof data === 'string') setPreview({ text: data });
        else {
          objectUrl = URL.createObjectURL(new Blob([data], { type: mime }));
          setPreview({ url: objectUrl });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, mime, path, raster, supported, token]);

  if (!supported || failed)
    return (
      <div className="wu-file-preview wu-file-preview--fallback">
        <FileTypeIcon file={file} />
        <span>{failed ? 'Preview could not be loaded.' : 'Download this file to view it.'}</span>
      </div>
    );
  return (
    <div className="wu-file-preview">
      {!preview ? (
        <p role="status">Loading preview…</p>
      ) : 'url' in preview ? (
        <img src={preview.url} alt={file.displayName} onError={() => setFailed(true)} />
      ) : (
        <pre tabIndex={0} aria-label="File preview">
          {preview.text || 'This file is empty.'}
        </pre>
      )}
    </div>
  );
}

/** Fetch raster thumbnails only when their cards approach the viewport. */
export function FileThumbnail({
  file,
  path,
  token,
}: {
  file: WorkspaceFile;
  path: string;
  token: string | null;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' },
    );
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  return (
    <span ref={host} className="wu-file-thumbnail">
      {visible && rasterTypes.includes(file.mimeType ?? '') ? (
        <FilePreview file={file} path={path} token={token} />
      ) : (
        <FileTypeIcon file={file} />
      )}
    </span>
  );
}
