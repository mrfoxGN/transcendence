import { Button } from '../../../shared/ui';
import { FormField, Input, Switch } from '../../../shared/ui';
import {EmptyIllustration} from '../../../shared/illustrations/EmptyIllustration';
import {ThemePreview,NotificationPreview} from './SettingsVisuals';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Key,
  Laptop,
  Lock,
  Mail,
  Moon,
  Palette,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Trash2,
  User,
} from 'lucide-react';
import { EmailVerificationForm } from '../../AccountPages';
import { sessionKey } from '../../auth/session';
import { AvatarPicker, type AvatarSelection } from '../../AvatarPicker';
import { accountRequest, authRoute } from '../../auth-routing';
import { Drawer } from '../WorkspaceControls';
import { jsonRequest, workspaceRequest } from '../workspace-api';
import { OtpCodeInput } from '../../auth/OtpCodeInput';
import { ResendCodeButton } from '../../auth/ResendCodeButton';

import type { ThemePreference as Theme } from '../../../shared/design-system/theme';
export type { ThemePreference as Theme } from '../../../shared/design-system/theme';
export type PersonalProfile = {
  id: string;
  username: string;
  email: string;
  emailVerified?: boolean;
  isTwoFactorEnabled?: boolean;
  avatarUrl?: string | null;
  theme?: Theme;
  notificationBadge?: boolean;
};
type PersonalChange =
  | AvatarSelection
  | { avatarUrl: null }
  | { username: string }
  | { notificationBadge: boolean };

export function PersonalSettings({
  tab,
  profile,
  token,
  onProfile,
  onTheme,
}: {
  tab: string;
  profile: PersonalProfile;
  token: string | null;
  onProfile: (profile: PersonalProfile) => void;
  onTheme: (theme: Theme) => Promise<boolean>;
}) {
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const working = useRef(false);

  // Username local edit state
  const [usernameInput, setUsernameInput] = useState(profile.username);
  useEffect(() => {
    setUsernameInput(profile.username);
  }, [profile.username]);

  // Password visibility states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 2FA state
  const [twoFactorPrompt, setTwoFactorPrompt] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState('');

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the change.');
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  function save(change: PersonalChange) {
    if (!token || !profile.id) return Promise.resolve(false);
    return run(async () => {
      const result = await workspaceRequest(
        'users/' + profile.id,
        token,
        jsonRequest('PATCH', change),
      );
      onProfile(await result.json());
    }, 'Changes saved.');
  }

  async function handleUsernameSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = usernameInput.trim();
    if (!trimmed || trimmed === profile.username || trimmed.length < 3) return;
    await save({ username: trimmed });
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || working.current) return;
    const fields = new FormData(event.currentTarget);
    const newPassword = String(fields.get('newPassword') ?? '');
    if (newPassword !== fields.get('confirmPassword')) {
      setError('The passwords must match.');
      return;
    }
    await run(async () => {
      await accountRequest(
        'password',
        {
          currentPassword: String(fields.get('currentPassword') ?? ''),
          newPassword,
        },
        token,
        'PATCH',
      );
      sessionStorage.removeItem(sessionKey);
      location.replace(
        authRoute(
          '/login',
          location.pathname + location.search + location.hash,
        ) + '&passwordChanged=1',
      );
    }, 'Password changed. Sign in again.');
  }

  async function requestEnableTwoFactor() {
    if (!token || busy) return;
    setTwoFactorError('');
    await run(async () => {
      await accountRequest('2fa/request-enable', undefined, token);
      setTwoFactorPrompt(true);
      setTwoFactorCode('');
    }, 'A 6-digit verification code was sent to your email.');
  }

  async function confirmEnableTwoFactor(codeToVerify?: string) {
    const code = (codeToVerify || twoFactorCode).trim();
    if (code.length !== 6 || !token || twoFactorBusy) return;
    setTwoFactorBusy(true);
    setTwoFactorError('');
    try {
      const updated = await accountRequest<PersonalProfile>(
        '2fa/confirm-enable',
        { code },
        token,
      );
      onProfile({
        ...profile,
        isTwoFactorEnabled: true,
        ...(updated && { ...updated }),
      });
      setTwoFactorPrompt(false);
      setTwoFactorCode('');
      setNotice('Two-factor authentication enabled successfully.');
    } catch (err) {
      setTwoFactorError(
        err instanceof Error ? err.message : 'Invalid verification code.',
      );
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function disableTwoFactor() {
    if (!token || busy) return;
    await run(async () => {
      const updated = await accountRequest<PersonalProfile>(
        '2fa/disable',
        undefined,
        token,
      );
      onProfile({
        ...profile,
        isTwoFactorEnabled: false,
        ...(updated && { ...updated }),
      });
      setTwoFactorPrompt(false);
    }, 'Two-factor authentication disabled.');
  }

  const isUsernameDirty =
    usernameInput.trim() !== profile.username && usernameInput.trim().length >= 3;

  return (
    <>
      {!avatarOpen && error && (
        <div className="wu-settings-banner wu-settings-banner--error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {!avatarOpen && notice && !busy && (
        <div className="wu-settings-banner wu-settings-banner--success" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}
      {!avatarOpen && busy && (
        <div className="wu-settings-banner wu-settings-banner--loading" role="status">
          <RefreshCw size={18} className="wu-spin" />
          <span>Saving your changes…</span>
        </div>
      )}

      <div className="wu-settings-form">
        {tab === 'Profile' && (
          <>
            <div className="wu-settings-header">
              <h2>
                <User size={20} /> Your profile
              </h2>
              <p>Manage your public identity, display avatar, and username handle.</p>
            </div>

            {/* Profile Hero Card */}
            <div className="wu-profile-hero">
              <div className="wu-avatar-large-wrapper">
                {profile.avatarUrl ? (
                  <img
                    className="wu-avatar-large"
                    src={profile.avatarUrl}
                    alt={profile.username}
                  />
                ) : (
                  <div className="wu-avatar-large-initials">
                    {profile.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="wu-profile-hero-meta">
                <h3 className="wu-profile-hero-name">{profile.username}</h3>
                <div className="wu-profile-hero-email">
                  <Mail size={14} />
                  <span>{profile.email}</span>
                  {profile.emailVerified ? (
                    <span className="wu-pill--mint">
                      <ShieldCheck size={12} /> Verified
                    </span>
                  ) : (
                    <span className="wu-pill--orange">
                      <AlertCircle size={12} /> Unverified
                    </span>
                  )}
                </div>
                <div className="wu-profile-hero-actions">
                  <Button
                    variant="primary"
                    type="button"
                    disabled={busy || !profile.id}
                    onClick={() => {
                      setError('');
                      setAvatarOpen(true);
                    }}
                  >
                    <Camera size={14} /> Change avatar
                  </Button>
                  {profile.avatarUrl && (
                    <Button
                      variant="secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => void save({ avatarUrl: null })}
                    >
                      <Trash2 size={14} /> Remove avatar
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Details Card */}
            <div className="wu-settings-card">
              <div className="wu-settings-card-head">
                <h4 className="wu-settings-card-title">
                  <User size={16} /> Identity details
                </h4>
              </div>

              <form onSubmit={handleUsernameSubmit}>
                <div className="wu-field-label wu-field-group--action">
                  <label htmlFor="settings-username">Username</label>
                  <div className="wu-input-row">
                    <Input
                      id="settings-username"
                      aria-describedby="settings-username-hint"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="e.g. nourdev"
                      minLength={3}
                      maxLength={30}
                      required
                      disabled={busy || !profile.id}
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={busy || !profile.id || !isUsernameDirty}
                    >
                      Save username
                    </Button>
                  </div>
                  <p id="settings-username-hint" className="wu-field-hint">
                    Must be between 3 and 30 characters. Your handle is visible to teammates
                    in task assignments and workspace discussions.
                  </p>
                </div>
              </form>

              <div className="wu-readonly-field">
                <span>Email address</span>
                <strong>{profile.email}</strong>
                <p className="wu-field-hint">
                  Your primary login and notification email. To manage authentication,
                  see the Security section.
                </p>
              </div>
            </div>
          </>
        )}

        {tab === 'Security' && (
          <>
            <div className="wu-settings-header">
              <h2>
                <Shield size={20} /> Account security
              </h2>
              <p>Manage your password, email verification, and two-factor authentication.</p>
            </div>

            <div className="wu-settings-security-visual"><EmptyIllustration kind="restricted" size={104}/><div><strong>Protect your account</strong><p>Keep your account protected with a strong password, a verified email, and two-factor authentication.</p></div></div>

            {/* Email Verification Card */}
            <div className="wu-settings-card">
              <div className="wu-settings-card-head">
                <h4 className="wu-settings-card-title">
                  <Mail size={16} /> Email verification
                </h4>
                {profile.emailVerified ? (
                  <span className="wu-pill--mint">
                    <ShieldCheck size={12} /> Verified
                  </span>
                ) : (
                  <span className="wu-pill--orange">
                    <AlertCircle size={12} /> Unverified
                  </span>
                )}
              </div>

              <div className="wu-readonly-field">
                <span>Registered email</span>
                <strong>{profile.email}</strong>
              </div>

              {profile.emailVerified ? (
                <p className="wu-field-hint" style={{ color: 'var(--wu-mint)' }}>
                  ✓ Your email is verified. All security alerts and one-time codes will be sent here.
                </p>
              ) : token ? (
                <div>
                  <p className="wu-field-hint" style={{ marginBottom: '12px' }}>
                    Verify your email address to enable two-factor authentication and ensure account recovery.
                  </p>
                  <EmailVerificationForm
                    token={token}
                    onVerified={() => onProfile({ ...profile, emailVerified: true })}
                  />
                </div>
              ) : null}
            </div>

            {/* Two-Factor Authentication Card */}
            <div className="wu-settings-card">
              <div className="wu-settings-card-head">
                <h4 className="wu-settings-card-title">
                  <ShieldCheck size={16} /> Two-factor authentication (Email 2FA)
                </h4>
                <span className={profile.isTwoFactorEnabled ? 'wu-pill--mint' : 'wu-pill--neutral'}>
                  {profile.isTwoFactorEnabled ? '● Enabled' : '○ Disabled'}
                </span>
              </div>
              <p className="wu-settings-card-desc">
                Add an extra layer of protection. When enabled, signing in requires a 6-digit one-time code sent to your email.
              </p>

              {profile.isTwoFactorEnabled ? (
                <div style={{ display: 'grid', gap: '12px' }}>
                  <p className="wu-field-hint" style={{ color: 'var(--wu-mint)' }}>
                    ✓ Two-factor authentication is active on <strong>{profile.email}</strong>.
                  </p>
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={busy || !token}
                    onClick={() => void disableTwoFactor()}
                    style={{ justifySelf: 'start' }}
                  >
                    <ShieldAlert size={15} /> Disable 2FA
                  </Button>
                </div>
              ) : !profile.emailVerified ? (
                <p className="wu-muted" style={{ fontStyle: 'italic', fontSize: '13px' }}>
                  Please verify your email address above before enabling two-factor authentication.
                </p>
              ) : twoFactorPrompt ? (
                <div className="two-factor-setup-box">
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>
                    Enter the 6-digit verification code sent to {profile.email}:
                  </p>
                  {twoFactorError && (
                    <div className="wu-settings-banner wu-settings-banner--error" style={{ margin: 0 }} role="alert">
                      <AlertCircle size={16} />
                      <span>{twoFactorError}</span>
                    </div>
                  )}
                  <OtpCodeInput
                    value={twoFactorCode}
                    onChange={setTwoFactorCode}
                    onComplete={(code) => void confirmEnableTwoFactor(code)}
                    disabled={twoFactorBusy}
                    hasError={Boolean(twoFactorError)}
                    autoFocus
                  />
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <Button
                      variant="primary"
                      type="button"
                      disabled={twoFactorBusy || twoFactorCode.length !== 6}
                      onClick={() => void confirmEnableTwoFactor(twoFactorCode)}
                    >
                      {twoFactorBusy ? 'Verifying…' : 'Confirm & Enable 2FA'}
                    </Button>
                    <ResendCodeButton
                      cooldownSeconds={60}
                      storageKey={`devup_2fa_enable_resend_${profile.id}`}
                      onResend={async () => {
                        await accountRequest('2fa/request-enable', undefined, token);
                        setTwoFactorError('');
                      }}
                    />
                    <button
                      className="wu-text-button"
                      type="button"
                      disabled={twoFactorBusy}
                      onClick={() => {
                        setTwoFactorPrompt(false);
                        setTwoFactorError('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="primary"
                  type="button"
                  disabled={busy || !token}
                  onClick={() => void requestEnableTwoFactor()}
                  style={{ justifySelf: 'start' }}
                >
                  <ShieldCheck size={15} /> Enable 2FA
                </Button>
              )}
            </div>

            {/* Change Password Card */}
            <div className="wu-settings-card">
              <div className="wu-settings-card-head">
                <h4 className="wu-settings-card-title">
                  <Key size={16} /> Change password
                </h4>
              </div>
              <p className="wu-settings-card-desc">
                Ensure your account uses a secure password of at least 8 characters.
              </p>

              <form className="auth-form wu-form-stack" onSubmit={changePassword}>
                <label className="wu-field-label">
                  Current password
                  <div className="wu-password-wrap">
                    <input
                      name="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      disabled={busy}
                    />
                    <button
                      type="button"
                      className="wu-password-toggle"
                      aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                <label className="wu-field-label">
                  New password
                  <div className="wu-password-wrap">
                    <input
                      name="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      disabled={busy}
                    />
                    <button
                      type="button"
                      className="wu-password-toggle"
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                <label className="wu-field-label">
                  Confirm new password
                  <div className="wu-password-wrap">
                    <input
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      disabled={busy}
                    />
                    <button
                      type="button"
                      className="wu-password-toggle"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                <p className="wu-field-hint">
                  Changing your password signs you out of all other active browser sessions.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <Button variant="primary" type="submit" disabled={busy || !token}>
                    <Lock size={14} /> Update password
                  </Button>
                  <a
                    className="wu-text-button"
                    href={authRoute(
                      '/forgot-password',
                      location.pathname + location.search + location.hash,
                    )}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    Forgot current password? <ArrowRight size={13} />
                  </a>
                </div>
              </form>
            </div>
          </>
        )}

        {tab === 'Appearance' && (
          <>
            <div className="wu-settings-header">
              <h2>
                <Palette size={20} /> Appearance
              </h2>
              <p>Customize how DevUP looks on your device and monitor.</p>
            </div>

            <div className="wu-settings-card">
              <div className="wu-settings-card-head">
                <h4 className="wu-settings-card-title">
                  <Palette size={16} /> Interface theme
                </h4>
              </div>
              <p className="wu-settings-card-desc">
                Select a visual theme or sync with your system display preferences.
              </p>

              <div className="wu-theme-grid">
                {(['light','dark','system'] as Theme[]).map(mode=><button key={mode} type="button" className={'wu-theme-tile'+((profile.theme??'system')===mode?' is-active':'')} aria-label={'Use '+mode+' theme'} aria-pressed={(profile.theme??'system')===mode} disabled={busy||!profile.id} onClick={()=>{void run(async()=>{if(!(await onTheme(mode)))throw new Error('Could not save theme.');},mode==='system'?'Theme set to match system.':mode[0].toUpperCase()+mode.slice(1)+' theme activated.');}}>
                  <ThemePreview mode={mode}/>
                  <span className="wu-theme-option-caption"><strong>{mode[0].toUpperCase()+mode.slice(1)}</strong>{(profile.theme??'system')===mode&&<span className="wu-theme-tile-check"><Check size={12} aria-hidden="true"/></span>}</span>
                  <span className="wu-theme-tile-desc">{mode==='light'?'Bright, clear surfaces':mode==='dark'?'A calm charcoal workspace':'Follow your device'}</span>
                </button>)}
              </div>
            </div>
          </>
        )}

        {tab === 'Notifications' && (
          <>
            <div className="wu-settings-header">
              <h2>
                <Bell size={20} /> Notifications
              </h2>
              <p>Configure how updates, invites, and task activities alert you.</p>
            </div>

            <div className="wu-settings-card">
              <div className="wu-settings-card-head">
                <h4 className="wu-settings-card-title">
                  <Bell size={16} /> Notification alerts
                </h4>
              </div>

              <NotificationPreview badge={profile.notificationBadge??true}/>
              <div className="wu-toggle-card">
                <div className="wu-toggle-card-meta">
                  <h5 className="wu-toggle-card-title">Unread badge counter</h5>
                  <p className="wu-toggle-card-desc">
                    Display a numerical badge with your unread count on the notification bell in the top navigation bar.
                  </p>
                </div>
                <Switch aria-label="Show unread notification badge"
                  checked={profile.notificationBadge ?? true}
                  disabled={busy || !profile.id}
                  onChange={event => void save({ notificationBadge: event.target.checked })}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {avatarOpen && (
        <Drawer
          title="Change avatar"
          onClose={() => {
            if (!working.current) setAvatarOpen(false);
          }}
        >
          <AvatarPicker
            saving={busy}
            error={error}
            saveLabel="Save avatar"
            skipLabel="Cancel"
            onSkip={() => setAvatarOpen(false)}
            onSave={(avatar) => {
              void save(avatar).then((saved) => {
                if (saved) setAvatarOpen(false);
              });
            }}
          />
        </Drawer>
      )}
    </>
  );
}
