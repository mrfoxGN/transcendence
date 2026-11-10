import { useEffect, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { ArrowRight, ListTodo, Search, X, type LucideIcon } from 'lucide-react';
import type { PageKey, Task } from './types';
import './workspace-command.css';

type WorkspaceCommandProps = {
  pages: { key: PageKey; label: string; icon: LucideIcon }[];
  tasks: Task[];
  disabled: boolean;
  onNavigate: (page: PageKey) => void;
  onOpenTask: (task: Task) => void;
};

export function WorkspaceCommand({ pages, tasks, disabled, onNavigate, onOpenTask }: WorkspaceCommandProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState('');
  const isApple = /Mac|iPhone|iPad/.test(navigator.platform);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.isComposing || disabled || document.querySelector('dialog[open]')) return;
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        trigger.current?.click();
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [disabled]);

  function select(action: () => void) {
    dialog.current?.close();
    action();
  }

  return (
    <>
      <button
        ref={trigger}
        className="wu-command-trigger"
        type="button"
        disabled={disabled}
        aria-label="Search tasks and pages"
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        onClick={() => { if (!dialog.current?.open) dialog.current?.showModal(); }}
      >
        <Search size={16} aria-hidden="true" />
        <span>Search tasks and pages</span>
        <kbd aria-hidden="true">{isApple ? '⌘ K' : 'Ctrl K'}</kbd>
      </button>
      <dialog
        ref={dialog}
        className="wu-command-dialog"
        aria-label="Search workspace"
        onClose={() => setQuery('')}
        onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}
      >
        <Command label="Search workspace" loop>
          <div className="wu-command-input">
            <Search size={18} aria-hidden="true" />
            <Command.Input autoFocus value={query} onValueChange={setQuery} placeholder="Search tasks and pages…" />
            <button type="button" className="wu-icon-button" aria-label="Close search" onClick={() => dialog.current?.close()}><X size={18} /></button>
          </div>
          <Command.List className="wu-command-results">
            <Command.Empty>No tasks or pages match your search.</Command.Empty>
            <Command.Group heading="Pages">
              {pages.map(({ key, label, icon: Icon }) => (
                <Command.Item key={key} value={`page-${key}`} keywords={[label]} onSelect={() => select(() => onNavigate(key))}>
                  <Icon size={17} aria-hidden="true" />
                  <span>{label}</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Tasks">
              {tasks.map(task => (
                <Command.Item key={task.id} value={task.id} keywords={[task.title, task.person, task.status]} onSelect={() => select(() => onOpenTask(task))}>
                  <ListTodo size={17} aria-hidden="true" />
                  <span>{task.title}</span>
                  <small>{task.id}</small>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
          <div className="wu-command-footer" aria-hidden="true">
            <span><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span>
            <span><kbd>Enter</kbd> Open</span>
            <span><kbd>Esc</kbd> Close</span>
          </div>
        </Command>
      </dialog>
    </>
  );
}
