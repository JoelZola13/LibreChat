/**
 * Module-level news prefetch — starts API calls as soon as this module is imported
 * (i.e., when React.lazy loads the news route bundle), BEFORE the component mounts.
 * This eliminates the component-mount → useEffect → fetch waterfall on first visit.
 */
import { SB_API_BASE } from '~/components/streetbot/shared/apiConfig';
import { readSessionCache, writeSessionCache } from '../shared/perfCache';
import { normalizeArticle, normalizeAggregatedItem } from './newsConstants';
import { prefetchTopArticles, seedArticleCache } from './articlePrefetch';
import type { Article } from './newsTypes';

const INTERNAL_KEY = 'streetbot:news:internal:v1';
const AGGREGATED_KEY = 'streetbot:news:aggregated:v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface PrefetchResult {
  internal: Article[];
  aggregated: Article[];
}

let prefetchPromise: Promise<PrefetchResult> | null = null;
let prefetchTimestamp = 0;

/**
 * Start prefetching news data. Safe to call multiple times — deduplicates.
 * Returns a promise that resolves with both article arrays.
 */
export function prefetchNews(): Promise<PrefetchResult> {
  // If we have a recent in-flight or completed prefetch, reuse it
  if (prefetchPromise && Date.now() - prefetchTimestamp < CACHE_TTL_MS) {
    return prefetchPromise;
  }

  // Check session cache first — if valid, resolve immediately
  const cachedInternal = readSessionCache<Article[]>(INTERNAL_KEY, CACHE_TTL_MS);
  const cachedAggregated = readSessionCache<Article[]>(AGGREGATED_KEY, CACHE_TTL_MS);
  if (cachedInternal && cachedAggregated) {
    // Keep detail cache hot when listing cache is already warm.
    cachedInternal.forEach((article) => seedArticleCache(article));
    prefetchTopArticles(cachedInternal, 8);
    prefetchPromise = Promise.resolve({ internal: cachedInternal, aggregated: cachedAggregated });
    prefetchTimestamp = Date.now();
    return prefetchPromise;
  }

  prefetchTimestamp = Date.now();

  const fetchInternal = fetch(`${SB_API_BASE}/news/articles?status=published&limit=20`)
    .then((r) => (r.ok ? r.json() : []))
    .then((data) => {
      const items = data.items || data;
      if (!Array.isArray(items)) return [] as Article[];
      const normalized = items.map((a: Article) => normalizeArticle(a, 'internal'));
      writeSessionCache(INTERNAL_KEY, normalized);
      normalized.forEach((article) => seedArticleCache(article));
      prefetchTopArticles(normalized, 8);
      return normalized;
    })
    .catch(() => [] as Article[]);

  const fetchAggregated = fetch(`${SB_API_BASE}/api/news-cms/aggregator/feed?limit=20`)
    .then((r) => (r.ok ? r.json() : { items: [] }))
    .then((data) => {
      const items = data.items || data;
      if (!Array.isArray(items)) return [] as Article[];
      const normalized = items.map((item: Record<string, unknown>) => normalizeAggregatedItem(item));
      writeSessionCache(AGGREGATED_KEY, normalized);
      return normalized;
    })
    .catch(() => [] as Article[]);

  prefetchPromise = Promise.all([fetchInternal, fetchAggregated]).then(
    ([internal, aggregated]) => ({ internal, aggregated }),
  );

  return prefetchPromise;
}

/**
 * Consume prefetched result. Returns cached data synchronously if available,
 * otherwise returns null (caller should fall back to the promise).
 */
export function getPrefetchedSync(): PrefetchResult | null {
  const cachedInternal = readSessionCache<Article[]>(INTERNAL_KEY, CACHE_TTL_MS);
  const cachedAggregated = readSessionCache<Article[]>(AGGREGATED_KEY, CACHE_TTL_MS);
  if (cachedInternal && cachedAggregated) {
    return { internal: cachedInternal, aggregated: cachedAggregated };
  }
  return null;
}

// Start prefetching immediately when this module is imported
prefetchNews();
