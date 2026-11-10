import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Activity, BarChart3, CheckCircle2, ChevronRight, Contrast, Files, GitBranch, Home, LayoutGrid, List, LogOut, MessageCircle, Plus, Settings, StickyNote, UserRound, Users, X } from 'lucide-react';
import { sessionKey, signOut } from './WorkspacePicker';
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
import { dueThisWeek, loadBoard, taskBoardColumn, type BoardColumnConfig, type Member } from './workspace/workspace-tasks';
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
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('devup-theme');
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  });
  const [browserDark, setBrowserDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const [workspace, setWorkspace] = useState<WorkspaceProfile>();
  const [workspaceError, setWorkspaceError] = useState('');
  const [workspaceAttempt, setWorkspaceAttempt] = useState(0);
  const workspaceName = workspace?.name ?? 'Workspace';
  const [profileName, setProfileName] = useState('Workspace member');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const profileInitials = profileName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const [profileId, setProfileId] = useState('');
  const [board, setBoard] = useState<Awaited<ReturnType<typeof loadBoard>>>();
  const [boardError, setBoardError] = useState('');
  const [boardAttempt, setBoardAttempt] = useState(0);
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [targetColumn, setTargetColumn] = useState<BoardColumnConfig>();
  const [columnError, setColumnError] = useState('');
  const [savingColumns, setSavingColumns] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
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
  const boardColumns = board?.boardColumns ?? [];
  const selectedTask = tasks.find(task => task.id === selectedTaskId);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('Last 30 days');

  useEffect(() => {
    if (!token) { window.location.replace('/login'); return; }
    const controller = new AbortController();
    void fetch('/api/auth/profile', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => {
        if (response.status === 401) { sessionStorage.removeItem(sessionKey); window.location.replace('/login'); return; }
        if (!response.ok) return;
        const profile = await response.json() as { id: string; username?: string; email?: string; avatarUrl?: string | null };
        setProfileId(profile.id);
        if (profile.username) setProfileName(profile.username);
        setProfileEmail(profile.email ?? '');
        setProfileAvatar(profile.avatarUrl ?? null);
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
    const preference = matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setBrowserDark(preference.matches);
    preference.addEventListener('change', sync);
    sync();
    return () => preference.removeEventListener('change', sync);
  }, []);

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
    window.history.pushState({ page: next, ...(next === 'files' && selectedTaskId ? { fromTask: selectedTaskId } : {}) }, '', url);
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
      const column = targetColumn ?? boardColumns.find(item => item.status === 'BACKLOG') ?? boardColumns[0];
      await workspaceRequest(workspacePath + '/tasks', token, jsonRequest('POST', { title, description: String(form.get('description') ?? ''), boardColumnId: column?.id }));
      setBoardAttempt(value => value + 1);
      recentActivity.retry();
      setModal(null);
      setToast(column ? 'Task added to ' + column.label + '.' : 'Task added to the backlog.');
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : 'Could not create the task.');
    } finally {
      setTaskSaving(false);
    }
  }

  async function moveBoardTask(id: string, column: BoardColumnConfig) {
    const task = tasks.find(item => item.id === id);
    if (!task || taskBoardColumn(task, boardColumns)?.id === column.id || taskSaving) return;
    setTaskSaving(true);
    setColumnError('');
    try {
      await workspaceRequest('tasks/' + id + '/transition', token, jsonRequest('POST', { toStatus: column.status, boardColumnId: column.id }));
      setToast(`Moved “${task.title}” to ${column.label}.`);
      recentActivity.retry();
    } catch (error) {
      setColumnError(`Could not move “${task.title}” to ${column.label}. ${error instanceof Error ? error.message : 'Try again.'}`);
    } finally {
      setBoardAttempt(value => value + 1);
      setTaskSaving(false);
    }
  }

  function openTaskForm(column?: BoardColumnConfig) {
    setTaskError('');
    setTargetColumn(column);
    setModal('task');
  }

  async function saveBoardColumns(next: BoardColumnConfig[]) {
    if (!token || savingColumns || workspace?.ownerId !== profileId) return false;
    setSavingColumns(true);
    setColumnError('');
    try {
      await workspaceRequest(workspacePath + '/kanban-settings', token, jsonRequest('PATCH', { boardColumns: next }));
      setBoard(current => current ? { ...current, boardColumns: next } : current);
      setBoardAttempt(value => value + 1);
      return true;
    } catch (error) {
      setColumnError(error instanceof Error ? error.message : 'Could not save the board.');
      return false;
    } finally {
      setSavingColumns(false);
    }
  }

  async function logout() {
    if (loggingOut || !token) return;
    setLoggingOut(true);
    try {
      await workspaceRequest('auth/logout', token, { method: 'POST' });
      signOut();
    } catch {
      setToast('Could not log out. Try again.');
      setLoggingOut(false);
    }
  }

  function openSettings(section = '') {
    document.getElementById('wu-profile-menu')?.hidePopover();
    navigate('settings', section);
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
    return <button className="wu-button wu-button--primary" type="button" onClick={() => openTaskForm()}><Plus size={16} />{label}</button>;
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
    history.replaceState({ page }, '', url);
    setSelectedTaskId(task?.id ?? null);
  }

  function openRelatedTask(task: Task) {
    const url = new URL(location.href);
    url.searchParams.set('task', task.id);
    history.pushState({ page, fromTask: selectedTaskId }, '', url);
    setSelectedTaskId(task.id);
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
          columns={boardColumns} allTasks={tasks}
          canManage={workspace.ownerId === profileId} savingColumns={savingColumns} saveColumns={saveBoardColumns} error={columnError}
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
          key={location.hash}
          pageHeading={pageHeading}
          path={filePath}
          token={token}
          files={workspaceFiles.items}
          loadError={workspaceFiles.error}
          onRetry={workspaceFiles.retry}
          owner={workspace.ownerId === profileId} profileId={profileId}
          onBackToTask={history.state?.fromTask ? () => history.back() : undefined}
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
          key={location.hash}
          initialTab={location.hash === '#profile' ? 'Profile' : 'General'}
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

  return <div className={page === 'chat' ? 'workspace-app workspace-app--chat' : 'workspace-app'} data-theme={theme === 'system' ? (browserDark ? 'dark' : 'light') : theme}>
    <aside className="wu-sidebar"><WorkspaceSwitcher workspaceId={workspaceId} workspaceName={workspaceName} token={token} />
      <nav className="wu-nav" aria-label="Workspace navigation">{navigation.slice(0, -1).map(item => { const Icon = item.icon; return <button key={item.key} type="button" aria-label={item.label} className={`wu-nav-item${page === item.key ? ' is-active' : ''}`} aria-current={page === item.key ? 'page' : undefined} onClick={() => navigate(item.key)}><Icon size={17} /><span>{item.label}</span>{item.key === 'chat' && <b>2</b>}</button>; })}</nav>
      <button type="button" className={`wu-nav-item wu-nav-settings${page === 'settings' ? ' is-active' : ''}`} aria-current={page === 'settings' ? 'page' : undefined} onClick={() => navigate('settings')}><Settings size={17} /><span>Settings</span></button>
    </aside>
    <div className="wu-main">
      <header className="wu-topbar">
        <a className="wu-brand" href="/" aria-label="DevUP home"><img src="/devup.svg" alt="" width="30" height="30" /><strong>DevUP</strong></a>
        <WorkspaceCommand pages={navigation} tasks={tasks} disabled={!!(modal || selectedTask)} onNavigate={navigate} onOpenTask={setSelectedTask} />
        <div className="wu-top-actions">
          <NotificationInbox token={token} workspaceId={workspaceId} />
          <button className="wu-user-button wu-profile-trigger" type="button" aria-label={'Account menu for ' + profileName} popoverTarget="wu-profile-menu">
            {profileAvatar ? <img className="wu-avatar" src={profileAvatar} alt="" /> : <Avatar initials={profileInitials} tone="blue" preview={false} />}
          </button>
          <div id="wu-profile-menu" popover="auto" className="wu-profile-menu" aria-label="Account">
            <div className="wu-profile-identity">
              {profileAvatar ? <img className="wu-avatar" src={profileAvatar} alt="" /> : <Avatar initials={profileInitials} tone="blue" preview={false} />}
              <div><strong>{profileName}</strong>{profileEmail && <span>{profileEmail}</span>}</div>
            </div>
            <div className="wu-profile-actions">
              <button type="button" onClick={() => openSettings('profile')}><UserRound size={17} aria-hidden="true" />Profile</button>
              <button type="button" onClick={() => openSettings()}><Settings size={17} aria-hidden="true" />Workspace settings</button>
              <details className="wu-profile-theme">
                <summary><Contrast size={17} aria-hidden="true" />Theme <ChevronRight className="wu-profile-chevron" size={15} aria-hidden="true" /></summary>
                <fieldset className="wu-theme-picker">
                  <legend className="wu-visually-hidden">Theme</legend>
                  {(['light', 'dark', 'system'] as const).map(mode => <label key={mode} className="wu-theme-option" data-selected={theme === mode}>
                    <input type="radio" name="workspace-theme" checked={theme === mode} onChange={() => setTheme(mode)} />
                    <span className={`wu-theme-preview wu-theme-preview--${mode}`} aria-hidden="true"><i /><b /></span>
                    <span>{mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'Match browser'}</span>
                  </label>)}
                </fieldset>
              </details>
            </div>
            <div className="wu-profile-actions wu-profile-footer">
              <button type="button" disabled={loggingOut} onClick={() => void logout()}><LogOut size={17} aria-hidden="true" />{loggingOut ? 'Logging out…' : 'Log out'}</button>
            </div>
          </div>
        </div>
      </header>
      <main className={page === 'chat' ? 'wu-page wu-page--chat' : 'wu-page'} id="main" aria-label={page === 'chat' ? 'Chat' : undefined}>{renderPage()}</main>
    </div>
    {selectedTask && <TaskDetails key={selectedTask.id} task={selectedTask} tasks={tasks} members={members.items ?? []}
      token={token} profileId={profileId} onClose={() => setSelectedTask(null)} onChange={() => setBoardAttempt(value => value + 1)}
      files={(workspaceFiles.items ?? []).filter(file => file.taskId === selectedTask.id)} boardColumns={boardColumns}
      openTask={openRelatedTask} openFile={file => navigate('files', 'file-' + file.id)}
      onBack={history.state?.fromTask ? () => history.back() : undefined} />}
    {modal && <div className="wu-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null); }}><section className="wu-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="wu-modal-head"><div><h2 id="modal-title">{modal === 'task' ? 'Create a task' : 'Invite a team member'}</h2><p>{modal === 'task' ? 'Add a piece of work to the workspace backlog.' : 'Send an invitation to collaborate in this workspace.'}</p></div><button className="wu-icon-button" type="button" aria-label="Close dialog" onClick={() => setModal(null)}><X size={18} /></button></div>{modal === 'task' ? <form onSubmit={submitTask}><label className="wu-field-label">Task title<input autoFocus name="title" placeholder="What needs to get done?" required /></label><label className="wu-field-label">Description<textarea name="description" rows={3} placeholder="Add details for your team" /></label><div className="wu-modal-actions"><button className="wu-button wu-button--secondary" type="button" onClick={() => setModal(null)}>Cancel</button><button className="wu-button wu-button--primary" type="submit"><Plus size={15} />Create task</button></div></form> : <form onSubmit={submitInvite}><label className="wu-field-label">Email address<input autoFocus name="email" type="email" placeholder="name@company.com" required /></label>{taskError && <p role="alert">{taskError}</p>}<p className="wu-muted">Invited people can view workspace activity and collaborate on tasks.</p><div className="wu-modal-actions"><button className="wu-button wu-button--secondary" type="button" onClick={() => setModal(null)}>Cancel</button><button className="wu-button wu-button--primary" type="submit"><Plus size={15} />Invite member</button></div></form>}</section></div>}
    {toast && <div className="wu-toast" role="status"><CheckCircle2 size={17} />{toast}<button type="button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15} /></button></div>}
  </div>;
}
