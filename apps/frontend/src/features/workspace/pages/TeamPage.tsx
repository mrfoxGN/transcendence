import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Avatar, Panel, Pill } from '../components';
import { ActionMenu, Drawer, LoadingPanel } from '../WorkspaceControls';
import { workspaceRequest } from '../workspace-api';
import type { Member } from '../workspace-tasks';
import type { PageHeading } from '../types';

export type PendingInvitation = { id: string; invitedEmail: string | null; createdAt: string };

export function TeamPage({ pageHeading, workspaceName, members, loadError, retry, path, token, profileId, onInvite, invitations }: {
  pageHeading: PageHeading; workspaceName: string; members?: Member[]; loadError: boolean; retry: () => void;
  path: string; token: string | null; profileId: string; onInvite: () => void;
  invitations: { items?: PendingInvitation[]; error: boolean; retry: () => void };
}) {
  const owner = members?.some(member => member.userId === profileId && member.isOwner);
  const [removing, setRemoving] = useState<Member>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState<PendingInvitation>();

  async function cancelInvitation() {
    if (!cancelling || !token || busy) return;
    setBusy(true);
    setError('');
    try {
      await workspaceRequest(path + '/invitations/' + cancelling.id + '/cancel', token, { method: 'PATCH' });
      invitations.retry();
      setCancelling(undefined);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not cancel this invitation.');
    } finally {
      setBusy(false);
    }
  }

  async function removeMember() {
    if (!removing || busy || !token) return;
    setBusy(true);
    setError('');
    try {
      await workspaceRequest(path + '/members/' + removing.userId, token, { method: 'DELETE' });
      setRemoving(undefined);
      retry();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not remove this member.');
    } finally {
      setBusy(false);
    }
  }

  return <>{pageHeading(owner && <button className="wu-button wu-button--primary" type="button" onClick={onInvite}><Plus size={16} />Invite member</button>)}
    <Panel className="wu-content-panel">
      <div className="wu-panel-heading"><div><h2>People{members ? ' (' + members.length + ')' : ''}</h2><p>Members with access to {workspaceName}.</p></div></div>
      {loadError ? <p role="alert">Could not load members. <button className="wu-text-button" onClick={retry}>Try again</button></p>
        : !members ? <LoadingPanel label="Loading workspace members" />
        : !members.length ? <p className="wu-muted">No workspace members found.</p>
        : <div className="wu-table-wrap"><table className="wu-table"><thead><tr><th>Member</th><th>Role</th><th>Joined</th><th><span className="wu-visually-hidden">Actions</span></th></tr></thead><tbody>
          {members.map(person => <tr key={person.userId}>
            <td><span className="wu-person">{person.avatarUrl ? <img className="wu-avatar" src={person.avatarUrl} alt="" /> : <Avatar initials={person.username.slice(0, 2).toUpperCase()} preview={false} />}<strong>{person.username}</strong>{person.userId === profileId && <small>You</small>}</span></td>
            <td><Pill tone={person.isOwner ? 'blue' : 'neutral'}>{person.isOwner ? 'Owner' : 'Member'}</Pill></td>
            <td>{new Date(person.joinedAt).toLocaleDateString()}</td>
            <td>{owner && !person.isOwner && <ActionMenu label={'Actions for ' + person.username} actions={[{ label: 'Remove member', run: () => { setError(''); setRemoving(person); } }]} />}</td>
          </tr>)}
        </tbody></table></div>}
    </Panel>
    {owner && <Panel className="wu-content-panel">
      <h2>Pending invitations</h2>
      {invitations.error ? <p role="alert">Could not load invitations. <button type="button" className="wu-text-button" onClick={invitations.retry}>Try again</button></p>
        : !invitations.items ? <LoadingPanel label="Loading pending invitations" />
        : !invitations.items.length ? <p className="wu-muted">No pending invitations.</p>
        : <ul className="wu-document-list">{invitations.items.map(invitation => <li key={invitation.id}>
          <span>{invitation.invitedEmail ?? 'DevUP user'} · {new Date(invitation.createdAt).toLocaleDateString()}</span>
          <button className="wu-text-button" type="button" onClick={() => { setError(''); setCancelling(invitation); }}>Cancel invitation</button>
        </li>)}</ul>}
    </Panel>}
    {cancelling && <Drawer title="Cancel invitation?" confirmation onClose={() => setCancelling(undefined)}>
      {error && <p role="alert">{error}</p>}
      <div className="wu-modal-actions"><button className="wu-button wu-button--secondary" autoFocus disabled={busy} onClick={() => setCancelling(undefined)}>Keep invitation</button>
        <button className="wu-button wu-button--primary" disabled={busy} onClick={() => void cancelInvitation()}>Cancel invitation</button></div>
    </Drawer>}
    {removing && <Drawer title={'Remove ' + removing.username + '?'} confirmation onClose={() => setRemoving(undefined)}>
      <p>They will lose access to this workspace.</p>
      {error && <p role="alert">{error}</p>}
      <div className="wu-modal-actions"><button className="wu-button wu-button--secondary" autoFocus disabled={busy} onClick={() => setRemoving(undefined)}>Cancel</button>
        <button className="wu-button wu-button--primary" disabled={busy} onClick={() => void removeMember()}>Remove member</button></div>
    </Drawer>}
  </>;
}
