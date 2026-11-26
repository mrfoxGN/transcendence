import type { CSSProperties } from 'react';
const portraitPositions: Record<string, string> = {
  AM: '1.6% 22.2%',
  LN: '34% 22.2%',
  SK: '66.4% 22.2%',
  OI: '98.7% 22.2%',
  MR: '34% 75.3%',
  JC: '66.4% 75.3%',
};

export function Avatar({
  initials,
  tone = 'blue',
  small = false,
  preview = false,
}: {
  initials: string;
  tone?: string;
  small?: boolean;
  preview?: boolean;
}) {
  const position = preview ? portraitPositions[initials] : undefined;
  return (
    <span
      className={`wu-avatar wu-avatar--${tone}${small ? ' wu-avatar--small' : ''}`}
      aria-hidden="true"
    >
      {initials}
      {position && (
        <span
          className="wu-avatar-portrait"
          style={{ '--portrait-position': position } as CSSProperties}
        />
      )}
    </span>
  );
}
