import { Check, Users } from 'lucide-react';
import { FilterChips, Panel } from '../components';
import type { PageHeading, PageKey } from '../types';
import './settings.css';

type SettingsPageProps = {
  pageHeading: PageHeading;
  settingsTab: string;
  setSettingsTab: (tab: string) => void;
  workspaceName: string;
  setWorkspaceName: (name: string) => void;
  profileName: string;
  navigate: (page: PageKey) => void;
  setToast: (message: string) => void;
};

export function SettingsPage({
  pageHeading,
  settingsTab,
  setSettingsTab,
  workspaceName,
  setWorkspaceName,
  profileName,
  navigate,
  setToast,
}: SettingsPageProps) {
  return <>{pageHeading(<button className="wu-button wu-button--primary" type="button" onClick={() => setToast('Workspace settings saved.')}><Check size={15} />Save changes</button>)}<FilterChips items={['General', 'Board settings']} active={settingsTab} onChange={setSettingsTab} />
    <Panel className="wu-settings-panel">{settingsTab === 'General' ? <><h2>Workspace profile</h2><div className="wu-settings-form"><label className="wu-field-label">Name<input defaultValue={workspaceName} onChange={event => setWorkspaceName(event.target.value)} /></label><label className="wu-field-label">Description<textarea defaultValue="Developer workspace for the storefront project." rows={3} /></label><div className="wu-readonly-field"><span>Owner</span><strong>{profileName}</strong></div></div><hr /><h3>Workspace access</h3><p className="wu-muted">Manage members and pending invitations from Team.</p><button className="wu-button wu-button--secondary" type="button" onClick={() => navigate('team')}><Users size={15} />Manage members</button></> : <><h2>Board defaults</h2><p className="wu-muted">Set the starting point for new tasks and board work.</p><div className="wu-settings-form"><label className="wu-field-label">Default task status<select defaultValue="To do"><option>To do</option><option>Ready</option></select></label><label className="wu-field-label">In-progress work limit<input type="number" defaultValue={3} min={1} max={20} /></label><label className="wu-check-row"><input type="checkbox" defaultChecked /> Show completed tasks on the board</label><label className="wu-check-row"><input type="checkbox" defaultChecked /> Notify members when a task is assigned</label></div></>}</Panel></>;
}
