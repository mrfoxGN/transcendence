import type { ComponentPropsWithRef } from 'react';

export type CheckboxProps = Omit<ComponentPropsWithRef<'input'>, 'type'>;

/** Keep native checkbox semantics, form values and keyboard behavior. */
export function Checkbox(props: CheckboxProps) {
  return <input {...props} type="checkbox" />;
}
