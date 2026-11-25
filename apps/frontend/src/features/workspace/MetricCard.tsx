import './metric-card.css';

type MetricCardProps = {
  label: string;
  value: number;
  note: string;
  tone: 'blue' | 'mint' | 'violet' | 'pink';
  onClick?: () => void;
};

export function MetricCard({ label, value, note, tone, onClick }: MetricCardProps) {
  const Card = onClick ? 'button' : 'div';

  return (
    <Card
      className={`wu-metric-card wu-metric-card--${tone}`}
      type={onClick ? 'button' : undefined}
      onClick={onClick}
    >
      <span className="wu-metric-card-copy">
        <strong>{value}</strong>
        <span>{label}</span>
        <small>{note}</small>
      </span>
    </Card>
  );
}
