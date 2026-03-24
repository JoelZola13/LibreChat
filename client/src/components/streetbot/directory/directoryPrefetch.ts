/**
 * Module-level directory prefetch — starts the default search API call as soon as
 * this module is imported (i.e., when React.lazy loads the directory route bundle),
 * BEFORE the component mounts. This eliminates the component-mount → useEffect →
 * fetch waterfall on first visit.
 *
 * Writes results into sessionStorage using the same cache key format as
 * useDirectorySearch, so the hook finds warm cache on mount and skips the fetch.
 */
import { readSessionCache, writeSessionCache } from '../shared/perfCache';
import type { SearchResult } from './useDirectorySearch';

const SEARCH_URL = '/api/directory/search';
const SBP_SEARCH_URL = '/sbapi/services/search';
const DIRECTORY_SEARCH_CACHE_PREFIX = 'streetbot:directory:search:v5:';
const CACHE_TTL_MS = 5 * 60 * 1000;

// Default first-load search parameters (must match DirectoryPage defaults exactly)
const DEFAULT_PER_PAGE = 12;
const DEFAULT_FACETS = 'category_names,city,service_type,ages_served,gender_served';

function buildDefaultParamString(): string {
  const params = new URLSearchParams();
  params.set('q', '');
  params.set('page', '0');
  params.set('per_page', String(DEFAULT_PER_PAGE));
  params.set('facets', DEFAULT_FACETS);
  return params.toString();
}

const defaultParamStr = buildDefaultParamString();
const defaultCacheKey = `${DIRECTORY_SEARCH_CACHE_PREFIX}${defaultParamStr}`;

let prefetchPromise: Promise<SearchResult | null> | null = null;
let prefetchTimestamp = 0;

function isJsonResponse(response: Response): boolean {
  const ct = response.headers.get('content-type') || '';
  return ct.includes('application/json');
}

/**
 * Start prefetching the default directory search. Safe to call multiple times —
 * deduplicates in-flight requests. Returns a promise resolving with the search
 * result (or null on failure).
 */
export function prefetchDirectory(): Promise<SearchResult | null> {
  // Reuse recent in-flight or completed prefetch
  if (prefetchPromise && Date.now() - prefetchTimestamp < CACHE_TTL_MS) {
    return prefetchPromise;
  }

  // If session cache already has the default search, resolve immediately
  const cached = readSessionCache<SearchResult>(defaultCacheKey, CACHE_TTL_MS);
  if (cached && cached.hits && cached.hits.length > 0) {
    prefetchPromise = Promise.resolve(cached);
    prefetchTimestamp = Date.now();
    return prefetchPromise;
  }

  prefetchTimestamp = Date.now();

  prefetchPromise = (async (): Promise<SearchResult | null> => {
    // Try Express Meilisearch first
    try {
      const res = await fetch(`${SEARCH_URL}?${defaultParamStr}`);
      if (res.ok && isJsonResponse(res)) {
        const payload = (await res.json()) as SearchResult;
        writeSessionCache(defaultCacheKey, payload);
        return payload;
      }
    } catch {
      // Express endpoint unavailable — fall through to SBP
    }

    // Try SBP Meilisearch
    try {
      const res = await fetch(`${SBP_SEARCH_URL}?${defaultParamStr}`);
      if (res.ok && isJsonResponse(res)) {
        const payload = (await res.json()) as SearchResult;
        writeSessionCache(defaultCacheKey, payload);
        return payload;
      }
    } catch {
      // Both search APIs failed
    }

    return null;
  })();

  return prefetchPromise;
}

/**
 * Synchronously check if prefetched directory data is available in session cache.
 * Returns the cached result or null.
 */
export function getPrefetchedDirectorySync(): SearchResult | null {
  const cached = readSessionCache<SearchResult>(defaultCacheKey, CACHE_TTL_MS);
  if (cached && cached.hits && cached.hits.length > 0) {
    return cached;
  }
  return null;
}

// Start prefetching immediately when this module is imported
prefetchDirectory();
