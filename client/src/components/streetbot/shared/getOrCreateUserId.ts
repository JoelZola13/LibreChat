const USER_ID_STORAGE_KEY = 'streetbot:user-id';
const DEFAULT_DEMO_USER_ID = 'demo-user';

export function getOrCreateUserId(authUserId?: string | null): string {
  if (authUserId && authUserId !== 'anonymous') {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(USER_ID_STORAGE_KEY, authUserId);
    }
    return authUserId;
  }
  if (typeof window === 'undefined') return DEFAULT_DEMO_USER_ID;
  const storedUserId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  if (storedUserId && storedUserId !== DEFAULT_DEMO_USER_ID) return storedUserId;
  return DEFAULT_DEMO_USER_ID;
}
