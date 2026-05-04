// Anonymous + user identity. Persists anonymous_id in localStorage.

const ANON_KEY = 'l3180.analytics.anonymous_id';
const SID_KEY  = 'l3180.analytics.session_id';

export interface IdentitySnapshot {
  anonymous_id: string;
  user_id:      string | null;
  session_id:   string | null;
  distinct_id:  string;          // user_id ?? anonymous_id (PostHog convention)
}

export class IdentityStore {
  private anonymousId: string;
  private userId:      string | null = null;
  private sessionId:   string | null = null;

  constructor() {
    this.anonymousId = readOrCreateAnonymousId();
    this.sessionId   = readSessionId();
  }

  snapshot(): IdentitySnapshot {
    return {
      anonymous_id: this.anonymousId,
      user_id:      this.userId,
      session_id:   this.sessionId,
      distinct_id:  this.userId ?? this.anonymousId,
    };
  }

  setUser(userId: string) {
    this.userId = userId;
  }

  setSessionId(sessionId: string) {
    this.sessionId = sessionId;
    try { localStorage.setItem(SID_KEY, sessionId); } catch {}
  }

  reset() {
    this.userId = null;
    this.anonymousId = createUuid();
    this.sessionId = null;
    try {
      localStorage.setItem(ANON_KEY, this.anonymousId);
      localStorage.removeItem(SID_KEY);
    } catch {}
  }
}

function readOrCreateAnonymousId(): string {
  try {
    const existing = localStorage.getItem(ANON_KEY);
    if (existing) return existing;
    const fresh = createUuid();
    localStorage.setItem(ANON_KEY, fresh);
    return fresh;
  } catch {
    // localStorage blocked (private mode, etc.) — fall back to per-tab id.
    return createUuid();
  }
}

function readSessionId(): string | null {
  try { return localStorage.getItem(SID_KEY); } catch { return null; }
}

export function createUuid(): string {
  // Prefer crypto.randomUUID where available.
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  // Fallback: RFC 4122 v4 from getRandomValues.
  const buf = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(buf);
  else for (let i = 0; i < 16; i++) buf[i] = Math.floor(Math.random() * 256);
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0,4).join('')}-${hex.slice(4,6).join('')}-${hex.slice(6,8).join('')}-${hex.slice(8,10).join('')}-${hex.slice(10,16).join('')}`;
}
