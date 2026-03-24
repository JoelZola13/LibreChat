/**
 * Hover-based prefetch for individual service detail pages.
 * Call `prefetchServiceDetail(id)` on card mouseEnter — it fetches the
 * service JSON and writes it to sessionStorage so ServiceDetailPage
 * reads it synchronously on mount (zero-wait).
 */
import { SB_API_BASE } from '~/components/streetbot/shared/apiConfig';
import { readSessionCache, writeSessionCache } from '../shared/perfCache';

export const SERVICE_CACHE_PREFIX = 'streetbot:service:';
export const SERVICE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

const inflight = new Set<string>();

/**
 * Prefetch a single service by ID. Deduplicates in-flight requests and
 * skips if session cache already has fresh data.
 */
export function prefetchServiceDetail(serviceId: number | string): void {
  const key = `${SERVICE_CACHE_PREFIX}${serviceId}`;
  if (inflight.has(key)) return;

  // Already cached?
  const cached = readSessionCache(key, SERVICE_CACHE_TTL_MS);
  if (cached) return;

  inflight.add(key);

  fetch(`${SB_API_BASE}/services/${serviceId}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data) writeSessionCache(key, data);
    })
    .catch(() => {})
    .finally(() => inflight.delete(key));
}
