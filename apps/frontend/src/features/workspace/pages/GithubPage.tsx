import { useEffect, useState, type FormEvent } from 'react';
import { RefreshCw } from 'lucide-react';
import { workspaceIcons } from '../workspace-icons';
import { FilterChips, Panel } from '../components';
import { jsonRequest, useWorkspaceCollection, workspaceRequest, WorkspaceRequestError } from '../workspace-api';
import type { PageHeading } from '../types';
import './github.css';

type Repository = { fullName: string; defaultBranch: string; repositoryUrl: string; lastSyncedAt: string | null; githubRepositoryId: string };
type Branch = { name: string; sha: string; protected: boolean };
type Commit = { id: string; sha: string; message: string; authorName: string | null; committedAt: string; githubUrl: string | null };
type CommitPage = { items: Commit[]; total: number; page: number; limit: number };

export function GithubPage({ pageHeading, path, workspaceId, token, owner }: {
  pageHeading: PageHeading; path: string; workspaceId: string; token: string | null; owner: boolean;
}) {
  const [tab, setTab] = useState('Repository');
  const [repository, setRepository] = useState<Repository | null>();
  const [setupId, setSetupId] = useState(() => new URLSearchParams(location.hash.slice(1)).get('github-setup') ?? '');
  const [choices, setChoices] = useState<Repository[]>();
  const [commitPage, setCommitPage] = useState<CommitPage>();
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const branches = useWorkspaceCollection<Branch>(path + '/branches', repository && tab === 'Branches' ? token : null);

  useEffect(() => {
    if (!setupId) return;
    const url = new URL(location.href);
    if (url.hash.startsWith('#github-setup=')) {
      url.hash = '';
      history.replaceState(history.state, '', url);
    }
  }, [setupId]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void workspaceRequest(path + '/repository', token, { signal: controller.signal })
      .then(response => response.json())
      .then(result => { if (!controller.signal.aborted) setRepository(result); })
      .catch(error => {
        if (controller.signal.aborted) return;
        if (error instanceof WorkspaceRequestError && error.status === 404) setRepository(null);
        else setError(error.message);
      });
    return () => controller.abort();
  }, [path, token, attempt]);

  useEffect(() => {
    if (!token || !setupId) return;
    const controller = new AbortController();
    void workspaceRequest('github/available-repositories', token, {
      ...jsonRequest('POST', { workspaceId, setupSessionId: setupId }), signal: controller.signal,
    }).then(response => response.json())
      .then(result => { if (!controller.signal.aborted) setChoices(result); })
      .catch(error => {
        if (!controller.signal.aborted) {
          setError(error.message);
          setSetupId('');
        }
      });
    return () => controller.abort();
  }, [token, setupId, workspaceId]);

  useEffect(() => {
    if (!token || !repository || tab !== 'Commits') return;
    const controller = new AbortController();
    void workspaceRequest(path + '/commits?page=' + page, token, { signal: controller.signal })
      .then(response => response.json())
      .then(result => { if (!controller.signal.aborted) setCommitPage(result); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [token, path, page, repository, tab, attempt]);

  async function action(kind: 'authorize' | 'connect' | 'sync', repositoryId?: string) {
    if (!token || busy || !owner) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (kind === 'authorize') {
        const response = await workspaceRequest('github/connect?workspaceId=' + encodeURIComponent(workspaceId), token);
        location.assign((await response.json()).authorizationUrl);
      } else if (kind === 'connect') {
        await workspaceRequest(path + '/repository', token, jsonRequest('POST', { setupSessionId: setupId, githubRepositoryId: repositoryId }));
        setSetupId('');
        setChoices(undefined);
        setNotice('Repository connected.');
      } else {
        await workspaceRequest(path + '/sync', token, { method: 'POST' });
        setNotice('Repository synced.');
        if (tab === 'Branches') branches.retry();
      }
      setAttempt(value => value + 1);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'GitHub request failed.');
    } finally {
      setBusy(false);
    }
  }

  function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void action('connect', String(new FormData(event.currentTarget).get('repository')));
  }

  return <>
    {pageHeading(repository && owner && <button className="wu-button wu-button--secondary" type="button" disabled={busy} onClick={() => void action('sync')}><RefreshCw size={15} />{busy ? 'Syncing…' : 'Sync commits'}</button>)}
    {error && <p role="alert">{error} <button className="wu-text-button" type="button" onClick={() => { setError(''); setAttempt(value => value + 1); }}>Refresh</button></p>}
    {notice && <p role="status">{notice}</p>}
    {setupId ? <Panel className="wu-content-panel">
      <h2>Choose a repository</h2>
      {!choices ? <p role="status">Loading eligible public repositories…</p> : !choices.length ? <p>No eligible public repositories found.</p>
        : <form onSubmit={connect}><label className="wu-field-label">Repository<select name="repository" required defaultValue=""><option value="" disabled>Select a repository</option>{choices.map(repo => <option key={repo.githubRepositoryId} value={repo.githubRepositoryId}>{repo.fullName}</option>)}</select></label>
          <button className="wu-button wu-button--primary" disabled={busy || !owner}>Connect repository</button></form>}
      <button type="button" className="wu-text-button" disabled={busy} onClick={() => setSetupId('')}>Cancel</button>
    </Panel> : repository === undefined ? !error && <p role="status">Loading repository…</p>
      : !repository ? <Panel className="wu-content-panel"><h2>No repository connected</h2><p>Connect a public GitHub repository to browse branches and commits.</p>
        {owner && <button className="wu-button wu-button--primary" type="button" disabled={busy} onClick={() => void action('authorize')}><workspaceIcons.github size={16} />Connect GitHub</button>}</Panel>
      : <>
        <FilterChips items={['Repository', 'Branches', 'Commits']} active={tab} onChange={setTab} />
        <Panel className="wu-content-panel">
          {tab === 'Repository' && <><h2><a href={repository.repositoryUrl} target="_blank" rel="noreferrer">{repository.fullName}</a></h2>
            <p>Default branch: {repository.defaultBranch}</p><p>{repository.lastSyncedAt ? 'Last synced ' + new Date(repository.lastSyncedAt).toLocaleString() : 'No commits synced yet.'}</p></>}
          {tab === 'Branches' && <><h2>Branches</h2>{branches.error ? <p role="alert">Could not load branches. <button type="button" onClick={branches.retry}>Try again</button></p>
            : !branches.items ? <p role="status">Loading branches…</p> : !branches.items.length ? <p>No branches found.</p>
            : <ul>{branches.items.map(branch => <li key={branch.name}>{branch.name}{branch.protected ? ' · Protected' : ''}</li>)}</ul>}</>}
          {tab === 'Commits' && <><h2>Commits</h2>{!commitPage ? <p role="status">Loading commits…</p> : !commitPage.items.length ? <p>No commits synced yet.</p>
            : <ul>{commitPage.items.map(commit => <li key={commit.id}>
              {commit.githubUrl ? <a href={commit.githubUrl} target="_blank" rel="noreferrer">{commit.message}</a> : commit.message}
              <p className="wu-muted">{commit.sha.slice(0, 7)} · {commit.authorName ?? 'Unknown author'} · {new Date(commit.committedAt).toLocaleDateString()}</p>
            </li>)}</ul>}
            <div className="wu-modal-actions"><button className="wu-button wu-button--secondary" disabled={page <= 1 || commitPage?.page !== page} onClick={() => setPage(page - 1)}>Previous</button>
              <button className="wu-button wu-button--secondary" disabled={!commitPage || commitPage.page !== page || page * commitPage.limit >= commitPage.total} onClick={() => setPage(page + 1)}>Next</button></div></>}
        </Panel>
      </>}
  </>;
}
