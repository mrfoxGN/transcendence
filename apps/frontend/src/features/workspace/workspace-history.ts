const recentLimit = 4;

export function recentWorkspaceIds(profileId: string): string[] {
  if (!profileId) return [];
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('devup-recent-workspaces:' + profileId) ?? '[]');
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string').slice(0, recentLimit) : [];
  } catch {
    return [];
  }
}

export function rememberWorkspace(profileId: string, workspaceId: string) {
  if (!profileId) return;
  try {
    const recent = recentWorkspaceIds(profileId).filter(id => id !== workspaceId);
    localStorage.setItem('devup-recent-workspaces:' + profileId, JSON.stringify([workspaceId, ...recent].slice(0, recentLimit)));
  } catch {
    // Workspace navigation also works when browser storage is unavailable.
  }
}

export function canSearchWorkspaces(count: number) {
  return count > 10;
}
