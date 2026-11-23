const tabs = [{ label: 'Repository' }, { label: 'Branches' }, { label: 'Commits' }, { label: 'Contributors' }, { label: 'Collaborators' }] as const;

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
        .map(({ label }) => (
          <button
            key={label}
            type="button"
            className="wu-github-tab"
            aria-pressed={active === label}
            onClick={() => onChange(label)}
          >
            <span>{label}</span>
          </button>
        ))}
    </nav>
  );
}
