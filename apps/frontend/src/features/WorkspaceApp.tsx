import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Activity, BarChart3, CheckCircle2, Files, GitBranch, Home, LayoutGrid, List, MessageCircle, Moon, Plus, Settings, StickyNote, Sun, Users, X } from 'lucide-react';
import { sessionKey } from './WorkspacePicker';
import './workspace-app.css';
import { Avatar } from './workspace/components';
import { TaskDetails } from './workspace/TaskDetails';
import { WorkspaceSwitcher } from './workspace/WorkspaceSwitcher';
import { WorkspaceCommand } from './workspace/WorkspaceCommand';
import { NotificationInbox } from './workspace/NotificationInbox';
import { LoadingPanel } from './workspace/WorkspaceControls';
import { TaskFacets, emptyFacets, matchesTaskFacets } from './workspace/TaskFacets';
import { homeFilters } from './workspace/previewData';
import { jsonRequest, useWorkspaceCollection, workspaceRequest, type WorkspaceFile } from './workspace/workspace-api';
import { dueThisWeek, loadBoard, statusCodes, type Member } from './workspace/workspace-tasks';
import type { PageKey, Task } from './workspace/types';
import { HomePage } from './workspace/pages/HomePage';
import { BacklogPage } from './workspace/pages/BacklogPage';
import { BoardPage } from './workspace/pages/BoardPage';
import { GithubPage } from './workspace/pages/GithubPage';
import { ActivityPage, type ActivityEvent } from './workspace/pages/ActivityPage';
import { TeamPage, type PendingInvitation } from './workspace/pages/TeamPage';
import { ChatPage } from './workspace/pages/ChatPage';
import { FilesPage } from './workspace/pages/FilesPage';
import { NotesPage } from './workspace/pages/NotesPage';
import { AnalyticsPage } from './workspace/pages/AnalyticsPage';
import { SettingsPage, type WorkspaceProfile } from './workspace/pages/SettingsPage';

const navigation: { key: PageKey; label: string; icon: typeof Home }[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'backlog', label: 'Backlog', icon: List },
  { key: 'board', label: 'Board', icon: LayoutGrid },
  { key: 'github', label: 'GitHub', icon: GitBranch },
  { key: 'activity', label: 'Activity', icon: Activity },
  { key: 'team', label: 'Team', icon: Users },
  { key: 'chat', label: 'Chat', icon: MessageCircle },
  { key: 'files', label: 'Files', icon: Files },
  { key: 'notes', label: 'Notes', icon: StickyNote },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings },
];

function getPageFromUrl(): PageKey {
  const value = new URLSearchParams(window.location.search).get('page');
  return navigation.some(item => item.key === value) ? value as PageKey : 'home';
}

export function WorkspaceApp({ workspaceId }: { workspaceId: string }) {
  const token = sessionStorage.getItem(sessionKey);
  const [page, setPage] = useState<PageKey>(getPageFromUrl);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('devup-theme') === 'dark' ? 'dark' : 'light');
  const [workspace, setWorkspace] = useState<WorkspaceProfile>();
  const [workspaceError, setWorkspaceError] = useState('');
  const [workspaceAttempt, setWorkspaceAttempt] = useState(0);
  const workspaceName = workspace?.name ?? 'Workspace';
  const [profileName, setProfileName] = useState('Workspace member');
  const profileInitials = profileName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const [profileId, setProfileId] = useState('');
  const [board, setBoard] = useState<Awaited<ReturnType<typeof loadBoard>>>();
  const [boardError, setBoardError] = useState('');
  const [boardAttempt, setBoardAttempt] = useState(0);
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [filter, setFilter] = useState('All tasks');
  const [facets, setFacets] = useState(emptyFacets);
  const [homeFilter, setHomeFilter] = useState(homeFilters[0]);
  const [selectedTaskId, setSelectedTaskId] = useState(() => new URLSearchParams(location.search).get('task'));
  const [modal, setModal] = useState<'task' | 'invite' | null>(null);
  const [toast, setToast] = useState('');
  const workspacePath = 'workspaces/' + encodeURIComponent(workspaceId);
  const filePath = workspacePath + '/files';
  const workspaceFiles = useWorkspaceCollection<WorkspaceFile>(filePath, token);
  const members = useWorkspaceCollection<Member>(workspacePath + '/members', token);
  const invitations = useWorkspaceCollection<PendingInvitation>(workspacePath + '/invitations', page === 'team' && workspace?.ownerId === profileId ? token : null);
  const recentActivity = useWorkspaceCollection<ActivityEvent>(workspacePath + '/activities?limit=5', token);
  const tasks = useMemo(() => (board?.tasks ?? []).map(task => {
    const member = members.items?.find(person => person.userId === task.assigneeId);
    return member ? { ...task, person: member.username, initials: member.username.slice(0, 2).toUpperCase() } : task;
  }), [board, members.items]);
  const columns = board?.columns ?? [];
  const selectedTask = tasks.find(task => task.id === selectedTaskId);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('Last 30 days');

  useEffect(() => {
    if (!token) { window.location.replace('/login'); return; }
    const controller = new AbortController();
    void fetch('/api/auth/profile', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => {
        if (response.status === 401) { sessionStorage.removeItem(sessionKey); window.location.replace('/login'); return; }
        if (!response.ok) return;
        const profile = await response.json() as { id: string; username?: string };
        setProfileId(profile.id);
        if (profile.username) setProfileName(profile.username);
      }).catch(() => {});
    void workspaceRequest(workspacePath, token, { signal: controller.signal })
      .then(response => response.json() as Promise<WorkspaceProfile>)
      .then(result => { if (!controller.signal.aborted) setWorkspace(result); })
      .catch(error => { if (!controller.signal.aborted) setWorkspaceError(error.message); });
    return () => controller.abort();
  }, [token, workspacePath, workspaceAttempt]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void loadBoard(workspacePath, token, controller.signal)
      .then(result => { if (!controller.signal.aborted) { setBoard(result); setBoardError(''); } })
      .catch(error => { if (!controller.signal.aborted) setBoardError(error.message); });
    return () => controller.abort();
  }, [workspacePath, token, boardAttempt]);

  useEffect(() => {
    document.title = `${navigation.find(item => item.key === page)?.label ?? 'Home'} · DevUP`;
    const onPop = () => {
      setPage(getPageFromUrl());
      setSelectedTaskId(new URLSearchParams(location.search).get('task'));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [page]);

  useEffect(() => {
    localStorage.setItem('devup-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!modal) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  const pageLabel = navigation.find(item => item.key === page)?.label ?? 'Home';
  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (filter === 'My tasks') result = result.filter(task => task.assigneeId === profileId);
    if (filter === 'Due this week') result = result.filter(dueThisWeek);
    if (filter === 'Blocked') result = result.filter(task => task.isBlocked && task.status !== 'Done');
    return result.filter(task => matchesTaskFacets(task, facets));
  }, [filter, facets, tasks, profileId]);

  const taskFacets = <TaskFacets tasks={tasks} value={facets} onChange={setFacets} />;

  function navigate(next: PageKey, section = '') {
    setPage(next);
    setFilter('All tasks');
    if (section === 'board-review') setFacets(emptyFacets);
    const url = new URL(window.location.href);
    url.searchParams.set('page', next);
    url.searchParams.delete('task');
    setSelectedTaskId(null);
    url.hash = section;
    window.history.pushState({ page: next }, '', url);
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (taskSaving || !token) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') ?? '').trim();
    if (!title) return;
    setTaskSaving(true);
    setTaskError('');
    try {
      await workspaceRequest(workspacePath + '/tasks', token, jsonRequest('POST', { title, description: String(form.get('description') ?? '') }));
      setBoardAttempt(value => value + 1);
      recentActivity.retry();
      setModal(null);
      setToast('Task added to the backlog.');
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : 'Could not create the task.');
    } finally {
      setTaskSaving(false);
    }
  }

  async function moveBoardTask(id: string, status: string) {
    const task = tasks.find(item => item.id === id);
    if (!task || task.status === status || !statusCodes[status] || taskSaving) return;
    setTaskSaving(true);
    try {
      await workspaceRequest('tasks/' + id + '/transition', token, jsonRequest('POST', { toStatus: statusCodes[status] }));
      setToast(`Moved “${task.title}” to ${status}.`);
      recentActivity.retry();
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not move the task.');
    } finally {
      setBoardAttempt(value => value + 1);
      setTaskSaving(false);
    }
  }

  function openTaskForm() {
    setTaskError('');
    setModal('task');
  }

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (taskSaving || !token) return;
    const invitedEmail = String(new FormData(event.currentTarget).get('email')).trim();
    setTaskSaving(true);
    setTaskError('');
    try {
      await workspaceRequest(workspacePath + '/invitations', token, jsonRequest('POST', { invitedEmail }));
      invitations.retry();
      setModal(null);
      setToast('Invitation sent.');
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : 'Could not invite this person.');
    } finally {
      setTaskSaving(false);
    }
  }

  function addTaskButton(label = 'New task') {
    return <button className="wu-button wu-button--primary" type="button" onClick={openTaskForm}><Plus size={16} />{label}</button>;
  }

  function pageHeading(action?: ReactNode) {
    return <header className="wu-page-heading">
      <h1>{pageLabel}</h1>
      {action && <div className="wu-page-action">{action}</div>}
    </header>;
  }

  function setSelectedTask(task: Task | null) {
    const url = new URL(location.href);
    if (task) url.searchParams.set('task', task.id);
    else url.searchParams.delete('task');
    history.replaceState(history.state, '', url);
    setSelectedTaskId(task?.id ?? null);
  }

  function openActivityResource(event: ActivityEvent) {
    if (event.resourceType === 'task') {
      const task = tasks.find(item => item.id === event.resourceId);
      if (task) { setSelectedTask(task); return true; }
      setToast('This task is unavailable.');
    } else if (event.actionType === 'FILE_UPLOADED' && event.resourceId) {
      navigate('files', 'file-' + event.resourceId);
      return true;
    }
    return false;
  }

  function renderPage() {
    if (!workspace) return <>{pageHeading()}{workspaceError
      ? <p role="alert">{workspaceError} <button type="button" className="wu-text-button" onClick={() => { setWorkspaceError(''); setWorkspaceAttempt(value => value + 1); }}>Try again</button> <a href="/workspaces">Back to workspaces</a></p>
      : <LoadingPanel label="Checking workspace access" />}</>;
    if (['home', 'board', 'backlog', 'analytics'].includes(page) && !board) {
      return <>{pageHeading()}{boardError
        ? <p role="alert">{boardError} <button type="button" className="wu-text-button" onClick={() => { setBoardError(''); setBoardAttempt(value => value + 1); }}>Try again</button></p>
        : <LoadingPanel label="Loading workspace tasks" />}</>;
    }
    switch (page) {
      case 'home': return (
        <HomePage
          pageHeading={pageHeading}
          columns={columns}
          tasks={tasks}
          profileId={profileId}
          members={members.items ?? []}
          recentActivity={recentActivity}
          openActivityResource={openActivityResource}
          githubPath={workspacePath + '/github'} token={token}
          homeFilter={homeFilter}
          setHomeFilter={setHomeFilter}
          navigate={navigate}
          recentFiles={workspaceFiles.items}
          filesError={workspaceFiles.error}
          retryFiles={workspaceFiles.retry}
          setSelectedTask={setSelectedTask}
          addTaskButton={addTaskButton}
        />
      );
      case 'backlog': return (
        <BacklogPage
          pageHeading={pageHeading}
          facets={taskFacets}
          filter={filter}
          setFilter={setFilter}
          filteredTasks={filteredTasks}
          setSelectedTask={setSelectedTask}
          onAddTask={openTaskForm}
          addTaskButton={addTaskButton}
        />
      );
      case 'board': return (
        <BoardPage
          pageHeading={pageHeading}
          facets={taskFacets}
          filter={filter}
          setFilter={setFilter}
          filteredTasks={filteredTasks}
          activeCount={board?.activeCount ?? 0}
          activeWipLimit={board?.activeWipLimit ?? 0}
          columns={columns}
          onMoveTask={moveBoardTask}
          setSelectedTask={setSelectedTask}
          onAddTask={openTaskForm}
          addTaskButton={addTaskButton}
        />
      );
      case 'github': return (
        <GithubPage
          pageHeading={pageHeading}
          path={workspacePath + '/github'} workspaceId={workspaceId} token={token} owner={workspace.ownerId === profileId}
        />
      );
      case 'activity': return (
        <ActivityPage
          pageHeading={pageHeading}
          path={workspacePath} token={token} members={members.items ?? []} openResource={openActivityResource}
        />
      );
      case 'team': return (
        <TeamPage
          pageHeading={pageHeading}
          workspaceName={workspaceName}
          members={members.items} loadError={members.error} retry={members.retry}
          invitations={invitations}
          path={workspacePath} token={token} profileId={profileId}
          onInvite={() => { setTaskError(''); setModal('invite'); }}
        />
      );
      case 'chat': return token && (
        <ChatPage
          workspaceId={workspaceId} token={token} profileId={profileId}
          profileName={profileName} roster={members.items ?? []}
        />
      );
      case 'files': return (
        <FilesPage
          pageHeading={pageHeading}
          path={filePath}
          token={token}
          files={workspaceFiles.items}
          loadError={workspaceFiles.error}
          onRetry={workspaceFiles.retry}
          owner={workspace.ownerId === profileId} profileId={profileId}
          onUpload={file => { workspaceFiles.setItems(current => [file, ...(current ?? [])]); recentActivity.retry(); }}
          onDelete={id => { workspaceFiles.setItems(current => current?.filter(file => file.id !== id)); recentActivity.retry(); }}
        />
      );
      case 'notes': return (
        <NotesPage
          pageHeading={pageHeading}
          path={workspacePath + '/notes'}
          token={token}
          owner={workspace.ownerId === profileId} profileId={profileId} members={members.items ?? []}
        />
      );
      case 'analytics': return (
        <AnalyticsPage
          pageHeading={pageHeading}
          analyticsPeriod={analyticsPeriod}
          setAnalyticsPeriod={setAnalyticsPeriod}
          tasks={tasks} columns={columns} activeCount={board?.activeCount ?? 0} activeWipLimit={board?.activeWipLimit ?? 0}
        />
      );
      case 'settings': return (
        <SettingsPage
          pageHeading={pageHeading}
          workspace={workspace} ownerName={members.items?.find(member => member.isOwner)?.username}
          profileId={profileId} profileName={profileName} token={token} path={workspacePath}
          navigate={navigate}
          onWorkspace={setWorkspace} onBoard={() => setBoardAttempt(value => value + 1)}
          onProfile={name => { setProfileName(name); members.retry(); }}
        />
      );
    }
  }

  return <div className={page === 'chat' ? 'workspace-app workspace-app--chat' : 'workspace-app'} data-theme={theme}>
    <aside className="wu-sidebar"><WorkspaceSwitcher workspaceId={workspaceId} workspaceName={workspaceName} token={token} />
      <nav className="wu-nav" aria-label="Workspace navigation">{navigation.slice(0, -1).map(item => { const Icon = item.icon; return <button key={item.key} type="button" aria-label={item.label} className={`wu-nav-item${page === item.key ? ' is-active' : ''}`} aria-current={page === item.key ? 'page' : undefined} onClick={() => navigate(item.key)}><Icon size={17} /><span>{item.label}</span>{item.key === 'chat' && <b>2</b>}</button>; })}</nav>
      <button type="button" className={`wu-nav-item wu-nav-settings${page === 'settings' ? ' is-active' : ''}`} aria-current={page === 'settings' ? 'page' : undefined} onClick={() => navigate('settings')}><Settings size={17} /><span>Settings</span></button>
    </aside>
    <div className="wu-main">
      <header className="wu-topbar">
        <a className="wu-brand" href="/" aria-label="DevUP home"><img src="/devup.svg" alt="" width="30" height="30" /><strong>DevUP</strong></a>
        <WorkspaceCommand pages={navigation} tasks={tasks} disabled={!!(modal || selectedTask)} onNavigate={navigate} onOpenTask={setSelectedTask} />
        <div className="wu-top-actions"><NotificationInbox token={token} workspaceId={workspaceId} /><button className="wu-theme-button" type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button><button className="wu-user-button" type="button" aria-label={"Profile: " + profileName} onClick={() => setToast(`${profileName} · Workspace member`)}><Avatar initials={profileInitials} tone="mint" preview={profileName === 'Alex Morgan'} /><span><strong>{profileName}</strong><small>Workspace member</small></span></button></div>
      </header>
      <main className={page === 'chat' ? 'wu-page wu-page--chat' : 'wu-page'} id="main" aria-label={page === 'chat' ? 'Chat' : undefined}>{renderPage()}</main>
    </div>
    {selectedTask && <TaskDetails key={selectedTask.id} task={selectedTask} tasks={tasks} members={members.items ?? []}
      token={token} profileId={profileId} onClose={() => setSelectedTask(null)} onChange={() => setBoardAttempt(value => value + 1)} />}
    {modal && <div className="wu-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null); }}><section className="wu-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="wu-modal-head"><div><h2 id="modal-title">{modal === 'task' ? 'Create a task' : 'Invite a team member'}</h2><p>{modal === 'task' ? 'Add a piece of work to the workspace backlog.' : 'Send an invitation to collaborate in this workspace.'}</p></div><button className="wu-icon-button" type="button" aria-label="Close dialog" onClick={() => setModal(null)}><X size={18} /></button></div>{modal === 'task' ? <form onSubmit={submitTask}><label className="wu-field-label">Task title<input autoFocus name="title" placeholder="What needs to get done?" required /></label><label className="wu-field-label">Description<textarea name="description" rows={3} placeholder="Add details for your team" /></label><div className="wu-modal-actions"><button className="wu-button wu-button--secondary" type="button" onClick={() => setModal(null)}>Cancel</button><button className="wu-button wu-button--primary" type="submit"><Plus size={15} />Create task</button></div></form> : <form onSubmit={submitInvite}><label className="wu-field-label">Email address<input autoFocus name="email" type="email" placeholder="name@company.com" required /></label>{taskError && <p role="alert">{taskError}</p>}<p className="wu-muted">Invited people can view workspace activity and collaborate on tasks.</p><div className="wu-modal-actions"><button className="wu-button wu-button--secondary" type="button" onClick={() => setModal(null)}>Cancel</button><button className="wu-button wu-button--primary" type="submit"><Plus size={15} />Invite member</button></div></form>}</section></div>}
    {toast && <div className="wu-toast" role="status"><CheckCircle2 size={17} />{toast}<button type="button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15} /></button></div>}
  </div>;
}
