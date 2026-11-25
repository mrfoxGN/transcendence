import { Tabs } from '../../shared/ui/Tabs';

const tabs = [
  { value: 'repository', label: 'Repository' },
  { value: 'branches', label: 'Branches' },
  { value: 'commits', label: 'Commits' },
  { value: 'changes', label: 'Code changes' },
] as const;

export type GitHubTab = (typeof tabs)[number]['value'];
export { tabs as githubTabs };

export function MagicTab({
  value,
  onChange,
}: {
  value: GitHubTab;
  onChange: (value: GitHubTab) => void;
}) {
  return (
    <Tabs
      items={tabs}
      value={value}
      onChange={onChange}
      idPrefix="github"
      label="GitHub preview"
      className="github-tabs"
    />
  );
}
