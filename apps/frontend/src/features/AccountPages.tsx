import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { accountRequest, authRoute, requestedWorkspace } from './auth-routing';
import { sessionKey } from './WorkspacePicker';

function AccountShell({ title, children }: { title: string; children: ReactNode }) {
  return <main className="auth-page">
    <header className="auth-header"><a href="/" className="brand"><img src="/devup.svg" alt="" width="34" height="34" />DevUP</a></header>
    <section className="auth-shell" aria-labelledby="account-title">
      <h1 id="account-title">{title}</h1>
      <div className="auth-panel">{children}</div>
    </section>
  </main>;
}

export function AccountRecovery({ mode }: { mode: 'request' | 'reset' | 'verify' }) {
  const [linkToken] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token') ?? '');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);
  const destination = requestedWorkspace();
  const title = mode === 'verify' ? 'Verify your email' : 'Reset your password';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    const password = String(fields.get('password') ?? '');
    if (mode === 'reset' && password !== fields.get('confirm')) {
      setMessage('The passwords must match.');
      return;
    }
    setPending(true);
    setMessage('');
    try {
      if (mode === 'request') {
        await accountRequest('password-reset/request', { email: String(fields.get('email') ?? '').trim() });
      } else if (mode === 'reset') {
        await accountRequest('password-reset/confirm', { token: linkToken, password });
        sessionStorage.removeItem(sessionKey);
      } else {
        await accountRequest('email-verification/confirm', { token: linkToken });
      }
      if (mode !== 'request') history.replaceState(history.state, '', location.pathname + location.search);
      setComplete(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not complete the request. Try again.');
    } finally {
      setPending(false);
    }
  }

  return <AccountShell title={title}>
    {complete ? <div className="auth-success">
      <p role="status">{mode === 'request' ? 'If a DevUP account uses that email, a password reset link will be sent.'
        : mode === 'reset' ? 'Your password has been updated.' : 'Your email is verified.'}</p>
      <a className="button button--primary" href={mode === 'verify' && sessionStorage.getItem(sessionKey) ? destination : authRoute('/login', destination)}>
        {mode === 'verify' && sessionStorage.getItem(sessionKey) ? 'Open workspaces' : 'Sign in'}
      </a>
    </div> : mode !== 'request' && !linkToken ? <p role="alert">Open the link from your DevUP email.</p>
      : <form className="auth-form" onSubmit={submit}>
        {mode === 'request' && <label>Email
          <input type="email" name="email" autoComplete="email" maxLength={320} required />
        </label>}
        {mode === 'reset' && <>
          <label>New password<input type="password" name="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
          <label>Confirm new password<input type="password" name="confirm" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
        </>}
        {mode === 'verify' && <p>Confirm the email address associated with this link.</p>}
        {message && <p className="auth-error" role="alert">{message}</p>}
        <button className="button button--primary" type="submit" disabled={pending}>
          {pending ? 'Please wait…' : mode === 'request' ? 'Send reset link' : mode === 'reset' ? 'Update password' : 'Verify email'}
        </button>
      </form>}
    {!complete && <p className="auth-switch">
      <a href={mode === 'reset' ? authRoute('/forgot-password', destination) : authRoute('/login', destination)}>
        {mode === 'reset' ? 'Request a new reset link' : 'Back to sign in'}
      </a>
    </p>}
  </AccountShell>;
}

export function FirstRun() {
  const token = sessionStorage.getItem(sessionKey);
  const destination = requestedWorkspace();
  const [profile, setProfile] = useState<{ id: string; username: string; email: string; emailVerified?: boolean }>();
  const [loadError, setLoadError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [mailFeedback, setMailFeedback] = useState<{ message: string; error: boolean }>();
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

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

  async function saveAvatar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !token || saving) return;
    const avatarUrl = String(new FormData(event.currentTarget).get('avatar') ?? '').trim();
    if (!/^https:\/\//i.test(avatarUrl)) {
      setAvatarError('Enter an HTTPS image URL.');
      return;
    }
    setSaving(true);
    setAvatarError('');
    try {
      const response = await fetch('/api/users/' + encodeURIComponent(profile.id), {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl }),
      });
      if (!response.ok) throw new Error('Could not save your avatar. Try again.');
      location.replace(destination);
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Could not save your avatar.');
    } finally { setSaving(false); }
  }

  async function verify() {
    if (!token || sending) return;
    setSending(true);
    try {
      await accountRequest('email-verification/request', undefined, token);
      setMailFeedback({ message: 'Check your email for a verification link.', error: false });
    } catch (error) {
      setMailFeedback({ message: error instanceof Error ? error.message : 'Could not send email.', error: true });
    } finally { setSending(false); }
  }

  return <AccountShell title={profile ? 'Welcome, ' + profile.username : 'Set up your profile'}>
    {loadError && <p role="alert">{loadError}</p>}
    {!profile && !loadError && <p role="status">Loading your profile…</p>}
    {profile && <>
      <form className="auth-form" onSubmit={saveAvatar}>
        <label>Avatar image URL
          <input name="avatar" type="url" placeholder="https://example.com/avatar.png" maxLength={500} required />
        </label>
        {avatarError && <p className="auth-error" role="alert">{avatarError}</p>}
        <div className="workspace-picker-actions">
          <button className="button button--primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save avatar and continue'}</button>
          <button className="button button--secondary" type="button" disabled={saving} onClick={() => location.replace(destination)}>Skip avatar</button>
        </div>
      </form>
      {!profile.emailVerified && <p><button className="button button--secondary" type="button" disabled={sending} onClick={() => void verify()}>
        {sending ? 'Sending…' : 'Send verification email'}
      </button></p>}
      {mailFeedback && <p role={mailFeedback.error ? 'alert' : 'status'}>{mailFeedback.message}</p>}
    </>}
  </AccountShell>;
}
