import { useEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { finishInputEdit, saveTextOnBlur } from '../autosave';
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

export function SettingsPage({ pageHeading, workspace, ownerName, profileId, profileName, token, path, navigate, onWorkspace, onBoard, onProfile, initialTab = 'General' }: {
  pageHeading: PageHeading; workspace: WorkspaceProfile; ownerName?: string; profileId: string; profileName: string;
  token: string | null; path: string; navigate: (page: PageKey) => void;
  onWorkspace: (workspace: WorkspaceProfile) => void; onBoard: () => void; onProfile: (name: string) => void;
  initialTab?: 'General' | 'Profile';
}) {
  const [tab, setTab] = useState<string>(initialTab);
  const [settings, setSettings] = useState<KanbanSettings>();
  const [attempt, setAttempt] = useState(0);
  const [settingsError, setSettingsError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
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

  function save(key: string, value: string | number) {
    if (!token || (tab === 'Profile' ? !profileId : !isOwner)) return;
    pending.current += 1;
    setBusy(true);
    queue.current = queue.current.then(async () => {
      setError('');
      setNotice('');
      try {
        const target = tab === 'Profile' ? 'users/' + profileId : tab === 'Board settings' ? path + '/kanban-settings' : path;
        const response = await workspaceRequest(target, token, jsonRequest('PATCH', { [key]: value }));
        const result = await response.json();
        if (tab === 'Profile') onProfile(result.username);
        else if (tab === 'Board settings') { setSettings(result); onBoard(); }
        else onWorkspace(result);
        setNotice('Changes saved.');
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Could not save changes. Edit the field to retry.');
      } finally {
        pending.current -= 1;
        if (!pending.current) setBusy(false);
      }
    });
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
    {pageHeading((busy || notice) && <span className="wu-muted" role="status">{busy ? 'Saving…' : notice}</span>)}
    <FilterChips items={['General', 'Board settings', 'Profile']} active={tab} onChange={value => { setTab(value); setError(''); setNotice(''); }} />
    <Panel className="wu-settings-panel">
      {error && !confirm && <p role="alert">{error}</p>}
      <div key={tab} className="wu-settings-form">
        {tab === 'General' && <>
          <h2>Workspace profile</h2>
          <label className="wu-field-label">Name<input name="name" defaultValue={workspace.name} placeholder="e.g. Platform engineering" required maxLength={120} readOnly={!editable}
            onBlur={event => saveTextOnBlur(event, workspace.name, value => save('name', value))} onKeyDown={finishInputEdit} /></label>
          <label className="wu-field-label">Description<textarea name="description" defaultValue={workspace.description ?? ''} placeholder="What does this workspace organize?" rows={3} readOnly={!editable}
            onBlur={event => saveTextOnBlur(event, workspace.description ?? '', value => save('description', value))} /></label>
          <div className="wu-readonly-field"><span>Owner</span><strong>{ownerName ?? 'Workspace owner'}</strong></div>
        </>}
        {tab === 'Board settings' && <>
          <h2>Board settings</h2>
          {settingsError ? <p role="alert">{settingsError} <button type="button" onClick={() => { setSettingsError(''); setAttempt(value => value + 1); }}>Retry</button></p>
            : !settings ? <p role="status">Loading board settings…</p>
            : <>
              <label className="wu-field-label">Active work limit<input name="limit" type="number" min={1} required defaultValue={settings.activeWipLimit} placeholder="e.g. 3" readOnly={!editable}
                onBlur={event => saveTextOnBlur(event, String(settings.activeWipLimit), value => save('activeWipLimit', Number(value)))} onKeyDown={finishInputEdit} /></label>
              <p className="wu-muted">The limit includes In progress and Review.</p>
              <label className="wu-field-label">Definition of ready<textarea name="definitionOfReady" rows={3} defaultValue={definitionText(settings.definitionOfReady)} placeholder="e.g. Scope and acceptance criteria are clear" readOnly={!editable}
                onBlur={event => saveTextOnBlur(event, definitionText(settings.definitionOfReady), value => save('definitionOfReady', value))} /></label>
              <label className="wu-field-label">Definition of done<textarea name="definitionOfDone" rows={3} defaultValue={definitionText(settings.definitionOfDone)} placeholder="e.g. Tests pass and the change has been reviewed" readOnly={!editable}
                onBlur={event => saveTextOnBlur(event, definitionText(settings.definitionOfDone), value => save('definitionOfDone', value))} /></label>
            </>}
        </>}
        {tab === 'Profile' && <><h2>Your profile</h2><label className="wu-field-label">Username<input name="username" defaultValue={profileName} placeholder="e.g. nourdev" required minLength={3} maxLength={30}
          onBlur={event => saveTextOnBlur(event, profileName, value => save('username', value))} onKeyDown={finishInputEdit} /></label></>}
      </div>
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
