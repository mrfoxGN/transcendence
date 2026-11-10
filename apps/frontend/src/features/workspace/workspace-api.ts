import { useEffect, useState } from 'react';
import { signOut } from '../WorkspacePicker';

export class WorkspaceRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function workspaceRequest(path: string, token: string | null, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('Authorization', 'Bearer ' + token);
  const response = await fetch('/api/' + path, { ...options, headers });
  if (response.status === 401) signOut();
  if (!response.ok) {
    const details = await response.json().catch(() => null);
    const message = details?.message;
    throw new WorkspaceRequestError(response.status, Array.isArray(message) ? message.join(' ') : typeof message === 'string' ? message : 'Workspace request failed.');
  }
  return response;
}

export function jsonRequest(method: string, body: object): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export function useWorkspaceCollection<T>(path: string, token: string | null) {
  const [items, setItems] = useState<T[]>();
  const [loadedPath, setLoadedPath] = useState<string>();
  const [failedPath, setFailedPath] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (!token) return;
    void workspaceRequest(path, token, { signal: controller.signal })
      .then(response => response.json() as Promise<T[]>)
      .then(results => {
        if (controller.signal.aborted) return;
        setItems(results);
        setLoadedPath(path);
        setFailedPath(undefined);
      })
      .catch(() => { if (!controller.signal.aborted) setFailedPath(path); });
    return () => controller.abort();
  }, [path, token, attempt]);
  function retry() {
    setFailedPath(undefined);
    setAttempt(current => current + 1);
  }
  return { items: loadedPath === path ? items : undefined, setItems, error: failedPath === path, retry };
}

export const documentPageSize = 20;

export function documentPagePath(path: string, page: number, search: string, sort: string) {
  const query = new URLSearchParams({ page: String(page), limit: String(documentPageSize), sort, lookahead: '1' });
  if (search.trim()) query.set('search', search.trim());
  return path + '?' + query;
}

export type WorkspaceFile = {
  id: string;
  taskId?: string | null;
  uploaderId: string | null;
  displayName: string;
  mimeType: string | null;
  sizeBytes: string;
  createdAt: string;
};

export function fileSize(bytes: string) {
  const size = Number(bytes);
  return size < 1024 ? size + ' B' : Math.round(size / 1024) + ' KB';
}
