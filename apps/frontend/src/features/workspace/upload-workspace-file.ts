import { signOut } from '../WorkspacePicker';
import { WorkspaceRequestError, type WorkspaceFile } from './workspace-api';

export const uploadLimit = 10 * 1024 * 1024;

export function uploadWorkspaceFile(path: string, token: string, file: File, onProgress: (percent: number) => void, signal: AbortSignal) {
  return new Promise<WorkspaceFile>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    request.open('POST', '/api/' + path);
    request.setRequestHeader('Authorization', 'Bearer ' + token);
    request.responseType = 'json';
    request.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    request.onload = () => {
      if (request.status === 401) signOut(true);
      if (request.status >= 200 && request.status < 300 && request.response?.id) { resolve(request.response); return; }
      const message = request.response?.message;
      if (request.status === 409 && typeof message === 'string' && message.startsWith('This workspace is archived.')) {
        window.dispatchEvent(new Event('devup:workspace-archived'));
      }
      reject(new WorkspaceRequestError(request.status, request.status === 413 ? 'Choose a file no larger than 10 MiB.'
        : typeof message === 'string' ? message : 'Could not upload the file.'));
    };
    request.onerror = () => reject(new Error('Could not upload the file. Check your connection and try again.'));
    request.onabort = () => reject(new DOMException('Upload cancelled.', 'AbortError'));
    request.onloadend = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    const body = new FormData();
    body.set('file', file);
    request.send(body);
  });
}
