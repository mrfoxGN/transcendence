import { useEffect, useState } from 'react';
import { AccountShell } from './AccountPages';
import { authRoute } from './auth-routing';
import { sessionKey } from './WorkspacePicker';

const inviteKey = 'devup.workspace-invitation';
const destination = '/join-workspace';

function readInvitation() {
  const fields = new URLSearchParams(location.hash ? location.hash.slice(1) : sessionStorage.getItem(inviteKey) ?? '');
  const workspace = fields.get('workspace') ?? '';
  const invitation = fields.get('invitation') ?? '';
  const token = fields.get('token') ?? '';
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  return uuid.test(workspace) && uuid.test(invitation) && /^[A-Za-z0-9_-]{43}$/.test(token)
    ? { workspace, invitation, token } : null;
}

export function JoinWorkspace() {
  const [invite] = useState(readInvitation);
  const [session, setSession] = useState(() => sessionStorage.getItem(sessionKey));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!location.hash) return;
    if (invite) sessionStorage.setItem(inviteKey, new URLSearchParams(invite).toString());
    else sessionStorage.removeItem(inviteKey);
    history.replaceState(null, '', destination);
  }, [invite]);

  async function accept() {
    if (!invite || !session || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/workspaces/${invite.workspace}/invitations/${invite.invitation}/redeem`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: invite.token }),
      });
      if (response.status === 401) {
        sessionStorage.removeItem(sessionKey);
        setSession(null);
        return;
      }
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(response.status === 403
          ? 'Use the email address that received this invitation. If the link was replaced, open the latest email.'
          : typeof result?.message === 'string' ? result.message : 'Could not join the workspace. Try again.');
      }
      sessionStorage.removeItem(inviteKey);
      location.replace('/workspaces/' + invite.workspace);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not join the workspace. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return <AccountShell title="Join a workspace" onboarding>
    <div className="auth-form">
      {!invite ? <p className="auth-description">Open the invitation link you received or ask the workspace owner to send a new one.</p>
        : <p className="auth-description">Use the email address that received the invitation to join your team on DevUP.</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {invite && (session ? <>
        <button type="button" className="button button--primary" disabled={busy} onClick={() => void accept()}>{busy ? 'Joining…' : 'Accept invitation'}</button>
        <a className="button button--secondary" href={authRoute('/login', destination)}>Sign in with another account</a>
      </> : <>
        <a className="button button--primary" href={authRoute('/login', destination)}>Sign in</a>
        <a className="button button--secondary" href={authRoute('/register', destination)}>Create an account</a>
      </>)}
      <a href="/workspaces">Go to workspaces</a>
    </div>
  </AccountShell>;
}
