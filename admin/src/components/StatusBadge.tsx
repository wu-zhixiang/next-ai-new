export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

interface StatusBadgeProps {
  readonly label: string;
  readonly tone?: BadgeTone;
}

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps): JSX.Element {
  return <span className={`status-badge status-badge--${tone}`}>{label}</span>;
}
