import { useEffect, useState } from 'react';
import { signOut } from '../WorkspacePicker';

export async function workspaceRequest(path: string, token: string | null, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('Authorization', 'Bearer ' + token);
  const response = await fetch('/api/' + path, { ...options, headers });
  if (response.status === 401) signOut();
  if (!response.ok) throw new Error('Workspace request failed');
  return response;
}

export function useWorkspaceCollection<T>(path: string, token: string | null) {
  const [items, setItems] = useState<T[]>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (!token) return;
    void workspaceRequest(path, token, { signal: controller.signal })
      .then(response => response.json() as Promise<T[]>)
      .then(results => { if (!controller.signal.aborted) setItems(results); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [path, token, attempt]);
  function retry() {
    setError(false);
    setAttempt(current => current + 1);
  }
  return { items, setItems, error, retry };
}

export type WorkspaceFile = {
  id: string;
  displayName: string;
  mimeType: string | null;
  sizeBytes: string;
  createdAt: string;
};

export function fileSize(bytes: string) {
  const size = Number(bytes);
  return size < 1024 ? size + ' B' : Math.round(size / 1024) + ' KB';
}
