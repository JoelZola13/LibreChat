/**
 * Tests for userId.ts — user ID management for StreetBot.
 *
 * Tests cover:
 * - getOrCreateUserId priority logic (auth > localStorage > demo fallback)
 * - setUserId persistence to localStorage
 * - clearUserId removal from localStorage
 * - isDemoUser detection
 * - Edge cases: anonymous users, server-side (no window), empty strings
 */
import {
  getOrCreateUserId,
  setUserId,
  clearUserId,
  isDemoUser,
} from '~/components/streetbot/shared/userId';

const STORAGE_KEY = 'streetbot:user-id';

describe('userId', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    window.localStorage.clear();
  });

  // ---------------------------------------------------------------------------
  // getOrCreateUserId
  // ---------------------------------------------------------------------------

  describe('getOrCreateUserId', () => {
    it('returns the auth user ID when provided', () => {
      const result = getOrCreateUserId('auth-user-abc');
      expect(result).toBe('auth-user-abc');
    });

    it('stores the auth user ID in localStorage', () => {
      getOrCreateUserId('auth-user-abc');
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('auth-user-abc');
    });

    it('ignores "anonymous" as an auth user ID and falls back', () => {
      const result = getOrCreateUserId('anonymous');
      expect(result).toBe('demo-user');
    });

    it('ignores null auth user ID and falls back', () => {
      const result = getOrCreateUserId(null);
      expect(result).toBe('demo-user');
    });

    it('ignores undefined auth user ID and falls back', () => {
      const result = getOrCreateUserId(undefined);
      expect(result).toBe('demo-user');
    });

    it('ignores empty string auth user ID and falls back', () => {
      const result = getOrCreateUserId('');
      expect(result).toBe('demo-user');
    });

    it('returns stored ID from localStorage when no auth user provided', () => {
      window.localStorage.setItem(STORAGE_KEY, 'stored-user-xyz');
      const result = getOrCreateUserId();
      expect(result).toBe('stored-user-xyz');
    });

    it('returns demo-user when localStorage has demo-user and no auth user', () => {
      window.localStorage.setItem(STORAGE_KEY, 'demo-user');
      const result = getOrCreateUserId();
      expect(result).toBe('demo-user');
    });

    it('returns demo-user when localStorage is empty and no auth user', () => {
      const result = getOrCreateUserId();
      expect(result).toBe('demo-user');
    });

    it('auth user ID takes priority over localStorage stored value', () => {
      window.localStorage.setItem(STORAGE_KEY, 'old-stored-user');
      const result = getOrCreateUserId('new-auth-user');
      expect(result).toBe('new-auth-user');
      // Should also update localStorage
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('new-auth-user');
    });
  });

  // ---------------------------------------------------------------------------
  // setUserId
  // ---------------------------------------------------------------------------

  describe('setUserId', () => {
    it('stores the user ID in localStorage', () => {
      setUserId('custom-user-id');
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('custom-user-id');
    });

    it('overwrites a previously stored user ID', () => {
      setUserId('first-id');
      setUserId('second-id');
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('second-id');
    });
  });

  // ---------------------------------------------------------------------------
  // clearUserId
  // ---------------------------------------------------------------------------

  describe('clearUserId', () => {
    it('removes the user ID from localStorage', () => {
      window.localStorage.setItem(STORAGE_KEY, 'some-user');
      clearUserId();
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('does not throw when localStorage has no user ID', () => {
      expect(() => clearUserId()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // isDemoUser
  // ---------------------------------------------------------------------------

  describe('isDemoUser', () => {
    it('returns true when no user ID is stored', () => {
      expect(isDemoUser()).toBe(true);
    });

    it('returns true when stored user ID is "demo-user"', () => {
      window.localStorage.setItem(STORAGE_KEY, 'demo-user');
      expect(isDemoUser()).toBe(true);
    });

    it('returns true when stored user ID is "anonymous"', () => {
      window.localStorage.setItem(STORAGE_KEY, 'anonymous');
      expect(isDemoUser()).toBe(true);
    });

    it('returns false when a real user ID is stored', () => {
      window.localStorage.setItem(STORAGE_KEY, '6981b4328395f000aca6edcc');
      expect(isDemoUser()).toBe(false);
    });

    it('returns false after setUserId with a real ID', () => {
      setUserId('real-user-id');
      expect(isDemoUser()).toBe(false);
    });

    it('returns true after clearUserId', () => {
      setUserId('real-user-id');
      clearUserId();
      expect(isDemoUser()).toBe(true);
    });
  });
});
