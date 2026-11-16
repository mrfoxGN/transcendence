import { useRef, useState } from 'react';
import { linkProjectTask, type Project } from './workspace-projects';

export function TaskProjectField({ taskId, projects, error, retry, path, token, readOnly, openProject }: {
  taskId: string; projects?: Project[]; error: boolean; retry: () => void; path: string; token: string | null;
  readOnly: boolean; openProject: (id: string) => void;
}) {
  const project = projects?.find(item => item.tasks.some(task => task.id === taskId));
  const milestoneId = project?.tasks.find(task => task.id === taskId)?.milestoneId ?? null;
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const saving = useRef(false);

  async function save(projectId: string | null, milestoneId: string | null = null) {
    if (saving.current || readOnly) return;
    saving.current = true;
    setBusy(true);
    setSaveError('');
    try {
      await linkProjectTask(path, token, taskId, projectId, milestoneId);
      retry();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not update the project.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return <section className="wu-drawer-section">
    <h3>Project</h3>
    {error ? <p role="alert">Could not load projects. <button className="wu-text-button" type="button" onClick={retry}>Try again</button></p>
      : !projects ? <p role="status">Loading projects…</p>
      : <>
        {!readOnly && !!projects.length && <label className="wu-field-label">Linked project
          <select value={project?.id ?? ''} disabled={busy} onChange={event => void save(event.target.value || null)}>
            <option value="">No project</option>{projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>}
        {!project && (readOnly || !projects.length) && <p className="wu-muted">No linked project.</p>}
        {project && <>
          {!readOnly && !!project.milestones.length && <label className="wu-field-label">Milestone
            <select value={milestoneId ?? ''} disabled={busy} onChange={event => void save(project.id, event.target.value || null)}>
              <option value="">No milestone</option>{project.milestones.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>}
          {readOnly && milestoneId && <p>{project.milestones.find(item => item.id === milestoneId)?.name}</p>}
          <button className="wu-text-button" type="button" onClick={() => openProject(project.id)}>Open {project.name}</button>
        </>}
      </>}
    {saveError && <p role="alert">{saveError}</p>}
  </section>;
}
