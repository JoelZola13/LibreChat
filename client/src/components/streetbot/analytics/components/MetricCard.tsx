// Brand-styled metric card — matches the Listmonk dashboard visual language.
// Two layouts:
//   <MetricCard label="Visitors" value={1240} hint="last 7 days" icon="👥" />
//   <MetricRow icon="📨" label="MESSAGES SENT" value={42} side="2 finished" />
//   <BigNumberTriple items={[{label:'SENT', value:4}, ...]} />

import * as React from 'react';
import { formatNumber } from '../lib/format';

interface MetricCardProps {
  label:    string;
  value:    number | string | null | undefined;
  icon?:    React.ReactNode;
  hint?:    string;
  intent?:  'neutral' | 'positive' | 'warn' | 'critical';
}

export function MetricCard({ label, value, icon, hint, intent = 'neutral' }: MetricCardProps) {
  const display = typeof value === 'number' ? formatNumber(value) : (value ?? '—');
  const ringColor = {
    neutral:  'var(--sv-card-border)',
    positive: 'rgba(16, 185, 129, 0.30)',
    warn:     'rgba(245, 158, 11, 0.40)',
    critical: 'rgba(244, 63, 94, 0.40)',
  }[intent];
  return (
    <div className="sv-card sv-card--compact" style={{ borderColor: ringColor }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {icon ? <div className="sv-tile-icon" aria-hidden>{icon}</div> : null}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="sv-metric-sm" style={{ marginBottom: 4 }}>{display}</div>
          <div className="sv-label">{label}</div>
        </div>
      </div>
      {hint ? <div className="sv-metric-row__hint" style={{ marginTop: 10 }}>{hint}</div> : null}
    </div>
  );
}

interface MetricRowProps {
  icon?:  React.ReactNode;
  label:  string;
  value:  number | string;
  side?:  React.ReactNode;
}

export function MetricRow({ icon, label, value, side }: MetricRowProps) {
  return (
    <div className="sv-metric-row">
      {icon ? <div className="sv-tile-icon" aria-hidden>{icon}</div> : <div />}
      <div>
        <div className="sv-metric-sm">{typeof value === 'number' ? formatNumber(value) : value}</div>
        <div className="sv-label" style={{ marginTop: 4 }}>{label}</div>
      </div>
      {side ? <div className="sv-metric-row__hint" style={{ textAlign: 'right' }}>{side}</div> : <div />}
    </div>
  );
}

/** Three big numbers side-by-side, like Listmonk's "Last 7 days" panel. */
export function BigNumberTriple({ items }: {
  items: { label: string; value: number | string; sub?: string }[];
}) {
  return (
    <div className="sv-big-number-row">
      {items.map((item, i) => (
        <div key={i}>
          <div className="sv-metric">
            {typeof item.value === 'number' ? formatNumber(item.value) : item.value}
          </div>
          <div className="sv-label" style={{ marginTop: 8 }}>{item.label}</div>
          {item.sub ? <div className="sv-metric-row__hint">{item.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}
