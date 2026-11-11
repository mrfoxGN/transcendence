export function safeWorkspaceDestination(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/workspaces';
  const target = new URL(value, location.origin);
  return target.origin === location.origin && /^\/workspaces(?:\/[0-9a-f-]{36})?\/?$/i.test(target.pathname)
    ? target.pathname + target.search + target.hash
    : '/workspaces';
}

export function authRoute(path: string, destination: string) {
  return path + '?' + new URLSearchParams({ next: safeWorkspaceDestination(destination) });
}

export function requestedWorkspace() {
  return safeWorkspaceDestination(new URLSearchParams(location.search).get('next'));
}

export async function accountRequest(path: string, body?: object, token?: string) {
  const response = await fetch('/api/auth/' + path, {
    method: 'POST',
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: 'Bearer ' + token }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(Array.isArray(result?.message) ? result.message.join(' ') : result?.message ?? 'Could not complete the request. Try again.');
  }
}
