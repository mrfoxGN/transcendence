import {
  Children,
  cloneElement,
  isValidElement,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import { classNames } from './classNames';

type FormFieldProps = ComponentPropsWithoutRef<'div'> & {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
};

/** Use with a direct control child. IDs connect its label, help and validation feedback. */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
  ...props
}: FormFieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const controls = Children.map(children, (child) => {
    if (
      !isValidElement<{
        id?: string;
        'aria-describedby'?: string;
        'aria-invalid'?: boolean | 'true' | 'false';
      }>(child)
    )
      return child;
    const describedBy =
      [...new Set([child.props['aria-describedby'], hintId, errorId].filter(Boolean))].join(' ') ||
      undefined;
    return cloneElement(child, {
      id: htmlFor,
      'aria-describedby': describedBy,
      'aria-invalid': error ? true : child.props['aria-invalid'],
    });
  });
  return (
    <div {...props} className={classNames('wu-field-label', className)}>
      <label htmlFor={htmlFor}>{label}</label>
      {controls}
      {hint && (
        <p id={hintId} className="wu-field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="wu-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
