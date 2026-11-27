import { useEffect, useRef, useState, type ReactNode } from 'react';
import './chart-feedback.css';

type Tooltip = { label: string; detail: string; x: number; y: number };
/** Chart marks keep their accessible values; this adds themed pointer/keyboard feedback. */
export function ChartTooltipSurface({ children }: { children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  function show(target: EventTarget | null) {
    const mark =
      target instanceof Element ? target.closest<HTMLElement>('[data-chart-label]') : null;
    if (!mark || !host.current?.contains(mark)) return;
    const box = mark.getBoundingClientRect(),
      parent = host.current.getBoundingClientRect();
    setTooltip({
      label: mark.dataset.chartLabel ?? '',
      detail: mark.dataset.chartDetail ?? '',
      x: box.left + box.width / 2 - parent.left,
      y: box.top - parent.top - 8,
    });
  }
  const open = !!tooltip;
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTooltip(null);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);
  return (
    <div
      className="wu-chart-feedback"
      ref={host}
      onPointerOver={(event) => show(event.target)}
      onPointerOut={(event) => {
        const next = event.relatedTarget;
        if (
          next instanceof Element &&
          host.current?.contains(next) &&
          next.closest('[data-chart-label],.wu-chart-tooltip')
        )
          return;
        if (
          !host.current?.contains(document.activeElement) ||
          !document.activeElement?.matches('[data-chart-label]')
        )
          setTooltip(null);
      }}
      onPointerLeave={() => {
        if (!host.current?.contains(document.activeElement)) setTooltip(null);
      }}
      onFocus={(event) => show(event.target)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTooltip(null);
      }}
    >
      {children}
      {tooltip && (
        <div
          className="wu-chart-tooltip"
          role="tooltip"
          style={{ left: `clamp(96px, ${tooltip.x}px, calc(100% - 96px))`, top: tooltip.y }}
        >
          <span>{tooltip.label}</span>
          <strong>{tooltip.detail}</strong>
        </div>
      )}
    </div>
  );
}
