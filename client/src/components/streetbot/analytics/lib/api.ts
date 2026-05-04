// Thin client for /api/analytics/query/* endpoints.
// All reads go through the collector — never PostHog directly.

const BASE = '/api/analytics';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers:     { 'content-type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let detail: string | undefined;
    try { detail = (await res.json()).error; } catch {}
    throw new Error(`analytics:${res.status} ${detail ?? res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface OverviewCards {
  wau:                  number;
  dau:                  number;
  new_profiles_7d:      number;
  applications_7d:      number;
  artworks_7d:          number;
  lessons_7d:           number;
  messages_7d:          number;
  service_actions_7d:   number;
  errors_24h:           number;
  rage_clicks_24h:      number;
}

export interface OverviewResponse {
  cards: OverviewCards;
  daily: Array<{
    day:                  string;
    dau:                  number;
    meaningful_actions:   number;
    conversions:          number;
    errors:               number;
    new_users:            number;
    new_street_profiles:  number;
  }>;
  by_product_area: Array<{
    product_area:  string;
    active_users:  number;
    conversions:   number;
  }>;
}

export const api = {
  overview:        (days = 28)            => request<OverviewResponse>(`/query/overview?days=${days}`),
  productAreas:    (days = 28)            => request<{ product_areas: any[]; window_days: number }>(`/query/product-areas?days=${days}`),
  retention:       (cohort = 'all', area = '_all') => request<{ rows: any[] }>(`/query/retention?cohort=${cohort}&product_area=${area}`),
  profiles:        (opts: { sort?: string; limit?: number; needs_nudge?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (opts.sort)       q.set('sort', opts.sort);
    if (opts.limit)      q.set('limit', String(opts.limit));
    if (opts.needs_nudge) q.set('needs_nudge', '1');
    return request<{ profiles: any[] }>(`/query/profiles?${q.toString()}`);
  },
  profile:         (id: string)           => request<{ rollup: any; events: any[]; sessions: any[] }>(`/query/profile/${id}`),
  funnels:         ()                     => request<{ funnels: any[] }>(`/query/funnels`),
  funnel:          (key: string)          => request<{ funnel_key: string; snapshot: any }>(`/query/funnel/${key}`),
  journeys:        (days = 7)             => request<{ journeys: any[] }>(`/query/journeys?days=${days}`),
  clicksTop:       (days = 7)             => request<{ clicks: any[] }>(`/query/clicks/top?days=${days}`),
  clicksDead:      (days = 7)             => request<{ dead_clicks: any[] }>(`/query/clicks/dead?days=${days}`),
  pagesTop:        (days = 7)             => request<{ pages: any[] }>(`/query/pages/top?days=${days}`),
  pagesLongest:    (days = 7)             => request<{ pages: any[] }>(`/query/pages/longest?days=${days}`),
  pagesExits:      (days = 7)             => request<{ exits: any[] }>(`/query/pages/exits?days=${days}`),
  dataQuality:     (days = 7)             => request<{ by_type: any[]; by_event: any[]; volume: any }>(`/query/data-quality?days=${days}`),
  platformHealth:  ()                     => request<{ services: any[] }>(`/query/platform/health`),
  platformApi:     ()                     => request<{ routes: any[] }>(`/query/platform/api`),
  alerts:          ()                     => request<{ alerts: any[] }>(`/query/alerts`),
  recentEvents:    (limit = 200)          => request<{ events: any[] }>(`/query/events/recent?limit=${limit}`),

  posthogInsight:  (query: object)        => request<any>(`/posthog/insight`, { method: 'POST', body: JSON.stringify({ query }) }),
  posthogReplay:   (body: { recording_id: string; reason?: string; target_user_id?: string; target_street_profile_id?: string }) =>
                                              request<{ url: string }>(`/posthog/replay`, { method: 'POST', body: JSON.stringify(body) }),
  posthogReplays:  (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params);
    return request<any>(`/posthog/replays?${q.toString()}`);
  },
};
