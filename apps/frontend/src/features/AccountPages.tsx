import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { accountRequest, authRoute, requestedWorkspace } from './auth-routing';
import { sessionKey } from './WorkspacePicker';
import { AvatarPicker, type AvatarSelection } from './AvatarPicker';
import './account-onboarding.css';

export function AccountShell({ title, children, onboarding = false }: { title: string; children: ReactNode; onboarding?: boolean }) {
  return <main className={onboarding ? 'auth-page account-onboarding' : 'auth-page'}>
    <header className="auth-header"><a href="/" className="brand"><img src="/devup.svg" alt="" width="34" height="34" />DevUP</a></header>
    <section className="auth-shell" aria-labelledby="account-title">
      <h1 id="account-title">{title}</h1>
      <div className="auth-panel">{children}</div>
    </section>
  </main>;
}

function EmailArtwork() {
  return <div className="account-email-artwork" aria-hidden="true"><span /></div>;
}

export function EmailVerificationForm({ token, onVerified }: { token: string; onVerified: () => void }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [retryAt, setRetryAt] = useState(0);

  async function send() {
    if (pending) return;
    if (Date.now() < retryAt) { setError('Wait one minute before requesting another code.'); return; }
    setPending(true);
    setError('');
    setMessage('');
    try {
      await accountRequest('email-verification/request', undefined, token);
      setRetryAt(Date.now() + 60_000);
      setMessage('Check your email for a six-digit code. It expires in 10 minutes. You can request another after one minute.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not send email.');
    } finally { setPending(false); }
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const code = String(new FormData(event.currentTarget).get('code') ?? '').trim();
    setPending(true);
    setError('');
    try {
      await accountRequest('email-verification/confirm', { code }, token);
      onVerified();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not verify your email.');
    } finally { setPending(false); }
  }

  return <form className="auth-form" onSubmit={confirm}>
    <button className="button button--secondary" type="button" disabled={pending} onClick={() => void send()}>
      {pending ? 'Please wait…' : 'Send verification code'}
    </button>
    <label>Verification code<input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={pending} /></label>
    {message && <p role="status">{message}</p>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="button button--primary" type="submit" disabled={pending}>Verify email</button>
  </form>;
}

export function AccountRecovery({ mode }: { mode: 'request' | 'reset' | 'verify' }) {
  const [resetStep, setResetStep] = useState(mode === 'reset');
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const token = sessionStorage.getItem(sessionKey);
  const destination = requestedWorkspace();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    const newPassword = String(fields.get('password') ?? '');
    if (resetStep && newPassword !== fields.get('confirm')) { setMessage('The passwords must match.'); return; }
    if (!resetStep && Date.now() < retryAt) { setMessage('Wait one minute before requesting another code.'); return; }
    setPending(true);
    setMessage('');
    try {
      if (!resetStep) {
        await accountRequest('password-reset/request', { email: email.trim() });
        setRetryAt(Date.now() + 60_000);
        setResetStep(true);
      } else {
        await accountRequest('password-reset/confirm', { email: email.trim(), code: String(fields.get('code') ?? '').trim(), newPassword });
        sessionStorage.removeItem(sessionKey);
        setComplete(true);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not complete the request. Try again.');
    } finally { setPending(false); }
  }

  return <AccountShell title={mode === 'verify' ? 'Verify your email' : 'Reset your password'} onboarding={mode === 'verify'}>
    {mode === 'verify' && <EmailArtwork />}
    {complete ? <div className="auth-success">
      <p role="status">{mode === 'verify' ? 'Your email is verified.' : 'Your password has been updated. Sign in with your new password.'}</p>
      <a className="button button--primary" href={mode === 'verify' ? destination : authRoute('/login', destination)}>{mode === 'verify' ? 'Open workspaces' : 'Sign in'}</a>
    </div> : mode === 'verify' ? token
      ? <EmailVerificationForm token={token} onVerified={() => setComplete(true)} />
      : <p>Sign in to verify your email. <a href={authRoute('/login', destination) + '&onboarding=1'}>Sign in</a></p>
      : <form className="auth-form" onSubmit={submit}>
        {resetStep && <p role="status">If an account uses that email, a six-digit reset code will be sent. Codes expire in 10 minutes. You can request another after one minute.</p>}
        <label>Email<input type="email" name="email" autoComplete="email" maxLength={320} required disabled={pending} value={email} onChange={event => setEmail(event.target.value)} /></label>
        {resetStep && <>
          <label>Reset code<input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={pending} /></label>
          <label>New password<input type="password" name="password" autoComplete="new-password" minLength={8} required disabled={pending} /></label>
          <label>Confirm new password<input type="password" name="confirm" autoComplete="new-password" minLength={8} required disabled={pending} /></label>
        </>}
        {message && <p className="auth-error" role="alert">{message}</p>}
        <button className="button button--primary" type="submit" disabled={pending}>{pending ? 'Please wait…' : resetStep ? 'Update password' : 'Send reset code'}</button>
        {resetStep && <button className="button button--secondary" type="button" disabled={pending} onClick={() => { setResetStep(false); setMessage(''); }}>Request another code</button>}
      </form>}
    {!complete && <p className="auth-switch"><a href={authRoute('/login', destination)}>Back to sign in</a></p>}
  </AccountShell>;
}

export function FirstRun({ step }: { step: 'avatar' | 'email' }) {
  const token = sessionStorage.getItem(sessionKey);
  const destination = requestedWorkspace();
  const [profile, setProfile] = useState<{ id: string; username: string; email: string; emailVerified?: boolean }>();
  const [loadError, setLoadError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [saving, setSaving] = useState(false);
  const emailStep = step === 'email';
  const emailPath = authRoute('/onboarding/email', destination);

  useEffect(() => {
    if (!token) {
      location.replace(authRoute('/login', destination) + '&onboarding=1');
      return;
    }
    const controller = new AbortController();
    void fetch('/api/auth/profile', { headers: { Authorization: 'Bearer ' + token }, signal: controller.signal })
      .then(async response => {
        if (response.status === 401) {
          sessionStorage.removeItem(sessionKey);
          location.replace(authRoute('/login', destination) + '&onboarding=1');
          return;
        }
        if (!response.ok) throw new Error('Could not load your profile.');
        const result = await response.json();
        if (!controller.signal.aborted) setProfile(result);
      })
      .catch(() => { if (!controller.signal.aborted) setLoadError('Could not load your profile. Try refreshing.'); });
    return () => controller.abort();
  }, [token, destination]);

  function nextAfterAvatar() {
    location.replace(profile?.emailVerified ? destination : emailPath);
  }

  async function saveAvatar(avatar: AvatarSelection) {
    if (!profile || !token || saving) return;
    setSaving(true);
    setAvatarError('');
    try {
      const response = await fetch('/api/users/' + encodeURIComponent(profile.id), {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(avatar),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(Array.isArray(result?.message) ? result.message.join(' ') : result?.message ?? 'Could not save your avatar. Try again.');
      }
      nextAfterAvatar();
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Could not save your avatar.');
    } finally { setSaving(false); }
  }

  const title = emailStep ? profile?.emailVerified ? 'Email verified' : 'Verify your email' : 'Choose your avatar';
  return <AccountShell title={title} onboarding>
    {loadError && <p role="alert">{loadError}</p>}
    {!profile && !loadError && <p role="status">Loading your profile…</p>}
    {profile && (emailStep ? <div className="account-email-step">
      <EmailArtwork />
      <p>{profile.emailVerified ? 'Your email address is confirmed.' : <>Confirm <strong>{profile.email}</strong> to verify your account.</>}</p>
      {!profile.emailVerified && token && <EmailVerificationForm token={token} onVerified={() => setProfile({ ...profile, emailVerified: true })} />}
      <a className={profile.emailVerified ? 'button button--primary' : 'button button--secondary'} href={destination}>
        {profile.emailVerified ? 'Continue to DevUP' : 'Verify later'}
      </a>
    </div> : <AvatarPicker saving={saving} error={avatarError} onSave={avatar => void saveAvatar(avatar)} onSkip={nextAfterAvatar} />)}
  </AccountShell>;
}
