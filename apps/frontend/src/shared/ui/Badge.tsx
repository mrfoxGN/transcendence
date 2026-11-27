import type { ReactNode } from 'react';
export function Badge({
  children,
  tone = 'neutral',
  status,
}: {
  children: ReactNode;
  tone?: string;
  status?: string;
}) {
  return (
    <span
      data-status={status?.replace(/[^a-z]/gi, '').toLowerCase()}
      className={`wu-pill wu-pill--${tone}`}
    >
      {children}
    </span>
  );
}
