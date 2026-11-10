import { useId, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import './metric-card.css';

type MetricCardProps = {
  icon: ReactNode;
  label: string;
  value: number;
  note: string;
  tone: 'blue' | 'mint' | 'violet' | 'pink';
  onClick?: () => void;
};

export function MetricCard({ icon, label, value, note, tone, onClick }: MetricCardProps) {
  const gradientId = useId();
  const Card = onClick ? 'button' : 'div';

  return (
    <Card className={`wu-metric-card wu-metric-card--${tone}`} type={onClick ? 'button' : undefined} onClick={onClick}>
      <span className="wu-metric-card-icon" aria-hidden="true">{icon}</span>
      <span className="wu-metric-card-copy">
        <strong>{value}</strong>
        <span>{label}</span>
        <small>{note}</small>
      </span>
      {onClick && <ArrowRight className="wu-metric-card-arrow" size={14} aria-hidden="true" />}
      <svg className="wu-metric-card-wave" viewBox="0 0 110 46" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x2="0%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity=".24" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path fill={`url(#${gradientId})`} d="M0 46C25 46 28 22 49 22S66 34 79 34 92 15 110 15V46Z" />
      </svg>
    </Card>
  );
}
