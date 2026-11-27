import { ArrowUpRight, Crown, Shield, Users, Wrench } from 'lucide-react';

import './github-collaborators.css';

interface Collaborator {
  login: string;
  avatarUrl: string;
  profileUrl: string;
  role: string;
  isOwner: boolean;
}

interface GithubCollaboratorsProps {
  collaborators: Collaborator[];
}

function getPermission(role: string) {
  switch (role.toLowerCase()) {
    case 'admin':
      return {
        label: 'Admin',
        style: 'admin',
        icon: Shield,
      };

    case 'write':
    case 'push':
      return {
        label: 'Write',
        style: 'write',
        icon: Wrench,
      };

    case 'read':
    case 'pull':
      return {
        label: 'Read',
        style: 'read',
        icon: Shield,
      };

    case 'maintain':
      return {
        label: 'Maintain',
        style: 'maintain',
        icon: Shield,
      };

    case 'triage':
      return {
        label: 'Triage',
        style: 'triage',
        icon: Shield,
      };

    default:
      return {
        label: role || 'Unknown',
        style: 'read',
        icon: Shield,
      };
  }
}

export function GithubCollaborators({ collaborators }: GithubCollaboratorsProps) {
  const sorted = [...collaborators].sort((a, b) => {
    if (a.isOwner !== b.isOwner) {
      return Number(b.isOwner) - Number(a.isOwner);
    }

    return a.login.localeCompare(b.login);
  });

  const adminCount = collaborators.filter(
    (collaborator) => collaborator.role.toLowerCase() === 'admin',
  ).length;

  const writeCount = collaborators.filter((collaborator) =>
    ['write', 'push'].includes(collaborator.role.toLowerCase()),
  ).length;

  return (
    <section className="wu-gcollab">
      <header className="wu-gcollab__header">
        <div className="wu-gcollab__heading">
          <span className="wu-gcollab__heading-icon">
            <Users size={26} aria-hidden="true" />
          </span>

          <div>
            <h2>Collaborators</h2>
            <p>People with access to this repository and their permissions.</p>
          </div>
        </div>

        <div className="wu-gcollab__stats">
          <div className="wu-gcollab__stat">
            <span className="wu-gcollab__stat-icon">
              <Users size={22} aria-hidden="true" />
            </span>

            <div>
              <strong>{collaborators.length}</strong>
              <span>Collaborators</span>
            </div>
          </div>

          <div className="wu-gcollab__stat">
            <span className="wu-gcollab__stat-icon">
              <Shield size={22} aria-hidden="true" />
            </span>

            <div>
              <strong>{adminCount}</strong>
              <span>Admin</span>
            </div>
          </div>

          <div className="wu-gcollab__stat">
            <span className="wu-gcollab__stat-icon">
              <Wrench size={22} aria-hidden="true" />
            </span>

            <div>
              <strong>{writeCount}</strong>
              <span>Write access</span>
            </div>
          </div>
        </div>
      </header>

      {sorted.length === 0 ? (
        <div className="wu-gcollab__empty">
          <Users size={27} aria-hidden="true" />
          <strong>No collaborators found</strong>
          <p>No repository collaborators are currently available.</p>
        </div>
      ) : (
        <div className="wu-gcollab__list">
          {sorted.map((collaborator) => {
            const permission = getPermission(collaborator.role);

            const PermissionIcon = permission.icon;

            return (
              <article className="wu-gcollab__card" key={collaborator.login}>
                <div className="wu-gcollab__identity">
                  <a
                    className="wu-gcollab__avatar"
                    href={collaborator.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View ${collaborator.login} on GitHub`}
                  >
                    <img
                      src={collaborator.avatarUrl}
                      alt=""
                      width={59}
                      height={59}
                      loading="lazy"
                    />
                  </a>

                  <div className="wu-gcollab__person">
                    <div className="wu-gcollab__name">
                      <a href={collaborator.profileUrl} target="_blank" rel="noopener noreferrer">
                        {collaborator.login}

                        <ArrowUpRight size={16} aria-hidden="true" />
                      </a>

                      {collaborator.isOwner && (
                        <span className="wu-gcollab__owner">
                          <Crown size={14} aria-hidden="true" />
                          Owner
                        </span>
                      )}
                    </div>

                    <span className="wu-gcollab__description">GitHub repository collaborator</span>
                  </div>
                </div>

                <div className="wu-gcollab__access">
                  <span
                    className={
                      'wu-gcollab__permission ' + `wu-gcollab__permission--${permission.style}`
                    }
                  >
                    <PermissionIcon size={15} aria-hidden="true" />

                    {permission.label}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="wu-gcollab__footer">
        <Shield size={15} aria-hidden="true" />
        Collaborator permissions are reported by GitHub. Access can be managed through the
        repository's GitHub settings.
      </p>
    </section>
  );
}
