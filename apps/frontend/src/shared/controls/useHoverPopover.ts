import { HOVER_OPEN_DELAY, HOVER_CLOSE_DELAY, supportsHover } from './hover-intent';
import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';

/** Pointer intent enhances an ordinary clickable, keyboard-accessible popover. */
export function useHoverPopover<T extends HTMLElement = HTMLDivElement>(
  onOpen?: (trigger: HTMLButtonElement | null) => void,
) {
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<T>(null);
  const [open, setOpen] = useState(false);
  const openTimer = useRef<number | undefined>(undefined),
    closeTimer = useRef<number | undefined>(undefined);
  const pinned = useRef(false),
    pointer = useRef({ trigger: false, panel: false });
  const clear = (timer: typeof openTimer) => {
    if (timer.current !== undefined) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
  };
  const isPopoverOpen = () => !!panel.current?.matches(':popover-open');
  const hasFocusWithinPopover = () =>
    !!panel.current?.contains(document.activeElement) || document.activeElement === trigger.current;
  function hide(restore = false) {
    clear(openTimer);
    clear(closeTimer);
    panel.current?.hidePopover();
    pinned.current = false;
    setOpen(false);
    if (restore) trigger.current?.focus({ preventScroll: true });
  }
  function show(keepOpen: boolean, focus = false) {
    clear(openTimer);
    clear(closeTimer);
    const wasOpen = isPopoverOpen();
    pinned.current = keepOpen;
    if (panel.current) panel.current.dataset.hoverIntent = String(!keepOpen);
    if (!wasOpen) onOpenRef.current?.(trigger.current);
    panel.current?.showPopover();
    setOpen(true);
    if (focus)
      panel.current
        ?.querySelector<HTMLElement>(
          'button:not(:disabled),summary,input:not(:disabled),a[href],select:not(:disabled)',
        )
        ?.focus({ preventScroll: true });
  }
  function handlePointerEnter(event: PointerEvent<HTMLElement>, part: 'trigger' | 'panel') {
    if (!supportsHover(event.pointerType)) return;
    pointer.current[part] = true;
    clear(closeTimer);
    if (part === 'trigger' && !isPopoverOpen()) {
      clear(openTimer);
      openTimer.current = window.setTimeout(() => {
        openTimer.current = undefined;
        if (
          !pointer.current.trigger ||
          document.querySelector('dialog[open],.wu-overlay') ||
          [...document.querySelectorAll(':popover-open')].some(
            (element) =>
              element !== panel.current && (element as HTMLElement).dataset.hoverIntent !== 'true',
          )
        )
          return;
        show(false);
      }, HOVER_OPEN_DELAY);
    }
  }
  function handlePointerLeave(event: PointerEvent<HTMLElement>, part: 'trigger' | 'panel') {
    if (event.pointerType !== 'mouse') return;
    pointer.current[part] = false;
    clear(openTimer);
    clear(closeTimer);
    if (pinned.current) return;
    closeTimer.current = window.setTimeout(() => {
      if (!pointer.current.trigger && !pointer.current.panel && !hasFocusWithinPopover()) hide();
    }, HOVER_CLOSE_DELAY);
  }
  function handleBlur(event: FocusEvent<HTMLElement>) {
    const next = event.relatedTarget as Node | null;
    if (next && (panel.current?.contains(next) || trigger.current?.contains(next))) return;
    clear(closeTimer);
    closeTimer.current = window.setTimeout(() => {
      if (!hasFocusWithinPopover() && !pointer.current.trigger && !pointer.current.panel) hide();
    }, HOVER_CLOSE_DELAY);
  }
  useEffect(
    () => () => {
      clear(openTimer);
      clear(closeTimer);
    },
    [],
  );
  return {
    triggerProps: {
      ref: trigger,
      'aria-expanded': open,
      onPointerEnter: (event: PointerEvent<HTMLButtonElement>) =>
        handlePointerEnter(event, 'trigger'),
      onPointerLeave: (event: PointerEvent<HTMLButtonElement>) =>
        handlePointerLeave(event, 'trigger'),
      onBlurCapture: handleBlur,
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        if (isPopoverOpen() && pinned.current) hide();
        else show(true, event.detail === 0);
      },
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          show(true, true);
        } else if (event.key === 'Escape' && isPopoverOpen()) {
          event.preventDefault();
          event.stopPropagation();
          hide();
        }
      },
    },
    panelProps: {
      ref: panel,
      onPointerEnter: (event: PointerEvent<T>) => handlePointerEnter(event, 'panel'),
      onPointerLeave: (event: PointerEvent<T>) => handlePointerLeave(event, 'panel'),
      onBlurCapture: handleBlur,
      onToggle: () => {
        const expanded = isPopoverOpen();
        setOpen(expanded);
        if (!expanded) {
          pinned.current = false;
          clear(openTimer);
          clear(closeTimer);
        }
      },
      onKeyDown: (event: KeyboardEvent<T>) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          hide(true);
        }
      },
    },
  };
}
