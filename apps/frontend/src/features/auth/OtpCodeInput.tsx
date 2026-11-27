import {
  useEffect,
  useRef,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';

export interface OtpCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  hasError?: boolean;
  id?: string;
  ariaLabel?: string;
}

export function OtpCodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = false,
  hasError = false,
  id = 'otp-input',
  ariaLabel = '6-digit verification code',
}: OtpCodeInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus && !disabled && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus, disabled]);

  function updateCode(newDigits: string[]) {
    const fullCode = newDigits.join('').slice(0, 6);
    onChange(fullCode);
    if (fullCode.length === 6 && /^\d{6}$/.test(fullCode)) {
      onComplete?.(fullCode);
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>, index: number) {
    const rawVal = event.target.value;
    const cleanDigits = rawVal.replace(/\D/g, '');

    if (!cleanDigits) {
      const next = [...digits];
      next[index] = '';
      updateCode(next);
      return;
    }

    if (cleanDigits.length > 1) {
      // Multiple digits entered or pasted into single box
      const next = [...digits];
      let cursor = index;
      for (const char of cleanDigits) {
        if (cursor < 6) {
          next[cursor] = char;
          cursor++;
        }
      }
      updateCode(next);
      const nextFocus = Math.min(cursor, 5);
      inputRefs.current[nextFocus]?.focus();
      return;
    }

    // Single digit
    const next = [...digits];
    next[index] = cleanDigits;
    updateCode(next);

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        event.preventDefault();
        const next = [...digits];
        next[index - 1] = '';
        updateCode(next);
        inputRefs.current[index - 1]?.focus();
      } else if (digits[index]) {
        event.preventDefault();
        const next = [...digits];
        next[index] = '';
        updateCode(next);
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < 5) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = Array.from({ length: 6 }, (_, i) => pasted[i] || '');
    updateCode(next);

    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();
  }

  return (
    <div
      className={`otp-container ${hasError ? 'otp-container--error' : ''}`}
      role="group"
      aria-label={ariaLabel}
      id={id}
    >
      <div className="otp-digit-group">
        {[0, 1, 2].map((i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            pattern="[0-9]*"
            maxLength={6}
            value={digits[i]}
            disabled={disabled}
            className={`otp-box ${digits[i] ? 'otp-box--filled' : ''}`}
            aria-label={`Digit ${i + 1} of 6`}
            onChange={(e) => handleInputChange(e, i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>
      <span className="otp-separator" aria-hidden="true">
        &ndash;
      </span>
      <div className="otp-digit-group">
        {[3, 4, 5].map((i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]*"
            maxLength={6}
            value={digits[i]}
            disabled={disabled}
            className={`otp-box ${digits[i] ? 'otp-box--filled' : ''}`}
            aria-label={`Digit ${i + 1} of 6`}
            onChange={(e) => handleInputChange(e, i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>
    </div>
  );
}
