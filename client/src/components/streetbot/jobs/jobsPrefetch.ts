/**
 * Module-level jobs prefetch — starts the API call as soon as this module is
 * imported (i.e., when React.lazy loads the jobs route bundle), BEFORE the
 * component mounts. Eliminates the mount → useEffect → fetch waterfall.
 *
 * Writes results into sessionStorage so JobsPage can read warm cache on mount.
 */
import { SB_API_BASE } from '~/components/streetbot/shared/apiConfig';
import { readSessionCache, writeSessionCache } from '../shared/perfCache';
import { enrichJobsSchedule } from './jobSchedule';

const JOBS_CACHE_KEY = 'streetbot:jobs:listings:v2';
const CACHE_TTL_MS = 5 * 60 * 1000;

export type JobListing = {
  id: string;
  title: string;
  organization?: string;
  [key: string]: unknown;
};

let prefetchPromise: Promise<JobListing[]> | null = null;
let prefetchTimestamp = 0;

/**
 * Start prefetching jobs. Safe to call multiple times — deduplicates.
 */
export function prefetchJobs(): Promise<JobListing[]> {
  if (prefetchPromise && Date.now() - prefetchTimestamp < CACHE_TTL_MS) {
    return prefetchPromise;
  }

  const cached = readSessionCache<JobListing[]>(JOBS_CACHE_KEY, CACHE_TTL_MS);
  if (cached && cached.length > 0) {
    prefetchPromise = Promise.resolve(enrichJobsSchedule(cached));
    prefetchTimestamp = Date.now();
    return prefetchPromise;
  }

  prefetchTimestamp = Date.now();

  prefetchPromise = fetch(`${SB_API_BASE}/jobs`)
    .then((r) => {
      if (!r.ok) return [];
      return r.json();
    })
    .then((data) => {
      const jobs = Array.isArray(data) ? enrichJobsSchedule(data as JobListing[]) : [];
      if (jobs.length > 0) {
        writeSessionCache(JOBS_CACHE_KEY, jobs);
      }
      return jobs;
    })
    .catch(() => [] as JobListing[]);

  return prefetchPromise;
}

/**
 * Read prefetched jobs synchronously from session cache.
 */
export function getPrefetchedJobsSync(): JobListing[] | null {
  const cached = readSessionCache<JobListing[]>(JOBS_CACHE_KEY, CACHE_TTL_MS);
  if (cached && cached.length > 0) return enrichJobsSchedule(cached);
  return null;
}

// Start prefetching immediately when this module is imported
prefetchJobs();
