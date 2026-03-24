import type { HomeNewsArticle } from "@/types/home";
import { getBackendBaseUrl } from "@/lib/backend";

type FetchOptions = RequestInit & {
  next?: {
    revalidate?: number;
  };
};

// Extract clean category string from categories array or legacy category field
function extractCategory(a: Record<string, unknown>): string {
  const cats = a.categories;
  if (Array.isArray(cats) && cats.length > 0) {
    return cats.filter((c): c is string => typeof c === 'string').join(', ');
  }
  let raw = String(a.category || '');
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) raw = parsed.join(', ');
    } catch { /* use raw */ }
  }
  return raw.replace(/-/g, ' ');
}

export async function fetchHomeNewsArticles(fetchOptions: FetchOptions = {}): Promise<HomeNewsArticle[]> {
  try {
    const baseUrl = getBackendBaseUrl();
    const [articlesRes, aggregatedRes] = await Promise.all([
      fetch(`${baseUrl}/api/news-cms/articles?status=published&limit=9`, fetchOptions),
      fetch(`${baseUrl}/api/news-cms/aggregator/feed?limit=9`, fetchOptions),
    ]);

    const allArticles: HomeNewsArticle[] = [];

    if (articlesRes.ok) {
      const data = await articlesRes.json();
      const articleList = data.items || data;
      if (Array.isArray(articleList)) {
        allArticles.push(...articleList.map((a: Record<string, unknown>) => ({
          id: String(a.id || ""),
          title: String(a.title || ""),
          excerpt: String(a.excerpt || ""),
          image_url: String(a.image_url || a.feature_image_url || ""),
          category: extractCategory(a),
          slug: String(a.slug || ""),
          source_type: "internal" as const,
        })));
      }
    }

    if (aggregatedRes.ok) {
      const data = await aggregatedRes.json();
      const aggregatedList = data.items || data;
      if (Array.isArray(aggregatedList)) {
        allArticles.push(...aggregatedList.map((a: Record<string, unknown>) => ({
          id: String(a.id || ""),
          title: String(a.title || ""),
          excerpt: String(a.excerpt || a.description || ""),
          image_url: String(a.image_url || ""),
          category: extractCategory(a) || "World",
          source_type: "aggregated" as const,
          source_url: String(a.source_url || a.canonical_url || ""),
        })));
      }
    }

    return allArticles.slice(0, 9);
  } catch (error) {
    console.error("Failed to fetch news for home page:", error);
    return [];
  }
}
