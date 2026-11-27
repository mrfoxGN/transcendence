import type { LucideIcon, LucideProps } from 'lucide-react';

export const iconSizes = { small: 14, medium: 16, large: 20, feature: 24 } as const;
type IconProps = Omit<LucideProps, 'size'> & {
  icon: LucideIcon;
  size?: keyof typeof iconSizes | number;
  label?: string;
};

/** Decorative icons stay silent; standalone meaningful icons receive a label. */
export function Icon({
  icon: Glyph,
  size = 'medium',
  label,
  strokeWidth = 1.75,
  ...props
}: IconProps) {
  return (
    <Glyph
      {...props}
      size={typeof size === 'number' ? size : iconSizes[size]}
      strokeWidth={strokeWidth}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    />
  );
}
