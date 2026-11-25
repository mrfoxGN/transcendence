import type { ComponentPropsWithRef } from 'react';
import { classNames } from './classNames';

export type IconButtonProps = ComponentPropsWithRef<'button'> & { 'aria-label': string };

/** An icon-only action always needs an accessible name. */
export function IconButton({ type = 'button', className, ...props }: IconButtonProps) {
  return <button {...props} type={type} className={classNames('wu-icon-button', className)} />;
}
