/**
 * Hook for Meilisearch facet-value autocomplete.
 *
 * Calls `GET /api/directory/search/facet-values?facet=<name>&q=<typed>`
 * which leverages Meilisearch's searchForFacetValues (with typo tolerance).
 * Falls back to empty results on error.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export interface FacetHit {
  value: string;
  count: number;
}

interface UseFacetAutocompleteOptions {
  /** Facet attribute name, e.g. "city" or "category_names" */
  facet: string;
  /** User-typed search within the facet values */
  query: string;
  /** Optional main search query to scope facets to current results */
  searchQuery?: string;
  /** Debounce ms (default: 100) */
  debounceMs?: number;
  /** Max values to return (default: 20) */
  max?: number;
  /** Whether to fetch (default: true). Set false to disable. */
  enabled?: boolean;
}

export function useFacetAutocomplete({
  facet,
  query,
  searchQuery,
  debounceMs = 100,
  max = 20,
  enabled = true,
}: UseFacetAutocompleteOptions) {
  const [hits, setHits] = useState<FacetHit[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const fetch_ = useCallback(
    async (facetQuery: string, signal: AbortSignal) => {
      const params = new URLSearchParams({
        facet,
        q: facetQuery,
        max: String(max),
      });
      if (searchQuery) {
        params.set('query', searchQuery);
      }
      const res = await globalThis.fetch(
        `/api/directory/search/facet-values?${params}`,
        { signal },
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.hits || []) as FacetHit[];
    },
    [facet, searchQuery, max],
  );

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (!enabled) {
      setHits([]);
      return;
    }

    setLoading(true);
    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const results = await fetch_(query, controller.signal);
        if (!controller.signal.aborted) {
          setHits(results);
          setLoading(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setHits([]);
          setLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [query, fetch_, debounceMs, enabled]);

  return { hits, loading };
}
