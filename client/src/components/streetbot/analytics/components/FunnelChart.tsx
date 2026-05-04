import * as React from 'react';
import { formatNumber, formatPercent, formatMs } from '../lib/format';

export interface FunnelStep {
  name:                     string;
  count:                    number;
  conversion_from_previous: number | null;
  median_time_ms:           number | null;
  p95_time_ms:              number | null;
}

interface Props {
  cohortSize: number;
  steps:      FunnelStep[];
}

export function FunnelChart({ cohortSize, steps }: Props) {
  const start = cohortSize || steps[0]?.count || 1;
  return (
    <div className="space-y-2">
      {steps.map((step, i) => {
        const widthPct = Math.max(2, (step.count / start) * 100);
        const overall = (step.count / start) * 100;
        return (
          <div key={i} className="rounded-md border border-border-light p-3 bg-surface-primary">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-text-primary">{i + 1}. {step.name}</span>
              <span className="text-text-secondary">
                {formatNumber(step.count)} · {formatPercent(overall)} of cohort
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-surface-tertiary overflow-hidden">
              <div className="h-full bg-blue-500/60" style={{ width: `${widthPct}%` }} />
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-text-secondary">
              {step.conversion_from_previous != null
                ? <span>Δ {formatPercent(step.conversion_from_previous * 100)}</span> : null}
              {step.median_time_ms != null
                ? <span>median {formatMs(step.median_time_ms)}</span> : null}
              {step.p95_time_ms != null
                ? <span>p95 {formatMs(step.p95_time_ms)}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
