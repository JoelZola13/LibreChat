import { sbFetch } from "../shared/sbFetch";
import type { AcademyProfileRole } from "./academyStreetProfiles";
import { findAcademyStreetProfileByUserId } from "./academyStreetProfiles";

const CMS_URL = "/cms";
const CMS_TOKEN = "streetvoices-admin-token-2026";
const CMS_HEADERS = {
  Authorization: `Bearer ${CMS_TOKEN}`,
  "Content-Type": "application/json",
};
const SETTINGS_STORAGE_KEY = "streetbot:user-settings";

type AcademySyncUser = {
  id?: string | null;
  _id?: string | null;
  username?: string | null;
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
  avatar_url?: string | null;
};

type DirectusStreetProfileRecord = {
  id: string;
  user_id: string;
  username?: string | null;
  display_name?: string | null;
  primary_roles?: string[] | null;
  secondary_skills?: string[] | null;
  bio?: string | null;
  tagline?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  city?: string | null;
  country?: string | null;
  location_display?: string | null;
  portfolio_items?: unknown[] | null;
  external_links?: unknown[] | null;
  website?: string | null;
  availability_status?: string | null;
  open_to?: string[] | null;
  contact_email?: string | null;
  contact_preference?: string | null;
  is_public?: boolean | null;
  is_featured?: boolean | null;
  is_verified?: boolean | null;
  show_in_directory?: boolean | null;
  open_to_messages?: boolean | null;
  followers_count?: number | null;
  following_count?: number | null;
  saves_count?: number | null;
  profile_views?: number | null;
  connections_count?: number | null;
  reputation_score?: number | null;
  helpful_count?: number | null;
  completeness_score?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type EnsureStreetProfileOptions = {
  userId?: string | null;
  user?: AcademySyncUser | null;
  roleHint?: AcademyProfileRole | null;
  force?: boolean;
};

const inflightEnsures = new Map<string, Promise<DirectusStreetProfileRecord | null>>();
let inflightBatchSync: Promise<DirectusStreetProfileRecord[]> | null = null;
const CMS_PROFILE_FIELDS = [
  "id",
  "user_id",
  "username",
  "display_name",
  "primary_roles",
  "secondary_skills",
  "bio",
  "tagline",
  "avatar_url",
  "cover_url",
  "city",
  "country",
  "location_display",
  "portfolio_items",
  "external_links",
  "website",
  "availability_status",
  "open_to",
  "contact_email",
  "contact_preference",
  "is_public",
  "is_featured",
  "is_verified",
  "show_in_directory",
  "open_to_messages",
  "followers_count",
  "following_count",
  "saves_count",
  "profile_views",
  "connections_count",
  "reputation_score",
  "helpful_count",
  "completeness_score",
  "created_at",
  "updated_at",
].join(",");
const BATCH_SYNC_STORAGE_KEY = "streetbot:academy-profile-sync:last-run";

async function cmsListProfiles(filter: Record<string, unknown>, fields = CMS_PROFILE_FIELDS, limit = 10) {
  const params = new URLSearchParams({
    filter: JSON.stringify(filter),
    limit: String(limit),
    fields,
  });
  const response = await fetch(`${CMS_URL}/items/street_profiles?${params.toString()}`, {
    headers: CMS_HEADERS,
  });

  if (!response.ok) {
    throw new Error(response.statusText || "Failed to load Street Profiles");
  }

  const data = await response.json();
  return Array.isArray(data?.data) ? (data.data as DirectusStreetProfileRecord[]) : [];
}

async function cmsFindProfileByUserId(userId: string, fields = CMS_PROFILE_FIELDS) {
  const profiles = await cmsListProfiles({ user_id: { _eq: userId } }, fields);
  return profiles[0] ?? null;
}

async function cmsFindProfileByUsername(username: string, fields = CMS_PROFILE_FIELDS) {
  const profiles = await cmsListProfiles({ username: { _eq: username } }, fields);
  return profiles[0] ?? null;
}

async function cmsCreateProfile(data: Partial<DirectusStreetProfileRecord>) {
  const response = await fetch(`${CMS_URL}/items/street_profiles`, {
    method: "POST",
    headers: CMS_HEADERS,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(response.statusText || "Failed to create Street Profile");
  }

  const payload = await response.json();
  return payload?.data as DirectusStreetProfileRecord;
}

async function cmsUpdateProfile(id: string, data: Partial<DirectusStreetProfileRecord>) {
  const response = await fetch(`${CMS_URL}/items/street_profiles/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: CMS_HEADERS,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(response.statusText || "Failed to update Street Profile");
  }
}

async function hasActiveAcademyEnrollment(userId: string) {
  try {
    const response = await sbFetch(`/api/academy/enrollments?user_id=${encodeURIComponent(userId)}`);
    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    const enrollments = Array.isArray(data) ? data : [];
    return enrollments.some((enrollment) => enrollment?.status !== "dropped");
  } catch {
    return false;
  }
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function getUserIdSuffix(userId: string) {
  const normalized = userId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return normalized.slice(-6) || "academy";
}

function buildDisplayName(userId: string, user?: AcademySyncUser | null) {
  const seeded = findAcademyStreetProfileByUserId(userId);
  const candidate =
    String(seeded?.display_name || "").trim() ||
    String(user?.name || "").trim() ||
    String(user?.username || "").trim() ||
    String(user?.email || "").split("@")[0].trim();

  if (!candidate) {
    return `Academy Learner ${getUserIdSuffix(userId).toUpperCase()}`;
  }

  return candidate
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildDefaultRoles(role: AcademyProfileRole) {
  return role === "instructor" ? ["Instructor", "Facilitator"] : ["Student", "Community Learner"];
}

function buildDefaultSkills(role: AcademyProfileRole) {
  return role === "instructor"
    ? ["Workshop Design", "Facilitation", "Community Teaching"]
    : ["Communication", "Confidence Building", "Peer Learning"];
}

function buildDefaultBio(displayName: string, role: AcademyProfileRole) {
  return role === "instructor"
    ? `${displayName} teaches and facilitates learning through Street Voices Academy.`
    : `${displayName} is learning and growing through Street Voices Academy.`;
}

function buildDefaultTagline(role: AcademyProfileRole) {
  return role === "instructor"
    ? "Teaching and building learning experiences through Street Voices Academy."
    : "Learning and growing through Street Voices Academy.";
}

function buildDefaultOpenTo(role: AcademyProfileRole) {
  return role === "instructor"
    ? ["Teaching", "Mentorship", "Workshops"]
    : ["Learning", "Peer Community"];
}

function buildUsernameCandidates(userId: string, user?: AcademySyncUser | null) {
  const seeded = findAcademyStreetProfileByUserId(userId);
  const emailLocalPart = String(user?.email || "").split("@")[0].trim();
  const suffix = getUserIdSuffix(userId);
  const rawCandidates = [
    String(seeded?.username || "").trim(),
    String(user?.username || "").replace(/^@+/, "").trim(),
    emailLocalPart,
    buildDisplayName(userId, user),
    `academy-${suffix}`,
  ];

  const seen = new Set<string>();
  const candidates: string[] = [];

  rawCandidates.forEach((candidate) => {
    const slug = toSlug(candidate);
    if (!slug || seen.has(slug)) {
      return;
    }
    seen.add(slug);
    candidates.push(slug);
  });

  if (!seen.has(`academy-${suffix}`)) {
    candidates.push(`academy-${suffix}`);
  }

  if (!seen.has(`student-${suffix}`)) {
    candidates.push(`student-${suffix}`);
  }

  return candidates;
}

async function resolveAvailableUsername(userId: string, user?: AcademySyncUser | null) {
  const candidates = buildUsernameCandidates(userId, user);

  for (const candidate of candidates) {
    const existing = await cmsFindProfileByUsername(candidate);
    if (!existing || existing.user_id === userId) {
      return candidate;
    }
  }

  return `academy-${getUserIdSuffix(userId)}`;
}

function buildProfileSeed(userId: string, user?: AcademySyncUser | null, roleHint: AcademyProfileRole | null = null) {
  const seeded = findAcademyStreetProfileByUserId(userId);
  const academyRole = seeded?.academy_role ?? roleHint ?? "student";
  const displayName = buildDisplayName(userId, user);

  return {
    user_id: userId,
    username: seeded?.username || undefined,
    display_name: seeded?.display_name || displayName,
    primary_roles: seeded?.primary_roles || buildDefaultRoles(academyRole),
    secondary_skills: seeded?.secondary_skills || buildDefaultSkills(academyRole),
    bio: seeded?.bio || buildDefaultBio(displayName, academyRole),
    tagline: seeded?.tagline || buildDefaultTagline(academyRole),
    avatar_url: seeded?.avatar_url || user?.avatar || user?.avatar_url || null,
    cover_url: seeded?.cover_url || null,
    city: seeded?.city || "Toronto",
    country: seeded?.country || "Canada",
    location_display: seeded?.location_display || "Toronto, Canada",
    portfolio_items: seeded?.portfolio_items || [],
    external_links: seeded?.external_links || [],
    website: seeded?.website || null,
    availability_status: seeded?.availability_status || "open",
    open_to: seeded?.open_to || buildDefaultOpenTo(academyRole),
    contact_email: seeded?.contact_email || null,
    contact_preference: seeded?.contact_preference || "form",
    is_public: true,
    is_featured: seeded?.is_featured || false,
    is_verified: seeded?.is_verified || false,
    show_in_directory: true,
    open_to_messages: true,
    followers_count: seeded?.followers_count || 0,
    following_count: seeded?.following_count || 0,
    saves_count: seeded?.saves_count || 0,
    profile_views: seeded?.profile_views || 0,
    connections_count: 0,
    reputation_score: 0,
    helpful_count: 0,
    completeness_score: seeded?.completeness_score || (academyRole === "instructor" ? 78 : 70),
  } satisfies Partial<DirectusStreetProfileRecord>;
}

function rememberGeneratedHandle(userId: string, username: string) {
  if (typeof window === "undefined") {
    return;
  }

  const nextHandle = `@${username}`;
  const keys = [`${SETTINGS_STORAGE_KEY}:${userId}`, SETTINGS_STORAGE_KEY];

  keys.forEach((key) => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      const currentHandle = String(parsed?.profile?.handle || "").trim();
      if (currentHandle) {
        return;
      }

      const nextValue = {
        ...parsed,
        profile: {
          ...(parsed?.profile || {}),
          handle: nextHandle,
        },
      };
      window.localStorage.setItem(key, JSON.stringify(nextValue));
    } catch {
      // Ignore malformed local settings and leave existing data alone.
    }
  });
}

function buildPatch(existing: DirectusStreetProfileRecord, seed: Partial<DirectusStreetProfileRecord>) {
  const patch: Partial<DirectusStreetProfileRecord> = {};
  const isBlank = (value?: string | null) => !String(value || "").trim();

  if (isBlank(existing.display_name) && seed.display_name) {
    patch.display_name = seed.display_name;
  }
  if (isBlank(existing.avatar_url) && seed.avatar_url) {
    patch.avatar_url = seed.avatar_url;
  }
  if (isBlank(existing.username) && seed.username) {
    patch.username = seed.username;
  }
  if (existing.is_public == null && seed.is_public != null) {
    patch.is_public = seed.is_public;
  }
  if (existing.show_in_directory == null && seed.show_in_directory != null) {
    patch.show_in_directory = seed.show_in_directory;
  }

  return patch;
}

type AcademyEnrollmentRecord = {
  user_id?: string | null;
  status?: string | null;
};

async function fetchActiveAcademyUserIds() {
  const response = await sbFetch("/api/academy/enrollments");
  if (!response.ok) {
    throw new Error("Failed to load Academy enrollments");
  }

  const data = await response.json();
  const enrollments = Array.isArray(data)
    ? (data as AcademyEnrollmentRecord[])
    : Array.isArray(data?.enrollments)
      ? (data.enrollments as AcademyEnrollmentRecord[])
      : [];

  return Array.from(
    new Set(
      enrollments
        .filter((enrollment) => enrollment?.status !== "dropped")
        .map((enrollment) => String(enrollment?.user_id || "").trim())
        .filter(Boolean),
    ),
  );
}

function shouldSkipBatchSync(minIntervalMs: number) {
  if (typeof window === "undefined" || minIntervalMs <= 0) {
    return false;
  }

  try {
    const lastRun = Number(window.sessionStorage.getItem(BATCH_SYNC_STORAGE_KEY) || "0");
    return Number.isFinite(lastRun) && Date.now() - lastRun < minIntervalMs;
  } catch {
    return false;
  }
}

function rememberBatchSyncRun() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(BATCH_SYNC_STORAGE_KEY, String(Date.now()));
  } catch {
    // Ignore storage write failures.
  }
}

export async function fetchCmsStreetProfileByUsername(username?: string | null) {
  const normalizedUsername = String(username || "").trim().toLowerCase();
  if (!normalizedUsername) {
    return null;
  }

  return cmsFindProfileByUsername(normalizedUsername);
}

export async function listCmsDirectoryStreetProfiles(limit = 200) {
  return cmsListProfiles(
    {
      _and: [
        { show_in_directory: { _eq: true } },
        { is_public: { _eq: true } },
      ],
    },
    CMS_PROFILE_FIELDS,
    limit,
  );
}

export async function ensureStreetProfilesForActiveAcademyUsers({
  force = false,
  minIntervalMs = 60_000,
}: {
  force?: boolean;
  minIntervalMs?: number;
} = {}) {
  if (!force && shouldSkipBatchSync(minIntervalMs)) {
    return [];
  }

  if (inflightBatchSync) {
    return inflightBatchSync;
  }

  const request = (async () => {
    try {
      const userIds = await fetchActiveAcademyUserIds();
      const syncedProfiles = await Promise.all(
        userIds.map((enrollmentUserId) =>
          ensureStreetProfileForAcademyUser({
            userId: enrollmentUserId,
            roleHint: "student",
            force: true,
          }),
        ),
      );
      rememberBatchSyncRun();
      return syncedProfiles.filter(Boolean) as DirectusStreetProfileRecord[];
    } catch (error) {
      console.error("Failed to sync Academy Street Profiles", error);
      return [];
    } finally {
      inflightBatchSync = null;
    }
  })();

  inflightBatchSync = request;
  return request;
}

export async function ensureStreetProfileForAcademyUser({
  userId,
  user,
  roleHint,
  force = false,
}: EnsureStreetProfileOptions) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return null;
  }

  const existingRequest = inflightEnsures.get(normalizedUserId);
  if (existingRequest) {
    return existingRequest;
  }

  const request = (async () => {
    try {
      const existing = await cmsFindProfileByUserId(normalizedUserId);
      const seed = buildProfileSeed(normalizedUserId, user, roleHint);

      if (existing) {
        const patch = buildPatch(existing, seed);

        if (!String(existing.username || "").trim()) {
          patch.username = await resolveAvailableUsername(normalizedUserId, user);
        }

        if (Object.keys(patch).length > 0) {
          await cmsUpdateProfile(existing.id, patch);
        }

        const merged = { ...existing, ...patch };
        if (merged.username) {
          rememberGeneratedHandle(normalizedUserId, merged.username);
        }
        return merged;
      }

      if (!force) {
        const hasEnrollment = await hasActiveAcademyEnrollment(normalizedUserId);
        if (!hasEnrollment) {
          return null;
        }
      }

      const username = await resolveAvailableUsername(normalizedUserId, user);
      const created = await cmsCreateProfile({
        user_id: normalizedUserId,
        display_name: seed.display_name || buildDisplayName(normalizedUserId, user),
        username,
        is_public: seed.is_public ?? true,
        show_in_directory: seed.show_in_directory ?? true,
      });

      if (created?.username) {
        rememberGeneratedHandle(normalizedUserId, created.username);
      }

      return created;
    } catch (error) {
      console.error("Failed to ensure Academy Street Profile", error);
      return null;
    } finally {
      inflightEnsures.delete(normalizedUserId);
    }
  })();

  inflightEnsures.set(normalizedUserId, request);
  return request;
}
