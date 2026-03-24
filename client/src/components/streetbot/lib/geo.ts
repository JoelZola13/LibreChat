/**
 * Geolocation utilities for distance calculation and user location management
 */

// Storage key for user location (matches settings page)
const LOCATION_STORAGE_KEY = "streetbot:location";

export interface UserLocation {
  lat: number;
  lon: number;
  radiusKm: number;
  label: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Format distance for display
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  if (km < 10) {
    return `${km.toFixed(1)}km`;
  }
  return `${Math.round(km)}km`;
}

/**
 * Read user location from localStorage
 */
export function readUserLocation(): UserLocation | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);

    // Handle both lat/lon and latitude/longitude formats
    const lat =
      typeof parsed["lat"] === "number"
        ? parsed["lat"]
        : typeof parsed["latitude"] === "number"
          ? parsed["latitude"]
          : null;

    const lon =
      typeof parsed["lon"] === "number"
        ? parsed["lon"]
        : typeof parsed["longitude"] === "number"
          ? parsed["longitude"]
          : null;

    const radiusKm = typeof parsed["radiusKm"] === "number" ? parsed["radiusKm"] : 10;
    const label = typeof parsed["label"] === "string" ? parsed["label"] : "";

    if (lat === null || lon === null) return null;

    return { lat, lon, radiusKm, label };
  } catch (error) {
    console.warn("Failed to read stored location", error);
    return null;
  }
}

/**
 * Save user location to localStorage
 */
export function saveUserLocation(location: UserLocation): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
  } catch (error) {
    console.warn("Failed to save location", error);
  }
}

/**
 * Distance filter options
 */
export const DISTANCE_OPTIONS = [
  { value: 5, label: "Within 5 km" },
  { value: 10, label: "Within 10 km" },
  { value: 25, label: "Within 25 km" },
  { value: 50, label: "Within 50 km" },
  { value: 100, label: "Within 100 km" },
  { value: 0, label: "Any distance" },
];
