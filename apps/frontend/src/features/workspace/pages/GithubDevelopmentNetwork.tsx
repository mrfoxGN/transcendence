import './github-network.css';
interface Collaborator { login: string; avatarUrl: string; profileUrl: string; role: string; isOwner: boolean; }
interface GithubDevelopmentNetworkProps { collaborators?: Collaborator[]; error?: string; onRetry: () => void; onViewAll: () => void; }
export function GithubDevelopmentNetwork({ collaborators, error, onRetry, onViewAll }: GithubDevelopmentNetworkProps) {
  const visible = [...(collaborators ?? [])].sort((a, b) => Number(b.isOwner) - Number(a.isOwner)).slice(0, 4);
  return <section className="wu-github-network">
    <header className="wu-github-network__heading"><h2>Collaborators</h2><button type="button" className="wu-text-button" onClick={onViewAll}>View all</button></header>
    {error ? <div role="alert"><p>Could not load collaborators.</p><button className="wu-text-button" type="button" onClick={onRetry}>Try again</button></div>
      : !collaborators ? <p role="status">Loading collaborators…</p>
      : !visible.length ? <p>No collaborators found.</p>
      : <ul className="wu-github-people-list">{visible.map(person => <li key={person.login}>
        <a href={person.profileUrl} target="_blank" rel="noopener noreferrer"><span className="wu-github-person-avatar" aria-hidden="true">{person.login.slice(0, 2).toUpperCase()}<img src={person.avatarUrl} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} /></span><span>{person.login}<small>{person.isOwner ? 'Owner' : person.role}</small></span></a>
      </li>)}</ul>}
    {collaborators && <p className="wu-github-network__footer">{collaborators.length} collaborators with repository access</p>}
  </section>;
}
