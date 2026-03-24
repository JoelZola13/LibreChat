const USER_ID_STORAGE_KEY = "streetbot:user-id";

// Default user ID for demo/development - matches mock data owner_id values
const DEFAULT_DEMO_USER_ID = "demo-user";

/**
 * Get or create a user ID.
 *
 * Priority:
 * 1. If authUserId is provided (from useAuth), use that
 * 2. If stored in localStorage, use that (for backwards compatibility)
 * 3. Fall back to demo-user for development
 */
export function getOrCreateUserId(authUserId?: string | null): string {
  // If auth user ID is provided, use it and store it
  if (authUserId && authUserId !== "anonymous") {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(USER_ID_STORAGE_KEY, authUserId);
    }
    return authUserId;
  }

  // Server-side fallback
  if (typeof window === "undefined") return DEFAULT_DEMO_USER_ID;

  // Check localStorage for existing user ID
  const storedUserId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  if (storedUserId && storedUserId !== DEFAULT_DEMO_USER_ID) {
    return storedUserId;
  }

  // Fall back to demo-user for development/unauthenticated
  return DEFAULT_DEMO_USER_ID;
}

/**
 * Set the user ID (called after authentication)
 */
export function setUserId(userId: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(USER_ID_STORAGE_KEY, userId);
  }
}

/**
 * Clear the user ID (called on logout)
 */
export function clearUserId(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(USER_ID_STORAGE_KEY);
  }
}

/**
 * Check if the current user is a demo/unauthenticated user
 */
export function isDemoUser(): boolean {
  if (typeof window === "undefined") return true;
  const userId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  return !userId || userId === DEFAULT_DEMO_USER_ID || userId === "anonymous";
}
