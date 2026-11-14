import type { ComponentPropsWithoutRef } from 'react';
import './magic-button.css';

// GodUI Magic Button's layered edge, shadow, and face, adapted for links.
export function MagicButton({ children, variant = 'primary', ...props }: ComponentPropsWithoutRef<'a'> & {
  variant?: 'primary' | 'secondary';
}) {
  return (
    <a {...props} className={`magic-button magic-button--${variant}`}>
      <span className="magic-button-shadow" aria-hidden="true" />
      <span className="magic-button-edge" aria-hidden="true" />
      <span className="magic-button-face">{children}</span>
    </a>
  );
}
