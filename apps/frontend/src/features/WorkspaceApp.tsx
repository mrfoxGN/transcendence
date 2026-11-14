import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Activity, BarChart3, CheckCircle2, Files, GitBranch, Home, LayoutGrid, List, MessageCircle, Moon, Plus, Settings, StickyNote, Sun, Users, X } from 'lucide-react';
import { sessionKey } from './WorkspacePicker';
import './workspace-app.css';
import { Avatar, Pill } from './workspace/components';
import { WorkspaceSwitcher } from './workspace/WorkspaceSwitcher';
import { WorkspaceCommand } from './workspace/WorkspaceCommand';
import { NotificationInbox } from './workspace/NotificationInbox';
import { Drawer } from './workspace/WorkspaceControls';
import { TaskFacets, emptyFacets, matchesTaskFacets } from './workspace/TaskFacets';
import { homeFilters, seedTasks, taskStatuses } from './workspace/previewData';
import { useWorkspaceCollection, type WorkspaceFile } from './workspace/workspace-api';
import type { GithubState, PageKey, Task } from './workspace/types';
import { initialChatThreads } from './workspace/chatPreview';
import { HomePage } from './workspace/pages/HomePage';
import { BacklogPage } from './workspace/pages/BacklogPage';
import { BoardPage } from './workspace/pages/BoardPage';
import { GithubPage } from './workspace/pages/GithubPage';
import { ActivityPage } from './workspace/pages/ActivityPage';
import { TeamPage } from './workspace/pages/TeamPage';
import { ChatPage } from './workspace/pages/ChatPage';
import { FilesPage } from './workspace/pages/FilesPage';
import { NotesPage } from './workspace/pages/NotesPage';
import { AnalyticsPage } from './workspace/pages/AnalyticsPage';
import { SettingsPage } from './workspace/pages/SettingsPage';

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
  const [workspaceName, setWorkspaceName] = useState('Studio North');
  const [profileName, setProfileName] = useState('Alex Morgan');
  const profileInitials = profileName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const [tasks, setTasks] = useState(seedTasks);
  const [columns, setColumns] = useState(taskStatuses);
  const [newTaskColumn, setNewTaskColumn] = useState('');
  const [filter, setFilter] = useState('All tasks');
  const [facets, setFacets] = useState(emptyFacets);
  const [homeFilter, setHomeFilter] = useState(homeFilters[0]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modal, setModal] = useState<'task' | 'invite' | null>(null);
  const [toast, setToast] = useState('');
  const [githubTab, setGithubTab] = useState('Repository');
  const [githubState, setGithubState] = useState<GithubState>('connected');
  const [activityFilterOpen, setActivityFilterOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState('All activity');
  const [chatThreads, setChatThreads] = useState(initialChatThreads);
  const workspacePath = 'workspaces/' + encodeURIComponent(workspaceId);
  const filePath = workspacePath + '/files';
  const workspaceFiles = useWorkspaceCollection<WorkspaceFile>(filePath, token);
  const [settingsTab, setSettingsTab] = useState('General');
  const [analyticsPeriod, setAnalyticsPeriod] = useState('Last 30 days');

  useEffect(() => {
    if (!token) { window.location.replace('/login'); return; }
    const controller = new AbortController();
    void fetch('/api/auth/profile', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => {
        if (response.status === 401) { sessionStorage.removeItem(sessionKey); window.location.replace('/login'); return; }
        if (!response.ok) return;
        const profile = await response.json() as { username?: string };
        if (profile.username) setProfileName(profile.username);
      }).catch(() => {});
    void fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => { if (response.ok) { const workspace = await response.json() as { name?: string }; if (workspace.name) setWorkspaceName(workspace.name); } })
      .catch(() => {});
    return () => controller.abort();
  }, [token, workspaceId]);

  useEffect(() => {
    document.title = `${navigation.find(item => item.key === page)?.label ?? 'Home'} · DevUP`;
    const onPop = () => setPage(getPageFromUrl());
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
    if (filter === 'My tasks') result = result.filter(task => task.initials === 'AM');
    if (filter === 'Due this week') result = result.filter(task => ['Apr 12', 'Apr 14', 'Apr 16', 'Apr 17'].includes(task.due));
    if (filter === 'Blocked') result = result.filter(task => task.isBlocked && task.status !== 'Done');
    return result.filter(task => matchesTaskFacets(task, facets));
  }, [filter, facets, tasks]);

  const taskFacets = <TaskFacets tasks={tasks} value={facets} onChange={setFacets} />;

  function navigate(next: PageKey, section = '') {
    setPage(next);
    setFilter('All tasks');
    if (section === 'board-review') setFacets(emptyFacets);
    const url = new URL(window.location.href);
    url.searchParams.set('page', next);
    url.hash = section;
    window.history.pushState({ page: next }, '', url);
  }

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') ?? '').trim();
    if (!title) return;
    const status = columns.includes(newTaskColumn) ? newTaskColumn : columns.includes('To do') ? 'To do' : columns[0];
    if (status === 'In progress' && tasks.filter(task => task.status === status).length >= 3) {
      setToast('In progress is full. Move a task out before adding another.');
      return;
    }
    const task: Task = { id: `DEV-${40 + tasks.length}`, title, status, type: String(form.get('type') ?? 'Feature'), person: profileName, initials: 'AM', due: 'Apr 20', priority: 'Medium', description: String(form.get('description') ?? '').trim() || 'A new task added to this workspace.' };
    setTasks(current => [task, ...current]);
    setModal(null);
    setToast(`Task added to ${status}.`);
  }

  function moveBoardTask(id: string, status: string) {
    const task = tasks.find(item => item.id === id);
    if (!task || task.status === status || !columns.includes(status)) return;
    if (status === 'In progress' && tasks.filter(item => item.status === status).length >= 3) {
      setToast('In progress is full. Move a task out before adding another.');
      return;
    }
    setTasks(current => [...current.filter(item => item.id !== id), { ...task, status }]);
    setToast(`Moved ${task.id} to ${status}.`);
  }

  function addBoardColumn(name: string) {
    if (!name || columns.some(column => column.toLowerCase() === name.toLowerCase())) return 'Enter a unique column name.';
    const defaultName = taskStatuses.find(column => column.toLowerCase() === name.toLowerCase());
    setColumns(current => [...current, defaultName ?? name]);
  }

  function removeBoardColumn(status: string, destination: string) {
    const affected = tasks.filter(task => task.status === status).length;
    if (columns.length <= 1) return 'Keep at least one column.';
    if (affected && (!columns.includes(destination) || destination === status)) return 'Choose a column for the tasks.';
    if (destination === 'In progress' && affected + tasks.filter(task => task.status === destination).length > 3) {
      return 'In progress can hold up to three tasks. Choose another column.';
    }
    setTasks(current => current.map(task => task.status === status ? { ...task, status: destination } : task));
    setColumns(current => current.filter(column => column !== status));
  }

  function addTaskButton(label = 'New task') {
    return <button className="wu-button wu-button--primary" type="button" onClick={() => { setNewTaskColumn(''); setModal('task'); }}><Plus size={16} />{label}</button>;
  }

  function pageHeading(action?: ReactNode) {
    return <header className="wu-page-heading">
      <h1>{pageLabel}</h1>
      {action && <div className="wu-page-action">{action}</div>}
    </header>;
  }

  function taskView(task: Task) {
    return <Drawer title={task.title} onClose={() => setSelectedTask(null)}>
      <span className="wu-task-id">{task.id}</span><p className="wu-muted">{task.description}</p>
      <div className="wu-detail-grid"><div><span>Status</span><Pill tone="blue">{task.status}</Pill></div><div><span>Priority</span><strong>{task.priority}</strong></div><div><span>Assignee</span><span className="wu-person"><Avatar initials={task.initials} small />{task.person}</span></div><div><span>Due date</span><strong>{task.due}</strong></div></div>
      <div className="wu-drawer-section"><h3>Acceptance criteria</h3><label className="wu-check-row"><input type="checkbox" /> Login works on mobile widths</label><label className="wu-check-row"><input type="checkbox" /> Errors are clear and placed near the field</label></div>
      <div className="wu-drawer-section"><h3>Activity</h3><p className="wu-muted">Sarah Kim moved this task to {task.status} · Today</p></div>
      <button className="wu-button wu-button--secondary" type="button" onClick={() => { setSelectedTask(null); navigate('chat'); }}>Open discussion</button>
    </Drawer>;
  }

  function renderPage() {
    switch (page) {
      case 'home': return (
        <HomePage
          pageHeading={pageHeading}
          columns={columns}
          tasks={tasks}
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
          onAddTask={() => { setNewTaskColumn(''); setModal('task'); }}
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
          activeCount={tasks.filter(task => task.status === 'In progress').length}
          columns={columns}
          allTasks={tasks}
          onAddColumn={addBoardColumn}
          onRemoveColumn={removeBoardColumn}
          onMoveTask={moveBoardTask}
          setSelectedTask={setSelectedTask}
          onAddTask={status => { setNewTaskColumn(status); setModal('task'); }}
          addTaskButton={addTaskButton}
        />
      );
      case 'github': return (
        <GithubPage
          pageHeading={pageHeading}
          githubTab={githubTab}
          setGithubTab={setGithubTab}
          githubState={githubState}
          setGithubState={setGithubState}
          setToast={setToast}
        />
      );
      case 'activity': return (
        <ActivityPage
          pageHeading={pageHeading}
          activityFilter={activityFilter}
          setActivityFilter={setActivityFilter}
          activityFilterOpen={activityFilterOpen}
          setActivityFilterOpen={setActivityFilterOpen}
        />
      );
      case 'team': return (
        <TeamPage
          pageHeading={pageHeading}
          setToast={setToast}
          workspaceName={workspaceName}
          onInvite={() => setModal('invite')}
        />
      );
      case 'chat': return (
        <ChatPage
          profileName={profileName}
          threads={chatThreads}
          setThreads={setChatThreads}
          files={workspaceFiles.items}
          navigate={navigate}
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
          onUpload={file => workspaceFiles.setItems(current => [file, ...(current ?? [])])}
        />
      );
      case 'notes': return (
        <NotesPage
          pageHeading={pageHeading}
          path={workspacePath + '/notes'}
          token={token}
        />
      );
      case 'analytics': return (
        <AnalyticsPage
          pageHeading={pageHeading}
          analyticsPeriod={analyticsPeriod}
          setAnalyticsPeriod={setAnalyticsPeriod}
        />
      );
      case 'settings': return (
        <SettingsPage
          pageHeading={pageHeading}
          settingsTab={settingsTab}
          setSettingsTab={setSettingsTab}
          workspaceName={workspaceName}
          setWorkspaceName={setWorkspaceName}
          profileName={profileName}
          navigate={navigate}
          setToast={setToast}
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
        <div className="wu-top-actions"><NotificationInbox token={token} /><button className="wu-theme-button" type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button><button className="wu-user-button" type="button" aria-label={"Profile: " + profileName} onClick={() => setToast(`${profileName} · Workspace member`)}><Avatar initials={profileInitials} tone="mint" preview={profileName === 'Alex Morgan'} /><span><strong>{profileName}</strong><small>Workspace member</small></span></button></div>
      </header>
      <main className={page === 'chat' ? 'wu-page wu-page--chat' : 'wu-page'} id="main" aria-label={page === 'chat' ? 'Chat' : undefined}>{renderPage()}</main>
    </div>
    {selectedTask && taskView(selectedTask)}
    {modal && <div className="wu-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null); }}><section className="wu-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="wu-modal-head"><div><h2 id="modal-title">{modal === 'task' ? 'Create a task' : 'Invite a team member'}</h2><p>{modal === 'task' ? 'Add a piece of work to the workspace backlog.' : 'Send an invitation to collaborate in this workspace.'}</p></div><button className="wu-icon-button" type="button" aria-label="Close dialog" onClick={() => setModal(null)}><X size={18} /></button></div>{modal === 'task' ? <form onSubmit={submitTask}><label className="wu-field-label">Task title<input autoFocus name="title" placeholder="What needs to get done?" required /></label><label className="wu-field-label">Type<select name="type"><option>Feature</option><option>Bug fix</option><option>Docs</option><option>Tech debt</option></select></label><label className="wu-field-label">Description<textarea name="description" rows={3} placeholder="Add details for your team" /></label><div className="wu-modal-actions"><button className="wu-button wu-button--secondary" type="button" onClick={() => setModal(null)}>Cancel</button><button className="wu-button wu-button--primary" type="submit"><Plus size={15} />Create task</button></div></form> : <form onSubmit={event => { event.preventDefault(); setModal(null); setToast('Invitation prepared.'); }}><label className="wu-field-label">Email address<input autoFocus name="email" type="email" placeholder="name@company.com" required /></label><label className="wu-field-label">Role<select defaultValue="Member"><option>Member</option><option>Admin</option></select></label><p className="wu-muted">Invited people can view workspace activity and collaborate on tasks.</p><div className="wu-modal-actions"><button className="wu-button wu-button--secondary" type="button" onClick={() => setModal(null)}>Cancel</button><button className="wu-button wu-button--primary" type="submit"><Plus size={15} />Invite member</button></div></form>}</section></div>}
    {toast && <div className="wu-toast" role="status"><CheckCircle2 size={17} />{toast}<button type="button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15} /></button></div>}
  </div>;
}
