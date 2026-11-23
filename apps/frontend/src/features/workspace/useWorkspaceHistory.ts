import { useEffect, useState } from 'react';

// Track only entries created inside this workspace, including after a reload.
export function useWorkspaceHistory(workspaceId: string) {
  const key = 'devup-history:' + workspaceId;
  const readIndex = () => history.state?.devupWorkspace === workspaceId ? Number(history.state.devupIndex) || 0 : 0;
  const [index, setIndex] = useState(readIndex);
  const [last, setLast] = useState(() => Math.max(readIndex(), Number(sessionStorage.getItem(key)) || 0));
  useEffect(() => {
    if (history.state?.devupWorkspace !== workspaceId) {
      history.replaceState({ ...history.state, devupWorkspace: workspaceId, devupIndex: 0 }, '');
      sessionStorage.setItem(key, '0');
      setIndex(0); setLast(0);
    }
    const sync = () => setIndex(readIndex());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [workspaceId]);
  function push(state: Record<string, unknown>, url: URL) {
    const next = readIndex() + 1;
    history.pushState({ ...state, devupWorkspace: workspaceId, devupIndex: next }, '', url);
    sessionStorage.setItem(key, String(next));
    setIndex(next); setLast(next);
  }
  return { push, canBack: index > 0, canForward: index < last };
}
