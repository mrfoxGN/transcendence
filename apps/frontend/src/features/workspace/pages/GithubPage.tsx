import { Select } from '../../../shared/controls/Select';
import { IllustratedEmptyState } from '../../../shared/illustrations/EmptyIllustration';
import { useEffect, useState, type FormEvent } from 'react';
import { Panel } from '../components';
import { GithubTabs, type GithubTabName } from './GithubTabs';
import { jsonRequest, useWorkspaceCollection, useWorkspaceData, workspaceRequest, WorkspaceRequestError } from '../workspace-api';
import type { PageHeading } from '../types';
import { GithubHeader } from './GithubHeader';
import { GithubDevelopmentNetwork } from './GithubDevelopmentNetwork';
import { GithubRecentCommits } from './GithubRecentCommits';
import { GithubTopContributors } from './GithubTopContributors';
import { GithubRepositoryIdentity } from './GithubRepositoryIdentity';
import { GithubCommitActivity, type GithubCommitStats } from './GithubCommitActivity';
import { GithubBranches } from './GithubBranches';
import { GithubCommits } from './GithubCommits';
import { GithubContributors } from './GithubContributors';
import { GithubCollaborators } from './GithubCollaborators';
import './github.css';
import './github-design.css';

type Repository = { fullName: string; defaultBranch: string; repositoryUrl: string; lastSyncedAt: string | null; githubRepositoryId: string };

type Branch = { name: string; sha: string; protected: boolean; lastCommittedAt?: string | null };
type Collaborator = {
  login: string;
  avatarUrl: string;
  profileUrl: string;
  role: string;
  isOwner: boolean;
};
type Contributor = {
  login: string;
  avatarUrl: string;
  profileUrl: string;
  contributions: number;
  isOwner: boolean;
};
type Commit = { id: string; sha: string; message: string; authorGithubUserId: string | null; authorName: string | null; committedAt: string; githubUrl: string | null };
type CommitPage = { items: Commit[]; total: number; page: number; limit: number };

export function GithubPage({ pageHeading, path, workspaceId, token, owner }: {
  pageHeading: PageHeading; path: string; workspaceId: string; token: string | null; owner: boolean;
}) {
  const [tab, setTab] = useState<GithubTabName>('Repository');
  const [repository, setRepository] = useState<Repository | null>();
  const [setupId, setSetupId] = useState(() => new URLSearchParams(location.hash.slice(1)).get('github-setup') ?? '');
  const [choices, setChoices] = useState<Repository[]>();
  const [commitPage, setCommitPage] = useState<CommitPage>();
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const dailyStats = useWorkspaceData<GithubCommitStats>(
    path + '/statistics/commits',
    repository ? token : null
  );

  const branches = useWorkspaceCollection<Branch>(path + '/branches', repository && tab === 'Branches' ? token : null);

  const contributors = useWorkspaceCollection<Contributor>(
    path + '/contributors',
    repository && (tab === 'Repository' || tab === 'Contributors')
      ? token
      : null
  );

  const collaborators = useWorkspaceCollection<Collaborator>(
    path + '/collaborators',
    repository && owner && (tab === 'Repository' || tab === 'Collaborators') ? token : null
  );

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
      .then(response => response.status === 204 ? null : response.json())
      .then(result => { if (!controller.signal.aborted) setRepository(result); })
      .catch(error => {
        if (controller.signal.aborted) return;
        setError(error.message);
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
    if (
      !token ||
      !repository ||
      (tab !== 'Commits' && tab !== 'Repository')
    ) return;
    const controller = new AbortController();
    void workspaceRequest(path + '/commits?page=' + (tab === 'Repository' ? 1 : page), token, { signal: controller.signal })
      .then(response => response.json())
      .then(result => { if (!controller.signal.aborted) setCommitPage(result); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [token, path, page, repository, tab, attempt]);

  async function action(kind: 'authorize' | 'connect' | 'sync' | 'disconnect', repositoryId?: string) {
    if (!token || busy || !owner) return;
    if (kind === 'disconnect' && !window.confirm(
      `Disconnect ${repository?.fullName ?? 'this repository'}? This will not delete it from GitHub.`
    )) return;
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
      } else if (kind === 'disconnect') {
        await workspaceRequest(path + '/repository', token, { method: 'DELETE' });
        setRepository(null);
        setCommitPage(undefined);
        setPage(1);
        setTab('Repository');
        setNotice('Repository disconnected. You can connect another repository.');
      } else {
        await workspaceRequest(path + '/sync', token, { method: 'POST' });
        setNotice('Repository synced.');
        dailyStats.retry();
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

  return <div className="wu-github-workbench">
    {!repository && pageHeading()}
    {error && <p role="alert">{error} <button className="wu-text-button" type="button" onClick={() => { setError(''); setAttempt(value => value + 1); }}>Refresh</button></p>}
    {notice && <p role="status">{notice}</p>}
    {setupId ? <Panel className="wu-content-panel">
      <h2>Choose a repository</h2>
      {!choices ? <p role="status">Loading eligible public repositories…</p> : !choices.length ? <p>No eligible public repositories found.</p>
        : <form onSubmit={connect}><label className="wu-field-label">Repository<Select name="repository" required defaultValue=""><option value="" disabled>Select a repository</option>{choices.map(repo => <option key={repo.githubRepositoryId} value={repo.githubRepositoryId}>{repo.fullName}</option>)}</Select></label>
          <button className="wu-button wu-button--primary" disabled={busy || !owner}>Connect repository</button></form>}
      <button type="button" className="wu-text-button" disabled={busy} onClick={() => setSetupId('')}>Cancel</button>
    </Panel> : repository === undefined ? !error && <p role="status">Loading repository…</p>
      : !repository ? <Panel className="wu-content-panel"><IllustratedEmptyState kind="integrations" title="No repository connected" detail="Connect a public GitHub repository to browse branches and commits." action={owner && !busy ? 'Connect GitHub' : undefined} onAction={() => void action('authorize')} /></Panel>
      : <>
        {pageHeading(<GithubHeader
          repositoryUrl={repository.repositoryUrl}
          owner={owner}
          busy={busy}
          onSync={() => void action('sync')}
          onDisconnect={() => void action('disconnect')}
        />)}
        <GithubTabs active={tab} owner={owner} onChange={setTab} />
        <Panel className={tab === 'Repository' ? 'wu-content-panel wu-github-overview-shell' : 'wu-content-panel wu-github-tab-panel'}>
          {tab === 'Repository' && (
            <div className="wu-github-overview">
              <GithubRepositoryIdentity
                fullName={repository.fullName}
                repositoryUrl={repository.repositoryUrl}
                defaultBranch={repository.defaultBranch}
                lastSyncedAt={repository.lastSyncedAt}
              />

              <GithubCommitActivity
                stats={dailyStats.data}
                error={
                  dailyStats.error
                    ? dailyStats.errorMessage
                    : undefined
                }
                onRetry={dailyStats.retry}
              />
            </div>
          )}

          {tab === 'Branches' && (
            branches.error ? (
              <p role="alert">
                Could not load branches.
                <button
                  type="button"
                  onClick={branches.retry}
                >
                  Try again
                </button>
              </p>
            ) : !branches.items ? (
              <p role="status">Loading branches…</p>
            ) : !branches.items.length ? (
              <p>No branches found.</p>
            ) : (
              <GithubBranches
                branches={branches.items}
                defaultBranch={repository.defaultBranch}
                repositoryUrl={repository.repositoryUrl}
              />
            )
          )}

          {tab === 'Contributors' && (
            contributors.error ? (
              <p role="alert">
                Could not load contributors: {contributors.errorMessage}
                <button
                  type="button"
                  onClick={contributors.retry}
                >
                  Try again
                </button>
              </p>
            ) : !contributors.items ? (
              <p role="status">Loading contributors…</p>
            ) : (
              <GithubContributors
                contributors={contributors.items}
              />
            )
          )}

          {tab === 'Collaborators' && owner && (
            collaborators.error ? (
              <p role="alert">
                Could not load collaborators: {collaborators.errorMessage}
                <button
                  type="button"
                  onClick={collaborators.retry}
                >
                  Try again
                </button>
              </p>
            ) : !collaborators.items ? (
              <p role="status">Loading collaborators…</p>
            ) : (
              <GithubCollaborators
                collaborators={collaborators.items}
              />
            )
          )}

          {tab === 'Commits' && (
            <>
              {!commitPage || commitPage.page !== page ? (
                <p role="status">Loading commits…</p>
              ) : (
                <GithubCommits
                  commits={commitPage.items}
                  defaultBranch={repository.defaultBranch}
                />
              )}

              <nav
                className="wu-gcommits-pagination"
                aria-label="Commit pagination"
              >
                <button
                  type="button"
                  className="wu-button wu-button--secondary"
                  disabled={
                    page <= 1 ||
                    commitPage?.page !== page
                  }
                  onClick={() => setPage(value => value - 1)}
                >
                  Previous
                </button>

                <span>Page {page}</span>

                <button
                  type="button"
                  className="wu-button wu-button--secondary"
                  disabled={
                    !commitPage ||
                    commitPage.page !== page ||
                    page * commitPage.limit >= commitPage.total
                  }
                  onClick={() => setPage(value => value + 1)}
                >
                  Next
                </button>
              </nav>
            </>
          )}
        </Panel>

        {tab === 'Repository' && (
          <div
            className={
              owner
                ? 'wu-github-insights'
                : 'wu-github-insights wu-github-insights--single'
            }
          >
            {owner && (
              <GithubDevelopmentNetwork
            collaborators={collaborators.items}
            error={
              collaborators.error
                ? collaborators.errorMessage
                : undefined
            }
            onRetry={collaborators.retry}
            onViewAll={() => setTab('Collaborators')}
          />
            )}

            <GithubRecentCommits
              commits={
                commitPage?.page === 1
                  ? commitPage.items
                  : undefined
              }
              onViewAll={() => {
                setPage(1);
                setTab('Commits');
              }}
            />

            <GithubTopContributors
              contributors={contributors.items}
              error={
                contributors.error
                  ? contributors.errorMessage
                  : undefined
              }
              onRetry={contributors.retry}
              onViewAll={() => setTab('Contributors')}
            />
          </div>
        )}
      </>}
  </div>;
}
