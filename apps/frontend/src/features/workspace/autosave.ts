import type { FocusEvent, KeyboardEvent } from 'react';

export function saveTextOnBlur(
  event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  previous: string,
  save: (value: string) => void,
) {
  const field = event.currentTarget;
  const value = field.value.trim();
  if (field.readOnly) return;
  if (!field.checkValidity() || (field.required && !value)) {
    field.reportValidity();
    return;
  }
  if (value !== previous.trim()) save(value);
}

export function finishInputEdit(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
    event.preventDefault();
    event.currentTarget.blur();
  }
}
