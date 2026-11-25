import { Input, Textarea, Button } from '../../../shared/ui';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { workspaceIcons } from '../workspace-icons';
import { finishInputEdit, saveTextOnBlur } from '../autosave';
import { Drawer } from '../WorkspaceControls';
import { jsonRequest, workspaceRequest } from '../workspace-api';
import { PersonalSettings, type PersonalProfile, type Theme } from './PersonalSettings';
import type { PageHeading, PageKey } from '../types';
import './settings.css';
import './settings-design.css';
import {BoardSettingsPreview,AccessPreview} from './SettingsVisuals';
import {Building2,UsersRound,Columns3,Plug,Archive,UserRound,ShieldCheck,Palette,Bell,CheckCircle2,ChevronDown} from 'lucide-react';

export type WorkspaceProfile = { name: string; description: string | null; ownerId: string; archivedAt: string | null; reportingTimeZone?: string };
type KanbanSettings = { activeWipLimit: number; definitionOfReady: unknown; definitionOfDone: unknown };

function definitionText(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value, null, 2);
}

const workspaceTabs = ['General', 'Access', 'Board settings', 'Integrations', 'Archive'];
const personalTabs = ['Profile', 'Security', 'Appearance', 'Notifications'];
const sectionIcons={General:Building2,Access:UsersRound,'Board settings':Columns3,Integrations:Plug,Archive,Profile:UserRound,Security:ShieldCheck,Appearance:Palette,Notifications:Bell};

export function SettingsPage({ pageHeading, workspace, ownerName, profile, token, path, navigate, onWorkspace, onBoard, onProfile, onTheme, onSectionChange, initialTab = 'General' }: {
  pageHeading: PageHeading; workspace: WorkspaceProfile; ownerName?: string; profile: PersonalProfile;
  token: string | null; path: string; navigate: (page: PageKey) => void;
  onWorkspace: (workspace: WorkspaceProfile) => void; onBoard: () => void; onProfile: (profile: PersonalProfile) => void;
  onTheme: (theme: Theme) => Promise<boolean>; onSectionChange: (section: string) => void; initialTab?: string;
}) {
  const [tab, setTab] = useState<string>([...workspaceTabs,...personalTabs].includes(initialTab)?initialTab:'General');
  useEffect(() => { if ([...workspaceTabs, ...personalTabs].includes(initialTab)) setTab(initialTab); }, [initialTab]);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const navigationTrigger = useRef<HTMLButtonElement>(null);
  const contentPanel = useRef<HTMLElement>(null);
  useLayoutEffect(() => { if (contentPanel.current) contentPanel.current.scrollTop = 0; }, [tab]);
  useEffect(() => {
    const desktop = matchMedia('(min-width: 901px)');
    const closeOnDesktop = () => { if (desktop.matches) setNavigationOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);
  function closeNavigation() {
    setNavigationOpen(false);
    requestAnimationFrame(() => navigationTrigger.current?.focus({ preventScroll: true }));
  }
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

  function selectTab(value: string) { if (navigationOpen) closeNavigation(); if (contentPanel.current) contentPanel.current.scrollTop = 0; onSectionChange(value === 'Board settings' ? 'board' : value.toLowerCase()); setTab(value); setError(''); setNotice(''); const url=new URL(location.href);url.hash=value==='Board settings'?'board':value.toLowerCase();history.replaceState({...history.state},'',url); }

  const sectionNavigation = <nav className="wu-settings-section-nav" aria-label="Settings sections">
        {[['Workspace',workspaceTabs],['Personal',personalTabs]].map(([group,items])=><section key={group as string}><h2>{group as string}</h2>{(items as string[]).map(name=>{const Icon=sectionIcons[name as keyof typeof sectionIcons];return <button key={name} type="button" aria-current={name===tab?'page':undefined} onClick={()=>selectTab(name)}><Icon size={16} aria-hidden="true"/>{name}</button>;})}</section>)}
      </nav>;

  return <>
    {pageHeading((busy || notice) && <span className="wu-muted" role="status">{!busy&&<CheckCircle2 size={14} aria-hidden="true"/>}{busy ? 'Saving…' : notice}</span>)}
    <div className="wu-settings-layout">
      {sectionNavigation}
      <button ref={navigationTrigger} type="button" className="wu-settings-mobile-trigger" aria-haspopup="dialog" aria-expanded={navigationOpen} aria-label={`Settings section: ${tab}`} onClick={() => setNavigationOpen(true)}><span><small>Settings section</small><strong>{tab}</strong></span><ChevronDown size={17} aria-hidden="true" /></button>
    <section ref={contentPanel} tabIndex={0} aria-label={tab + ' settings'} className={'wu-panel wu-settings-panel'+(tab==='Archive'?' wu-settings-panel--danger':'')}>
      {error && !confirm && <p role="alert">{error}</p>}
      {personal ? <PersonalSettings key={tab} tab={tab} profile={profile} token={token} onProfile={onProfile} onTheme={onTheme} /> :
      <div key={tab} className="wu-settings-form">
        {tab === 'General' && <>
          <div className="wu-settings-workspace-identity"><span aria-hidden="true">{workspace.name.split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase()}</span><div><h2>Workspace profile</h2><p>Workspace details and reporting preferences.</p></div></div>
          <label className="wu-field-label">Name<Input name="name" defaultValue={workspace.name} placeholder="e.g. Platform engineering" required maxLength={120} readOnly={!editable}
            onBlur={event => saveTextOnBlur(event, workspace.name, value => save('name', value))} onKeyDown={finishInputEdit} /></label>
          <label className="wu-field-label">Description<Textarea name="description" defaultValue={workspace.description ?? ''} placeholder="What does this workspace organize?" rows={3} readOnly={!editable}
            onBlur={event => saveTextOnBlur(event, workspace.description ?? '', value => save('description', value))} /></label>
          <label className="wu-field-label">Reporting time zone<Input name="reportingTimeZone" aria-describedby="settings-timezone-hint" list="wu-workspace-time-zones" maxLength={80}
            defaultValue={workspace.reportingTimeZone ?? 'Africa/Casablanca'} placeholder="e.g. Africa/Casablanca" readOnly={!editable}
            onBlur={event => saveTextOnBlur(event, workspace.reportingTimeZone ?? 'Africa/Casablanca', value => save('reportingTimeZone', value))} onKeyDown={finishInputEdit} />
            <span id="settings-timezone-hint" className="wu-field-hint">Used for reporting periods and relative due-date filters.</span>
          </label>
          <datalist id="wu-workspace-time-zones">{Array.from(new Set(['UTC', 'Africa/Casablanca', ...(Intl.supportedValuesOf?.('timeZone') ?? [])])).map(zone => <option key={zone} value={zone} />)}</datalist>
          <div className="wu-readonly-field"><span>Owner</span><strong>{ownerName ?? 'Workspace owner'}</strong></div>
        </>}
        {tab === 'Board settings' && <>
          <h2>Board settings</h2>
          {settings&&<BoardSettingsPreview limit={settings.activeWipLimit}/>}
          {settingsError ? <p role="alert">{settingsError} <button type="button" onClick={() => { setSettingsError(''); setAttempt(value => value + 1); }}>Retry</button></p>
            : !settings ? <p role="status">Loading board settings…</p>
            : <>
              <label className="wu-field-label">Active work limit<Input name="limit" aria-describedby="settings-work-limit-hint" type="number" min={1} required defaultValue={settings.activeWipLimit} placeholder="e.g. 3" readOnly={!editable}
                onBlur={event => saveTextOnBlur(event, String(settings.activeWipLimit), value => save('activeWipLimit', Number(value)))} onKeyDown={finishInputEdit} /><span id="settings-work-limit-hint" className="wu-field-hint">The limit includes In progress and Review.</span></label>
              <label className="wu-field-label">Definition of ready<Textarea name="definitionOfReady" rows={3} defaultValue={definitionText(settings.definitionOfReady)} placeholder="e.g. Scope and acceptance criteria are clear" readOnly={!editable}
                onBlur={event => saveTextOnBlur(event, definitionText(settings.definitionOfReady), value => save('definitionOfReady', value))} /></label>
              <label className="wu-field-label">Definition of done<Textarea name="definitionOfDone" rows={3} defaultValue={definitionText(settings.definitionOfDone)} placeholder="e.g. Tests pass and the change has been reviewed" readOnly={!editable}
                onBlur={event => saveTextOnBlur(event, definitionText(settings.definitionOfDone), value => save('definitionOfDone', value))} /></label>
            </>}
        </>}
        {tab === 'Access' && <><h2>Workspace access</h2>
          <AccessPreview ownerName={ownerName}/>
          <div className="wu-readonly-field"><span>Your role</span><strong>{isOwner ? 'Owner' : 'Member'}</strong></div>
          <Button variant="secondary" type="button" onClick={() => navigate('team')}><workspaceIcons.team size={15} />{editable ? 'Manage members' : 'View team'}</Button>
        </>}
        {tab === 'Integrations' && <><h2>Integrations</h2>
          <Button variant="secondary" type="button" onClick={() => navigate('github')}><workspaceIcons.github size={15} />View GitHub integration</Button>
        </>}
        {tab === 'Archive' && <><h2>{workspace.archivedAt ? 'Workspace archived' : 'Archive workspace'}</h2>
          <p className="wu-muted">Archiving pauses changes to shared work. The workspace owner can restore it at any time.</p>
          {isOwner && <Button variant="secondary" type="button" disabled={busy}
            onClick={() => { setError(''); setConfirm(true); }}>{workspace.archivedAt ? 'Restore workspace' : 'Archive workspace'}</Button>}
        </>}
      </div>}
    </section>
    </div>
    {navigationOpen && <Drawer title="Settings sections" className="wu-settings-navigation-drawer" closeLabel="Close settings navigation" onClose={closeNavigation}>{sectionNavigation}</Drawer>}
    {confirm && <Drawer title={workspace.archivedAt ? 'Restore workspace?' : 'Archive workspace?'} confirmation onClose={() => setConfirm(false)}>
      {error && <p role="alert">{error}</p>}
      <div className="wu-modal-actions"><button className="wu-button wu-button--secondary" autoFocus disabled={busy} onClick={() => setConfirm(false)}>Cancel</button>
        <button className="wu-button wu-button--primary" disabled={busy} onClick={() => void changeArchive()}>{workspace.archivedAt ? 'Restore' : 'Archive'}</button></div>
    </Drawer>}
  </>;
}
