import { useEffect, useId, useRef, type ReactNode } from 'react';
import { MoreHorizontal, X } from 'lucide-react';
import { Avatar } from './components';
import './workspace-controls.css';

export function LoadingPanel({ label }: { label: string }) {
  return <div className="wu-loading-panel" role="status">
    <span className="wu-visually-hidden">{label}</span>
    <div aria-hidden="true" className="wu-skeleton" />
    <div aria-hidden="true" className="wu-skeleton" />
    <div aria-hidden="true" className="wu-skeleton" />
  </div>;
}

export function Drawer({ title, children, onClose, confirmation = false }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  confirmation?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog ref={ref} className={confirmation ? 'wu-modal wu-native-confirmation' : 'wu-drawer wu-native-drawer'}
      role={confirmation ? 'alertdialog' : undefined} aria-labelledby={id}
      onClose={onClose} onClick={event => { if (event.target === event.currentTarget) ref.current?.close(); }}>
      <div className={confirmation ? undefined : 'wu-drawer-body'}>
        <div className={confirmation ? 'wu-modal-head' : 'wu-drawer-head'}>
          <h2 id={id}>{title}</h2>
          <button type="button" className="wu-icon-button" aria-label={confirmation ? 'Close dialog' : 'Close details'} onClick={() => ref.current?.close()}><X size={18} /></button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function ActionMenu({ label, actions }: { label: string; actions: { label: string; run: () => void; disabled?: boolean }[] }) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  return <>
    <button type="button" className="wu-icon-button" aria-label={label} popoverTarget={id}
      onClick={event => {
        const anchor = event.currentTarget.getBoundingClientRect();
        if (menu.current) {
          menu.current.style.left = Math.max(8, Math.min(anchor.right - 192, window.innerWidth - 200)) + 'px';
          menu.current.style.top = Math.min(anchor.bottom + 4, window.innerHeight - 48 - actions.length * 38) + 'px';
        }
      }}><MoreHorizontal size={17} /></button>
    <div ref={menu} popover="auto" id={id} className="wu-action-menu" role="group" aria-label={label}>
      {actions.map(action => <button type="button" key={action.label} disabled={action.disabled} onClick={() => {
        menu.current?.hidePopover();
        action.run();
      }}>{action.label}</button>)}
    </div>
  </>;
}

export function AvatarGroup({ people, label = 'Contributors' }: { people: { name: string; initials: string; tone?: string; preview?: boolean }[]; label?: string }) {
  if (!people.length) return null;
  return (
    <div className="wu-avatar-group" role="img" aria-label={label + ': ' + people.map(person => person.name).join(', ')}>
      {people.slice(0, 4).map(person => <span key={person.name} title={person.name}><Avatar {...person} small /></span>)}
      {people.length > 4 && <span className="wu-avatar-overflow" aria-hidden="true">+{people.length - 4}</span>}
    </div>
  );
}
