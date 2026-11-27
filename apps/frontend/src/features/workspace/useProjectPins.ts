import { useMemo, useSyncExternalStore } from 'react';
const changed = 'devup-project-pins-changed';
const memory = new Map<string, string>();
function subscribe(notify: () => void) {
  window.addEventListener('storage', notify);
  window.addEventListener(changed, notify);
  return () => {
    window.removeEventListener('storage', notify);
    window.removeEventListener(changed, notify);
  };
}
export function useProjectPins(workspaceId: string, profileId: string) {
  const key = 'devup:studio:project-pins:' + workspaceId + ':' + profileId;
  const read = () => {
    try {
      return localStorage.getItem(key) ?? memory.get(key) ?? '[]';
    } catch {
      return memory.get(key) ?? '[]';
    }
  };
  const raw = useSyncExternalStore(subscribe, read, () => '[]');
  const pinnedIds = useMemo<string[]>(() => {
    try {
      const value = JSON.parse(raw);
      return Array.isArray(value)
        ? [...new Set(value.filter((id): id is string => typeof id === 'string'))]
        : [];
    } catch {
      return [];
    }
  }, [raw]);
  function togglePin(id: string) {
    const next = pinnedIds.includes(id)
      ? pinnedIds.filter((item) => item !== id)
      : [...pinnedIds, id];
    const value = JSON.stringify(next);
    memory.set(key, value);
    try {
      localStorage.setItem(key, value);
    } catch {
      /* In-memory preferences remain usable. */
    }
    window.dispatchEvent(new Event(changed));
  }
  return { pinnedIds, togglePin };
}
