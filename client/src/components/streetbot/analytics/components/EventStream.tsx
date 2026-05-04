import * as React from 'react';
import { formatRelativeTime } from '../lib/format';
import type { LiveSummary } from '../lib/liveStream';

export function EventStream({ events }: { events: LiveSummary[] }) {
  return (
    <div className="rounded-md border border-border-light bg-surface-primary divide-y divide-border-light max-h-[60vh] overflow-y-auto">
      {events.length === 0 ? (
        <div className="p-6 text-center text-text-secondary text-sm">Waiting for events…</div>
      ) : null}
      {events.map((e, i) => (
        <div key={i} className="px-3 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-text-primary truncate">{e.event_name}</span>
            {e.product_area ? <span className="text-text-secondary">· {e.product_area}</span> : null}
            {e.route_pattern ? <span className="text-text-secondary truncate">· {e.route_pattern}</span> : null}
          </div>
          <div className="text-xs text-text-secondary whitespace-nowrap pl-3">
            {e.user_role ?? 'anon'} · {formatRelativeTime(e.occurred_at)}
          </div>
        </div>
      ))}
    </div>
  );
}
