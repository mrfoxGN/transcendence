import type { ComponentPropsWithRef } from 'react';

export function Input({ type = 'text', ...props }: ComponentPropsWithRef<'input'>) {
  return <input {...props} type={type} />;
}
