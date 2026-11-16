import { useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react';
import { Panel, Pill } from '../components';
import { ActionMenu, Drawer, LoadingPanel } from '../WorkspaceControls';
import { jsonRequest, workspaceRequest } from '../workspace-api';
import { formatCalendarDate } from '../workspace-calendar';
import { statusLabels, type Member } from '../workspace-tasks';
import { linkProjectTask, projectStatusLabels, type Milestone, type Project, type ProjectProgress, type ProjectTask } from '../workspace-projects';
import type { PageHeading, Task } from '../types';
import './projects.css';

type Editor = { kind: 'project'; item?: Project } | { kind: 'milestone'; item?: Milestone };
type Removal = { name: string; path: string; project: boolean };

function targetLabel(date: string | null) {
  return date ? formatCalendarDate(date, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No target date';
}

function Progress({ progress, label }: { progress: ProjectProgress; label: string }) {
  return <span className="wu-project-progress">
    <progress aria-label={label} max={progress.total || 1} value={progress.done} />
    <span>{progress.total ? progress.done + ' of ' + progress.total + ' tasks done' : 'No tasks counted toward progress'}</span>
  </span>;
}

function TaskList({ tasks, onOpenTask }: { tasks: ProjectTask[]; onOpenTask: (id: string) => void }) {
  if (!tasks.length) return <p className="wu-muted">No linked tasks.</p>;
  return <ul className="wu-project-task-list">{tasks.map(task => <li key={task.id}>
    <button type="button" className="wu-project-task" onClick={() => onOpenTask(task.id)}>
      <span>{task.taskNumber ? <small>TASK-{task.taskNumber}</small> : null}<strong>{task.title}</strong></span>
      <Pill>{statusLabels[task.status]}</Pill>
    </button>
  </li>)}</ul>;
}

export function ProjectsPage({ pageHeading, projects, failed, retry, projectId, onProject, onOpenTask, tasks, members, profileId, path, token, readOnly }: {
  pageHeading: PageHeading; projects?: Project[]; failed: boolean; retry: () => void;
  projectId: string | null; onProject: (id?: string) => void; onOpenTask: (id: string) => void;
  tasks: Task[]; members: Member[]; profileId: string; path: string; token: string | null; readOnly: boolean;
}) {
  const [editor, setEditor] = useState<Editor>();
  const [removal, setRemoval] = useState<Removal>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [taskSelection, setTaskSelection] = useState('');
  const [milestoneSelection, setMilestoneSelection] = useState('');
  const saving = useRef(false);
  const project = projects?.find(item => item.id === projectId);
  const linked = new Set(projects?.flatMap(item => item.tasks.map(task => task.id)));
  const available = tasks.filter(task => !linked.has(task.id));
  const owner = (id: string | null) => members.find(member => member.userId === id)?.username ?? (id ? 'Workspace member' : 'Unassigned');

  async function perform(action: () => Promise<void>) {
    if (readOnly || saving.current || !token) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      retry();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save the change.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  function edit(next: Editor) { setError(''); setEditor(next); }
  function remove(next: Removal) { setError(''); setRemoval(next); }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const fields = new FormData(event.currentTarget);
    const name = String(fields.get('name') ?? '').trim();
    if (!name) { setError('Enter a name.'); return; }
    const common = { name, targetDate: fields.get('targetDate') || null };
    const isProject = editor.kind === 'project';
    if (!isProject && !project) return;
    const route = isProject ? path : path + '/' + project?.id + '/milestones';
    const body = isProject ? { ...common, status: fields.get('status'), ownerId: fields.get('ownerId') || null } : common;
    void perform(async () => {
      await workspaceRequest(route + (editor.item ? '/' + editor.item.id : ''), token, jsonRequest(editor.item ? 'PUT' : 'POST', body));
      setEditor(undefined);
    });
  }

  return <>
    {pageHeading(!readOnly && (!projectId || project) && <button type="button" className="wu-button wu-button--primary" disabled={busy} onClick={() => edit({ kind: project ? 'milestone' : 'project' })}>
      <Plus size={16} aria-hidden="true" />{project ? 'New milestone' : 'New project'}
    </button>)}
    {failed ? <Panel className="wu-project-panel"><p role="alert">Could not load projects. <button className="wu-text-button" type="button" onClick={retry}>Try again</button></p></Panel>
      : !projects ? <LoadingPanel label="Loading projects" />
      : projectId ? <>
        <button className="wu-text-button wu-project-back" type="button" onClick={() => onProject()}><ArrowLeft size={15} aria-hidden="true" />All projects</button>
        {project ? <>
          <Panel className="wu-project-panel wu-project-overview">
            <div className="wu-panel-heading">
              <h2>{project.name}</h2>
              <div className="wu-project-actions"><Pill tone={project.status === 'completed' ? 'green' : 'blue'}>{projectStatusLabels[project.status]}</Pill>
                {!readOnly && <ActionMenu label="Project actions" actions={[
                  { label: 'Edit project', disabled: busy, run: () => edit({ kind: 'project', item: project }) },
                  { label: 'Delete project', disabled: busy, run: () => remove({ name: project.name, path: path + '/' + project.id, project: true }) },
                ]} />}
              </div>
            </div>
            <p className="wu-muted">Owner {owner(project.ownerId)} · {targetLabel(project.targetDate)}</p>
            <Progress progress={project.progress} label="Project progress" />
            <p className="wu-muted">Progress counts linked tasks and excludes cancelled tasks.</p>
          </Panel>
          {!readOnly && !!available.length && <Panel className="wu-project-panel">
            <h2>Link a task</h2>
            <form className="wu-project-link-form" onSubmit={event => {
              event.preventDefault();
              if (!taskSelection) return;
              void perform(async () => {
                const milestoneId = project.milestones.find(item => item.id === milestoneSelection)?.id ?? null;
                await linkProjectTask(path, token, taskSelection, project.id, milestoneId, true);
                setTaskSelection('');
              });
            }}>
              <label className="wu-field-label">Task<select required value={taskSelection} onChange={event => setTaskSelection(event.target.value)}>
                <option value="">Choose an ungrouped task</option>{available.map(task => <option key={task.id} value={task.id}>{task.taskKey ? task.taskKey + ' · ' : ''}{task.title}</option>)}
              </select></label>
              {!!project.milestones.length && <label className="wu-field-label">Milestone<select value={milestoneSelection} onChange={event => setMilestoneSelection(event.target.value)}>
                <option value="">No milestone</option>{project.milestones.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select></label>}
              <button type="submit" className="wu-button wu-button--secondary" disabled={busy || !taskSelection}>Link task</button>
            </form>
          </Panel>}
          {!editor && !removal && error && <p role="alert">{error}</p>}
          <Panel className="wu-project-panel">
            <h2>Milestones</h2>
            {!project.milestones.length && <p className="wu-muted">No milestones yet.</p>}
            {project.milestones.map(item => <section key={item.id} className="wu-project-milestone">
              <div className="wu-panel-heading"><div><h3>{item.name}</h3><p>{targetLabel(item.targetDate)}</p></div>
                {!readOnly && <ActionMenu label={'Actions for ' + item.name} actions={[
                  { label: 'Edit milestone', disabled: busy, run: () => edit({ kind: 'milestone', item }) },
                  { label: 'Delete milestone', disabled: busy, run: () => remove({ name: item.name, path: path + '/' + project.id + '/milestones/' + item.id, project: false }) },
                ]} />}
              </div>
              <Progress progress={item.progress} label={item.name + ' progress'} />
              <TaskList tasks={project.tasks.filter(task => task.milestoneId === item.id)} onOpenTask={onOpenTask} />
            </section>)}
          </Panel>
          <Panel className="wu-project-panel"><h2>Tasks without a milestone</h2>
            <TaskList tasks={project.tasks.filter(task => !task.milestoneId)} onOpenTask={onOpenTask} />
          </Panel>
        </> : <Panel className="wu-project-panel"><p role="status">This project is unavailable.</p></Panel>}
      </> : projects.length ? <ul className="wu-project-grid">{projects.map(item => <li key={item.id}>
        <button type="button" className="wu-panel wu-project-card" onClick={() => onProject(item.id)}>
          <span className="wu-project-card-heading"><strong>{item.name}</strong><ArrowRight size={17} aria-hidden="true" /></span>
          <span className="wu-muted">{projectStatusLabels[item.status]} · {targetLabel(item.targetDate)}</span>
          <Progress progress={item.progress} label={item.name + ' progress'} />
        </button>
      </li>)}</ul> : <Panel className="wu-project-panel"><h2>No projects yet</h2>
        <p className="wu-muted">{readOnly ? 'This workspace has no projects.' : 'Create a project to group tasks and track milestones.'}</p>
      </Panel>}
    {!readOnly && editor && <Drawer title={(editor.item ? 'Edit ' : 'New ') + editor.kind} closeDisabled={busy} onClose={() => setEditor(undefined)}>
      <form className="wu-project-form" onSubmit={save}>
        <label className="wu-field-label">Name<input name="name" required maxLength={120} defaultValue={editor.item?.name} placeholder={editor.kind === 'project' ? 'e.g. Workspace onboarding' : 'e.g. Release candidate'} /></label>
        <label className="wu-field-label">Target date<input name="targetDate" type="date" min="1000-01-01" max="9999-12-31" defaultValue={editor.item?.targetDate ?? ''} /></label>
        {editor.kind === 'project' && <>
          <label className="wu-field-label">Owner<select name="ownerId" defaultValue={editor.item ? editor.item.ownerId ?? '' : profileId}>
            <option value="">Unassigned</option>{members.map(member => <option key={member.userId} value={member.userId}>{member.username}</option>)}
          </select></label>
          <label className="wu-field-label">Status<select name="status" defaultValue={editor.item?.status ?? 'planned'}>
            {Object.entries(projectStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
        </>}
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="wu-button wu-button--primary" disabled={busy}>{busy ? 'Saving…' : editor.item ? 'Save changes' : 'Create ' + editor.kind}</button>
      </form>
    </Drawer>}
    {!readOnly && removal && <Drawer title={'Delete ' + removal.name + '?'} confirmation closeDisabled={busy} onClose={() => setRemoval(undefined)}>
      <p>{removal.project ? 'Its tasks will remain in the workspace as ungrouped tasks.' : 'Its tasks will stay in the project without a milestone.'}</p>
      {error && <p role="alert">{error}</p>}
      <div className="wu-modal-actions">
        <button type="button" className="wu-button wu-button--secondary" disabled={busy} onClick={() => setRemoval(undefined)}>Cancel</button>
        <button type="button" className="wu-button wu-button--primary" disabled={busy} onClick={() => void perform(async () => {
          await workspaceRequest(removal.path, token, { method: 'DELETE' });
          setRemoval(undefined);
          if (removal.project) onProject();
        })}>Delete</button>
      </div>
    </Drawer>}
  </>;
}
