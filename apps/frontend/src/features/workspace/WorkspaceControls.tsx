import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal, X } from 'lucide-react';
import { Avatar } from './components';
import { documentPageSize } from './workspace-api';
import './workspace-controls.css';
import './workspace-list.css';

export function LoadingPanel({ label }: { label: string }) {
  return <div className="wu-loading-panel" role="status">
    <span className="wu-visually-hidden">{label}</span>
    <div aria-hidden="true" className="wu-skeleton" />
    <div aria-hidden="true" className="wu-skeleton" />
    <div aria-hidden="true" className="wu-skeleton" />
  </div>;
}

export function DocumentPagination({ page, count, onPage, disabled = false }: {
  page: number; count?: number; onPage: (page: number) => void; disabled?: boolean;
}) {
  const hasNext = (count ?? 0) > documentPageSize;
  if (page === 1 && !hasNext) return null;
  return <nav className="wu-document-pagination" aria-label="Document pages">
    <button className="wu-button wu-button--secondary" type="button" disabled={disabled || page === 1} onClick={() => onPage(page - 1)}>Previous</button>
    <span aria-live="polite">Page {page}</span>
    <button className="wu-button wu-button--secondary" type="button" disabled={disabled || !hasNext} onClick={() => onPage(page + 1)}>Next</button>
  </nav>;
}

export function Drawer({ title, children, onClose, confirmation = false, closeDisabled = false, className = '', closeLabel }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  confirmation?: boolean;
  closeDisabled?: boolean;
  className?: string;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog ref={ref} className={(confirmation ? 'wu-modal wu-native-confirmation' : 'wu-drawer wu-native-drawer') + (className ? ' ' + className : '')}
      role={confirmation ? 'alertdialog' : undefined} aria-labelledby={id}
      onClose={onClose} onCancel={event => { if (closeDisabled) event.preventDefault(); }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')).filter(element => element.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      onClick={event => { if (!closeDisabled && event.target === event.currentTarget) ref.current?.close(); }}>
      <div className={confirmation ? undefined : 'wu-drawer-body'}>
        <div className={confirmation ? 'wu-modal-head' : 'wu-drawer-head'}>
          <h2 id={id}>{title}</h2>
          <button type="button" className="wu-icon-button" aria-label={closeLabel ?? (confirmation ? 'Close dialog' : 'Close details')} disabled={closeDisabled} onClick={() => ref.current?.close()}><X size={18} /></button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function ActionMenu({ label, actions }: { label: string; actions: { label: string; run: () => void; disabled?: boolean }[] }) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const [menuOpen,setMenuOpen] = useState(false);
  function close(restore = false) { menu.current?.hidePopover(); if (restore) trigger.current?.focus({ preventScroll: true }); }
  function position() {
    if (!menu.current || !trigger.current) return;
    const anchor=trigger.current.getBoundingClientRect(),width=menu.current.offsetWidth,height=menu.current.offsetHeight;
    if(anchor.bottom<0||anchor.top>innerHeight){close();return;}
    menu.current.dataset.side=anchor.bottom+height+6<innerHeight?'below':'above';
    menu.current.style.left=Math.max(8,Math.min(anchor.right-width,innerWidth-width-8))+'px';
    menu.current.style.top=Math.max(8,anchor.bottom+height+6<innerHeight?anchor.bottom+6:anchor.top-height-6)+'px';
  }
  useEffect(()=>{if(!menuOpen)return;window.addEventListener('resize',position);window.addEventListener('scroll',position,true);return()=>{window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);};},[menuOpen]);
  return <>
    <button ref={trigger} type="button" className="wu-icon-button" aria-label={label} popoverTarget={id}
      onClick={() => requestAnimationFrame(position)} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();menu.current?.showPopover();position();const buttons=menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');(event.key==='ArrowUp'?buttons?.[buttons.length-1]:buttons?.[0])?.focus();}}}><MoreHorizontal size={17}/></button>
    <div ref={menu} id={id} popover="auto" className="wu-action-menu" role="group" aria-label={label}
      onToggle={event=>{const expanded=(event.nativeEvent as ToggleEvent).newState==='open';setMenuOpen(expanded);if(expanded){position();if(!menu.current?.contains(document.activeElement))menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();}}}
      onKeyDown={event=>{
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);return;}
        if(event.key==='Tab'){close(true);return;}
        if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
        event.preventDefault();const buttons=Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]),index=buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:event.key==='ArrowDown'?(index+1)%buttons.length:(index-1+buttons.length)%buttons.length;buttons[next]?.focus();
      }}>
      {actions.map((action,index)=><button key={action.label} type="button" disabled={action.disabled} data-destructive={/^(delete|remove|revoke|disconnect)\b/i.test(action.label)||undefined} data-separated={index>0&&/^(delete|remove|revoke|disconnect)\b/i.test(action.label)||undefined} onClick={()=>{close(true);action.run();}}>{action.label}</button>)}
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
