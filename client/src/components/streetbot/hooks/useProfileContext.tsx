"use client";

/**
 * ProfileContext - Unified profile state management across the app.
 *
 * Provides:
 * - Current user's StreetProfile
 * - Profile loading/error states
 * - Profile existence check (for onboarding gate)
 * - Profile refresh functionality
 * - Profile completeness calculation
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { getOrCreateUserId } from "@/lib/userId";
import { useAuth } from "@/lib/auth";
import { isPublicPath } from "@/lib/public-routes";

// =============================================================================
// Types
// =============================================================================

export interface StreetProfile {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  primary_roles: string[];
  secondary_skills: string[];
  bio?: string;
  tagline?: string;
  avatar_url?: string;
  cover_url?: string;
  city?: string;
  country?: string;
  location_display?: string;
  website?: string;
  availability_status: string;
  open_to: string[];
  is_public: boolean;
  is_featured: boolean;
  is_verified: boolean;
  followers_count: number;
  following_count: number;
  completeness_score: number;
  created_at: string;
  updated_at: string;
}

export interface ProfileContextValue {
  // Current user's profile (null if no profile exists)
  currentProfile: StreetProfile | null;

  // Loading state
  isLoading: boolean;

  // Error state
  error: string | null;

  // Whether the user has a profile (used for onboarding gate)
  hasProfile: boolean;

  // Whether check is complete (to avoid flash of content)
  isChecked: boolean;

  // Profile completeness percentage (0-100)
  completeness: number;

  // Refresh profile data from server
  refreshProfile: () => Promise<void>;

  // Clear local profile state (for logout)
  clearProfile: () => void;

  // Current user ID (from auth)
  userId: string;

  // Authentication state
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isAuthConfigured: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

// =============================================================================
// API Functions
// =============================================================================

const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:8000";

async function fetchMyProfile(userId: string): Promise<StreetProfile | null> {
  try {
    // Add timeout to avoid hanging when backend is unavailable
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(
      `${API_BASE}/street-profiles/me?user_id=${encodeURIComponent(userId)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!resp.ok) return null;
    const data = await resp.json();
    return data || null;
  } catch (error) {
    // Only log if not a network/abort error (backend unavailable is expected in dev)
    if (error instanceof Error && !error.message.includes("fetch") && error.name !== "AbortError") {
      console.error("Failed to fetch profile:", error);
    }
    return null;
  }
}

async function checkProfileExists(userId: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(
      `${API_BASE}/street-profiles/exists?user_id=${encodeURIComponent(userId)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!resp.ok) return false;
    const data = await resp.json();
    return data?.exists ?? false;
  } catch (error) {
    // Silently handle network errors (backend unavailable is expected in dev)
    if (error instanceof Error && !error.message.includes("fetch") && error.name !== "AbortError") {
      console.error("Failed to check profile exists:", error);
    }
    return false;
  }
}

// =============================================================================
// Completeness Calculation
// =============================================================================

function calculateCompleteness(profile: StreetProfile | null): number {
  if (!profile) return 0;

  const fields = [
    { field: "display_name", weight: 15 },
    { field: "username", weight: 15 },
    { field: "avatar_url", weight: 20 },
    { field: "bio", weight: 15 },
    { field: "primary_roles", weight: 10, isArray: true },
    { field: "city", weight: 10 },
    { field: "tagline", weight: 5 },
    { field: "website", weight: 5 },
    { field: "secondary_skills", weight: 5, isArray: true },
  ];

  let score = 0;
  for (const { field, weight, isArray } of fields) {
    const value = profile[field as keyof StreetProfile];
    if (isArray) {
      if (Array.isArray(value) && value.length > 0) {
        score += weight;
      }
    } else if (value) {
      score += weight;
    }
  }

  return Math.min(100, score);
}

// =============================================================================
// Context
// =============================================================================

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

// =============================================================================
// Provider
// =============================================================================

interface ProfileProviderProps {
  children: ReactNode;
}

export function ProfileProvider({ children }: ProfileProviderProps) {
  const pathname = usePathname();
  const [currentProfile, setCurrentProfile] = useState<StreetProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecked, setIsChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserIdState] = useState<string>("");

  // Get auth state
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    isConfigured: isAuthConfigured,
    user: authUser,
    login,
    logout: authLogout,
  } = useAuth();

  const isPublicRoute = isPublicPath(pathname);

  // Initialize userId from auth (client-side only)
  useEffect(() => {
    // If auth is still loading, wait
    if (isAuthLoading) return;

    // Get user ID from auth or fall back to localStorage/demo
    const authUserId = authUser?.id;
    const id = getOrCreateUserId(authUserId);
    setUserIdState(id);
  }, [isAuthLoading, authUser?.id]);

  // Wrap logout to also clear profile
  const logout = useCallback(async () => {
    await authLogout();
    setCurrentProfile(null);
    setIsChecked(false);
  }, [authLogout]);

  // Fetch profile when userId is available
  const refreshProfile = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const profile = await fetchMyProfile(userId);
      setCurrentProfile(profile);
      setIsChecked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
      setIsChecked(true);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Load profile on mount and when userId changes
  useEffect(() => {
    if (!userId) return;

    if (isPublicRoute) {
      setIsLoading(false);
      setIsChecked(true);
      return;
    }

    if (isAuthConfigured && !isAuthenticated) {
      setIsLoading(false);
      setIsChecked(true);
      return;
    }

    refreshProfile();
  }, [userId, isPublicRoute, isAuthConfigured, isAuthenticated, refreshProfile]);

  // Listen for profile updates from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "streetbot:profile-updated") {
        refreshProfile();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [refreshProfile]);

  // Clear profile (for logout)
  const clearProfile = useCallback(() => {
    setCurrentProfile(null);
    setIsChecked(false);
    setError(null);
  }, []);

  // Computed values
  const hasProfile = currentProfile !== null;
  const completeness = useMemo(
    () => calculateCompleteness(currentProfile),
    [currentProfile]
  );

  const value = useMemo<ProfileContextValue>(
    () => ({
      currentProfile,
      isLoading,
      isChecked,
      error,
      hasProfile,
      completeness,
      refreshProfile,
      clearProfile,
      userId,
      // Auth state
      isAuthenticated,
      isAuthLoading,
      isAuthConfigured,
      login,
      logout,
    }),
    [
      currentProfile,
      isLoading,
      isChecked,
      error,
      hasProfile,
      completeness,
      refreshProfile,
      clearProfile,
      userId,
      isAuthenticated,
      isAuthLoading,
      isAuthConfigured,
      login,
      logout,
    ]
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useProfileContext(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfileContext must be used within a ProfileProvider");
  }
  return context;
}

// =============================================================================
// Utility Hook - Profile Existence Check (lightweight, no full profile fetch)
// =============================================================================

export function useProfileExists(userId?: string) {
  const [exists, setExists] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const uid = userId || getOrCreateUserId();
    if (!uid) {
      setExists(false);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    checkProfileExists(uid)
      .then((result) => {
        setExists(result);
        setIsChecking(false);
      })
      .catch(() => {
        setExists(false);
        setIsChecking(false);
      });
  }, [userId]);

  return { exists, isChecking };
}

// =============================================================================
// Export Context for advanced usage
// =============================================================================

export { ProfileContext };
