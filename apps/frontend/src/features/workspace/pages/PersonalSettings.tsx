import { useRef, useState, type FormEvent } from 'react';
import { EmailVerificationForm } from '../../AccountPages';
import { sessionKey } from '../../WorkspacePicker';
import { AvatarPicker, type AvatarSelection } from '../../AvatarPicker';
import { accountRequest, authRoute } from '../../auth-routing';
import { finishInputEdit, saveTextOnBlur } from '../autosave';
import { Avatar } from '../components';
import { Drawer } from '../WorkspaceControls';
import { jsonRequest, workspaceRequest } from '../workspace-api';

export type Theme = 'system' | 'light' | 'dark';
export type PersonalProfile = {
  id: string;
  username: string;
  email: string;
  emailVerified?: boolean;
  avatarUrl?: string | null;
  theme?: Theme;
  notificationBadge?: boolean;
};
type PersonalChange = AvatarSelection | { avatarUrl: null } | { username: string } | { notificationBadge: boolean };

export function PersonalSettings({ tab, profile, token, onProfile, onTheme }: {
  tab: string; profile: PersonalProfile; token: string | null;
  onProfile: (profile: PersonalProfile) => void; onTheme: (theme: Theme) => Promise<boolean>;
}) {
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const working = useRef(false);

  async function run(action: () => Promise<void>, message: string) {
    if (working.current) return false;
    working.current = true;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await action();
      setNotice(message);
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save the change.');
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  function save(change: PersonalChange) {
    if (!token || !profile.id) return Promise.resolve(false);
    return run(async () => {
      const result = await workspaceRequest('users/' + profile.id, token, jsonRequest('PATCH', change));
      onProfile(await result.json());
    }, 'Changes saved.');
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || working.current) return;
    const fields = new FormData(event.currentTarget);
    const newPassword = String(fields.get('newPassword') ?? '');
    if (newPassword !== fields.get('confirmPassword')) { setError('The passwords must match.'); return; }
    await run(async () => {
      await accountRequest('password', { currentPassword: String(fields.get('currentPassword') ?? ''), newPassword }, token, 'PATCH');
      sessionStorage.removeItem(sessionKey);
      location.replace(authRoute('/login', location.pathname + location.search + location.hash) + '&passwordChanged=1');
    }, 'Password changed. Sign in again.');
  }

  return <>
    {!avatarOpen && error && <p role="alert">{error}</p>}
    {(busy || notice) && !avatarOpen && <p role="status">{busy ? 'Working…' : notice}</p>}
    <div className="wu-settings-form">
      {tab === 'Profile' && <>
        <h2>Your profile</h2>
        <div className="wu-settings-actions">
          {profile.avatarUrl ? <img className="wu-avatar" src={profile.avatarUrl} alt="" /> : <Avatar initials={profile.username.slice(0, 2).toUpperCase()} preview={false} />}
          <button className="wu-button wu-button--secondary" type="button" disabled={busy || !profile.id} onClick={() => { setError(''); setAvatarOpen(true); }}>Change avatar</button>
          {profile.avatarUrl && <button className="wu-text-button" type="button" disabled={busy} onClick={() => void save({ avatarUrl: null })}>Remove avatar</button>}
        </div>
        <label className="wu-field-label">Username<input defaultValue={profile.username} placeholder="e.g. nourdev" minLength={3} maxLength={30}
          required readOnly={busy || !profile.id} onBlur={event => saveTextOnBlur(event, profile.username, value => void save({ username: value }))} onKeyDown={finishInputEdit} /></label>
      </>}
      {tab === 'Security' && <>
        <h2>Account security</h2>
        <div className="wu-readonly-field"><span>Email address</span><strong>{profile.email}</strong></div>
        {profile.emailVerified === false && token && <EmailVerificationForm token={token} onVerified={() => onProfile({ ...profile, emailVerified: true })} />}
        {profile.emailVerified && <p className="wu-muted">Email verified</p>}
        <form className="auth-form" onSubmit={changePassword}>
          <h3>Change password</h3>
          <label className="wu-field-label">Current password<input name="currentPassword" type="password" autoComplete="current-password" required disabled={busy} /></label>
          <label className="wu-field-label">New password<input name="newPassword" type="password" autoComplete="new-password" minLength={8} required disabled={busy} /></label>
          <label className="wu-field-label">Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required disabled={busy} /></label>
          <p className="wu-muted">Changing your password signs you out of all sessions.</p>
          <button className="wu-button" type="submit" disabled={busy || !token}>Change password</button>
        </form>
        <a className="wu-text-button" href={authRoute('/forgot-password', location.pathname + location.search + location.hash)}>Reset password</a>
      </>}
      {tab === 'Appearance' && <>
        <h2>Appearance</h2>
        <label className="wu-field-label">Theme<select value={profile.theme ?? 'system'} disabled={busy || !profile.id} onChange={event => {
          const theme = event.target.value as Theme;
          void run(async () => { if (!await onTheme(theme)) throw new Error('Could not save the theme.'); }, 'Theme saved.');
        }}>
          <option value="system">Match browser</option><option value="light">Light</option><option value="dark">Dark</option>
        </select></label>
      </>}
      {tab === 'Notifications' && <>
        <h2>Notifications</h2>
        <label className="wu-settings-check"><input type="checkbox" checked={profile.notificationBadge ?? true}
          disabled={busy || !profile.id} onChange={event => void save({ notificationBadge: event.target.checked })} /> Show unread count on the notification bell</label>
      </>}
    </div>
    {avatarOpen && <Drawer title="Change avatar" onClose={() => { if (!working.current) setAvatarOpen(false); }}>
      <AvatarPicker saving={busy} error={error} saveLabel="Save avatar" skipLabel="Cancel"
        onSkip={() => setAvatarOpen(false)} onSave={avatar => { void save(avatar).then(saved => { if (saved) setAvatarOpen(false); }); }} />
    </Drawer>}
  </>;
}
