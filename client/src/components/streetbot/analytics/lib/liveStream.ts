// Subscribe to /api/analytics/live (SSE).

export interface LiveSummary {
  event_name:        string | null;
  product_area:      string | null;
  route_pattern:     string | null;
  user_role:         string | null;
  street_profile_id: string | null;
  occurred_at:       string | null;
}

export function openLiveStream(onEvent: (s: LiveSummary) => void): () => void {
  const url = '/api/analytics/live';
  const es = new EventSource(url, { withCredentials: true });
  es.onmessage = (e) => {
    try { onEvent(JSON.parse(e.data)); } catch { /* ignore */ }
  };
  es.onerror = () => {
    // Browser auto-reconnects on transient failures. Nothing to do.
  };
  return () => es.close();
}
