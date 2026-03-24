/**
 * Module-level homepage news prefetch — fires the API call as soon as this
 * module is imported (at app startup), BEFORE HomepageNews mounts.
 *
 * Eliminates the waterfall: React.lazy → HomepageRoute auth/models wait →
 * HomepageChatView render → HomepageNews mount → useEffect → fetch.
 *
 * Writes directly to the same session cache key that HomepageNews reads in
 * its useState initialiser, so the component finds warm data on first render.
 */
import { readLocalCache, readSessionCache, writeLocalCache, writeSessionCache } from './perfCache';

/* ------------------------------------------------------------------ */
/* Types (mirrors HomepageNews.tsx — kept minimal to avoid coupling)   */
/* ------------------------------------------------------------------ */

interface NewsItem {
  id: string;
  title: string;
  image: string;
  category: string;
  isInternal: boolean;
  href: string;
  publishedAt?: string;
}

interface ApiNewsArticle {
  id?: string | number;
  slug?: string;
  title?: string;
  image_url?: string;
  feature_image_url?: string;
  source?: unknown;
  category?: unknown;
  categories?: unknown;
  published_at?: string;
}

/* ------------------------------------------------------------------ */
/* Constants — MUST match HomepageNews.tsx exactly                     */
/* ------------------------------------------------------------------ */

const API_BASE = '/sbapi';
const CACHE_KEY = 'streetbot:homepage-news:v1';
const LOCAL_CACHE_KEY = 'streetbot:homepage-news:v1:local';
const SESSION_CACHE_TTL_MS = 10 * 60 * 1000;
const LOCAL_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FALLBACK_IMAGE = '/assets/street-news-placeholder.png';

/* ------------------------------------------------------------------ */
/* Helpers (extracted from HomepageNews.tsx)                           */
/* ------------------------------------------------------------------ */

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function normalizeCategoryValues(raw: unknown, categories: unknown): string[] {
  const values: string[] = [];

  if (Array.isArray(categories)) {
    values.push(...categories.filter((item): item is string => typeof item === 'string'));
  }

  if (typeof raw === 'string' && raw.trim()) {
    if (raw.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          values.push(...parsed.filter((item): item is string => typeof item === 'string'));
        } else {
          values.push(raw);
        }
      } catch {
        values.push(raw);
      }
    } else {
      values.push(raw);
    }
  }

  return values;
}

function isStreetVoicesSource(source: unknown): boolean {
  if (typeof source !== 'string') return false;
  return source.toLowerCase().includes('street voices');
}

function isStreetVoicesStory(article: ApiNewsArticle): boolean {
  if (isStreetVoicesSource(article.source)) return true;
  const normalized = normalizeCategoryValues(article?.category, article?.categories)
    .map((value) => value.toLowerCase().replace(/-/g, ' ').trim())
    .filter(Boolean);
  return normalized.some((value) => value.includes('street voices'));
}

function getPrimaryCategory(raw: unknown, categories: unknown): string {
  const normalized = normalizeCategoryValues(raw, categories)
    .map((value) => value.toLowerCase().replace(/-/g, ' ').trim())
    .filter(Boolean);
  const nonStreetVoices = normalized.find((value) => value && value !== 'street voices');
  const picked = nonStreetVoices || normalized[0] || 'news';
  return toTitleCase(picked);
}

function getArticleRefFromHref(href: string): string | null {
  if (!href || !href.startsWith('/news/')) return null;
  const ref = href.slice('/news/'.length).split(/[?#]/)[0];
  return ref || null;
}

function warmHomepageNewsDetails(items: NewsItem[]): void {
  if (typeof window === 'undefined' || !Array.isArray(items) || items.length === 0) return;
  const refs = items
    .map((item) => getArticleRefFromHref(item.href))
    .filter((ref): ref is string => Boolean(ref))
    .slice(0, 6);
  if (refs.length === 0) return;

  const runPrefetch = () => {
    void import('../news/articlePrefetch')
      .then(({ prefetchArticle }) => {
        refs.forEach((ref, index) => {
          window.setTimeout(() => prefetchArticle(ref), index * 120);
        });
      })
      .catch(() => {});
  };

  if ('requestIdleCallback' in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number })
      .requestIdleCallback(runPrefetch, { timeout: 1500 });
    return;
  }

  window.setTimeout(runPrefetch, 120);
}

/* ------------------------------------------------------------------ */
/* Prefetch logic                                                     */
/* ------------------------------------------------------------------ */

let prefetchPromise: Promise<NewsItem[]> | null = null;

/**
 * Module-level permanent cache. Once news is fetched successfully it lives
 * here for the entire SPA session — no TTL, no refetch, no flash on revisit.
 */
let cachedItems: NewsItem[] | null = null;

async function fetchLatestHomepageNews(): Promise<NewsItem[]> {
  try {
    const res = await fetch(
      `${API_BASE}/news/articles?status=published&limit=16`,
      { cache: 'default' },
    );
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const payload = await res.json();
    const rawItems = Array.isArray(payload) ? payload : payload?.items;
    if (!Array.isArray(rawItems)) {
      return cachedItems ?? [];
    }

    const mapped: NewsItem[] = (rawItems as ApiNewsArticle[])
      .filter((item) => isStreetVoicesStory(item))
      .map((item) => {
        const id = String(item?.id ?? '');
        const slug = typeof item?.slug === 'string' && item.slug.trim() ? item.slug : '';
        const category = getPrimaryCategory(item?.category, item?.categories);
        return {
          id,
          title: String(item?.title ?? ''),
          image:
            String(item?.image_url ?? item?.feature_image_url ?? FALLBACK_IMAGE) ||
            FALLBACK_IMAGE,
          category,
          isInternal: true,
          href: slug ? `/news/${slug}` : `/news/${id}`,
          publishedAt: typeof item?.published_at === 'string' ? item.published_at : undefined,
        };
      })
      .filter((item) => item.id && item.title)
      .sort((a, b) => {
        const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 12);

    if (mapped.length > 0) {
      cachedItems = mapped;
      writeSessionCache(CACHE_KEY, mapped);
      writeLocalCache(LOCAL_CACHE_KEY, mapped);
      warmHomepageNewsDetails(mapped);
      return mapped;
    }

    return cachedItems ?? [];
  } catch {
    return cachedItems ?? [];
  }
}

/**
 * Start prefetching homepage news. Safe to call multiple times — deduplicates.
 * Returns a promise that resolves with the NewsItem array.
 */
export function prefetchHomepageNews(): Promise<NewsItem[]> {
  // Return immediately if we already have data in memory
  if (cachedItems && cachedItems.length > 0) {
    warmHomepageNewsDetails(cachedItems);
    return Promise.resolve(cachedItems);
  }

  // Reuse in-flight prefetch
  if (prefetchPromise) {
    return prefetchPromise;
  }

  // Check session storage (survives page reloads within the same tab)
  const sessionCached = readSessionCache<NewsItem[]>(CACHE_KEY, SESSION_CACHE_TTL_MS);
  if (sessionCached && sessionCached.length > 0) {
    cachedItems = sessionCached;
    warmHomepageNewsDetails(cachedItems);
    return Promise.resolve(cachedItems);
  }

  const localCached = readLocalCache<NewsItem[]>(LOCAL_CACHE_KEY, LOCAL_CACHE_TTL_MS);
  if (localCached && localCached.length > 0) {
    cachedItems = localCached;
    warmHomepageNewsDetails(cachedItems);
    // Refresh in the background so "latest news" stays fresh without blocking render.
    prefetchPromise = fetchLatestHomepageNews().finally(() => {
      prefetchPromise = null;
    });
    return Promise.resolve(cachedItems);
  }

  prefetchPromise = fetchLatestHomepageNews().finally(() => {
    prefetchPromise = null;
  });

  return prefetchPromise;
}

/**
 * Synchronously read prefetched homepage news.
 * First checks the permanent in-memory cache, then falls back to session storage.
 */
export function getHomepageNewsSync(): NewsItem[] | null {
  if (cachedItems && cachedItems.length > 0) return cachedItems;
  const fromSession = readSessionCache<NewsItem[]>(CACHE_KEY, SESSION_CACHE_TTL_MS);
  if (fromSession && fromSession.length > 0) {
    cachedItems = fromSession;
    return cachedItems;
  }
  const fromLocal = readLocalCache<NewsItem[]>(LOCAL_CACHE_KEY, LOCAL_CACHE_TTL_MS);
  if (fromLocal && fromLocal.length > 0) {
    cachedItems = fromLocal;
    return cachedItems;
  }
  return null;
}

// Fire immediately when this module is imported
prefetchHomepageNews();
