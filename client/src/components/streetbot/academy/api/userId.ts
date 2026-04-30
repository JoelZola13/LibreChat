/**
 * User ID utility for LibreChat Academy components.
 * Adapted from SBP's @/lib/userId for the Vite environment.
 */

const USER_ID_STORAGE_KEY = "streetbot:user-id";
const LOCAL_USER_PREFIX = "academy-local-user";

export type AcademyAuthUser =
  | {
      id?: string | null;
      _id?: string | null;
      username?: string | null;
      email?: string | null;
    }
  | null
  | undefined;

/**
 * Get or create a user ID.
 *
 * Priority:
 * 1. If authUserId is provided (from useAuth), use that
 * 2. If stored in localStorage, use that (for backwards compatibility)
 * 3. Fall back to a stable local Academy user ID for compatibility
 */
export function getOrCreateUserId(authUserId?: string | null): string {
  // If auth user ID is provided, use it and store it
  if (authUserId && authUserId !== "anonymous") {
    window.localStorage.setItem(USER_ID_STORAGE_KEY, authUserId);
    return authUserId;
  }

  // Check localStorage for existing user ID
  const storedUserId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  if (storedUserId && storedUserId !== "anonymous") {
    return storedUserId;
  }

  const localUserId =
    typeof window.crypto?.randomUUID === "function"
      ? `${LOCAL_USER_PREFIX}-${window.crypto.randomUUID()}`
      : `${LOCAL_USER_PREFIX}-${Date.now().toString(36)}`;
  window.localStorage.setItem(USER_ID_STORAGE_KEY, localUserId);
  return localUserId;
}

export function resolveAcademyUserId(user?: AcademyAuthUser): string | null {
  if (!user) {
    return null;
  }

  const candidate = user.id || user._id || user.username || user.email;
  return candidate && candidate !== "anonymous" ? candidate : null;
}

/**
 * Set the user ID (called after authentication)
 */
export function setUserId(userId: string): void {
  window.localStorage.setItem(USER_ID_STORAGE_KEY, userId);
}

/**
 * Clear the user ID (called on logout)
 */
export function clearUserId(): void {
  window.localStorage.removeItem(USER_ID_STORAGE_KEY);
}

/**
 * Check if the current user is a demo/unauthenticated user
 */
export function isDemoUser(): boolean {
  const userId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  return !userId || userId.startsWith(LOCAL_USER_PREFIX) || userId === "anonymous";
}
