import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Archive, CheckCircle2, ChevronRight, Contrast, LogOut, PanelLeftClose, PanelLeftOpen, Plus, UserRound, UsersRound, X } from 'lucide-react';
import { workspaceIcons } from './workspace/workspace-icons';
import { sessionKey, signOut, switchAccount } from './WorkspacePicker';
import './workspace-app.css';
import { Avatar } from './workspace/components';
import { rememberWorkspace } from './workspace/workspace-history';
import './workspace/workspace-navigation.css';
import { TaskDetails } from './workspace/TaskDetails';
import { TaskProjectField } from './workspace/TaskProjectField';
import type { Project } from './workspace/workspace-projects';
import { WorkspaceSwitcher } from './workspace/WorkspaceSwitcher';
import { WorkspaceCommand } from './workspace/WorkspaceCommand';
import { NotificationInbox } from './workspace/NotificationInbox';
import { LoadingPanel } from './workspace/WorkspaceControls';
import { TaskFacets, emptyFacets, matchesTaskFacets } from './workspace/TaskFacets';
import { homeFilters } from './workspace/previewData';
import { useWorkspaceChat } from './workspace/workspace-chat';
import { WorkspaceRequestError, jsonRequest, useWorkspaceCollection, workspaceRequest, type WorkspaceFile } from './workspace/workspace-api';
import { loadBoard, taskPriorities, type BoardColumnConfig, type Member } from './workspace/workspace-tasks';
import { addCalendarDays, calendarDate, isDueInNextSevenDays, nextSevenDaysLabel } from './workspace/workspace-calendar';
import type { PageKey, Task } from './workspace/types';
import { HomePage } from './workspace/pages/HomePage';
import { ProjectsPage } from './workspace/pages/ProjectsPage';
import { BacklogPage } from './workspace/pages/BacklogPage';
import { BoardPage } from './workspace/pages/BoardPage';
import { GithubPage } from './workspace/pages/GithubPage';
import { ActivityPage, type ActivityEvent } from './workspace/pages/ActivityPage';
import { TeamPage, type TeamInvitation } from './workspace/pages/TeamPage';
import { ChatPage } from './workspace/pages/ChatPage';
import { FilesPage } from './workspace/pages/FilesPage';
import { NotesPage } from './workspace/pages/NotesPage';
import { AnalyticsPage } from './workspace/pages/AnalyticsPage';
import { SettingsPage, type WorkspaceProfile } from './workspace/pages/SettingsPage';
import type { PersonalProfile, Theme } from './workspace/pages/PersonalSettings';

const navigation: { key: PageKey; label: string; icon: typeof workspaceIcons.home }[] = [
  { key: 'home', label: 'Home', icon: workspaceIcons.home },
  { key: 'projects', label: 'Projects', icon: workspaceIcons.projects },
  { key: 'backlog', label: 'Backlog', icon: workspaceIcons.backlog },
  { key: 'board', label: 'Board', icon: workspaceIcons.board },
  { key: 'github', label: 'GitHub', icon: workspaceIcons.github },
  { key: 'activity', label: 'Activity', icon: workspaceIcons.activity },
  { key: 'team', label: 'Team', icon: workspaceIcons.team },
  { key: 'chat', label: 'Chat', icon: workspaceIcons.chat },
  { key: 'files', label: 'Files', icon: workspaceIcons.files },
  { key: 'notes', label: 'Notes', icon: workspaceIcons.notes },
  { key: 'analytics', label: 'Analytics', icon: workspaceIcons.analytics },
  { key: 'settings', label: 'Settings', icon: workspaceIcons.settings },
];

function getPageFromUrl(): PageKey {
  const value = new URLSearchParams(window.location.search).get('page');
  return navigation.some(item => item.key === value) ? value as PageKey : 'home';
}

function getChatThreadFromUrl() {
  return location.hash.startsWith('#dm-') ? location.hash.slice(4) : 'team';
}

export function WorkspaceApp({ workspaceId }: { workspaceId: string }) {
  const [sidebarPreference, setSidebarPreference] = useState(() => localStorage.getItem('devup-sidebar'));
  const [compactSidebar, setCompactSidebar] = useState(() => matchMedia('(max-width: 980px)').matches);
  const sidebarCollapsed = sidebarPreference === null ? compactSidebar : sidebarPreference === 'collapsed';

  useEffect(() => {
    const query = matchMedia('(max-width: 980px)');
    const sync = () => setCompactSidebar(query.matches);
    query.addEventListener('change', sync);
    sync();
    return () => query.removeEventListener('change', sync);
  }, []);

  function toggleSidebar() {
    const preference = sidebarCollapsed ? 'expanded' : 'collapsed';
    setSidebarPreference(preference);
    localStorage.setItem('devup-sidebar', preference);
  }
  const token = sessionStorage.getItem(sessionKey);
  const [page, setPage] = useState<PageKey>(getPageFromUrl);
  const [settingsSection, setSettingsSection] = useState(location.hash);
  const [projectSection, setProjectSection] = useState(() => location.hash.slice(1));
  const themeSaving = useRef(false);
  const [browserDark, setBrowserDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const [workspace, setWorkspace] = useState<WorkspaceProfile>();
  const [workspaceError, setWorkspaceError] = useState('');
  const [workspaceAttempt, setWorkspaceAttempt] = useState(0);
  const workspaceName = workspace?.name ?? 'Workspace';
  const [profile, setProfile] = useState<PersonalProfile>({ id: '', username: 'Workspace member', email: '' });
  const { id: profileId, username: profileName, email: profileEmail, avatarUrl: profileAvatar, theme = 'system' } = profile;
  const profileInitials = profileName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const archived = !!workspace?.archivedAt;
  const [chatThread, setChatThread] = useState(getChatThreadFromUrl);
  const chat = useWorkspaceChat(workspaceId, workspace ? token : null, page === 'chat' ? chatThread : null, profileId);
  const [board, setBoard] = useState<Awaited<ReturnType<typeof loadBoard>>>();
  const [boardError, setBoardError] = useState('');
  const [boardAttempt, setBoardAttempt] = useState(0);
  const [taskSaving, setTaskSaving] = useState(false);
  const submittingModal = useRef(false);
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
  const [inviteDelivery, setInviteDelivery] = useState<TeamInvitation>();
  const workspacePath = 'workspaces/' + encodeURIComponent(workspaceId);
  const filePath = workspacePath + '/files';
  const workspaceFiles = useWorkspaceCollection<WorkspaceFile>(filePath, token);
  const members = useWorkspaceCollection<Member>(workspacePath + '/members', token);
  const projectsPath = workspacePath + '/projects';
  const projects = useWorkspaceCollection<Project>(projectsPath, page === 'projects' || selectedTaskId ? token : null);
  const invitations = useWorkspaceCollection<TeamInvitation>(workspacePath + '/invitations', page === 'team' && workspace?.ownerId === profileId ? token : null);
  const recentActivity = useWorkspaceCollection<ActivityEvent>(workspacePath + '/activities?limit=5', token);
  const tasks = useMemo(() => (board?.tasks ?? []).map(task => {
    const member = members.items?.find(person => person.userId === task.assigneeId);
    return member ? { ...task, person: member.username, initials: member.username.slice(0, 2).toUpperCase() } : task;
  }), [board, members.items]);
  const columns = board?.columns ?? [];
  const boardColumns = board?.boardColumns ?? [];
  const selectedTask = tasks.find(task => task.id === selectedTaskId || (selectedTaskId && task.taskKey === selectedTaskId.toUpperCase()));
  const [analyticsPeriod, setAnalyticsPeriod] = useState('Last 30 days');

  useEffect(() => {
    if (!token) { signOut(true); return; }
    const controller = new AbortController();
    void fetch('/api/auth/profile', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => {
        if (response.status === 401) { signOut(true); return; }
        if (!response.ok) return;
        const profile = await response.json() as PersonalProfile;
        if (!controller.signal.aborted) setProfile(profile);
      }).catch(() => {});
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void workspaceRequest(workspacePath, token, { signal: controller.signal })
      .then(response => response.json() as Promise<WorkspaceProfile>)
      .then(result => { if (!controller.signal.aborted) { setWorkspace(result); setWorkspaceError(''); } })
      .catch(error => {
        if (controller.signal.aborted) return;
        if (error instanceof WorkspaceRequestError && [403, 404].includes(error.status)) setWorkspace(undefined);
        setWorkspaceError(error.message);
      });
    return () => controller.abort();
  }, [token, workspacePath, workspaceAttempt]);

  useEffect(() => {
    if (workspace && !archived) rememberWorkspace(profileId, workspaceId);
  }, [profileId, workspaceId, workspace, archived]);

  useEffect(() => { if (archived) setModal(null); }, [archived]);

  useEffect(() => {
    const refresh = () => setWorkspaceAttempt(current => current + 1);
    window.addEventListener('devup:workspace-archived', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('devup:workspace-archived', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void loadBoard(workspacePath, token, controller.signal)
      .then(result => { if (!controller.signal.aborted) { setBoard(result); setBoardError(''); } })
      .catch(error => { if (!controller.signal.aborted) setBoardError(error.message); });
    return () => controller.abort();
  }, [workspacePath, token, boardAttempt]);

  useEffect(() => {
    if (boardAttempt > 0) projects.retry();
  }, [boardAttempt]);

  useEffect(() => {
    document.title = `${navigation.find(item => item.key === page)?.label ?? 'Home'} · DevUP`;
    const onPop = () => {
      setPage(getPageFromUrl());
      setSettingsSection(location.hash);
      setProjectSection(location.hash.slice(1));
      setChatThread(getChatThreadFromUrl());
      setSelectedTaskId(new URLSearchParams(location.search).get('task'));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [page]);

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
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !submittingModal.current) setModal(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  const pageLabel = navigation.find(item => item.key === page)?.label ?? 'Home';
  const reportingTimeZone = workspace?.reportingTimeZone ?? board?.reportingTimeZone ?? 'Africa/Casablanca';
  const [calendarNow, setCalendarNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setCalendarNow(new Date());
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  const today = calendarDate(calendarNow, reportingTimeZone);
  const nextSevenDaysEnd = addCalendarDays(today, 7);
  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (filter === 'My tasks') result = result.filter(task => task.assigneeId === profileId);
    if (filter === nextSevenDaysLabel) result = result.filter(task => isDueInNextSevenDays(task, today, nextSevenDaysEnd));
    if (filter === 'Blocked') result = result.filter(task => task.isBlocked && task.status !== 'Done');
    return result.filter(task => matchesTaskFacets(task, facets, today, nextSevenDaysEnd));
  }, [filter, facets, tasks, profileId, today, nextSevenDaysEnd]);

  const taskFacets = <TaskFacets tasks={tasks} value={facets} onChange={setFacets} />;

  function navigate(next: PageKey, section = '') {
    setPage(next);
    if (next === 'settings') setSettingsSection(section ? '#' + section : '');
    if (next === 'projects') setProjectSection(section);
    setFilter('All tasks');
    if (section === 'board-review') setFacets(emptyFacets);
    const url = new URL(window.location.href);
    url.searchParams.set('page', next);
    url.searchParams.delete('task');
    setSelectedTaskId(null);
    url.hash = section;
    window.history.pushState({ page: next, ...(next === 'files' && selectedTaskId ? { fromTask: selectedTaskId } : {}) }, '', url);
    if (next === 'chat') setChatThread(getChatThreadFromUrl());
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (archived || submittingModal.current || taskSaving || !token) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') ?? '').trim();
    if (!title) {
      setTaskError('Enter a task title.');
      return;
    }
    submittingModal.current = true;
    setTaskSaving(true);
    setTaskError('');
    try {
      const column = targetColumn ?? boardColumns.find(item => item.status === 'BACKLOG') ?? boardColumns[0];
      await workspaceRequest(workspacePath + '/tasks', token, jsonRequest('POST', {
        title,
        description: String(form.get('description') ?? ''),
        boardColumnId: column?.id,
        assigneeId: form.get('assigneeId') || undefined,
        priority: form.get('priority') || undefined,
        dueDate: form.get('dueDate') || undefined,
      }));
      setBoardAttempt(value => value + 1);
      recentActivity.retry();
      setModal(null);
      setToast(column ? 'Task added to ' + column.label + '.' : 'Task added to the backlog.');
    } catch (error) {
      setTaskError(error instanceof WorkspaceRequestError ? error.message : 'Could not create the task. Try again.');
    } finally {
      submittingModal.current = false;
      setTaskSaving(false);
    }
  }

  async function moveBoardTask(id: string, column: BoardColumnConfig, placement: 'before' | 'after' | 'end', anchorTaskId?: string) {
    const task = tasks.find(item => item.id === id);
    if (archived || !task || taskSaving || !token) return false;
    setTaskSaving(true);
    setColumnError('');
    try {
      await workspaceRequest('tasks/' + id + '/transition', token, jsonRequest('POST', {
        toStatus: column.status, boardColumnId: column.id, placement, anchorTaskId,
      }));
      setToast(`Moved “${task.title}” to ${column.label}.`);
      recentActivity.retry();
      return true;
    } catch (error) {
      setColumnError(`Could not move “${task.title}” to ${column.label}. ${error instanceof Error ? error.message : 'Try again.'}`);
      return false;
    } finally {
      setBoardAttempt(value => value + 1);
      setTaskSaving(false);
    }
  }

  function openTaskForm(column?: BoardColumnConfig) {
    if (archived) return;
    setTaskError('');
    setTargetColumn(column);
    setModal('task');
  }

  async function saveBoardColumns(next: BoardColumnConfig[], moveColumnTasks?: { fromColumnId: string; toColumnId: string }) {
    if (archived || !token || savingColumns || workspace?.ownerId !== profileId) return false;
    setSavingColumns(true);
    setColumnError('');
    try {
      await workspaceRequest(workspacePath + '/kanban-settings', token, jsonRequest('PATCH', { boardColumns: next, moveColumnTasks }));
      if (!moveColumnTasks) setBoard(current => current ? { ...current, boardColumns: next } : current);
      else recentActivity.retry();
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

  async function saveTheme(theme: Theme) {
    if (!token || !profileId || themeSaving.current) return false;
    themeSaving.current = true;
    try {
      await workspaceRequest('users/' + profileId, token, jsonRequest('PATCH', { theme }));
      setProfile(current => ({ ...current, theme }));
      return true;
    } catch {
      setToast('Could not save the theme. Try again.');
      return false;
    } finally {
      themeSaving.current = false;
    }
  }

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (archived || submittingModal.current || taskSaving || !token) return;
    const invitedEmail = String(new FormData(event.currentTarget).get('email')).trim();
    submittingModal.current = true;
    setTaskSaving(true);
    setTaskError('');
    try {
      const response = await workspaceRequest(workspacePath + '/invitations', token, jsonRequest('POST', { invitedEmail }));
      setInviteDelivery(await response.json() as TeamInvitation);
      invitations.retry();
      setModal(null);
    } catch (error) {
      switch (error instanceof WorkspaceRequestError ? error.message : '') {
        case 'Pending invitation already exists':
          setTaskError('This person already has an invitation. Use Resend invitation in the Team list.');
          break;
        case 'User is already a workspace member':
          setTaskError('This person is already a workspace member. You can find them in the Team list.');
          break;
        default:
          setTaskError(error instanceof WorkspaceRequestError ? error.message : 'Could not send the invitation. Try again.');
      }
    } finally {
      submittingModal.current = false;
      setTaskSaving(false);
    }
  }

  function addTaskButton(label = 'New task') {
    if (archived) return null;
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
    if (task) url.searchParams.set('task', task.taskKey ?? task.id);
    else url.searchParams.delete('task');
    history.replaceState({ page }, '', url);
    setSelectedTaskId(task?.id ?? null);
  }

  function openRelatedTask(task: Task) {
    const url = new URL(location.href);
    url.searchParams.set('task', task.taskKey ?? task.id);
    history.pushState({ page, fromTask: selectedTaskId }, '', url);
    setSelectedTaskId(task.id);
  }

  function openProjectTask(id: string) {
    const url = new URL(location.href);
    url.searchParams.set('task', id);
    history.replaceState({ page }, '', url);
    setSelectedTaskId(id);
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
      case 'projects': {
        const projectId = projectSection.startsWith('project-') ? projectSection.slice('project-'.length) : null;
        return <ProjectsPage key={(projectId ?? 'list') + (archived ? '-archived' : '')}
          pageHeading={pageHeading} projects={projects.items} failed={projects.error} retry={projects.retry}
          projectId={projectId} onProject={id => navigate('projects', id ? 'project-' + id : '')}
          onOpenTask={openProjectTask} tasks={tasks} members={members.items ?? []} profileId={profileId}
          path={projectsPath} token={token} readOnly={archived} />;
      }
      case 'home': return (
        <HomePage
          pageHeading={pageHeading}
          columns={columns}
          tasks={tasks}
          today={today}
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
          readOnly={archived}
          key={workspaceId + ':' + profileId}
          pageHeading={pageHeading}
          storageKey={'devup:backlog:' + workspaceId + ':' + profileId}
          viewsPath={workspacePath + '/backlog-views'}
          token={token}
          tasks={tasks}
          profileId={profileId}
          today={today}
          nextSevenDaysEnd={nextSevenDaysEnd}
          setSelectedTask={setSelectedTask}
          onAddTask={openTaskForm}
          addTaskButton={addTaskButton}
        />
      );
      case 'board': return (
        <BoardPage
          key={archived ? 'archived' : 'active'}
          readOnly={archived}
          pageHeading={pageHeading}
          facets={taskFacets}
          filter={filter}
          setFilter={setFilter}
          filteredTasks={filteredTasks}
          activeCount={board?.activeCount ?? 0}
          activeWipLimit={board?.activeWipLimit ?? 0}
          columns={boardColumns} allTasks={tasks}
          canManage={!archived && workspace.ownerId === profileId} savingColumns={savingColumns} saveColumns={saveBoardColumns} error={columnError}
          onMoveTask={moveBoardTask}
          movingTask={taskSaving}
          setSelectedTask={setSelectedTask}
          onAddTask={openTaskForm}
          addTaskButton={addTaskButton}
        />
      );
      case 'github': return (
        <GithubPage
          pageHeading={pageHeading}
          path={workspacePath + '/github'} workspaceId={workspaceId} token={token} owner={!archived && workspace.ownerId === profileId}
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
          key={archived ? 'archived' : 'active'}
          pageHeading={pageHeading}
          workspaceName={workspaceName}
          archived={archived}
          members={members.items} loadError={members.error} retry={members.retry}
          invitations={invitations}
          delivery={inviteDelivery} onDelivery={setInviteDelivery}
          refreshWorkspace={() => { setWorkspaceAttempt(current => current + 1); setBoardAttempt(current => current + 1); }}
          path={workspacePath} token={token} profileId={profileId}
          onInvite={() => { setTaskError(''); setModal('invite'); }}
        />
      );
      case 'chat': return token && (
        <ChatPage
          chat={chat} selected={chatThread} setSelected={setChatThread} profileId={profileId}
          profileName={profileName} roster={members.items ?? []} workspaceArchived={archived}
        />
      );
      case 'files': return (
        <FilesPage
          key={location.hash + (archived ? '-archived' : '')}
          pageHeading={pageHeading}
          path={filePath}
          token={token}
          files={workspaceFiles.items}
          readOnly={archived}
          members={members.items ?? []}
          owner={workspace.ownerId === profileId} profileId={profileId}
          onBackToTask={history.state?.fromTask ? () => history.back() : undefined}
          onUpload={file => { workspaceFiles.setItems(current => [file, ...(current ?? [])]); recentActivity.retry(); }}
          onDelete={id => { workspaceFiles.setItems(current => current?.filter(file => file.id !== id)); recentActivity.retry(); }}
        />
      );
      case 'notes': return (
        <NotesPage
          key={archived ? 'archived' : 'active'}
          pageHeading={pageHeading}
          path={workspacePath + '/notes'}
          token={token}
          readOnly={archived}
          owner={workspace.ownerId === profileId} profileId={profileId} members={members.items ?? []}
        />
      );
      case 'analytics': return (
        <AnalyticsPage
          pageHeading={pageHeading}
          analyticsPeriod={analyticsPeriod}
          setAnalyticsPeriod={setAnalyticsPeriod}
          today={today} reportingTimeZone={reportingTimeZone}
          tasks={tasks} columns={columns} activeCount={board?.activeCount ?? 0} activeWipLimit={board?.activeWipLimit ?? 0}
        />
      );
      case 'settings': return (
        <SettingsPage
          key={settingsSection}
          initialTab={settingsSection === '#profile' ? 'Profile' : settingsSection === '#archive' ? 'Archive' : 'General'}
          pageHeading={pageHeading}
          workspace={workspace} ownerName={members.items?.find(member => member.isOwner)?.username}
          profile={profile} token={token} path={workspacePath}
          navigate={navigate}
          onWorkspace={next => { setWorkspace(next); setWorkspaceAttempt(current => current + 1); }} onBoard={() => setBoardAttempt(value => value + 1)}
          onProfile={next => { setProfile(current => ({ ...next, theme: current.theme })); members.retry(); }}
          onTheme={saveTheme}
        />
      );
    }
  }

  return <div className={page === 'chat' ? 'workspace-app workspace-app--chat' : 'workspace-app'} data-sidebar={sidebarCollapsed ? 'collapsed' : 'expanded'} data-theme={theme === 'system' ? (browserDark ? 'dark' : 'light') : theme}>
    <aside className="wu-sidebar" id="workspace-sidebar">
      <div className="wu-sidebar-header">
        <WorkspaceSwitcher workspaceId={workspaceId} workspaceName={workspaceName} token={token} profileId={profileId} />
        <button className="wu-icon-button wu-sidebar-toggle" type="button" aria-controls="workspace-sidebar" aria-expanded={!sidebarCollapsed}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={toggleSidebar}>
          {sidebarCollapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
        </button>
      </div>
      <nav className="wu-nav" aria-label="Workspace navigation">{navigation.slice(0, -1).map(item => { const Icon = item.icon; return <button key={item.key} type="button" aria-label={item.key === 'chat' && chat.unreadTotal > 0 ? 'Chat, ' + chat.unreadTotal + ' unread messages' : item.label} data-nav-tooltip={item.label} className={`wu-nav-item${page === item.key ? ' is-active' : ''}`} aria-current={page === item.key ? 'page' : undefined} onClick={() => navigate(item.key)}><Icon size={17} /><span>{item.label}</span>{item.key === 'chat' && chat.unreadTotal > 0 && <b aria-hidden="true">{chat.unreadTotal > 99 ? '99+' : chat.unreadTotal}</b>}</button>; })}</nav>
      <button type="button" aria-label="Workspace settings" data-nav-tooltip="Settings" className={`wu-nav-item wu-nav-settings${page === 'settings' ? ' is-active' : ''}`} aria-current={page === 'settings' ? 'page' : undefined} onClick={() => navigate('settings')}><workspaceIcons.settings size={17} /><span>Settings</span></button>
    </aside>
    <div className="wu-main">
      <header className="wu-topbar">
        <a className="wu-brand" href="/" aria-label="DevUP home"><img src="/devup.svg" alt="" width="30" height="30" /><strong>DevUP</strong></a>
        <WorkspaceCommand pages={navigation} tasks={tasks}
          disabled={!!(!workspace || (!archived && modal) || selectedTask)} onNavigate={navigate} onOpenTask={setSelectedTask} />
        <div className="wu-top-actions">
          <NotificationInbox token={token} workspaceId={workspaceId} showBadge={profile.notificationBadge} />
          <button className="wu-user-button wu-profile-trigger" type="button" aria-label={'Account menu for ' + profileName} popoverTarget="wu-profile-menu">
            {profileAvatar ? <img className="wu-avatar" src={profileAvatar} alt="" /> : <Avatar initials={profileInitials} tone="blue" preview={false} />}
          </button>
          <div id="wu-profile-menu" popover="auto" className="wu-profile-menu" aria-label="Account">
            <div className="wu-profile-identity">
              {profileAvatar ? <img className="wu-avatar" src={profileAvatar} alt="" /> : <Avatar initials={profileInitials} tone="blue" preview={false} />}
              <div><strong>{profileName}</strong>{profileEmail && <span>{profileEmail}</span>}</div>
            </div>
            <div className="wu-profile-actions">
              <button type="button" onClick={() => openSettings('profile')}><UserRound size={17} aria-hidden="true" />Personal settings</button>
              <details className="wu-profile-theme">
                <summary><Contrast size={17} aria-hidden="true" />Theme <ChevronRight className="wu-profile-chevron" size={15} aria-hidden="true" /></summary>
                <fieldset className="wu-theme-picker">
                  <legend className="wu-visually-hidden">Theme</legend>
                  {(['light', 'dark', 'system'] as const).map(mode => <label key={mode} className="wu-theme-option" data-selected={theme === mode}>
                    <input type="radio" name="workspace-theme" checked={theme === mode} disabled={!profileId} onChange={() => void saveTheme(mode)} />
                    <span className={`wu-theme-preview wu-theme-preview--${mode}`} aria-hidden="true"><i /><b /></span>
                    <span>{mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'Match browser'}</span>
                  </label>)}
                </fieldset>
              </details>
            </div>
            <div className="wu-profile-actions wu-profile-footer">
              <button type="button" onClick={() => switchAccount()}><UsersRound size={17} aria-hidden="true" />Switch account</button>
              <button type="button" disabled={loggingOut} onClick={() => void logout()}><LogOut size={17} aria-hidden="true" />{loggingOut ? 'Logging out…' : 'Log out'}</button>
            </div>
          </div>
        </div>
      </header>
      <main className={page === 'chat' ? 'wu-page wu-page--chat' : 'wu-page'} id="main" data-archived={archived || undefined} aria-label={page === 'chat' ? 'Chat' : undefined}>
        {archived && <div className="wu-archive-banner" role="status"><Archive size={17} aria-hidden="true" /><span>Archived workspace</span>
          {workspace?.ownerId === profileId && (page !== 'settings' || settingsSection !== '#archive') && <button className="wu-text-button" type="button" onClick={() => navigate('settings', 'archive')}>Restore options</button>}</div>}
        {renderPage()}
      </main>
    </div>
    {workspace && selectedTask && <TaskDetails key={selectedTask.id + (archived ? '-archived' : '')} task={selectedTask} tasks={tasks} members={members.items ?? []}
      readOnly={archived}
      projectSection={<TaskProjectField taskId={selectedTask.id} projects={projects.items} error={projects.error} retry={projects.retry}
        path={projectsPath} token={token} readOnly={archived} openProject={id => navigate('projects', 'project-' + id)} />}
      token={token} profileId={profileId} onClose={() => setSelectedTask(null)} onChange={() => setBoardAttempt(value => value + 1)}
      files={(workspaceFiles.items ?? []).filter(file => file.taskId === selectedTask.id)} boardColumns={boardColumns}
      openTask={openRelatedTask} openFile={file => navigate('files', 'file-' + file.id)}
      onBack={history.state?.fromTask ? () => history.back() : undefined} />}
    {!archived && modal && <div className="wu-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !submittingModal.current) setModal(null); }}><section className="wu-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="wu-modal-head"><div><h2 id="modal-title">{modal === 'task' ? 'Create a task' : 'Invite a team member'}</h2><p>{modal === 'task' ? 'Add a piece of work to the workspace backlog.' : 'Send an invitation to collaborate in this workspace.'}</p></div><button className="wu-icon-button" type="button" aria-label="Close dialog" disabled={taskSaving} onClick={() => setModal(null)}><X size={18} /></button></div>{modal === 'task' ? <form onSubmit={submitTask}>
      <label className="wu-field-label">Task title<input autoFocus name="title" placeholder="What needs to get done?" required maxLength={200} readOnly={taskSaving} /></label>
      <label className="wu-field-label">Description<textarea name="description" rows={3} placeholder="Add details for your team" readOnly={taskSaving} /></label>
      <div className="wu-task-create-fields">
      <label className="wu-field-label">Assignee<select name="assigneeId" disabled={taskSaving}>
        <option value="">Unassigned</option>
        {(members.items ?? []).map(member => <option key={member.userId} value={member.userId}>{member.username}</option>)}
      </select></label>
      <label className="wu-field-label">Priority<select name="priority" disabled={taskSaving}>
        <option value="">No priority</option>
        {Object.entries(taskPriorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label className="wu-field-label">Due date<input name="dueDate" type="date" min="1000-01-01" max="9999-12-31" readOnly={taskSaving} /></label>
      </div>
      {taskError && <p role="alert">{taskError}</p>}
      <div className="wu-modal-actions">
        <button className="wu-button wu-button--secondary" type="button" disabled={taskSaving} onClick={() => setModal(null)}>Cancel</button>
        <button className="wu-button wu-button--primary" type="submit" disabled={taskSaving}><Plus size={15} />{taskSaving ? 'Creating…' : 'Create task'}</button>
      </div>
    </form> : <form onSubmit={submitInvite}>
      <label className="wu-field-label">Email address
        <input autoFocus name="email" type="email" placeholder="name@company.com" required readOnly={taskSaving}
          aria-describedby="invite-email-help" />
      </label>
      <p id="invite-email-help" className="wu-muted">They can sign in or create an account with this email. The invitation expires in seven days.</p>
      {taskError && <p role="alert">{taskError}</p>}
      <div className="wu-modal-actions">
        <button className="wu-button wu-button--secondary" type="button" disabled={taskSaving} onClick={() => setModal(null)}>Cancel</button>
        <button className="wu-button wu-button--primary" type="submit" disabled={taskSaving}><Plus size={15} />{taskSaving ? 'Sending…' : 'Invite member'}</button>
      </div>
    </form>}</section></div>}
    {toast && <div className="wu-toast" role="status"><CheckCircle2 size={17} />{toast}<button type="button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15} /></button></div>}
  </div>;
}
