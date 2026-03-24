import type { Article } from './newsTypes';

/* ─── Page-specific design tokens (dark stone glass, not in shared system) ─── */
export const NEWS_T = {
  bgDeep: "#0C0A09",
  glassSubtle: "rgba(0,0,0,0.4)",
  glassMedium: "rgba(0,0,0,0.55)",
  borderAccent: "rgba(250,204,21,0.4)",
};

export const FALLBACK_IMAGE = "/assets/street-news-placeholder.png";
export const ARTICLES_PER_PAGE = 15;
const NEWS_REQUEST_TIMEOUT_MS = 8000;

/* ─── Fetch helper with timeout ─── */
export const fetchWithTimeout = async (
  url: string,
  parentSignal: AbortSignal,
  timeoutMs: number = NEWS_REQUEST_TIMEOUT_MS,
) => {
  const timeoutController = new AbortController();
  const handleParentAbort = () => timeoutController.abort();
  const timeoutId = window.setTimeout(() => timeoutController.abort(), timeoutMs);

  parentSignal.addEventListener("abort", handleParentAbort, { once: true });

  try {
    return await fetch(url, { signal: timeoutController.signal });
  } finally {
    window.clearTimeout(timeoutId);
    parentSignal.removeEventListener("abort", handleParentAbort);
  }
};

/* ─── User ID helper ─── */
const USER_ID_STORAGE_KEY = "streetbot:user-id";
const DEFAULT_DEMO_USER_ID = "demo-user";

export function getOrCreateUserId(authUserId?: string | null): string {
  if (authUserId && authUserId !== "anonymous") {
    window.localStorage.setItem(USER_ID_STORAGE_KEY, authUserId);
    return authUserId;
  }
  const storedUserId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  if (storedUserId && storedUserId !== DEFAULT_DEMO_USER_ID) {
    return storedUserId;
  }
  return DEFAULT_DEMO_USER_ID;
}

/* ─── Formatting utilities ─── */
export const formatDate = (dateStr?: string) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const getInitials = (name?: string) => {
  if (!name) return "SV";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

/* ─── Category / normalization helpers ─── */
export const cleanCategory = (article: Article): string => {
  if (article.categories && Array.isArray(article.categories) && article.categories.length > 0) {
    return article.categories.filter((c): c is string => typeof c === 'string').join(', ');
  }
  let raw = article.category || '';
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) raw = parsed.join(', ');
    } catch { /* use raw */ }
  }
  return raw.replace(/-/g, ' ');
};

export const normalizeArticle = (article: Article, sourceType: "internal" | "aggregated" = "internal"): Article => ({
  ...article,
  category: cleanCategory(article),
  author: article.author || article.author_name,
  image_url: article.image_url || article.feature_image_url,
  source_type: sourceType,
});

export const normalizeAggregatedItem = (item: Record<string, unknown>): Article => ({
  id: String(item.id || ""),
  title: String(item.title || ""),
  slug: undefined,
  excerpt: String(item.excerpt || item.description || ""),
  category: String(item.category || "World"),
  image_url: String(item.image_url || ""),
  published_at: String(item.published_at || item.fetched_at || ""),
  author: String(item.author || item.source_name || ""),
  source_type: "aggregated",
  source_name: String(item.source_name || ""),
  source_url: String(item.source_url || item.canonical_url || ""),
  is_featured: false,
  is_breaking: Boolean(item.is_breaking),
});

/* ─── Animation helpers ─── */
export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.1 },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT_EXPO } },
};
