/**
 * Hover-based prefetch for individual news articles.
 * Call `prefetchArticle(slug)` on card mouseEnter — it fetches the
 * article JSON and writes it to sessionStorage so NewsArticleDetail
 * reads it synchronously on mount (zero-wait).
 */
import { SB_API_BASE } from '~/components/streetbot/shared/apiConfig';
import { readSessionCache, writeSessionCache } from '../shared/perfCache';
import { normalizeArticle } from './newsConstants';
import type { Article } from './newsTypes';

const ARTICLE_CACHE_PREFIX = 'streetbot:news:article:';
const ARTICLE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min (matches NewsArticleDetail)

const inflight = new Set<string>();

function toCacheKey(slugOrId: string): string {
  return `${ARTICLE_CACHE_PREFIX}${slugOrId}`;
}

function writeArticleToCache(article: Article, requestedRef?: string): void {
  const refs = new Set<string>();
  const normalizedSlug = typeof article.slug === 'string' ? article.slug.trim() : '';
  const normalizedId = article.id != null ? String(article.id).trim() : '';

  if (requestedRef && requestedRef.trim()) refs.add(requestedRef.trim());
  if (normalizedSlug) refs.add(normalizedSlug);
  if (normalizedId) refs.add(normalizedId);

  refs.forEach((ref) => {
    writeSessionCache<Article>(toCacheKey(ref), article);
  });
}

/**
 * Seed detail cache with article list data so detail route can paint instantly
 * and then refresh in the background.
 */
export function seedArticleCache(article: Article): void {
  if (!article) return;
  const normalized = normalizeArticle(article, 'internal');
  writeArticleToCache(normalized);
}

/**
 * Prefetch a single article by slug. Deduplicates and skips if cached.
 */
export function prefetchArticle(slugOrId: string): void {
  const ref = slugOrId?.trim();
  if (!ref) return;

  const key = toCacheKey(ref);
  if (inflight.has(key)) return;

  const cached = readSessionCache<Article>(key, ARTICLE_CACHE_TTL_MS);
  // If we already have full article content cached, no network request needed.
  if (cached?.content) return;

  inflight.add(key);

  const encoded = encodeURIComponent(ref);
  const looksLikeId = /^[0-9]+$/.test(ref);
  const primaryUrl = looksLikeId
    ? `${SB_API_BASE}/news/articles/${encoded}`
    : `${SB_API_BASE}/news/articles/slug/${encoded}`;
  fetch(primaryUrl, { cache: 'default' })
    .then((r) => (r.ok ? r.json() : null))
    .then((results) => {
      const data = results ?? null;
      if (!data) return;
      const normalized = normalizeArticle(data, 'internal');
      writeArticleToCache(normalized, ref);
    })
    .catch(() => {})
    .finally(() => inflight.delete(key));
}

/**
 * Background-prefetch details for top articles to make first taps instantaneous.
 * Uses light staggering to avoid request bursts on mobile connections.
 */
export function prefetchTopArticles(articles: Article[], limit = 8): void {
  if (!Array.isArray(articles) || articles.length === 0) return;
  const refs = articles
    .filter((article) => article?.source_type !== 'aggregated')
    .map((article) => {
      seedArticleCache(article);
      return article.slug ? article.slug : String(article.id ?? '');
    })
    .filter(Boolean)
    .slice(0, limit);

  if (refs.length === 0) return;

  const run = () => {
    refs.forEach((ref, index) => {
      window.setTimeout(() => prefetchArticle(ref), index * 120);
    });
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (
      window as unknown as {
        requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
      }
    ).requestIdleCallback(run, { timeout: 1200 });
    return;
  }

  window.setTimeout(run, 120);
}
