import type { ReactNode } from 'react';
export function IconTile({ children, tone = 'blue' }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`wu-icon-tile wu-icon-tile--${tone}`} aria-hidden="true">
      {children}
    </span>
  );
}
