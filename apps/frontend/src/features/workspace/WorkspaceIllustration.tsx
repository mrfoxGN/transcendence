type Illustration = 'folder' | 'checklist' | 'note';

export function WorkspaceIllustration({ kind }: { kind: Illustration }) {
  return <svg className="wu-workspace-illustration" viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
    {kind === 'folder' ? <>
      <path className="wu-illustration-base" d="M8 20a5 5 0 0 1 5-5h13l5 5h20a5 5 0 0 1 5 5v21a5 5 0 0 1-5 5H13a5 5 0 0 1-5-5z" />
      <rect className="wu-illustration-paper" x="17" y="23" width="33" height="21" rx="4" />
      <path className="wu-illustration-front" d="M14 29h40a4 4 0 0 1 4 5l-4 14a4 4 0 0 1-4 3H12a4 4 0 0 1-4-5l2-13a4 4 0 0 1 4-4z" />
      <path className="wu-illustration-highlight" d="M16 32h36" />
    </> : <>
      <rect className="wu-illustration-base" x="14" y="10" width="38" height="46" rx="8" />
      <rect className="wu-illustration-paper" x="18" y="13" width="29" height="37" rx="5" />
      {kind === 'checklist' ? <>
        <rect className="wu-illustration-front" x="23" y="8" width="19" height="9" rx="4" />
        <path className="wu-illustration-ink" d="m23 29 4 4 7-8m3 5h5m-19 9h19" />
      </> : <>
        <path className="wu-illustration-ink" d="M24 23h16m-16 7h16m-16 7h10" />
        <path className="wu-illustration-front" d="M38 50v-6a3 3 0 0 1 3-3h6z" />
      </>}
    </>}
  </svg>;
}
