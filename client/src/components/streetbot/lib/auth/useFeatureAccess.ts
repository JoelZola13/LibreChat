"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useMemo, useState, useEffect } from "react";
import { isAuth0Configured } from "./config";

/**
 * Feature permission keys that can be controlled via Auth0.
 * These correspond to the backend feature registry.
 */
export const Features = {
  // Core features
  STREET_PROFILE: "feature:street_profile",
  NEWS: "feature:news",
  CHAT: "feature:chat",

  // Media features
  STREET_GALLERY: "feature:street_gallery",
  MEDIA_UPLOAD: "feature:media_upload",
  CREATIVES: "feature:creatives",

  // Service features
  DIRECTORY: "feature:directory",
  DIRECTORY_PRO_FILTERS: "feature:directory_pro_filters",
  JOBS: "feature:jobs",
  JOBS_POST: "feature:jobs_post",
  LEARNING: "feature:learning",

  // Social features
  MESSAGING: "feature:messaging",
  GROUPS: "feature:groups",

  // Admin features
  ADMIN_PANEL: "feature:admin_panel",
  ANALYTICS: "feature:analytics",
  USER_MANAGEMENT: "feature:user_management",
} as const;

export type FeatureKey = (typeof Features)[keyof typeof Features];

export interface UseFeatureAccessResult {
  /**
   * All feature permissions the user has.
   */
  features: Set<string>;

  /**
   * Check if user has access to a specific feature.
   */
  hasFeature: (feature: FeatureKey | string) => boolean;

  /**
   * Check if user has access to any of the specified features.
   */
  hasAnyFeature: (...features: (FeatureKey | string)[]) => boolean;

  /**
   * Check if user has access to all of the specified features.
   */
  hasAllFeatures: (...features: (FeatureKey | string)[]) => boolean;

  /**
   * Whether the feature access check is still loading.
   */
  isLoading: boolean;

  /**
   * Refresh the feature access from the latest token.
   */
  refreshFeatures: () => Promise<void>;
}

/**
 * Hook for checking feature-level access based on Auth0 permissions.
 *
 * Features are permissions in the JWT that start with "feature:".
 * They control UI visibility and are enforced by the backend.
 *
 * In dev mode (Auth0 not configured), all features are granted.
 *
 * @example
 * ```tsx
 * const { hasFeature } = useFeatureAccess();
 *
 * if (hasFeature(Features.STREET_GALLERY)) {
 *   // Show gallery link
 * }
 * ```
 */
export function useFeatureAccess(): UseFeatureAccessResult {
  const isConfigured = isAuth0Configured();

  // Only call useAuth0 if configured
  const auth0 = isConfigured
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      useAuth0()
    : null;

  const [features, setFeatures] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Extract features from token permissions
  const extractFeatures = useCallback(async () => {
    if (!isConfigured) {
      // Dev mode - grant all features
      setFeatures(new Set(Object.values(Features)));
      setIsLoading(false);
      return;
    }

    if (!auth0?.getAccessTokenSilently) {
      setIsLoading(false);
      return;
    }

    try {
      const token = await auth0.getAccessTokenSilently();
      if (!token) {
        setFeatures(new Set());
        return;
      }

      // Decode JWT to get permissions
      const payload = JSON.parse(atob(token.split(".")[1]));
      const permissions: string[] = payload.permissions || [];

      // Filter to only feature permissions
      const featurePermissions = permissions.filter((p) =>
        p.startsWith("feature:")
      );

      setFeatures(new Set(featurePermissions));
    } catch (err) {
      console.error("Failed to extract features from token:", err);
      setFeatures(new Set());
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, auth0]);

  // Extract features on mount and when auth state changes
  useEffect(() => {
    if (auth0?.isLoading === false || !isConfigured) {
      void extractFeatures();
    }
  }, [auth0?.isLoading, auth0?.isAuthenticated, extractFeatures, isConfigured]);

  const hasFeature = useCallback(
    (feature: FeatureKey | string): boolean => {
      if (!isConfigured) return true; // Dev mode
      return features.has(feature);
    },
    [isConfigured, features]
  );

  const hasAnyFeature = useCallback(
    (...featureList: (FeatureKey | string)[]): boolean => {
      if (!isConfigured) return true;
      return featureList.some((f) => features.has(f));
    },
    [isConfigured, features]
  );

  const hasAllFeatures = useCallback(
    (...featureList: (FeatureKey | string)[]): boolean => {
      if (!isConfigured) return true;
      return featureList.every((f) => features.has(f));
    },
    [isConfigured, features]
  );

  const refreshFeatures = useCallback(async () => {
    setIsLoading(true);
    await extractFeatures();
  }, [extractFeatures]);

  return {
    features,
    hasFeature,
    hasAnyFeature,
    hasAllFeatures,
    isLoading: isConfigured ? (auth0?.isLoading ?? true) || isLoading : false,
    refreshFeatures,
  };
}
