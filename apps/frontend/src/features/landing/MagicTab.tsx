import { useRef, useState, type KeyboardEvent } from 'react';

const tabs = [
  { value: 'repository', label: 'Repository' },
  { value: 'branches', label: 'Branches' },
  { value: 'commits', label: 'Commits' },
  { value: 'changes', label: 'Code changes' },
] as const;

export type GitHubTab = typeof tabs[number]['value'];
export { tabs as githubTabs };

// GodUI Magic Tab adapted to the landing page's plain CSS.
export function MagicTab({ value, onChange }: {
  value: GitHubTab;
  onChange: (value: GitHubTab) => void;
}) {
  const [focused, setFocused] = useState<GitHubTab | null>(null);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex(tab => tab.value === (focused ?? value));
    const next = {
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    buttons.current[next]?.focus();
  }

  return (
    <div className="github-tabs" role="tablist" aria-label="GitHub preview" onKeyDown={moveFocus}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(null); }}>
      {tabs.map((tab, index) => (
        <button key={tab.value} id={`github-tab-${tab.value}`} type="button" role="tab"
          aria-selected={value === tab.value} aria-controls={`github-panel-${tab.value}`}
          tabIndex={(focused ?? value) === tab.value ? 0 : -1}
          ref={node => { buttons.current[index] = node; }}
          onFocus={() => setFocused(tab.value)} onClick={() => onChange(tab.value)}>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
