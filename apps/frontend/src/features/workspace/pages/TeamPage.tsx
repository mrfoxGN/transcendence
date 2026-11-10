import { CheckCircle2, GitPullRequest, Plus, Users } from 'lucide-react';
import { Avatar, IconTile, Panel, Pill } from '../components';
import { people } from '../previewData';
import { ActionMenu } from '../WorkspaceControls';
import type { PageHeading } from '../types';

type TeamPageProps = {
  pageHeading: PageHeading;
  workspaceName: string;
  onInvite: () => void;
  setToast: (message: string) => void;
};

export function TeamPage({
  pageHeading,
  workspaceName,
  onInvite,
  setToast,
}: TeamPageProps) {
  async function copyEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email);
      setToast('Email copied.');
    } catch {
      setToast('Could not copy the email.');
    }
  }

  return <>{pageHeading(<button className="wu-button wu-button--primary" type="button" onClick={onInvite}><Plus size={16} />Invite member</button>)}
    <div className="wu-stat-grid wu-stat-grid--compact"><Panel className="wu-stat"><div className="wu-stat-top"><IconTile tone="blue"><Users size={16} /></IconTile><span>Team members</span></div><div className="wu-stat-bottom"><strong>5</strong><Pill tone="blue">Across this workspace</Pill></div></Panel><Panel className="wu-stat"><div className="wu-stat-top"><IconTile tone="mint"><CheckCircle2 size={16} /></IconTile><span>Active</span></div><div className="wu-stat-bottom"><strong>4</strong><Pill tone="mint">1 invitation pending</Pill></div></Panel><Panel className="wu-stat"><div className="wu-stat-top"><IconTile tone="violet"><GitPullRequest size={16} /></IconTile><span>Open tasks</span></div><div className="wu-stat-bottom"><strong>12</strong><Pill tone="violet">Shared workload</Pill></div></Panel></div>
    <Panel className="wu-content-panel"><div className="wu-panel-heading"><div><h2>People</h2><p>Members with access to {workspaceName}.</p></div><button className="wu-button wu-button--secondary" type="button" onClick={onInvite}><Plus size={15} />Add people</button></div><div className="wu-table-wrap"><table className="wu-table"><thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr></thead><tbody>{people.map(person => <tr key={person.email}><td><span className="wu-person"><Avatar initials={person.initials} tone={person.color} /><span><strong>{person.name}</strong><small>{person.email}</small></span></span></td><td>{person.role}</td><td><Pill tone={person.status === 'Active' ? 'mint' : 'orange'}>{person.status}</Pill></td><td className="wu-muted">{person.status === 'Active' ? 'Apr 02' : 'Pending'}</td><td><ActionMenu label={"Actions for " + person.name} actions={[{ label: "Copy email", run: () => void copyEmail(person.email) }]} /></td></tr>)}</tbody></table></div></Panel>
  </>;
}
