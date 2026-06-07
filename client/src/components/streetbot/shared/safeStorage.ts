export function readStoredBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (raw == null || raw === '' || raw === 'undefined' || raw === 'null') {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'boolean' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function parseStoredJson<T>(raw: string | null, fallback: T): T {
  if (raw == null || raw === '' || raw === 'undefined' || raw === 'null') {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
