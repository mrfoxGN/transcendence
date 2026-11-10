import { useEffect, useState, type FormEvent } from 'react';
import { Check, Users } from 'lucide-react';
import { FilterChips, Panel } from '../components';
import { Drawer } from '../WorkspaceControls';
import { jsonRequest, workspaceRequest } from '../workspace-api';
import type { PageHeading, PageKey } from '../types';
import './settings.css';

export type WorkspaceProfile = { name: string; description: string | null; ownerId: string; archivedAt: string | null };
type KanbanSettings = { activeWipLimit: number; definitionOfReady: unknown; definitionOfDone: unknown };

function definitionText(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value, null, 2);
}

export function SettingsPage({ pageHeading, workspace, ownerName, profileId, profileName, token, path, navigate, onWorkspace, onBoard, onProfile }: {
  pageHeading: PageHeading; workspace: WorkspaceProfile; ownerName?: string; profileId: string; profileName: string;
  token: string | null; path: string; navigate: (page: PageKey) => void;
  onWorkspace: (workspace: WorkspaceProfile) => void; onBoard: () => void; onProfile: (name: string) => void;
}) {
  const [tab, setTab] = useState('General');
  const [settings, setSettings] = useState<KanbanSettings>();
  const [attempt, setAttempt] = useState(0);
  const [settingsError, setSettingsError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const isOwner = workspace.ownerId === profileId;

  useEffect(() => {
    if (!token || tab !== 'Board settings') return;
    const controller = new AbortController();
    void workspaceRequest(path + '/kanban-settings', token, { signal: controller.signal })
      .then(response => response.json())
      .then(result => { if (!controller.signal.aborted) setSettings(result); })
      .catch(error => { if (!controller.signal.aborted) setSettingsError(error.message); });
    return () => controller.abort();
  }, [token, path, tab, attempt]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || busy || (tab !== 'Profile' && !isOwner)) return;
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (tab === 'General') {
        const response = await workspaceRequest(path, token, jsonRequest('PATCH', { name: String(values.get('name')).trim(), description: String(values.get('description')).trim() }));
        onWorkspace(await response.json());
      } else if (tab === 'Board settings' && settings) {
        const patch: Record<string, unknown> = { activeWipLimit: Number(values.get('limit')) };
        for (const key of ['definitionOfReady', 'definitionOfDone'] as const) {
          const value = String(values.get(key)).trim();
          if (value !== definitionText(settings[key]).trim()) patch[key] = value;
        }
        const response = await workspaceRequest(path + '/kanban-settings', token, jsonRequest('PATCH', patch));
        setSettings(await response.json());
        onBoard();
      } else if (tab === 'Profile') {
        const response = await workspaceRequest('users/' + profileId, token, jsonRequest('PATCH', { username: String(values.get('username')).trim() }));
        onProfile((await response.json()).username);
      }
      setNotice('Changes saved.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save changes.');
    } finally {
      setBusy(false);
    }
  }

  async function changeArchive() {
    if (!token || busy || !isOwner) return;
    setBusy(true);
    setError('');
    try {
      const response = await workspaceRequest(path + (workspace.archivedAt ? '/unarchive' : '/archive'), token, { method: 'PATCH' });
      onWorkspace(await response.json());
      setConfirm(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update the workspace.');
    } finally {
      setBusy(false);
    }
  }

  const editable = tab === 'Profile' ? !!profileId : isOwner;
  return <>
    {pageHeading(editable && (tab !== 'Board settings' || settings) && <button className="wu-button wu-button--primary" type="submit" form="workspace-settings-form" disabled={busy}><Check size={15} />Save changes</button>)}
    <FilterChips items={['General', 'Board settings', 'Profile']} active={tab} onChange={value => { setTab(value); setError(''); setNotice(''); }} />
    <Panel className="wu-settings-panel">
      {error && !confirm && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      <form key={tab} id="workspace-settings-form" className="wu-settings-form" onSubmit={save}>
        {tab === 'General' && <>
          <h2>Workspace profile</h2>
          <label className="wu-field-label">Name<input name="name" defaultValue={workspace.name} required readOnly={!editable} /></label>
          <label className="wu-field-label">Description<textarea name="description" defaultValue={workspace.description ?? ''} rows={3} readOnly={!editable} /></label>
          <div className="wu-readonly-field"><span>Owner</span><strong>{ownerName ?? 'Workspace owner'}</strong></div>
        </>}
        {tab === 'Board settings' && <>
          <h2>Board settings</h2>
          {settingsError ? <p role="alert">{settingsError} <button type="button" onClick={() => { setSettingsError(''); setAttempt(value => value + 1); }}>Retry</button></p>
            : !settings ? <p role="status">Loading board settings…</p>
            : <>
              <label className="wu-field-label">Active work limit<input name="limit" type="number" min={1} required defaultValue={settings.activeWipLimit} readOnly={!editable} /></label>
              <p className="wu-muted">The limit includes In progress and Review.</p>
              <label className="wu-field-label">Definition of ready<textarea name="definitionOfReady" rows={3} defaultValue={definitionText(settings.definitionOfReady)} readOnly={!editable} /></label>
              <label className="wu-field-label">Definition of done<textarea name="definitionOfDone" rows={3} defaultValue={definitionText(settings.definitionOfDone)} readOnly={!editable} /></label>
            </>}
        </>}
        {tab === 'Profile' && <><h2>Your profile</h2><label className="wu-field-label">Username<input name="username" defaultValue={profileName} required /></label></>}
      </form>
      {tab === 'General' && <><hr /><button className="wu-button wu-button--secondary" type="button" onClick={() => navigate('team')}><Users size={15} />Manage members</button>
        {isOwner && <button className="wu-text-button" type="button" onClick={() => { setError(''); setConfirm(true); }}>{workspace.archivedAt ? 'Restore workspace' : 'Archive workspace'}</button>}</>}
    </Panel>
    {confirm && <Drawer title={workspace.archivedAt ? 'Restore workspace?' : 'Archive workspace?'} confirmation onClose={() => setConfirm(false)}>
      {error && <p role="alert">{error}</p>}
      <div className="wu-modal-actions"><button className="wu-button wu-button--secondary" autoFocus disabled={busy} onClick={() => setConfirm(false)}>Cancel</button>
        <button className="wu-button wu-button--primary" disabled={busy} onClick={() => void changeArchive()}>{workspace.archivedAt ? 'Restore' : 'Archive'}</button></div>
    </Drawer>}
  </>;
}
