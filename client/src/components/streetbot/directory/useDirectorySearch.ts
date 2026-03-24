/**
 * Hook for instant directory search via Meilisearch backend.
 *
 * Debounces search queries (150ms) and returns hits, total, facets, and loading state.
 * Falls back gracefully if the search endpoint is unavailable.
 */
import { useState, useRef, useEffect } from 'react';
import {
  readLocalCache,
  readSessionCache,
  removeSessionCache,
  writeLocalCache,
  writeSessionCache,
} from '../shared/perfCache';
// Uses LibreChat Express /api/directory/search (NOT /sbapi)

export interface SearchHit {
  id: number;
  name: string;
  overview?: string;
  description?: string;
  city?: string;
  province?: string;
  category_names?: string[];
  tags?: string[];
  is_verified?: boolean;
  rating?: number;
  rating_count?: number;
  slug?: string;
  image_url?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  postal_code?: string;
  service_type?: string;
  ages_served?: string;
  gender_served?: string;
  contact_structured?: Record<string, unknown>;
  latitude?: number;
  longitude?: number;
  _geo?: { lat: number; lng: number };
  _geoDistance?: number;
  _formatted?: Record<string, unknown>;
  _rankingScore?: number;
}

export interface SearchFacets {
  [field: string]: Record<string, number>;
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  facets: SearchFacets;
  processingTimeMs: number;
}

export interface UseDirectorySearchOptions {
  query?: string;
  city?: string;
  province?: string;
  categories?: string[];
  serviceTypes?: string[];
  agesServed?: string[];
  gendersServed?: string[];
  tags?: string[];
  isVerified?: boolean;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sort?: string;
  page?: number;
  perPage?: number;
  facets?: string[];
  filter?: string;
  matchingStrategy?: 'all' | 'last';
  attributesToRetrieve?: string[];
  attributesToHighlight?: string[];
  attributesToCrop?: string[];
  cropLength?: number;
  cropMarker?: string;
  highlightPreTag?: string;
  highlightPostTag?: string;
  showRankingScore?: boolean;
  showRankingScoreDetails?: boolean;
  showMatchesPosition?: boolean;
  distinct?: string;
  enabled?: boolean;
  progressive?: boolean;
  progressiveLimit?: number;
  cacheTtlMs?: number;
}

const DEBOUNCE_MS = 150;
const SEARCH_URL = '/api/directory/search';
const SBP_SEARCH_URL = '/sbapi/services/search';
const FALLBACK_SERVICES_URL = '/sbapi/services';
const DIRECTORY_SEARCH_CACHE_PREFIX = 'streetbot:directory:search:v5:';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_PROGRESSIVE_LIMIT = 200;
const FALLBACK_FETCH_PAGE_SIZE = 100;
const FALLBACK_FETCH_MAX_PAGES = 5;
const FALLBACK_FETCH_HARD_MAX_PAGES = 60;
const FALLBACK_FETCH_CONCURRENCY = 6;
const SEARCH_API_FAILURE_COOLDOWN_MS = 60 * 1000;
const SEARCH_API_FAILURE_UNTIL_KEY = 'streetbot:directory:search-api-failure-until:v2';
const FALLBACK_TOTAL_CACHE_KEY = 'streetbot:directory:fallback-total:v1';
const FALLBACK_TOTAL_SEARCH_MAX = 200000;
const inFlightSearchRequests = new Map<string, Promise<SearchResult>>();
let searchApiFailureUntil = 0;

function isJsonResponse(response: Response) {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  return contentType.includes('application/json') || contentType.includes('+json');
}

// localStorage toggle: set 'streetbot:perf:parallel-progressive' to 'false' to revert to serial
function isParallelProgressiveEnabled(): boolean {
  try {
    return window.localStorage.getItem('streetbot:perf:parallel-progressive') !== 'false';
  } catch {
    return true;
  }
}

function readSearchApiFailureUntil() {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return 0;
  }

  try {
    const raw = window.sessionStorage.getItem(SEARCH_API_FAILURE_UNTIL_KEY);
    if (!raw) return 0;
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeSearchApiFailureUntil(until: number) {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return;
  }

  try {
    if (until > 0) {
      window.sessionStorage.setItem(SEARCH_API_FAILURE_UNTIL_KEY, String(until));
      return;
    }
    window.sessionStorage.removeItem(SEARCH_API_FAILURE_UNTIL_KEY);
  } catch {
    // noop
  }
}

function isSearchApiFailureCoolingDown() {
  const persisted = readSearchApiFailureUntil();
  if (persisted > searchApiFailureUntil) {
    searchApiFailureUntil = persisted;
  }
  return searchApiFailureUntil > Date.now();
}

function markSearchApiFailure() {
  searchApiFailureUntil = Date.now() + SEARCH_API_FAILURE_COOLDOWN_MS;
  writeSearchApiFailureUntil(searchApiFailureUntil);
}

function clearSearchApiFailure() {
  searchApiFailureUntil = 0;
  writeSearchApiFailureUntil(0);
}

export function useDirectorySearch(options: UseDirectorySearchOptions) {
  const {
    query = '',
    city,
    province,
    categories,
    serviceTypes,
    agesServed,
    gendersServed,
    tags,
    isVerified,
    lat,
    lng,
    radiusKm,
    sort,
    page = 0,
    perPage = 20,
    facets,
    filter,
    matchingStrategy,
    attributesToRetrieve,
    attributesToHighlight,
    attributesToCrop,
    cropLength,
    cropMarker,
    highlightPreTag,
    highlightPostTag,
    showRankingScore = true,
    showRankingScoreDetails = false,
    showMatchesPosition = false,
    distinct,
    enabled = true,
    progressive = false,
    progressiveLimit = DEFAULT_PROGRESSIVE_LIMIT,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  } = options;

  // Build cache key early so useState initializers can read warm cache synchronously.
  // This eliminates the blank-frame flash: if the prefetch script or directoryPrefetch
  // module already wrote data to sessionStorage, the component renders with data on
  // the very first paint — no useEffect round-trip needed.
  const initParamStr = (() => {
    const params = new URLSearchParams();
    params.set('q', query);
    if (city) params.set('city', city);
    if (province) params.set('province', province);
    if (categories && categories.length) params.set('categories', categories.join(','));
    if (serviceTypes && serviceTypes.length) params.set('service_type', serviceTypes.join(','));
    if (agesServed && agesServed.length) params.set('ages_served', agesServed.join(','));
    if (gendersServed && gendersServed.length) params.set('gender_served', gendersServed.join(','));
    if (tags && tags.length) params.set('tags', tags.join(','));
    if (isVerified !== undefined) params.set('is_verified', String(isVerified));
    if (lat !== undefined && lng !== undefined) {
      params.set('lat', String(lat));
      params.set('lng', String(lng));
      if (radiusKm !== undefined) params.set('radius_km', String(radiusKm));
    }
    if (sort) params.set('sort', sort);
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    if (facets && facets.length) params.set('facets', facets.join(','));
    if (filter) params.set('filter', filter);
    if (matchingStrategy) params.set('matching_strategy', matchingStrategy);
    if (attributesToRetrieve && attributesToRetrieve.length) {
      params.set('attributes_to_retrieve', attributesToRetrieve.join(','));
    }
    if (attributesToHighlight && attributesToHighlight.length) {
      params.set('attributes_to_highlight', attributesToHighlight.join(','));
    }
    if (attributesToCrop && attributesToCrop.length) {
      params.set('attributes_to_crop', attributesToCrop.join(','));
    }
    if (cropLength !== undefined) params.set('crop_length', String(cropLength));
    if (cropMarker) params.set('crop_marker', cropMarker);
    if (highlightPreTag) params.set('highlight_pre_tag', highlightPreTag);
    if (highlightPostTag) params.set('highlight_post_tag', highlightPostTag);
    params.set('show_ranking_score', String(showRankingScore));
    if (showRankingScoreDetails) params.set('show_ranking_score_details', 'true');
    if (showMatchesPosition) params.set('show_matches_position', 'true');
    if (distinct) params.set('distinct', distinct);
    return params.toString();
  })();
  const initCacheKey = `${DIRECTORY_SEARCH_CACHE_PREFIX}${initParamStr}`;
  const initCached = readSessionCache<SearchResult>(initCacheKey, cacheTtlMs);
  const hasCacheHit = initCached !== null && initCached.hits && initCached.hits.length > 0;

  const [result, setResult] = useState<SearchResult>(
    hasCacheHit ? initCached! : { hits: [], total: 0, facets: {}, processingTimeMs: 0 },
  );
  const [loading, setLoading] = useState(!hasCacheHit);
  const [error, setError] = useState<string | null>(null);
  const [searchAvailable, setSearchAvailable] = useState(true);
  const [resolved, setResolved] = useState(hasCacheHit);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Stabilize array deps so new array literals don't cause re-render loops
  const categoriesKey = categories ? categories.join(',') : '';
  const serviceTypesKey = serviceTypes ? serviceTypes.join(',') : '';
  const agesServedKey = agesServed ? agesServed.join(',') : '';
  const gendersServedKey = gendersServed ? gendersServed.join(',') : '';
  const tagsKey = tags ? tags.join(',') : '';
  const facetsKey = facets ? facets.join(',') : '';
  const attributesToRetrieveKey = attributesToRetrieve ? attributesToRetrieve.join(',') : '';
  const attributesToHighlightKey = attributesToHighlight ? attributesToHighlight.join(',') : '';
  const attributesToCropKey = attributesToCrop ? attributesToCrop.join(',') : '';
  const requestedFacets =
    facets && facets.length > 0
      ? facets
      : ['category_names', 'city', 'service_type', 'ages_served', 'gender_served'];

  const normalizeList = (value: string) =>
    value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

  const categoryFilterList = categoriesKey ? normalizeList(categoriesKey) : [];
  const tagFilterList = tagsKey ? normalizeList(tagsKey) : [];
  const hasNarrowingFilters =
    query.trim().length > 0 ||
    Boolean(city) ||
    Boolean(province) ||
    categoryFilterList.length > 0 ||
    Boolean(serviceTypesKey) ||
    Boolean(agesServedKey) ||
    Boolean(gendersServedKey) ||
    tagFilterList.length > 0 ||
    isVerified !== undefined ||
    (lat !== undefined && lng !== undefined);

  const toKilometers = (latA: number, lngA: number, latB: number, lngB: number) => {
    const toRad = (degrees: number) => (degrees * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const deltaLat = toRad(latB - latA);
    const deltaLng = toRad(lngB - lngA);
    const normalizedA =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(toRad(latA)) *
        Math.cos(toRad(latB)) *
        Math.sin(deltaLng / 2) *
        Math.sin(deltaLng / 2);
    return earthRadiusKm * (2 * Math.atan2(Math.sqrt(normalizedA), Math.sqrt(1 - normalizedA)));
  };

  const buildFacetDistribution = (items: SearchHit[]): SearchFacets => {
    const distribution: SearchFacets = {};

    requestedFacets.forEach((facet) => {
      if (facet === 'category_names') {
        const counts: Record<string, number> = {};
        items.forEach((item) => {
          (item.category_names || []).forEach((category) => {
            if (!category) return;
            counts[category] = (counts[category] ?? 0) + 1;
          });
        });
        distribution[facet] = counts;
        return;
      }

      if (facet === 'city') {
        const counts: Record<string, number> = {};
        items.forEach((item) => {
          const itemCity = item.city?.trim();
          if (!itemCity) return;
          counts[itemCity] = (counts[itemCity] ?? 0) + 1;
        });
        distribution[facet] = counts;
        return;
      }

      // Generic string field facets (service_type, ages_served, gender_served)
      if (['service_type', 'ages_served', 'gender_served'].includes(facet)) {
        const counts: Record<string, number> = {};
        items.forEach((item) => {
          const val = (item as Record<string, unknown>)[facet];
          if (typeof val === 'string' && val.trim()) {
            const key = val.trim();
            counts[key] = (counts[key] ?? 0) + 1;
          }
        });
        distribution[facet] = counts;
      }
    });

    return distribution;
  };

  const extractItemsFromPayload = (payload: unknown): SearchHit[] => {
    if (Array.isArray(payload)) {
      return payload as SearchHit[];
    }

    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      if (Array.isArray(record.items)) {
        return record.items as SearchHit[];
      }
      if (Array.isArray(record.services)) {
        return record.services as SearchHit[];
      }
      if (Array.isArray(record.results)) {
        return record.results as SearchHit[];
      }
      if (Array.isArray(record.data)) {
        return record.data as SearchHit[];
      }
      if (
        record.data &&
        typeof record.data === 'object' &&
        Array.isArray((record.data as Record<string, unknown>).items)
      ) {
        return (record.data as Record<string, unknown>).items as SearchHit[];
      }
    }

    return [];
  };

  const fetchFallbackSearchResult = async (
    signal: AbortSignal,
    mode: 'quick' | 'full' = 'full',
  ): Promise<SearchResult> => {
    const quickMode = mode === 'quick';
    const minimumNeeded = Math.max((page + 1) * perPage, perPage);
    const fallbackTargetCount = hasNarrowingFilters
      ? Math.max(minimumNeeded, FALLBACK_FETCH_PAGE_SIZE * 2)
      : minimumNeeded;
    const requestedPages = Math.max(1, Math.ceil(fallbackTargetCount / FALLBACK_FETCH_PAGE_SIZE));
    let maxPages = requestedPages;
    if (!quickMode) {
      maxPages = hasNarrowingFilters
        ? Math.max(requestedPages, FALLBACK_FETCH_MAX_PAGES)
        : Math.max(requestedPages, FALLBACK_FETCH_HARD_MAX_PAGES);
    }

    const sourceItems: SearchHit[] = [];
    const seenIds = new Set<string>();

    const appendBatchItems = (batchItems: SearchHit[]) => {
      for (const item of batchItems) {
        const id = String((item as Record<string, unknown>)?.id ?? '');
        const dedupeKey = id || JSON.stringify(item);
        if (seenIds.has(dedupeKey)) continue;
        seenIds.add(dedupeKey);
        sourceItems.push(item);
      }
    };

    const fetchFallbackPage = async (pageIndex: number) => {
      const skip = pageIndex * FALLBACK_FETCH_PAGE_SIZE;
      const response = await fetch(
        `${FALLBACK_SERVICES_URL}?limit=${FALLBACK_FETCH_PAGE_SIZE}&skip=${skip}`,
        { signal },
      );
      if (!response.ok) {
        throw new Error(`Fallback search failed: ${response.status}`);
      }

      const payload = await response.json();
      return extractItemsFromPayload(payload);
    };

    if (quickMode) {
      for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
        const batchItems = await fetchFallbackPage(pageIndex);

        if (!batchItems.length) {
          break;
        }

        appendBatchItems(batchItems);

        if (sourceItems.length >= fallbackTargetCount) {
          break;
        }

        if (batchItems.length < FALLBACK_FETCH_PAGE_SIZE) {
          break;
        }
      }
    } else {
      let pageIndex = 0;
      let reachedEnd = false;

      while (pageIndex < maxPages && !reachedEnd) {
        const pageBatch: number[] = [];
        while (pageBatch.length < FALLBACK_FETCH_CONCURRENCY && pageIndex < maxPages) {
          pageBatch.push(pageIndex);
          pageIndex += 1;
        }

        const responses = await Promise.all(
          pageBatch.map(async (batchPageIndex) => ({
            pageIndex: batchPageIndex,
            items: await fetchFallbackPage(batchPageIndex),
          })),
        );
        responses.sort((a, b) => a.pageIndex - b.pageIndex);

        for (const responseBatch of responses) {
          const batchItems = responseBatch.items;

          if (!batchItems.length) {
            reachedEnd = true;
            break;
          }

          appendBatchItems(batchItems);

          if (batchItems.length < FALLBACK_FETCH_PAGE_SIZE) {
            reachedEnd = true;
            break;
          }

          if (
            !hasNarrowingFilters &&
            sourceItems.length >= FALLBACK_FETCH_PAGE_SIZE * FALLBACK_FETCH_HARD_MAX_PAGES
          ) {
            reachedEnd = true;
            break;
          }
        }
      }
    }

    if (sourceItems.length === 0) {
      return {
        hits: [],
        total: 0,
        facets: {},
        processingTimeMs: 0,
      };
    }

    const normalizedQuery = query.trim().toLowerCase();
    const normalizedCity = city?.trim().toLowerCase();

    const filtered = sourceItems
      .filter((item: Record<string, unknown>) => item?.is_active !== false)
      .filter((item: Record<string, unknown>) => {
        if (!normalizedQuery) return true;
        const searchable = [
          item.name,
          item.overview,
          item.description,
          item.city,
          item.address,
          ...(Array.isArray(item.tags) ? item.tags : []),
          ...(Array.isArray(item.category_names) ? item.category_names : []),
        ]
          .filter((value): value is string => typeof value === 'string')
          .join(' ')
          .toLowerCase();
        return searchable.includes(normalizedQuery);
      })
      .filter((item) => {
        if (!normalizedCity) return true;
        const itemCity = typeof item.city === 'string' ? item.city.toLowerCase() : '';
        return itemCity === normalizedCity;
      })
      .filter((item) => {
        if (categoryFilterList.length === 0) return true;
        const itemCategories = Array.isArray(item.category_names)
          ? item.category_names
              .filter((value): value is string => typeof value === 'string')
              .map((value) => value.toLowerCase())
          : [];
        return categoryFilterList.some((category) => itemCategories.includes(category));
      })
      .filter((item) => {
        if (!serviceTypesKey) return true;
        const itemType = (item.service_type || '').toLowerCase();
        return serviceTypesKey.split(',').some((st) => itemType === st.trim().toLowerCase());
      })
      .filter((item) => {
        if (!agesServedKey) return true;
        const itemAge = (item.ages_served || '').toLowerCase();
        return agesServedKey.split(',').some((a) => itemAge === a.trim().toLowerCase());
      })
      .filter((item) => {
        if (!gendersServedKey) return true;
        const itemGender = (item.gender_served || '').toLowerCase();
        return gendersServedKey.split(',').some((g) => itemGender === g.trim().toLowerCase());
      })
      .filter((item) => {
        if (tagFilterList.length === 0) return true;
        const itemTags = Array.isArray(item.tags)
          ? item.tags
              .filter((value): value is string => typeof value === 'string')
              .map((value) => value.toLowerCase())
          : [];
        return tagFilterList.some((tag) => itemTags.includes(tag));
      })
      .filter((item) => {
        if (isVerified === undefined) return true;
        return Boolean(item.is_verified) === Boolean(isVerified);
      })
      .map((item) => {
        const latitude = Number(item.latitude);
        const longitude = Number(item.longitude);
        let geoDistance: number | undefined;
        if (
          lat !== undefined &&
          lng !== undefined &&
          Number.isFinite(latitude) &&
          Number.isFinite(longitude)
        ) {
          geoDistance = toKilometers(lat, lng, latitude, longitude) * 1000;
        }
        return {
          ...item,
          _geo:
            Number.isFinite(latitude) && Number.isFinite(longitude)
              ? { lat: latitude, lng: longitude }
              : undefined,
          _geoDistance: geoDistance,
        };
      });

    if (lat !== undefined && lng !== undefined && radiusKm !== undefined) {
      const maxDistanceMeters = radiusKm * 1000;
      filtered.splice(
        0,
        filtered.length,
        ...filtered.filter(
          (item) => item._geoDistance === undefined || item._geoDistance <= maxDistanceMeters,
        ),
      );
    }

    if (lat !== undefined && lng !== undefined) {
      filtered.sort(
        (a, b) =>
          (a._geoDistance ?? Number.MAX_SAFE_INTEGER) - (b._geoDistance ?? Number.MAX_SAFE_INTEGER),
      );
    } else if (sort === 'name:asc') {
      filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sort === 'name:desc') {
      filtered.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    }

    const total = filtered.length;
    const start = page * perPage;
    const end = start + perPage;
    const hits = filtered.slice(start, end);

    return {
      hits,
      total,
      facets: buildFacetDistribution(filtered),
      processingTimeMs: 0,
    };
  };

  const fetchFallbackTotalCount = async (signal: AbortSignal): Promise<number> => {
    // Try the fast /services/count endpoint first (single request)
    try {
      const countRes = await fetch(`${FALLBACK_SERVICES_URL}/count`, { signal });
      if (countRes.ok) {
        const data = await countRes.json();
        if (typeof data?.total === 'number') {
          return data.total;
        }
      }
    } catch {
      // Fall through to binary search
    }

    // Binary search fallback (slow — ~22 sequential requests)
    const existenceCache = new Map<number, boolean>();

    const hasItemAt = async (index: number): Promise<boolean> => {
      if (index < 0) {
        return false;
      }
      const cached = existenceCache.get(index);
      if (cached !== undefined) {
        return cached;
      }
      const response = await fetch(`${FALLBACK_SERVICES_URL}?limit=1&skip=${index}`, { signal });
      if (!response.ok) {
        throw new Error(`Fallback count failed: ${response.status}`);
      }
      const payload = await response.json();
      const exists = extractItemsFromPayload(payload).length > 0;
      existenceCache.set(index, exists);
      return exists;
    };

    const firstExists = await hasItemAt(0);
    if (!firstExists) {
      return 0;
    }

    let high = 1;
    while (high < FALLBACK_TOTAL_SEARCH_MAX) {
      const exists = await hasItemAt(high);
      if (!exists) {
        break;
      }
      high = Math.min(high * 2, FALLBACK_TOTAL_SEARCH_MAX);
    }

    let low = Math.floor(high / 2);
    let upper = high;
    while (low < upper) {
      const mid = Math.floor((low + upper) / 2);
      const exists = await hasItemAt(mid);
      if (exists) {
        low = mid + 1;
      } else {
        upper = mid;
      }
    }

    return low;
  };

  const buildParamString = (requestedPage: number, requestedPerPage: number) => {
    const params = new URLSearchParams();
    params.set('q', query);
    if (city) params.set('city', city);
    if (province) params.set('province', province);
    if (categoriesKey) params.set('categories', categoriesKey);
    if (serviceTypesKey) params.set('service_type', serviceTypesKey);
    if (agesServedKey) params.set('ages_served', agesServedKey);
    if (gendersServedKey) params.set('gender_served', gendersServedKey);
    if (tagsKey) params.set('tags', tagsKey);
    if (isVerified !== undefined) params.set('is_verified', String(isVerified));
    if (lat !== undefined && lng !== undefined) {
      params.set('lat', String(lat));
      params.set('lng', String(lng));
      if (radiusKm !== undefined) params.set('radius_km', String(radiusKm));
    }
    if (sort) params.set('sort', sort);
    params.set('page', String(requestedPage));
    params.set('per_page', String(requestedPerPage));
    if (facetsKey) params.set('facets', facetsKey);
    if (filter) params.set('filter', filter);
    if (matchingStrategy) params.set('matching_strategy', matchingStrategy);
    if (attributesToRetrieveKey) params.set('attributes_to_retrieve', attributesToRetrieveKey);
    if (attributesToHighlightKey) params.set('attributes_to_highlight', attributesToHighlightKey);
    if (attributesToCropKey) params.set('attributes_to_crop', attributesToCropKey);
    if (cropLength !== undefined) params.set('crop_length', String(cropLength));
    if (cropMarker) params.set('crop_marker', cropMarker);
    if (highlightPreTag) params.set('highlight_pre_tag', highlightPreTag);
    if (highlightPostTag) params.set('highlight_post_tag', highlightPostTag);
    params.set('show_ranking_score', String(showRankingScore));
    if (showRankingScoreDetails) params.set('show_ranking_score_details', 'true');
    if (showMatchesPosition) params.set('show_matches_position', 'true');
    if (distinct) params.set('distinct', distinct);
    return params.toString();
  };

  // Build a stable param string that drives the search
  const paramStr = buildParamString(page, perPage);
  const cacheKey = `${DIRECTORY_SEARCH_CACHE_PREFIX}${paramStr}`;

  // Debounced search trigger — only fires when paramStr actually changes
  useEffect(() => {
    if (!enabled) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    const shouldDebounceSearch = page === 0 && hasNarrowingFilters;
    const debounceDelay = shouldDebounceSearch ? DEBOUNCE_MS : 0;

    timerRef.current = setTimeout(() => {
      const cached = readSessionCache<SearchResult>(cacheKey, cacheTtlMs);
      if (cached) {
        const isSuspiciousEmptyDefault =
          !hasNarrowingFilters &&
          (cached.total ?? 0) === 0 &&
          (!cached.hits || cached.hits.length === 0);
        if (isSuspiciousEmptyDefault) {
          removeSessionCache(cacheKey);
        } else {
          setResult(cached);
          setSearchAvailable(true);
          setLoading(false);
          setResolved(true);
          return;
        }
      }

      setLoading(true);
      setError(null);
      setResolved(false);

      // Abort previous request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const fetchSearchResult = async (paramsString: string): Promise<SearchResult> => {
        const existing = inFlightSearchRequests.get(paramsString);
        if (existing) {
          return existing;
        }

        const request = (async (): Promise<SearchResult> => {
          const shouldTryExpressSearchApi = !isSearchApiFailureCoolingDown();

          // Try Express Meilisearch first (skip during cooldown)
          if (shouldTryExpressSearchApi) {
            try {
              const res = await fetch(`${SEARCH_URL}?${paramsString}`, {
                signal: controller.signal,
              });

              if (res.ok && isJsonResponse(res)) {
                const payload = (await res.json()) as SearchResult;
                clearSearchApiFailure();
                return payload;
              }

              // Vite dev can return HTML fallback for missing /api route;
              // mark this endpoint unhealthy briefly to avoid repeated latency.
              if (res.ok && !isJsonResponse(res)) {
                markSearchApiFailure();
              } else if (!res.ok && res.status >= 500) {
                markSearchApiFailure();
              }
            } catch (err) {
              if ((err as Error).name === 'AbortError') throw err;
              markSearchApiFailure();
            }
          }

          // Try SBP Meilisearch (bypasses Express route mounting)
          const sbpRes = await fetch(`${SBP_SEARCH_URL}?${paramsString}`, {
            signal: controller.signal,
          });
          if (!sbpRes.ok) throw new Error(`Search failed: ${sbpRes.status}`);
          return (await sbpRes.json()) as SearchResult;
        })().finally(() => {
          inFlightSearchRequests.delete(paramsString);
        });

        inFlightSearchRequests.set(paramsString, request);
        return request;
      };

      const run = async () => {
        const resolveWithFallback = async () => {
          const quickFallback = await fetchFallbackSearchResult(controller.signal, 'quick');
          if (controller.signal.aborted) return;

          const shouldRefreshFallbackTotal = !hasNarrowingFilters && page === 0;
          const cachedFallbackTotal = shouldRefreshFallbackTotal
            ? readLocalCache<number>(FALLBACK_TOTAL_CACHE_KEY, cacheTtlMs)
            : null;
          const quickFallbackWithStableTotal =
            shouldRefreshFallbackTotal && typeof cachedFallbackTotal === 'number'
              ? { ...quickFallback, total: Math.max(quickFallback.total, cachedFallbackTotal) }
              : quickFallback;

          // Show data immediately — never block paint on total count resolution
          setResult(quickFallbackWithStableTotal);
          setSearchAvailable(true);
          setLoading(false);
          setError(null);
          setResolved(true);
          writeSessionCache(cacheKey, quickFallbackWithStableTotal);

          // Resolve accurate total count in the background (binary search is slow)
          if (shouldRefreshFallbackTotal) {
            void (async () => {
              try {
                const fallbackTotal = await fetchFallbackTotalCount(controller.signal);
                if (controller.signal.aborted) return;
                const totalUpdatedResult = {
                  ...quickFallbackWithStableTotal,
                  total: Math.max(quickFallbackWithStableTotal.total, fallbackTotal),
                };
                writeLocalCache(FALLBACK_TOTAL_CACHE_KEY, totalUpdatedResult.total);
                setResult(totalUpdatedResult);
                writeSessionCache(cacheKey, totalUpdatedResult);
              } catch (err) {
                if ((err as Error).name === 'AbortError') return;
              }
            })();
            return;
          }

          void (async () => {
            try {
              const fullFallback = await fetchFallbackSearchResult(controller.signal, 'full');
              if (controller.signal.aborted) return;
              setResult(fullFallback);
              writeSessionCache(cacheKey, fullFallback);
            } catch (err) {
              if ((err as Error).name === 'AbortError') return;
            }
          })();
        };

        try {
          const firstPage = await fetchSearchResult(paramStr);
          if (controller.signal.aborted) return;

          setResult(firstPage);
          setSearchAvailable(true);
          setLoading(false);
          setResolved(true);
          writeSessionCache(cacheKey, firstPage);

          const shouldProgressivelyLoad =
            progressive &&
            page === 0 &&
            perPage < progressiveLimit &&
            firstPage.total > firstPage.hits.length;

          if (!shouldProgressivelyLoad) {
            return;
          }

          const targetCount = Math.min(firstPage.total, progressiveLimit);
          const mergedHits = [...firstPage.hits];
          const totalPages = Math.ceil(targetCount / perPage);
          const useParallel = isParallelProgressiveEnabled();

          if (useParallel && totalPages > 1) {
            // Parallel: fetch remaining pages in batches of PARALLEL_BATCH_SIZE
            const PARALLEL_BATCH_SIZE = 4;
            let pageIndex = 1;
            while (pageIndex < totalPages && !controller.signal.aborted) {
              const batchEnd = Math.min(pageIndex + PARALLEL_BATCH_SIZE, totalPages);
              const batch: Promise<SearchResult>[] = [];
              for (let p = pageIndex; p < batchEnd; p++) {
                batch.push(fetchSearchResult(buildParamString(p, perPage)));
              }
              const results = await Promise.all(batch);
              if (controller.signal.aborted) return;

              const seen = new Set(mergedHits.map((hit) => String(hit.id)));
              let gotEmpty = false;
              for (const pageResult of results) {
                if (!pageResult.hits.length) {
                  gotEmpty = true;
                  break;
                }
                for (const hit of pageResult.hits) {
                  if (!seen.has(String(hit.id))) {
                    seen.add(String(hit.id));
                    mergedHits.push(hit);
                  }
                }
              }
              if (gotEmpty) break;
              pageIndex = batchEnd;
            }
          } else {
            // Serial fallback (original behavior)
            let nextPage = 1;
            while (mergedHits.length < targetCount && !controller.signal.aborted) {
              const nextParams = buildParamString(nextPage, perPage);
              const nextPageResult = await fetchSearchResult(nextParams);

              if (!nextPageResult.hits.length) {
                break;
              }

              const seen = new Set(mergedHits.map((hit) => String(hit.id)));
              for (const hit of nextPageResult.hits) {
                if (!seen.has(String(hit.id))) {
                  seen.add(String(hit.id));
                  mergedHits.push(hit);
                }
              }

              nextPage += 1;
            }
          }

          if (controller.signal.aborted) {
            return;
          }

          const progressiveResult: SearchResult = {
            ...firstPage,
            hits: mergedHits.slice(0, targetCount),
          };

          setResult(progressiveResult);
          writeSessionCache(cacheKey, progressiveResult);
        } catch (err) {
          if ((err as Error).name === 'AbortError') return;
          markSearchApiFailure();

          try {
            await resolveWithFallback();
            return;
          } catch (fallbackErr) {
            if ((fallbackErr as Error).name === 'AbortError') return;
            console.error('Directory search error:', err);
            console.error('Directory fallback search error:', fallbackErr);
            setError((fallbackErr as Error).message);
            setSearchAvailable(false);
            setLoading(false);
            setResolved(true);
          }
        }
      };

      void run();
    }, debounceDelay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    paramStr,
    cacheKey,
    cacheTtlMs,
    enabled,
    page,
    perPage,
    progressive,
    progressiveLimit,
    hasNarrowingFilters,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    ...result,
    loading,
    error,
    searchAvailable,
    resolved,
  };
}
