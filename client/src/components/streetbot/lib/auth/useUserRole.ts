import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthContext } from '~/hooks';
import { isStreetBot } from '~/config/appVariant';
import { logger } from '~/utils';

// Directus connection — duplicated here to avoid importing directus.ts
// which has a top-level dependency on @directus/sdk
const DIRECTUS_URL = import.meta.env.VITE_DIRECTUS_URL || '/cms';
const DIRECTUS_TOKEN = import.meta.env.VITE_DIRECTUS_TOKEN || 'streetvoices-admin-token-2026';
const ROLE_CACHE_TTL_MS = 30 * 60 * 1000;
const ROLE_FAILURE_BACKOFF_MS = 5 * 60 * 1000;

// ── Role types ──────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'designer' | 'media' | 'service_user' | 'user';

// ── Nav-key-to-role mapping ─────────────────────────────────────────────────
// Which nav keys each role can access. Admin gets everything.
// All roles implicitly get 'home' (chat).

const ROLE_PAGES: Record<UserRole, Set<string>> = {
  admin: new Set([
    'profile',
    'forum',
    'gallery',
    'groups',
    'news',
    'messages',
    'directory',
    'jobs',
    'learning',
    'calendar',
    'case-management',
    'social-media',
    'tasks',
    'documents',
    'storage',
    'data',
    'grantwriter',
    'grant-alert',
    'settings',
    'notifications',
    'dashboard',
    'manage',
  ]),
  designer: new Set(['news', 'directory', 'gallery', 'profile', 'settings']),
  media: new Set(['news', 'directory', 'gallery', 'forum', 'profile']),
  service_user: new Set(['news', 'directory', 'jobs', 'profile', 'gallery']),
  user: new Set(['news', 'directory', 'profile', 'settings', 'gallery']),
};

const CACHE_PREFIX = 'sv_user_role_';
const inflightRoleRequests = new Map<string, Promise<UserRole>>();
const failedRoleRequests = new Map<string, number>();

type CachedRoleEntry = {
  role: UserRole;
  fetchedAt: number;
};

function parseCachedRole(value: string | null): CachedRoleEntry | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<CachedRoleEntry>;
    if (parsed && typeof parsed.role === 'string' && typeof parsed.fetchedAt === 'number') {
      return {
        role: parsed.role as UserRole,
        fetchedAt: parsed.fetchedAt,
      };
    }
  } catch {
    return {
      role: value as UserRole,
      fetchedAt: 0,
    };
  }

  return null;
}

function getCachedRoleEntry(uid: string | undefined): CachedRoleEntry | null {
  if (!uid) {
    return null;
  }

  const cached = localStorage.getItem(CACHE_PREFIX + uid);
  return parseCachedRole(cached);
}

function getCachedRole(uid: string | undefined): UserRole {
  return getCachedRoleEntry(uid)?.role ?? 'user';
}

function setCachedRole(uid: string, role: UserRole) {
  localStorage.setItem(
    CACHE_PREFIX + uid,
    JSON.stringify({
      role,
      fetchedAt: Date.now(),
    } satisfies CachedRoleEntry),
  );
}

async function fetchRoleFromDirectus({
  userId,
  displayName,
}: {
  userId: string;
  displayName: string;
}): Promise<UserRole> {
  const inflight = inflightRoleRequests.get(userId);
  if (inflight) {
    return inflight;
  }

  const requestPromise = (async () => {
    const params = new URLSearchParams({
      'filter[user_id][_eq]': userId,
      fields: 'id,role',
      limit: '1',
    });

    const res = await fetch(`${DIRECTUS_URL}/items/user_profiles?${params}`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json();
    const profiles = json.data as { id: string; role: UserRole }[];

    if (profiles.length > 0) {
      return profiles[0].role || 'user';
    }

    const createRes = await fetch(`${DIRECTUS_URL}/items/user_profiles`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        display_name: displayName,
        role: 'user',
      }),
    });

    if (!createRes.ok) {
      throw new Error(`HTTP ${createRes.status}`);
    }

    return 'user';
  })().finally(() => {
    inflightRoleRequests.delete(userId);
  });

  inflightRoleRequests.set(userId, requestPromise);

  return requestPromise;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useUserRole({ requireFresh = false }: { requireFresh?: boolean } = {}) {
  const { user } = useAuthContext();
  const userId = user?.id;
  const displayName = user?.name || user?.username || 'User';

  // Hydrate from per-user cache to avoid nav flash
  const [role, setRole] = useState<UserRole>(() => getCachedRole(userId));
  const [isLoading, setIsLoading] = useState(requireFresh && !!userId);

  useEffect(() => {
    if (!userId) {
      setRole('user');
      setIsLoading(false);
      return;
    }

    const cachedEntry = getCachedRoleEntry(userId);
    const cachedRole = cachedEntry?.role ?? 'user';
    setRole(cachedRole);

    let cancelled = false;

    const recentFailureAt = failedRoleRequests.get(userId) ?? 0;
    const hasFreshCache =
      cachedEntry != null && Date.now() - cachedEntry.fetchedAt < ROLE_CACHE_TTL_MS;
    const inBackoffWindow =
      recentFailureAt > 0 && Date.now() - recentFailureAt < ROLE_FAILURE_BACKOFF_MS;

    if (!requireFresh || hasFreshCache || inBackoffWindow) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const fetchRole = async () => {
      try {
        const fetchedRole = await fetchRoleFromDirectus({
          userId,
          displayName,
        });
        failedRoleRequests.delete(userId);

        if (!cancelled) {
          setRole(fetchedRole);
          setCachedRole(userId, fetchedRole);
        }
      } catch (err) {
        failedRoleRequests.set(userId, Date.now());
        logger.debug('streetbot_role', 'Failed to fetch StreetBot role, using cached/default', {
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchRole();

    return () => {
      cancelled = true;
    };
  }, [displayName, requireFresh, userId]);

  const canAccess = useCallback(
    (navKey: string): boolean => {
      // StreetBot should expose its full first-party experience locally without
      // depending on Directus role lookups for routine page access.
      if (isStreetBot) {
        return navKey === 'manage' ? role === 'admin' : true;
      }
      // Admin sees everything
      if (role === 'admin') return true;
      const allowed = ROLE_PAGES[role];
      return allowed ? allowed.has(navKey) : false;
    },
    [role],
  );

  const isAdmin = role === 'admin';
  const canEditNews = role === 'admin' || role === 'media' || role === 'designer';

  return useMemo(
    () => ({ role, isAdmin, canEditNews, canAccess, isLoading }),
    [role, isAdmin, canEditNews, canAccess, isLoading],
  );
}
