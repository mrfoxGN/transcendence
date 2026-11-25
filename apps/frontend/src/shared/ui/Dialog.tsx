import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';
export function Dialog({
  title,
  children,
  onClose,
  confirmation = false,
  closeDisabled = false,
  className = '',
  closeLabel,
}: {
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
    <dialog
      ref={ref}
      className={
        (confirmation ? 'wu-modal wu-native-confirmation' : 'wu-drawer wu-native-drawer') +
        (className ? ' ' + className : '')
      }
      role={confirmation ? 'alertdialog' : undefined}
      aria-labelledby={id}
      onClose={onClose}
      onCancel={(event) => {
        if (closeDisabled) event.preventDefault();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(event) => {
        if (!closeDisabled && event.target === event.currentTarget) ref.current?.close();
      }}
    >
      <div className={confirmation ? undefined : 'wu-drawer-body'}>
        <div className={confirmation ? 'wu-modal-head' : 'wu-drawer-head'}>
          <h2 id={id}>{title}</h2>
          <button
            type="button"
            className="wu-icon-button"
            aria-label={closeLabel ?? (confirmation ? 'Close dialog' : 'Close details')}
            disabled={closeDisabled}
            onClick={() => ref.current?.close()}
          >
            <Icon icon={X} size={18} strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
