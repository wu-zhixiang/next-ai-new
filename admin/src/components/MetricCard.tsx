import type { ReactNode } from 'react';

interface MetricCardProps {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly icon: ReactNode;
}

export function MetricCard({ detail, icon, label, value }: MetricCardProps): JSX.Element {
  return (
    <section className="metric-card">
      <div className="metric-icon" aria-hidden="true">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </section>
  );
}
