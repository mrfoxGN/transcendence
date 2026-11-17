import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export interface ResendCodeButtonProps {
  onResend: () => Promise<void>;
  cooldownSeconds?: number;
  storageKey?: string;
  disabled?: boolean;
  label?: string;
  resendLabel?: string;
}

export function ResendCodeButton({
  onResend,
  cooldownSeconds = 60,
  storageKey,
  disabled = false,
  label = 'Send code',
  resendLabel = 'Resend code',
}: ResendCodeButtonProps) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!storageKey) return 0;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const expiresAt = Number.parseInt(stored, 10);
        const diff = Math.ceil((expiresAt - Date.now()) / 1000);
        return diff > 0 ? diff : 0;
      }
    } catch {
      // ignore storage access error
    }
    return 0;
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (storageKey) {
            try {
              sessionStorage.removeItem(storageKey);
            } catch {
              // ignore
            }
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, storageKey]);

  async function handleClick() {
    if (secondsLeft > 0 || loading || disabled) return;

    setLoading(true);
    try {
      await onResend();
      const expiresAt = Date.now() + cooldownSeconds * 1000;
      setSecondsLeft(cooldownSeconds);
      if (storageKey) {
        try {
          sessionStorage.setItem(storageKey, expiresAt.toString());
        } catch {
          // ignore
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const isCountingDown = secondsLeft > 0;

  return (
    <div className="resend-container">
      {isCountingDown ? (
        <span className="resend-countdown" role="timer" aria-live="polite">
          <RefreshCw size={14} className="resend-icon" aria-hidden="true" />
          <span>Resend code in <strong>{secondsLeft}s</strong></span>
        </span>
      ) : (
        <button
          type="button"
          className="button button--secondary button--small resend-button"
          disabled={disabled || loading}
          onClick={() => void handleClick()}
        >
          <RefreshCw size={14} className={`resend-icon ${loading ? 'resend-icon--spinning' : ''}`} aria-hidden="true" />
          <span>{loading ? 'Sending…' : secondsLeft === 0 ? resendLabel : label}</span>
        </button>
      )}
    </div>
  );
}
