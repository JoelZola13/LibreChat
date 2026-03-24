type CacheEntry<T> = {
  value: T;
  cachedAt: number;
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function isCacheDisabled(): boolean {
  if (!isBrowser()) {
    return false;
  }

  try {
    return window.localStorage.getItem('streetbot:disable-perf-cache') === '1';
  } catch {
    return false;
  }
}

export function readSessionCache<T>(key: string, ttlMs: number): T | null {
  const entry = readCacheEntry<T>(getSessionStorage(), key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > ttlMs) {
    removeSessionCache(key);
    return null;
  }
  return entry.value ?? null;
}

export function writeSessionCache<T>(key: string, value: T): void {
  writeCache(getSessionStorage(), key, value);
}

export function removeSessionCache(key: string): void {
  removeCache(getSessionStorage(), key);
}

export function readLocalCache<T>(key: string, ttlMs: number): T | null {
  const entry = readCacheEntry<T>(getLocalStorage(), key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > ttlMs) {
    removeLocalCache(key);
    return null;
  }
  return entry.value ?? null;
}

export function writeLocalCache<T>(key: string, value: T): void {
  writeCache(getLocalStorage(), key, value);
}

export function removeLocalCache(key: string): void {
  removeCache(getLocalStorage(), key);
}

export function readSessionCacheMeta<T>(key: string): CacheEntry<T> | null {
  return readCacheEntry<T>(getSessionStorage(), key);
}

function readCacheEntry<T>(storage: Storage | undefined, key: string): CacheEntry<T> | null {
  if (!isBrowser() || isCacheDisabled() || !storage) {
    return null;
  }

  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.cachedAt !== 'number') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeCache<T>(storage: Storage | undefined, key: string, value: T): void {
  if (!isBrowser() || isCacheDisabled() || !storage) {
    return;
  }

  try {
    const payload: CacheEntry<T> = {
      value,
      cachedAt: Date.now(),
    };
    storage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage quota and serialization failures.
  }
}

function removeCache(storage: Storage | undefined, key: string): void {
  if (!isBrowser() || !storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // noop
  }
}

function getSessionStorage(): Storage | undefined {
  if (!isBrowser()) return undefined;
  return window.sessionStorage;
}

function getLocalStorage(): Storage | undefined {
  if (!isBrowser()) return undefined;
  return window.localStorage;
}
