/**
 * React hook for Street Bot Pro API calls with loading/error state management.
 * Uses sbFetch internally for auth-aware requests.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuthContext } from '~/hooks/AuthContext';
import { sbGet, sbPost, sbPatch, sbDelete } from './sbFetch';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook that provides auth-aware API methods and tracks loading/error state.
 *
 * The user identity comes from LibreChat's AuthContext — the JWT is automatically
 * attached by sbFetch reading from axios defaults.
 */
export function useSbApi() {
  const { user } = useAuthContext();

  /** The authenticated user's ID (from LibreChat). */
  const userId = user?.id || user?._id || 'demo-user';

  const get = useCallback(
    <T = unknown>(path: string, params?: Record<string, string>) =>
      sbGet<T>(path, params),
    [],
  );

  const post = useCallback(
    <T = unknown>(path: string, body?: unknown) =>
      sbPost<T>(path, body),
    [],
  );

  const patch = useCallback(
    <T = unknown>(path: string, body?: unknown) =>
      sbPatch<T>(path, body),
    [],
  );

  const del = useCallback(
    (path: string) => sbDelete(path),
    [],
  );

  return { userId, get, post, patch, del };
}

/**
 * Hook for a single API fetch with automatic loading/error state.
 * Re-fetches when `deps` change.
 *
 * Usage:
 * ```ts
 * const { data, loading, error, refetch } = useSbQuery<Course[]>(
 *   '/academy/courses',
 *   { user_id: userId },
 *   [userId]
 * );
 * ```
 */
export function useSbQuery<T>(
  path: string,
  params?: Record<string, string>,
  deps: unknown[] = [],
) {
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: true, error: null });
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await sbGet<T>(path, params);
      if (mountedRef.current) setState({ data, loading: false, error: null });
    } catch (err: unknown) {
      if (mountedRef.current) {
        setState({ data: null, loading: false, error: (err as Error).message });
      }
    }
  }, [path, JSON.stringify(params)]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => { mountedRef.current = false; };
  }, [fetchData, ...deps]);

  return { ...state, refetch: fetchData };
}
