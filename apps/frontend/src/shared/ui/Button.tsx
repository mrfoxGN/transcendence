import type { ComponentPropsWithRef } from 'react';
import { classNames } from './classNames';

export type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'danger';
};

/** Explicit submit buttons opt in with type="submit". */
export function Button({
  variant = 'secondary',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={classNames('wu-button', `wu-button--${variant}`, className)}
    />
  );
}
