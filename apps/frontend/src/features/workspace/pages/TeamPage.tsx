import { Search, UserRoundPlus } from 'lucide-react';
import { useState } from 'react';
import { IllustratedEmptyState } from '../../../shared/illustrations/EmptyIllustration';
import { Button, Input } from '../../../shared/ui';
import { Avatar, Panel, Pill } from '../components';
import type { PageHeading } from '../types';
import { workspaceRequest } from '../workspace-api';
import type { Member } from '../workspace-tasks';
import { ActionMenu, Drawer, LoadingPanel } from '../WorkspaceControls';

export type TeamInvitation = {
  id: string;
  invitedEmail: string | null;
  expiresAt: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
};

export function TeamPage({
  pageHeading,
  workspaceName,
  members,
  loadError,
  retry,
  path,
  token,
  profileId,
  onInvite,
  invitations,
  delivery,
  onDelivery,
  refreshWorkspace,
  archived = false,
}: {
  pageHeading: PageHeading;
  workspaceName: string;
  members?: Member[];
  loadError: boolean;
  retry: () => void;
  path: string;
  token: string | null;
  profileId: string;
  onInvite: () => void;
  invitations: { items?: TeamInvitation[]; error: boolean; retry: () => void };
  delivery?: TeamInvitation;
  onDelivery: (invitation?: TeamInvitation) => void;
  refreshWorkspace: () => void;
  archived?: boolean;
}) {
  const owner = members?.some((member) => member.userId === profileId && member.isOwner);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [confirmation, setConfirmation] = useState<{
    title: string;
    action: string;
    detail: string;
    run: () => Promise<void>;
  }>();
  const visibleMembers = members?.filter((person) =>
    person.username.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const statuses = {
    PENDING: 'Pending',
    ACCEPTED: 'Accepted',
    REJECTED: 'Declined',
    CANCELLED: 'Revoked',
    EXPIRED: 'Expired',
  };

  async function runAction(action: () => Promise<void>) {
    if (!token || busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
      setConfirmation(undefined);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not complete this action.');
    } finally {
      setBusy(false);
    }
  }

  function confirm(title: string, action: string, detail: string, run: () => Promise<void>) {
    setError('');
    setConfirmation({ title, action, detail, run });
  }

  return (
    <>
      {pageHeading(
        owner && !archived ? (
          <Button
            variant="primary"
            className="wu-button--with-icon"
            type="button"
            onClick={onInvite}
          >
            <UserRoundPlus size={15} aria-hidden="true" />
            Invite member
          </Button>
        ) : (
          !owner && members?.some((member) => member.userId === profileId) && (
            <Button
              variant="secondary"
              type="button"
              onClick={() =>
                confirm(
                  'Leave this workspace?',
                  'Leave workspace',
                  'You’ll lose access and your tasks will become unassigned.',
                  async () => {
                    await workspaceRequest(path + '/membership', token, { method: 'DELETE' });
                    location.replace('/workspaces');
                  },
                )
              }
            >
              Leave workspace
            </Button>
          )
        ),
      )}
      <Panel className="wu-content-panel wu-team-panel">
        <div className="wu-panel-heading">
          <div>
            <h2>People{members ? ' (' + members.length + ')' : ''}</h2>
            <p>Members with access to {workspaceName}.</p>
          </div>
        </div>
        {!!members?.length && (
          <label className="wu-list-search">
            <Search size={16} aria-hidden="true" />
            <Input
              type="search"
              aria-label="Search members"
              placeholder="Search members"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        )}
        {loadError ? (
          <p role="alert">
            Could not load members.{' '}
            <button className="wu-text-button" onClick={retry}>
              Try again
            </button>
          </p>
        ) : !members || !visibleMembers ? (
          <LoadingPanel label="Loading workspace members" />
        ) : !members.length ? (
          <IllustratedEmptyState
            kind="team"
            title="Make room for your team"
            detail="Invite someone to start collaborating."
            action={owner && !archived ? 'Invite member' : undefined}
            onAction={onInvite}
          />
        ) : !visibleMembers.length ? (
          <IllustratedEmptyState
            compact
            kind="search"
            title="No matching members"
            action="Clear search"
            onAction={() => setQuery('')}
          />
        ) : (
          <div className="wu-table-wrap">
            <table className="wu-table wu-team-table">
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col">Role</th>
                  <th scope="col">Joined</th>
                  <th scope="col">
                    <span className="wu-visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleMembers.map((person) => (
                  <tr key={person.userId}>
                    <td data-label="Member">
                      <span className="wu-person">
                        {person.avatarUrl ? (
                          <img className="wu-avatar" src={person.avatarUrl} alt="" />
                        ) : (
                          <Avatar
                            initials={person.username.slice(0, 2).toUpperCase()}
                            preview={false}
                          />
                        )}
                        <strong>{person.username}</strong>
                        {person.userId === profileId && <small>You</small>}
                      </span>
                    </td>
                    <td data-label="Role">
                      <Pill tone={person.isOwner ? 'blue' : 'neutral'}>
                        {person.isOwner ? 'Owner' : 'Member'}
                      </Pill>
                    </td>
                    <td data-label="Joined">{new Date(person.joinedAt).toLocaleDateString()}</td>
                    <td className="wu-team-actions" data-label="Actions">
                      {owner && !archived && !person.isOwner && (
                        <ActionMenu
                          label={'Actions for ' + person.username}
                          actions={[
                            {
                              label: 'Transfer ownership',
                              run: () =>
                                confirm(
                                  'Transfer ownership to ' + person.username + '?',
                                  'Transfer ownership',
                                  'They’ll manage this workspace. You’ll stay as a member.',
                                  async () => {
                                    await workspaceRequest(
                                      path + '/owner/' + person.userId,
                                      token,
                                      { method: 'PATCH' },
                                    );
                                    refreshWorkspace();
                                    retry();
                                  },
                                ),
                            },
                            {
                              label: 'Remove member',
                              run: () =>
                                confirm(
                                  'Remove ' + person.username + '?',
                                  'Remove member',
                                  'They’ll lose access and their tasks will become unassigned.',
                                  async () => {
                                    await workspaceRequest(
                                      path + '/members/' + person.userId,
                                      token,
                                      { method: 'DELETE' },
                                    );
                                    retry();
                                  },
                                ),
                            },
                          ]}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {owner && (
        <Panel className="wu-content-panel">
          <h2>Invitations</h2>
          {!archived && delivery && (
            <div role="status" className="wu-invitation-success">
              <p>
                Invitation created successfully. The registered DevUP user can accept or decline it
                from their notifications.
              </p>
              <button className="wu-text-button" type="button" onClick={() => onDelivery()}>
                Dismiss
              </button>
            </div>
          )}
          {!confirmation && error && <p role="alert">{error}</p>}
          {invitations.error ? (
            <p role="alert">
              Could not load invitations.{' '}
              <button type="button" className="wu-text-button" onClick={invitations.retry}>
                Try again
              </button>
            </p>
          ) : !invitations.items ? (
            <LoadingPanel label="Loading invitations" />
          ) : !invitations.items.length ? (
            <IllustratedEmptyState
              compact
              kind="invitations"
              title="No invitations yet"
              detail="Invite someone to join this workspace."
              action={!archived ? 'Invite member' : undefined}
              onAction={onInvite}
            />
          ) : (
            <ul className="wu-document-list">
              {invitations.items.map((invitation) => (
                <li key={invitation.id}>
                  <span>
                    {invitation.invitedEmail ?? 'DevUP user'} · {statuses[invitation.status]}
                    {invitation.status === 'PENDING' &&
                      invitation.expiresAt &&
                      ' · Expires ' + new Date(invitation.expiresAt).toLocaleDateString()}
                  </span>
                  {(invitation.status === 'PENDING' || invitation.status === 'EXPIRED') && (
                    <ActionMenu
                      label={'Invitation actions for ' + (invitation.invitedEmail ?? 'DevUP user')}
                      actions={[
                        {
                          label: 'Revoke invitation',
                          run: () =>
                            confirm(
                              'Revoke this invitation?',
                              'Revoke invitation',
                              'The recipient will need a new invitation to join.',
                              async () => {
                                await workspaceRequest(
                                  path + '/invitations/' + invitation.id + '/cancel',
                                  token,
                                  { method: 'PATCH' },
                                );
                                if (delivery?.id === invitation.id) onDelivery();
                                invitations.retry();
                              },
                            ),
                        },
                      ]}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
      {confirmation && (
        <Drawer
          title={confirmation.title}
          confirmation
          onClose={() => {
            if (!busy) setConfirmation(undefined);
          }}
        >
          <p>{confirmation.detail}</p>
          {error && <p role="alert">{error}</p>}
          <div className="wu-modal-actions">
            <button
              className="wu-button wu-button--secondary"
              autoFocus
              disabled={busy}
              onClick={() => setConfirmation(undefined)}
            >
              Cancel
            </button>
            <button
              className="wu-button wu-button--primary"
              disabled={busy}
              onClick={() => void runAction(confirmation.run)}
            >
              {confirmation.action}
            </button>
          </div>
        </Drawer>
      )}
    </>
  );
}
