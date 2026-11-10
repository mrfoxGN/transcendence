import { AlertCircle, ArrowRight, ArrowUpRight, ExternalLink, GitBranch, GitCommitHorizontal, MoreHorizontal, RefreshCw } from 'lucide-react';
import { FilterChips, IconTile, Panel, Pill } from '../components';
import type { PageHeading, GithubState } from '../types';
import './github.css';

type GithubPageProps = {
  pageHeading: PageHeading;
  githubTab: string;
  setGithubTab: (tab: string) => void;
  githubState: GithubState;
  setGithubState: (state: GithubState) => void;
  setToast: (message: string) => void;
};

export function GithubPage({
  pageHeading,
  githubTab,
  setGithubTab,
  githubState,
  setGithubState,
  setToast,
}: GithubPageProps) {
  const tabs = ['Repository', 'Branches', 'Commits'];
  return <>{pageHeading(<div className="wu-github-actions"><button className="wu-button wu-button--secondary" type="button" onClick={() => { setGithubState('failed'); setToast('Sync could not complete. Your saved commits are still available.'); }}><RefreshCw size={15} />Sync commits</button><button className="wu-icon-button" aria-label="GitHub connection options" type="button" onClick={() => setGithubState(githubState === 'disconnected' ? 'connected' : 'disconnected')}><MoreHorizontal size={18} /></button></div>)}
    <FilterChips items={tabs} active={githubTab} onChange={setGithubTab} />
    {githubState === 'disconnected' ? <Panel className="wu-content-panel"><div className="wu-empty"><IconTile tone="blue"><GitBranch size={21} /></IconTile><h3>No repository connected</h3><p>Connect a GitHub repository to browse branches and recent commits here.</p><button className="wu-button wu-button--primary" type="button" onClick={() => { setGithubState('connected'); setToast('Repository connected.'); }}><GitBranch size={15} />Connect repository</button></div></Panel> : <>
      <Panel className="wu-repo-summary"><div className="wu-repo-heading"><IconTile><GitBranch size={18} /></IconTile><div><h2>studio-north / storefront</h2><p>Default branch: main <span>·</span> 3 branches <span>·</span> Last sync today at 10:24</p></div><Pill tone={githubState === 'failed' ? 'pink' : 'mint'}>{githubState === 'failed' ? 'Sync failed' : 'Public · Synced'}</Pill><button className="wu-button wu-button--secondary" type="button" onClick={() => setGithubState('disconnected')}><ExternalLink size={15} />Open on GitHub</button></div></Panel>
      {githubState === 'failed' && <div className="wu-alert wu-alert--error"><AlertCircle size={18} /><div><strong>Couldn’t sync commits</strong><p>The last synced commits are still available. Check repository access and try again.</p><button className="wu-button wu-button--primary" type="button" onClick={() => { setGithubState('connected'); setToast('Repository is up to date.'); }}><RefreshCw size={14} />Retry sync</button></div></div>}
      {githubTab === 'Repository' && <div className="wu-github-grid"><Panel className="wu-content-panel"><div className="wu-panel-heading"><div><h2>Repository overview</h2><p>Latest repository activity</p></div><Pill tone="blue">main</Pill></div><div className="wu-repo-stats"><div><span>Branches</span><strong>3</strong></div><div><span>Open pull requests</span><strong>2</strong></div><div><span>Commits this week</span><strong>12</strong></div></div><div className="wu-commit-row"><GitCommitHorizontal size={16} /><div><strong>Validate email before submit</strong><small>a7d02fc · Alex Morgan · Apr 12</small></div><Pill tone="mint">Latest</Pill></div></Panel><Panel className="wu-content-panel"><div className="wu-panel-heading"><h2>Branches</h2><button className="wu-text-button" onClick={() => setGithubTab('Branches')} type="button">View all <ArrowRight size={14} /></button></div><BranchList /></Panel></div>}
      {githubTab === 'Branches' && <Panel className="wu-content-panel"><div className="wu-panel-heading"><div><h2>Branches</h2><p>Recent branches in this repository.</p></div><Pill tone="blue">3 branches</Pill></div><BranchList detailed /></Panel>}
      {githubTab === 'Commits' && <Panel className="wu-content-panel"><div className="wu-panel-heading"><div><h2>Commit review</h2><p>Latest changes from the default branch.</p></div><button className="wu-text-button" type="button" onClick={() => setToast('Showing the latest saved commits.')}>Refresh list <RefreshCw size={14} /></button></div><CommitList /></Panel>}
    </>}</>;
}

function BranchList({ detailed = false }: { detailed?: boolean }) {
  return <div className="wu-branch-list">{[['main', 'Default branch', '12 commits'], ['feat/login', 'Validate email before submit', '4 commits'], ['fix/mobile-board', 'Polish mobile board layout', '2 commits']].map(([name, note, commits]) => <div className="wu-branch-row" key={name}><GitBranch size={16} /><div><strong>{name}</strong><small>{note}</small></div><Pill tone={name === 'main' ? 'mint' : 'blue'}>{name === 'main' ? 'Default' : commits}</Pill>{detailed && <button className="wu-text-button" type="button">Open branch <ArrowUpRight size={14} /></button>}</div>)}</div>;
}

function CommitList() {
  return <div className="wu-commit-list">{[['a7d02fc', 'Validate email before submit', 'Alex Morgan', 'Apr 12 · 10:24'], ['d24b5ad', 'Handle password field errors', 'Sarah Kim', 'Apr 12 · 09:48'], ['75ac9df', 'Update mobile spacing', 'Maya Rodriguez', 'Apr 11 · 16:03']].map(([hash, title, author, time]) => <div className="wu-commit-row" key={hash}><GitCommitHorizontal size={16} /><strong>{title}</strong><span className="wu-muted">{hash}</span><span>{author}</span><time>{time}</time></div>)}</div>;
}
