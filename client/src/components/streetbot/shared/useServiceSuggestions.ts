/**
 * Shared hook for Meilisearch-powered service suggestion autocomplete.
 * Used by DirectoryPage, NewsListing, HomePage, and any other search bar.
 */
import { useState, useEffect, useRef, useCallback } from "react";

export interface ServiceSuggestion {
  id: number;
  name: string;
  category_names?: string[];
  city?: string;
  /** Meilisearch highlighted fields with <mark> tags */
  _formatted?: { name?: string; city?: string };
}

interface UseServiceSuggestionsOptions {
  query: string;
  city?: string;
  /** Minimum chars before fetching (default: 2) */
  minChars?: number;
  /** Debounce ms (default: 120) */
  debounceMs?: number;
  /** Max suggestions (default: 6) */
  maxResults?: number;
}

const SUGGEST_SEARCH_API_FAILURE_KEY = "streetbot:directory:suggest-search-api-failure-until:v1";
const SUGGEST_SEARCH_API_FAILURE_COOLDOWN_MS = 60 * 1000;
let suggestSearchApiFailureUntil = 0;

function isJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.includes("application/json") || contentType.includes("+json");
}

function readSuggestSearchApiFailureUntil() {
  if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") {
    return 0;
  }
  try {
    const raw = window.sessionStorage.getItem(SUGGEST_SEARCH_API_FAILURE_KEY);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeSuggestSearchApiFailureUntil(until: number) {
  if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") {
    return;
  }
  try {
    if (until > 0) {
      window.sessionStorage.setItem(SUGGEST_SEARCH_API_FAILURE_KEY, String(until));
    } else {
      window.sessionStorage.removeItem(SUGGEST_SEARCH_API_FAILURE_KEY);
    }
  } catch {
    // no-op
  }
}

function isSuggestSearchApiCoolingDown() {
  const persisted = readSuggestSearchApiFailureUntil();
  if (persisted > suggestSearchApiFailureUntil) {
    suggestSearchApiFailureUntil = persisted;
  }
  return suggestSearchApiFailureUntil > Date.now();
}

function markSuggestSearchApiFailure() {
  suggestSearchApiFailureUntil = Date.now() + SUGGEST_SEARCH_API_FAILURE_COOLDOWN_MS;
  writeSuggestSearchApiFailureUntil(suggestSearchApiFailureUntil);
}

function clearSuggestSearchApiFailure() {
  suggestSearchApiFailureUntil = 0;
  writeSuggestSearchApiFailureUntil(0);
}

export function useServiceSuggestions({
  query,
  city,
  minChars = 2,
  debounceMs = 80,
  maxResults = 6,
}: UseServiceSuggestionsOptions) {
  const [suggestions, setSuggestions] = useState<ServiceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();
    if (!query || query.length < minChars) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const params = new URLSearchParams({ q: query, per_page: String(maxResults) });
        if (city) params.set("city", city);
        const qs = params.toString();
        let res: Response | null = null;

        const shouldTryPrimaryApi = !isSuggestSearchApiCoolingDown();
        if (shouldTryPrimaryApi) {
          try {
            const primaryRes = await fetch(`/api/directory/search?${qs}`, { signal: controller.signal });
            if (primaryRes.ok && isJsonResponse(primaryRes)) {
              clearSuggestSearchApiFailure();
              res = primaryRes;
            } else if (primaryRes.ok && !isJsonResponse(primaryRes)) {
              markSuggestSearchApiFailure();
            } else if (!primaryRes.ok && primaryRes.status >= 500) {
              markSuggestSearchApiFailure();
            }
          } catch (primaryErr) {
            if ((primaryErr as Error).name === "AbortError") throw primaryErr;
            markSuggestSearchApiFailure();
          }
        }

        if (!res) {
          res = await fetch(`/sbapi/services/search?${qs}`, { signal: controller.signal });
        }

        if (!res.ok) return;

        const data = await res.json();
        const items = (data.hits || []).slice(0, maxResults);
        setSuggestions(
          items.map((s: Record<string, unknown>) => ({
            id: s.id as number,
            name: s.name as string,
            category_names: s.category_names as string[] | undefined,
            city: s.city as string | undefined,
            _formatted: (s as Record<string, unknown>)._formatted as
              | { name?: string; city?: string }
              | undefined,
          })),
        );
        if (items.length > 0) {
          setShowSuggestions(true);
        } else {
          setShowSuggestions(false);
        }
      } catch {
        /* AbortError or network — ignore */
      }
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [query, city, minChars, debounceMs, maxResults]);

  const closeSuggestions = useCallback(() => setShowSuggestions(false), []);
  const openSuggestions = useCallback(() => {
    if (suggestions.length > 0) setShowSuggestions(true);
  }, [suggestions.length]);

  return { suggestions, showSuggestions, setShowSuggestions, closeSuggestions, openSuggestions };
}
