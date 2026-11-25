import type { CheckboxProps } from './Checkbox';
import { Checkbox } from './Checkbox';
import './switch.css';

export function Switch({ className, ...props }: CheckboxProps) {
  return (
    <label className={['wu-switch', className].filter(Boolean).join(' ')}>
      <Checkbox {...props} role="switch" />
      <span className="wu-switch-slider" aria-hidden="true" />
    </label>
  );
}
