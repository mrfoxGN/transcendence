import { SessionExpired } from '../auth/session';

export type Workspace = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  archivedAt: string | null;
};

export async function workspacePickerRequest<T>(
  path: string,
  token: string,
  method = 'GET',
  body?: object,
): Promise<T> {
  const response = await fetch('/api/' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      ...(body && { 'Content-Type': 'application/json' }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 401) throw new SessionExpired();
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(
      Array.isArray(result?.message)
        ? result.message.join(' ')
        : result?.message || 'Something went wrong. Please try again.',
    );
  }
  return response.json();
}

export async function listActiveWorkspaces(token: string) {
  const workspaces = await workspacePickerRequest<Workspace[]>('workspaces', token);
  return workspaces.filter((workspace) => !workspace.archivedAt);
}
