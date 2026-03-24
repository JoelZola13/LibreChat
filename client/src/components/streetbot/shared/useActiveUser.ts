/**
 * Shared hook that resolves the active user across all pages.
 *
 * `useAuthContext().user` can be null on public-layout pages even when the
 * browser still has a valid session cookie (e.g. after Google OAuth).
 * This hook falls back to `/api/auth/refresh` and caches the result in
 * sessionStorage so the Login/Profile UI is consistent everywhere.
 *
 * Key behaviors:
 * - Initializes from session cache synchronously (no logged-out flicker)
 * - On logout (user goes truthy → null), clears cache immediately
 * - Deduplicates concurrent /api/auth/refresh calls across hook instances
 * - Verifies session in background and keeps cache in sync
 */
import { useEffect, useRef, useState } from 'react';
import { useAuthContext } from '~/hooks';
import { readSessionCache, writeSessionCache } from './perfCache';

const SESSION_USER_CACHE_KEY = 'streetbot:session-user:v1';
const SESSION_USER_CACHE_TTL_MS = 2 * 60 * 1000;
const EXPLICIT_LOGOUT_KEY = 'streetbot:explicit-logout';
const RESOLVE_FALLBACK_MS = 250;
let inFlightRefresh: Promise<any | null> | null = null;

function getCachedUser() {
  try {
    return readSessionCache<any>(SESSION_USER_CACHE_KEY, SESSION_USER_CACHE_TTL_MS);
  } catch {
    return null;
  }
}

function clearCachedUser() {
  try {
    sessionStorage.removeItem(SESSION_USER_CACHE_KEY);
  } catch {
    // noop
  }
}

function hasExplicitLogout() {
  try {
    return sessionStorage.getItem(EXPLICIT_LOGOUT_KEY) === '1';
  } catch {
    return false;
  }
}

async function refreshSessionUser(): Promise<any | null> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  inFlightRefresh = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        clearCachedUser();
        return null;
      }

      const data = await res.json();
      const refreshedUser = data?.user ?? null;

      if (refreshedUser) {
        writeSessionCache(SESSION_USER_CACHE_KEY, refreshedUser);
      } else {
        clearCachedUser();
      }

      return refreshedUser;
    } catch {
      // Network error — keep cached user if available
      return getCachedUser();
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

export function useActiveUser() {
  const { user } = useAuthContext();
  // Initialize from cache synchronously — prevents "logged out" flicker
  const [sessionUser, setSessionUser] = useState<any>(() => getCachedUser());
  const [resolved, setResolved] = useState(() => !!user || !!getCachedUser());
  const hadUserRef = useRef(!!user);

  useEffect(() => {
    let cancelled = false;

    if (user) {
      hadUserRef.current = true;
      writeSessionCache(SESSION_USER_CACHE_KEY, user);
      setSessionUser(null);
      setResolved(true);
      try {
        sessionStorage.removeItem(EXPLICIT_LOGOUT_KEY);
      } catch {
        // noop
      }
      return;
    }

    if (hasExplicitLogout()) {
      hadUserRef.current = false;
      clearCachedUser();
      setSessionUser(null);
      setResolved(true);
      return;
    }

    // User is null — either initial load or logout
    if (hadUserRef.current) {
      // Previously had a user → this is a logout
      hadUserRef.current = false;
      clearCachedUser();
      setSessionUser(null);
      setResolved(true);
      return;
    }

    // If we already have a cached user, keep showing them while we verify
    const cached = getCachedUser();
    if (cached) {
      setSessionUser(cached);
      setResolved(true);
    }

    const resolveTimer = !cached
      ? setTimeout(() => {
          if (!cancelled) setResolved(true);
        }, RESOLVE_FALLBACK_MS)
      : null;

    // Verify session in background
    const verify = async () => {
      try {
        const refreshedUser = await refreshSessionUser();

        if (hasExplicitLogout()) {
          clearCachedUser();
          if (!cancelled) setSessionUser(null);
        } else if (!cancelled && refreshedUser) {
          hadUserRef.current = true;
          setSessionUser(refreshedUser);
        } else {
          clearCachedUser();
          if (!cancelled) setSessionUser(null);
        }
      } catch {
        // Network error — keep cached user if we have one
      } finally {
        if (resolveTimer) clearTimeout(resolveTimer);
        if (!cancelled) setResolved(true);
      }
    };

    verify();
    return () => {
      cancelled = true;
      if (resolveTimer) clearTimeout(resolveTimer);
    };
  }, [user]);

  const activeUser = user ?? sessionUser;

  return { activeUser, resolved };
}
