export type StreetBotUserRole = 'admin' | 'designer' | 'media' | 'service_user' | 'user';

type EnsureUserProfileOptions = {
  userId: string;
  displayName: string;
  fullName?: string | null;
  role?: StreetBotUserRole;
};

type StreetBotSignupProfile = {
  id: string;
  user_id: string;
  display_name: string;
  full_name: string;
  role: StreetBotUserRole;
  updated_at: string;
};

const SIGNUP_PROFILE_CACHE_KEY = 'streetbot:signup-profile-cache';

function readCachedProfiles(): StreetBotSignupProfile[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(SIGNUP_PROFILE_CACHE_KEY) || '[]');
    return Array.isArray(parsed) ? (parsed as StreetBotSignupProfile[]) : [];
  } catch {
    return [];
  }
}

function writeCachedProfiles(profiles: StreetBotSignupProfile[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(SIGNUP_PROFILE_CACHE_KEY, JSON.stringify(profiles.slice(-50)));
  } catch {
    // Local cache is best-effort. Server-side registration writes the canonical profile row.
  }
}

export async function ensureUserProfileForSignup({
  userId,
  displayName,
  fullName,
  role = 'user',
}: EnsureUserProfileOptions) {
  const normalizedUserId = userId.trim();
  const normalizedDisplayName = displayName.trim();

  if (!normalizedUserId || !normalizedDisplayName) {
    return null;
  }

  const profile: StreetBotSignupProfile = {
    id: normalizedUserId,
    user_id: normalizedUserId,
    display_name: normalizedDisplayName,
    full_name: fullName?.trim() || normalizedDisplayName,
    role,
    updated_at: new Date().toISOString(),
  };

  const profiles = readCachedProfiles();
  const nextProfiles = [
    ...profiles.filter((existing) => existing.user_id !== normalizedUserId),
    profile,
  ];
  writeCachedProfiles(nextProfiles);

  return profile;
}
