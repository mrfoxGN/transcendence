import {
  GitBranch,
  GitCommitHorizontal,
  House,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';

const tabs = [
  { label: 'Repository', icon: House },
  { label: 'Branches', icon: GitBranch },
  { label: 'Commits', icon: GitCommitHorizontal },
  { label: 'Contributors', icon: UsersRound },
  { label: 'Collaborators', icon: UserRoundCheck },
] as const;

export type GithubTabName = (typeof tabs)[number]['label'];

interface GithubTabsProps {
  active: GithubTabName;
  owner: boolean;
  onChange: (tab: GithubTabName) => void;
}

export function GithubTabs({
  active,
  owner,
  onChange,
}: GithubTabsProps) {
  return (
    <nav className="wu-github-tabs" aria-label="GitHub navigation">
      {tabs
        .filter(tab => owner || tab.label !== 'Collaborators')
        .map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            className="wu-github-tab"
            aria-pressed={active === label}
            onClick={() => onChange(label)}
          >
            <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
    </nav>
  );
}
