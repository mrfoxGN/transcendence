import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { WorkspaceIllustration } from '../WorkspaceIllustration';
import { EmptyState, Panel, TaskTable } from '../components';
import { TaskFacets, emptyFacets, matchesTaskFacets, type Facets } from '../TaskFacets';
import { jsonRequest, useWorkspaceCollection, workspaceRequest } from '../workspace-api';
import { isOpenTask } from '../workspace-calendar';
import type { PageHeading, Task, AddTaskButton } from '../types';

type BacklogView = {
  scope: 'backlog' | 'all' | 'review';
  sort: 'manual' | 'priority' | 'due';
  mine: boolean;
  blocked: boolean;
  search: string;
  facets: Facets;
};
type SavedView = { name: string; view: BacklogView };
const defaultView: BacklogView = { scope: 'backlog', sort: 'manual', mine: false, blocked: false, search: '', facets: emptyFacets };
const presets: SavedView[] = [
  { name: 'All backlog tasks', view: defaultView },
  { name: 'My work', view: { ...defaultView, scope: 'all', mine: true } },
  { name: 'Needs review', view: { ...defaultView, scope: 'review' } },
  { name: 'Blocked', view: { ...defaultView, scope: 'all', blocked: true } },
];
const priorityOrder: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

function readView(key: string): BacklogView {
  try {
    const data = JSON.parse(localStorage.getItem(key) ?? 'null');
    return { ...defaultView, ...data?.view };
  } catch {
    return defaultView;
  }
}

type BacklogPageProps = {
  pageHeading: PageHeading;
  storageKey: string;
  viewsPath: string;
  token: string | null;
  tasks: Task[];
  profileId: string;
  today: string;
  nextSevenDaysEnd: string;
  setSelectedTask: (task: Task) => void;
  onAddTask: () => void;
  addTaskButton: AddTaskButton;
  readOnly?: boolean;
};

export function BacklogPage({
  pageHeading, storageKey, viewsPath, token, tasks, profileId, today, nextSevenDaysEnd, setSelectedTask, onAddTask, addTaskButton, readOnly = false,
}: BacklogPageProps) {
  const [view, setView] = useState(() => readView(storageKey));
  const savedViews = useWorkspaceCollection<SavedView>(viewsPath, token);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [viewName, setViewName] = useState('');
  const [storageError, setStorageError] = useState(false);
  const update = (patch: Partial<BacklogView>) => setView(current => ({ ...current, ...patch }));

  useEffect(() => {
    if (!profileId) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ view }));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [profileId, storageKey, view]);

  const query = view.search.trim().toLowerCase();
  const backlogTasks = tasks.filter(task =>
    (view.scope === 'all' || (view.scope === 'review' ? task.status === 'Review' : ['To do', 'Ready'].includes(task.status))) &&
    (!view.mine || (task.assigneeId === profileId && isOpenTask(task))) &&
    (!view.blocked || (task.isBlocked && isOpenTask(task))) &&
    (task.title.toLowerCase().includes(query) || task.taskKey?.toLowerCase().includes(query)) &&
    matchesTaskFacets(task, view.facets, today, nextSevenDaysEnd)
  ).sort((a, b) => {
    if (view.sort === 'priority') return (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
    if (view.sort === 'due') return (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99');
    return (a.position ?? 0) - (b.position ?? 0);
  });
  const views = [...(savedViews.items ?? []), ...presets];
  const activeView = views.findIndex(item => {
    const { facets, ...configuration } = item.view;
    return Object.entries(configuration).every(([key, value]) => view[key as keyof BacklogView] === value)
      && facets.assignee === view.facets.assignee && facets.priority === view.facets.priority && facets.due === view.facets.due;
  });
  const hasFilters = !!(view.search || view.mine || view.blocked || view.scope !== 'backlog' || Object.values(view.facets).some(Boolean));

  function clearFilters() {
    update({ ...defaultView, sort: view.sort });
  }

  return <>
    {pageHeading(addTaskButton())}
    <Panel className="wu-list-panel">
      <div className="wu-task-toolbar wu-list-toolbar">
        <select className="wu-select" aria-label="Backlog view" value={activeView < 0 ? '' : activeView}
          onChange={event => update(views[Number(event.currentTarget.value)].view)}>
          <option value="" disabled>Custom view</option>
          {views.map((item, index) => <option key={index} value={index}>{item.name}</option>)}
        </select>
        <select className="wu-select" aria-label="Task scope" value={view.scope}
          onChange={event => update({ scope: event.currentTarget.value as BacklogView['scope'] })}>
          <option value="backlog">To do and Ready</option>
          <option value="all">All statuses</option>
          <option value="review">In review</option>
        </select>
        <label className="wu-list-search">
          <Search size={16} aria-hidden="true" />
          <input type="search" aria-label="Search backlog tasks" placeholder="Search by title or task ID" maxLength={200} value={view.search} onChange={event => update({ search: event.currentTarget.value })} />
        </label>
        <select className="wu-select" aria-label="Sort tasks" value={view.sort}
          onChange={event => update({ sort: event.currentTarget.value as BacklogView['sort'] })}>
          <option value="manual">Manual rank</option>
          <option value="priority">Highest priority</option>
          <option value="due">Earliest due date</option>
        </select>
        <TaskFacets tasks={tasks} value={view.facets} onChange={facets => update({ facets })} />
        {hasFilters && <button className="wu-text-button" type="button" onClick={clearFilters}>Clear filters</button>}
        <button className="wu-text-button" type="button" aria-expanded={showSaveForm} disabled={saving || !savedViews.items}
          onClick={() => { setSaveError(''); setShowSaveForm(value => !value); }}>Save view</button>
        <span className="wu-task-toolbar-counts" role="status">{backlogTasks.length} {backlogTasks.length === 1 ? 'task' : 'tasks'}</span>
      </div>
      {showSaveForm && <form className="wu-list-toolbar" onSubmit={async event => {
        event.preventDefault();
        const name = viewName.trim();
        if (!name || saving || !token) return;
        setSaving(true);
        setSaveError('');
        try {
          const response = await workspaceRequest(viewsPath, token, jsonRequest('POST', { name, view }));
          savedViews.setItems(await response.json() as SavedView[]);
          setViewName('');
          setShowSaveForm(false);
        } catch (error) {
          setSaveError(error instanceof Error ? error.message : 'Could not save the view. Try again.');
        } finally {
          setSaving(false);
        }
      }}>
        <label className="wu-list-search"><input aria-label="View name" placeholder="View name" maxLength={60} required autoFocus
          value={viewName} onChange={event => setViewName(event.currentTarget.value)} /></label>
        <button className="wu-button wu-button--secondary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </form>}
      {saveError && <p role="alert">{saveError}</p>}
      {savedViews.error && <p role="alert">Could not load saved views. <button className="wu-text-button" type="button" onClick={savedViews.retry}>Try again</button></p>}
      {storageError && <p role="alert">This browser could not remember your current filters.</p>}
      {backlogTasks.length > 0 ? <TaskTable items={backlogTasks} onSelect={setSelectedTask} />
        : readOnly && !hasFilters ? <p className="wu-muted">No tasks in this backlog.</p>
        : <EmptyState icon={<WorkspaceIllustration kind="checklist" />} title="No matching tasks"
          detail={hasFilters ? 'Change your filters to see more tasks.' : 'Add a task to your backlog.'}
          action={hasFilters ? 'Clear filters' : 'Add a task'} onAction={hasFilters ? clearFilters : onAddTask} />}
    </Panel>
  </>;
}
