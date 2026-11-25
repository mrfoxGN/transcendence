import { Tabs } from '../../../shared/ui/Tabs';
const tabs = [
  { label: 'Repository' },
  { label: 'Branches' },
  { label: 'Commits' },
  { label: 'Contributors' },
  { label: 'Collaborators' },
] as const;

export type GithubTabName = (typeof tabs)[number]['label'];

interface GithubTabsProps {
  active: GithubTabName;
  owner: boolean;
  onChange: (tab: GithubTabName) => void;
}

export function GithubTabs({ active, owner, onChange }: GithubTabsProps) {
  return (
    <Tabs
      items={tabs
        .filter((tab) => owner || tab.label !== 'Collaborators')
        .map((tab) => ({ value: tab.label, label: tab.label }))}
      value={active}
      onChange={onChange}
      idPrefix="workspace-github"
      panelId="workspace-github-panel"
      label="GitHub navigation"
      className="wu-github-tabs"
      itemClassName="wu-github-tab"
    />
  );
}
