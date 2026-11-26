import type { ComponentPropsWithRef } from 'react';
import { classNames } from './classNames';

export function Card({ className, ...props }: ComponentPropsWithRef<'section'>) {
  return <section {...props} className={classNames('wu-panel', className)} />;
}
