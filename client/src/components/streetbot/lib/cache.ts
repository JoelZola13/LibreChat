/**
 * Client-side caching utilities for instant loading
 * Implements stale-while-revalidate pattern
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  expiresAt: number;
};

type CacheOptions = {
  /** Time in ms before cache is considered stale (default: 5 min) */
  staleTime?: number;
  /** Time in ms before cache is completely invalid (default: 1 hour) */
  cacheTime?: number;
  /** Storage key prefix */
  prefix?: string;
};

const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes
const DEFAULT_CACHE_TIME = 60 * 60 * 1000; // 1 hour
const CACHE_PREFIX = "sv_cache_";

/**
 * Get item from cache
 * Returns { data, isStale } or null if not cached/expired
 */
export function getFromCache<T>(
  key: string,
  options: CacheOptions = {}
): { data: T; isStale: boolean } | null {
  if (typeof window === "undefined") return null;

  const prefix = options.prefix || CACHE_PREFIX;
  const fullKey = prefix + key;

  try {
    const stored = localStorage.getItem(fullKey);
    if (!stored) return null;

    const entry: CacheEntry<T> = JSON.parse(stored);
    const now = Date.now();

    // Cache completely expired
    if (now > entry.expiresAt) {
      localStorage.removeItem(fullKey);
      return null;
    }

    const staleTime = options.staleTime ?? DEFAULT_STALE_TIME;
    const isStale = now > entry.timestamp + staleTime;

    return { data: entry.data, isStale };
  } catch {
    return null;
  }
}

/**
 * Save item to cache
 */
export function saveToCache<T>(
  key: string,
  data: T,
  options: CacheOptions = {}
): void {
  if (typeof window === "undefined") return;

  const prefix = options.prefix || CACHE_PREFIX;
  const fullKey = prefix + key;
  const cacheTime = options.cacheTime ?? DEFAULT_CACHE_TIME;

  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + cacheTime,
  };

  try {
    localStorage.setItem(fullKey, JSON.stringify(entry));
  } catch (e) {
    // Storage full - clear old cache entries
    clearOldCache(prefix);
    try {
      localStorage.setItem(fullKey, JSON.stringify(entry));
    } catch {
      // Still failed, give up
    }
  }
}

/**
 * Remove item from cache
 */
export function removeFromCache(key: string, prefix = CACHE_PREFIX): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(prefix + key);
}

/**
 * Clear all cache entries with given prefix
 */
export function clearCache(prefix = CACHE_PREFIX): void {
  if (typeof window === "undefined") return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Clear old/expired cache entries
 */
function clearOldCache(prefix = CACHE_PREFIX): void {
  if (typeof window === "undefined") return;

  const now = Date.now();
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const entry = JSON.parse(stored);
          if (now > entry.expiresAt) {
            keysToRemove.push(key);
          }
        }
      } catch {
        keysToRemove.push(key);
      }
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Fetch with cache - implements stale-while-revalidate
 * Returns cached data immediately if available, fetches fresh data in background
 */
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const cached = getFromCache<T>(key, options);

  // If we have fresh cache, return it
  if (cached && !cached.isStale) {
    return cached.data;
  }

  // If we have stale cache, return it but revalidate in background
  if (cached && cached.isStale) {
    // Revalidate in background (don't await)
    fetcher()
      .then((data) => saveToCache(key, data, options))
      .catch(() => {}); // Silently fail background revalidation

    return cached.data;
  }

  // No cache - fetch and cache
  const data = await fetcher();
  saveToCache(key, data, options);
  return data;
}

/**
 * React hook for cached data fetching
 * Returns data immediately from cache, updates when fresh data arrives
 */
export function useCachedData<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): {
  data: T | null;
  isLoading: boolean;
  isStale: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  // This is a simplified version - for production use SWR or React Query
  // But this gives instant loading from cache

  const [state, setState] = React.useState<{
    data: T | null;
    isLoading: boolean;
    isStale: boolean;
    error: Error | null;
  }>(() => {
    // Initialize from cache synchronously
    if (!key) return { data: null, isLoading: false, isStale: false, error: null };

    const cached = getFromCache<T>(key, options);
    return {
      data: cached?.data ?? null,
      isLoading: !cached,
      isStale: cached?.isStale ?? false,
      error: null,
    };
  });

  const refetch = React.useCallback(async () => {
    if (!key) return;

    setState((s) => ({ ...s, isLoading: true }));
    try {
      const data = await fetcher();
      saveToCache(key, data, options);
      setState({ data, isLoading: false, isStale: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, isLoading: false, error: e as Error }));
    }
  }, [key, fetcher, options]);

  React.useEffect(() => {
    if (!key) return;

    const cached = getFromCache<T>(key, options);

    // If no cache or stale, fetch fresh data
    if (!cached || cached.isStale) {
      refetch();
    }
  }, [key, refetch, options]);

  return { ...state, refetch };
}

// Import React for the hook
import * as React from "react";

/**
 * Preload data into cache
 * Call this to warm up cache before user navigates
 */
export function preloadCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): void {
  const cached = getFromCache<T>(key, options);

  // Only preload if not already cached or stale
  if (!cached || cached.isStale) {
    fetcher()
      .then((data) => saveToCache(key, data, options))
      .catch(() => {});
  }
}

/**
 * Cache keys for common data
 */
export const CACHE_KEYS = {
  services: (params?: string) => `services${params ? `_${params}` : ""}`,
  news: (page?: number) => `news${page ? `_${page}` : ""}`,
  jobs: (params?: string) => `jobs${params ? `_${params}` : ""}`,
  courses: () => "courses",
  groups: () => "groups",
  documents: (userId: string) => `documents_${userId}`,
  tasks: (userId: string) => `tasks_${userId}`,
  messages: (userId: string) => `messages_${userId}`,
  profile: (userId: string) => `profile_${userId}`,
};
