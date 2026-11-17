import { ShieldCheck, ShieldAlert } from 'lucide-react';

export interface VerifiedUserBadgeProps {
  isVerified: boolean;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  onVerifyClick?: () => void;
}

export function VerifiedUserBadge({
  isVerified,
  size = 'medium',
  showLabel = true,
  onVerifyClick,
}: VerifiedUserBadgeProps) {
  const iconSize = size === 'small' ? 14 : size === 'large' ? 20 : 16;

  if (isVerified) {
    return (
      <span className={`verified-badge verified-badge--verified verified-badge--${size}`} title="Email verified account">
        <ShieldCheck size={iconSize} className="verified-badge__icon" aria-hidden="true" />
        {showLabel && <span className="verified-badge__label">Verified</span>}
      </span>
    );
  }

  return (
    <span className={`verified-badge verified-badge--unverified verified-badge--${size}`} title="Email address not yet verified">
      <ShieldAlert size={iconSize} className="verified-badge__icon" aria-hidden="true" />
      {showLabel && <span className="verified-badge__label">Unverified</span>}
      {onVerifyClick && (
        <button
          type="button"
          className="verified-badge__action"
          onClick={onVerifyClick}
        >
          Verify
        </button>
      )}
    </span>
  );
}
