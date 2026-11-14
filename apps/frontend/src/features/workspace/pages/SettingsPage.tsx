import { useEffect, useRef, useState } from 'react';
import { workspaceIcons } from '../workspace-icons';
import { finishInputEdit, saveTextOnBlur } from '../autosave';
import { FilterChips, Panel } from '../components';
import { Drawer } from '../WorkspaceControls';
import { jsonRequest, workspaceRequest } from '../workspace-api';
import { PersonalSettings, type PersonalProfile, type Theme } from './PersonalSettings';
import type { PageHeading, PageKey } from '../types';
import './settings.css';

export type WorkspaceProfile = { name: string; description: string | null; ownerId: string; archivedAt: string | null; reportingTimeZone?: string };
type KanbanSettings = { activeWipLimit: number; definitionOfReady: unknown; definitionOfDone: unknown };

function definitionText(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value, null, 2);
}

const workspaceTabs = ['General', 'Access', 'Board settings', 'Integrations', 'Archive'];
const personalTabs = ['Profile', 'Security', 'Appearance', 'Notifications'];

export function SettingsPage({ pageHeading, workspace, ownerName, profile, token, path, navigate, onWorkspace, onBoard, onProfile, onTheme, initialTab = 'General' }: {
  pageHeading: PageHeading; workspace: WorkspaceProfile; ownerName?: string; profile: PersonalProfile;
  token: string | null; path: string; navigate: (page: PageKey) => void;
  onWorkspace: (workspace: WorkspaceProfile) => void; onBoard: () => void; onProfile: (profile: PersonalProfile) => void;
  onTheme: (theme: Theme) => Promise<boolean>; initialTab?: 'General' | 'Profile' | 'Archive' | 'Board settings';
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
  const isOwner = workspace.ownerId === profile.id;
  const editable = isOwner && !workspace.archivedAt;
  const personal = personalTabs.includes(tab);

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
    if (!token || !editable) return;
    pending.current += 1;
    setBusy(true);
    queue.current = queue.current.then(async () => {
      setError('');
      setNotice('');
      try {
        const target = tab === 'Board settings' ? path + '/kanban-settings' : path;
        const response = await workspaceRequest(target, token, jsonRequest('PATCH', { [key]: value }));
        const result = await response.json();
        if (tab === 'Board settings') { setSettings(result); onBoard(); }
        else { onWorkspace(result); if (key === 'reportingTimeZone') onBoard(); }
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

  function selectTab(value: string) { setTab(value); setError(''); setNotice(''); }

  return <>
    {pageHeading((busy || notice) && <span className="wu-muted" role="status">{busy ? 'Saving…' : notice}</span>)}
    <div className="wu-settings-navigation">
      <div role="group" aria-label="Settings scope"><FilterChips items={['Workspace', 'Personal']} active={personal ? 'Personal' : 'Workspace'}
        onChange={value => { if (value !== (personal ? 'Personal' : 'Workspace')) selectTab(value === 'Personal' ? 'Profile' : 'General'); }} /></div>
      <div role="group" aria-label={personal ? 'Personal settings sections' : 'Workspace settings sections'}>
        <FilterChips items={personal ? personalTabs : workspaceTabs} active={tab} onChange={selectTab} />
      </div>
    </div>
    <Panel className="wu-settings-panel">
      {error && !confirm && <p role="alert">{error}</p>}
      {personal ? <PersonalSettings key={tab} tab={tab} profile={profile} token={token} onProfile={onProfile} onTheme={onTheme} /> :
      <div key={tab} className="wu-settings-form">
        {tab === 'General' && <>
          <h2>Workspace profile</h2>
          <label className="wu-field-label">Name<input name="name" defaultValue={workspace.name} placeholder="e.g. Platform engineering" required maxLength={120} readOnly={!editable}
            onBlur={event => saveTextOnBlur(event, workspace.name, value => save('name', value))} onKeyDown={finishInputEdit} /></label>
          <label className="wu-field-label">Description<textarea name="description" defaultValue={workspace.description ?? ''} placeholder="What does this workspace organize?" rows={3} readOnly={!editable}
            onBlur={event => saveTextOnBlur(event, workspace.description ?? '', value => save('description', value))} /></label>
          <label className="wu-field-label">Reporting time zone<input name="reportingTimeZone" list="wu-workspace-time-zones" maxLength={80}
            defaultValue={workspace.reportingTimeZone ?? 'Africa/Casablanca'} placeholder="e.g. Africa/Casablanca" readOnly={!editable}
            onBlur={event => saveTextOnBlur(event, workspace.reportingTimeZone ?? 'Africa/Casablanca', value => save('reportingTimeZone', value))} onKeyDown={finishInputEdit} />
          </label>
          <datalist id="wu-workspace-time-zones">{Array.from(new Set(['UTC', 'Africa/Casablanca', ...(Intl.supportedValuesOf?.('timeZone') ?? [])])).map(zone => <option key={zone} value={zone} />)}</datalist>
          <p className="wu-muted">Used for reporting periods and relative due-date filters.</p>
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
        {tab === 'Access' && <><h2>Workspace access</h2>
          <div className="wu-readonly-field"><span>Your role</span><strong>{isOwner ? 'Owner' : 'Member'}</strong></div>
          <button className="wu-button wu-button--secondary" type="button" onClick={() => navigate('team')}><workspaceIcons.team size={15} />{editable ? 'Manage members' : 'View team'}</button>
        </>}
        {tab === 'Integrations' && <><h2>Integrations</h2>
          <button className="wu-button wu-button--secondary" type="button" onClick={() => navigate('github')}><workspaceIcons.github size={15} />View GitHub integration</button>
        </>}
        {tab === 'Archive' && <><h2>{workspace.archivedAt ? 'Workspace archived' : 'Archive workspace'}</h2>
          <p className="wu-muted">Archiving pauses changes to shared work. The workspace owner can restore it at any time.</p>
          {isOwner && <button className="wu-button wu-button--secondary" type="button" disabled={busy}
            onClick={() => { setError(''); setConfirm(true); }}>{workspace.archivedAt ? 'Restore workspace' : 'Archive workspace'}</button>}
        </>}
      </div>}
    </Panel>
    {confirm && <Drawer title={workspace.archivedAt ? 'Restore workspace?' : 'Archive workspace?'} confirmation onClose={() => setConfirm(false)}>
      {error && <p role="alert">{error}</p>}
      <div className="wu-modal-actions"><button className="wu-button wu-button--secondary" autoFocus disabled={busy} onClick={() => setConfirm(false)}>Cancel</button>
        <button className="wu-button wu-button--primary" disabled={busy} onClick={() => void changeArchive()}>{workspace.archivedAt ? 'Restore' : 'Archive'}</button></div>
    </Drawer>}
  </>;
}
