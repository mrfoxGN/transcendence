import { HOVER_OPEN_DELAY, HOVER_CLOSE_DELAY, supportsHover } from './hover-intent';
import { useEffect, useRef, type PointerEvent, type KeyboardEvent, type MouseEvent } from 'react';

/** An inline disclosure keeps the same intent delay as the surrounding menus. */
export function useHoverDisclosure() {
  const panel = useRef<HTMLDetailsElement>(null);
  const openTimer = useRef<number | undefined>(undefined),
    closeTimer = useRef<number | undefined>(undefined);
  const pinned = useRef(false);
  const clear = () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  };
  const close = () => {
    if (panel.current) panel.current.open = false;
    pinned.current = false;
  };
  useEffect(() => () => clear(), []);
  return {
    detailsProps: {
      ref: panel,
      onPointerEnter: () => clearTimeout(closeTimer.current),
      onPointerLeave: (event: PointerEvent<HTMLDetailsElement>) => {
        if (event.pointerType !== 'mouse') return;
        clear();
        closeTimer.current = window.setTimeout(() => {
          if (!pinned.current && !panel.current?.contains(document.activeElement)) close();
        }, HOVER_CLOSE_DELAY);
      },
      onBlurCapture: () => {
        clearTimeout(closeTimer.current);
        closeTimer.current = window.setTimeout(() => {
          if (
            !pinned.current &&
            !panel.current?.matches(':hover') &&
            !panel.current?.contains(document.activeElement)
          )
            close();
        }, HOVER_CLOSE_DELAY);
      },
      onKeyDown: (event: KeyboardEvent<HTMLDetailsElement>) => {
        if (event.key === 'Escape' && panel.current?.open) {
          event.preventDefault();
          event.stopPropagation();
          close();
          panel.current.querySelector('summary')?.focus();
        }
      },
    },
    summaryProps: {
      onPointerEnter: (event: PointerEvent<HTMLElement>) => {
        if (!supportsHover(event.pointerType)) return;
        clear();
        openTimer.current = window.setTimeout(() => {
          if (panel.current) panel.current.open = true;
        }, HOVER_OPEN_DELAY);
      },
      onPointerLeave: () => clearTimeout(openTimer.current),
      onClick: (event: MouseEvent<HTMLElement>) => {
        event.preventDefault();
        clear();
        if (panel.current?.open && pinned.current) close();
        else {
          pinned.current = true;
          if (panel.current) panel.current.open = true;
        }
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          clear();
          pinned.current = true;
          if (panel.current) {
            panel.current.open = true;
            panel.current.querySelector<HTMLInputElement>('input:checked')?.focus();
          }
        }
      },
    },
  };
}
