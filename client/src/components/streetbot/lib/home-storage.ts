/**
 * Storage utilities for the Home/Chat interface
 * Handles localStorage operations for sessions, settings, and location
 */
import type { UserLocation, StoredUserSettings, StoredSession } from "@/types/home";
import {
  LOCATION_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  LOCAL_STORAGE_KEY,
  DEFAULT_USER_SETTINGS,
} from "./home-constants";

// Location storage
export function readStoredLocation(): UserLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const latitude =
      typeof parsed.latitude === "number"
        ? parsed.latitude
        : typeof parsed.lat === "number"
          ? parsed.lat
          : null;
    const longitude =
      typeof parsed.longitude === "number"
        ? parsed.longitude
        : typeof parsed.lon === "number"
          ? parsed.lon
          : null;
    const radiusKm = typeof parsed.radiusKm === "number" ? parsed.radiusKm : null;
    if (latitude === null || longitude === null || radiusKm === null) return null;
    return {
      latitude,
      longitude,
      radiusKm,
      label: typeof parsed.label === "string" ? parsed.label : undefined,
    };
  } catch (error) {
    console.warn("Failed to read stored location", error);
    return null;
  }
}

export function writeStoredLocation(next: UserLocation | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!next) {
      window.localStorage.removeItem(LOCATION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next));
    }
  } catch (error) {
    console.warn("Failed to persist location", error);
  }
}

// User settings storage
export function readStoredUserSettings(): StoredUserSettings {
  if (typeof window === "undefined") return DEFAULT_USER_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_USER_SETTINGS;
    const parsed = JSON.parse(raw) as StoredUserSettings;
    return {
      profile: { ...DEFAULT_USER_SETTINGS.profile, ...parsed.profile },
      notifications: { ...DEFAULT_USER_SETTINGS.notifications, ...parsed.notifications },
      appearance: { ...DEFAULT_USER_SETTINGS.appearance, ...parsed.appearance },
      data: { ...DEFAULT_USER_SETTINGS.data, ...parsed.data },
      workspace: { ...DEFAULT_USER_SETTINGS.workspace, ...parsed.workspace },
      location: { ...DEFAULT_USER_SETTINGS.location, ...parsed.location },
    };
  } catch (error) {
    console.warn("Failed to parse stored user settings", error);
    return DEFAULT_USER_SETTINGS;
  }
}

export function writeStoredUserSettings(next: StoredUserSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn("Failed to persist user settings", error);
  }
}

export function cloneSettings(settings: StoredUserSettings): StoredUserSettings {
  return JSON.parse(JSON.stringify(settings));
}

// Session storage
export function parseStoredSessions(raw: string | null): StoredSession[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readStoredSessions(): StoredSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    return parseStoredSessions(raw);
  } catch (error) {
    console.warn("Failed to read stored sessions", error);
    return [];
  }
}

export function writeStoredSessions(next: StoredSession[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn("Failed to persist sessions", error);
  }
}

// Session helpers
export function upsertSession(sessions: StoredSession[], session: StoredSession): StoredSession[] {
  const idx = sessions.findIndex((s) => s.sessionId === session.sessionId);
  if (idx >= 0) {
    const updated = [...sessions];
    updated[idx] = session;
    return updated;
  }
  return [...sessions, session];
}

export function sortSessionsByUpdated(sessions: StoredSession[]): StoredSession[] {
  return [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

// Date helpers for session bucketing
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 7); // "YYYY-MM"
}

export function getDefaultSessionTitle(message: string): string {
  const trimmed = message.trim().slice(0, 60);
  return trimmed.length < message.trim().length ? `${trimmed}...` : trimmed;
}

export function getInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
