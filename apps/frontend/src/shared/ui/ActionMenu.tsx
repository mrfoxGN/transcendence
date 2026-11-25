import { Icon } from './Icon';
import { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
export function ActionMenu({
  label,
  actions,
}: {
  label: string;
  actions: { label: string; run: () => void; disabled?: boolean }[];
}) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  function close(restore = false) {
    menu.current?.hidePopover();
    if (restore) trigger.current?.focus({ preventScroll: true });
  }
  function position() {
    if (!menu.current || !trigger.current) return;
    const anchor = trigger.current.getBoundingClientRect(),
      width = menu.current.offsetWidth,
      height = menu.current.offsetHeight;
    if (anchor.bottom < 0 || anchor.top > innerHeight) {
      close();
      return;
    }
    menu.current.dataset.side = anchor.bottom + height + 6 < innerHeight ? 'below' : 'above';
    menu.current.style.left =
      Math.max(8, Math.min(anchor.right - width, innerWidth - width - 8)) + 'px';
    menu.current.style.top =
      Math.max(
        8,
        anchor.bottom + height + 6 < innerHeight ? anchor.bottom + 6 : anchor.top - height - 6,
      ) + 'px';
  }
  useEffect(() => {
    if (!menuOpen) return;
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [menuOpen]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="wu-icon-button"
        aria-label={label}
        popoverTarget={id}
        onClick={() => requestAnimationFrame(position)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            menu.current?.showPopover();
            position();
            const buttons =
              menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
            (event.key === 'ArrowUp' ? buttons?.[buttons.length - 1] : buttons?.[0])?.focus();
          }
        }}
      >
        <Icon icon={MoreHorizontal} size={17} strokeWidth={2} />
      </button>
      <div
        ref={menu}
        id={id}
        popover="auto"
        className="wu-action-menu"
        role="group"
        aria-label={label}
        onToggle={(event) => {
          const expanded = (event.nativeEvent as ToggleEvent).newState === 'open';
          setMenuOpen(expanded);
          if (expanded) {
            position();
            if (!menu.current?.contains(document.activeElement))
              menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close(true);
            return;
          }
          if (event.key === 'Tab') {
            close(true);
            return;
          }
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const buttons = Array.from(
              menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
            ),
            index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? buttons.length - 1
                : event.key === 'ArrowDown'
                  ? (index + 1) % buttons.length
                  : (index - 1 + buttons.length) % buttons.length;
          buttons[next]?.focus();
        }}
      >
        {actions.map((action, index) => (
          <button
            key={action.label}
            type="button"
            disabled={action.disabled}
            data-destructive={
              /^(delete|remove|revoke|disconnect)\b/i.test(action.label) || undefined
            }
            data-separated={
              (index > 0 && /^(delete|remove|revoke|disconnect)\b/i.test(action.label)) || undefined
            }
            onClick={() => {
              close(true);
              action.run();
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </>
  );
}
