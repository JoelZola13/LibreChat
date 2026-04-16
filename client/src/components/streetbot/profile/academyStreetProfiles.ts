export type AcademyProfileRole = "student" | "instructor";

export type StreetProfileRecord = {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  primary_roles: string[];
  secondary_skills: string[];
  bio: string;
  tagline: string;
  avatar_url: string | null;
  cover_url: string | null;
  city: string;
  country: string;
  location_display: string;
  portfolio_items: any[];
  external_links: any[];
  website: string | null;
  availability_status: string;
  open_to: string[];
  contact_email: string | null;
  contact_preference: string;
  is_public: boolean;
  is_featured: boolean;
  is_verified: boolean;
  followers_count: number;
  following_count: number;
  saves_count: number;
  profile_views: number;
  completeness_score: number;
  created_at: string;
  updated_at: string;
  academy_role?: AcademyProfileRole;
  academy_instructor_name?: string | null;
};

type StreetProfileHydrationInput = {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  primary_roles?: string[] | null;
  secondary_skills?: string[] | null;
  bio?: string | null;
  tagline?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  city?: string | null;
  country?: string | null;
  location_display?: string | null;
  portfolio_items?: any[] | null;
  external_links?: any[] | null;
  website?: string | null;
  availability_status?: string | null;
  open_to?: string[] | null;
  contact_email?: string | null;
  contact_preference?: string | null;
  is_public?: boolean | null;
  is_featured?: boolean | null;
  is_verified?: boolean | null;
  followers_count?: number | null;
  following_count?: number | null;
  saves_count?: number | null;
  profile_views?: number | null;
  completeness_score?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  academy_role?: AcademyProfileRole | null;
  academy_instructor_name?: string | null;
};

const PROFILE_CREATED_AT = "2026-01-10T12:00:00.000Z";
const PROFILE_UPDATED_AT = "2026-04-15T12:00:00.000Z";

const ACADEMY_STREET_PROFILES: StreetProfileRecord[] = [
  {
    id: "academy-profile-faith-macpherson",
    user_id: "69dd0e215b40c39cc3a47691",
    username: "faith-macpherson",
    display_name: "Faith Macpherson",
    primary_roles: ["Instructor", "Facilitator"],
    secondary_skills: ["Confidence Coaching", "System Navigation", "Workshop Design"],
    bio: "Faith leads Street Voices Academy sessions focused on confidence, rights, and navigating systems so learners can turn practice into real-world action.",
    tagline: "Helping people speak up, navigate systems, and build confidence together.",
    avatar_url: null,
    cover_url: null,
    city: "Toronto",
    country: "Canada",
    location_display: "Toronto, Canada",
    portfolio_items: [],
    external_links: [],
    website: null,
    availability_status: "open",
    open_to: ["Teaching", "Mentorship", "Workshops"],
    contact_email: null,
    contact_preference: "form",
    is_public: true,
    is_featured: true,
    is_verified: true,
    followers_count: 128,
    following_count: 46,
    saves_count: 37,
    profile_views: 912,
    completeness_score: 92,
    created_at: PROFILE_CREATED_AT,
    updated_at: PROFILE_UPDATED_AT,
    academy_role: "instructor",
    academy_instructor_name: "Street Voices Academy",
  },
  {
    id: "academy-profile-amara-lewis",
    user_id: "academy-demo-learner-amara",
    username: "amara-lewis",
    display_name: "Amara Lewis",
    primary_roles: ["Student", "Community Learner"],
    secondary_skills: ["Advocacy Practice", "Peer Support", "Communication"],
    bio: "Amara is building her advocacy and confidence through Street Voices Academy, with a focus on practical communication and knowing her rights.",
    tagline: "Learning how to speak up with more confidence every week.",
    avatar_url: null,
    cover_url: null,
    city: "Toronto",
    country: "Canada",
    location_display: "Toronto, Canada",
    portfolio_items: [],
    external_links: [],
    website: null,
    availability_status: "open",
    open_to: ["Learning", "Peer Community"],
    contact_email: null,
    contact_preference: "form",
    is_public: true,
    is_featured: false,
    is_verified: false,
    followers_count: 24,
    following_count: 18,
    saves_count: 5,
    profile_views: 148,
    completeness_score: 78,
    created_at: PROFILE_CREATED_AT,
    updated_at: PROFILE_UPDATED_AT,
    academy_role: "student",
  },
  {
    id: "academy-profile-devon-carter",
    user_id: "academy-demo-learner-devon",
    username: "devon-carter",
    display_name: "Devon Carter",
    primary_roles: ["Student", "Job Seeker"],
    secondary_skills: ["Confidence Building", "Systems Navigation", "Goal Setting"],
    bio: "Devon is using Street Voices Academy to strengthen confidence and learn how to navigate real systems with more clarity.",
    tagline: "Taking practical steps toward steady growth and opportunity.",
    avatar_url: null,
    cover_url: null,
    city: "Toronto",
    country: "Canada",
    location_display: "Toronto, Canada",
    portfolio_items: [],
    external_links: [],
    website: null,
    availability_status: "open",
    open_to: ["Learning", "Employment Support"],
    contact_email: null,
    contact_preference: "form",
    is_public: true,
    is_featured: false,
    is_verified: false,
    followers_count: 19,
    following_count: 14,
    saves_count: 4,
    profile_views: 111,
    completeness_score: 73,
    created_at: PROFILE_CREATED_AT,
    updated_at: PROFILE_UPDATED_AT,
    academy_role: "student",
  },
  {
    id: "academy-profile-zuri-bennett",
    user_id: "academy-demo-learner-zuri",
    username: "zuri-bennett",
    display_name: "Zuri Bennett",
    primary_roles: ["Student", "Community Learner"],
    secondary_skills: ["Rights Awareness", "Workplace Communication", "Digital Practice"],
    bio: "Zuri is working through Street Voices Academy courses that connect rights awareness with clearer communication for everyday situations and work.",
    tagline: "Building confidence through rights, communication, and real practice.",
    avatar_url: null,
    cover_url: null,
    city: "Toronto",
    country: "Canada",
    location_display: "Toronto, Canada",
    portfolio_items: [],
    external_links: [],
    website: null,
    availability_status: "open",
    open_to: ["Learning", "Community Building"],
    contact_email: null,
    contact_preference: "form",
    is_public: true,
    is_featured: false,
    is_verified: false,
    followers_count: 21,
    following_count: 16,
    saves_count: 6,
    profile_views: 126,
    completeness_score: 76,
    created_at: PROFILE_CREATED_AT,
    updated_at: PROFILE_UPDATED_AT,
    academy_role: "student",
  },
];

export function getAcademyStreetProfiles(): StreetProfileRecord[] {
  return ACADEMY_STREET_PROFILES;
}

export function findAcademyStreetProfileByUsername(username?: string | null): StreetProfileRecord | null {
  const normalized = String(username || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return ACADEMY_STREET_PROFILES.find((profile) => profile.username.toLowerCase() === normalized) ?? null;
}

export function findAcademyStreetProfileByUserId(userId?: string | null): StreetProfileRecord | null {
  const normalized = String(userId || "").trim();
  if (!normalized) {
    return null;
  }

  return ACADEMY_STREET_PROFILES.find((profile) => profile.user_id === normalized) ?? null;
}

export function getAcademyRoleForProfile(profile?: {
  user_id?: string | null;
  username?: string | null;
  primary_roles?: string[];
  academy_role?: AcademyProfileRole;
} | null): AcademyProfileRole | null {
  if (!profile) {
    return null;
  }

  if (profile.academy_role) {
    return profile.academy_role;
  }

  const seeded =
    findAcademyStreetProfileByUserId(profile.user_id) ??
    findAcademyStreetProfileByUsername(profile.username);

  if (seeded?.academy_role) {
    return seeded.academy_role;
  }

  const normalizedRoles = (profile.primary_roles || []).map((role) => role.toLowerCase());
  if (normalizedRoles.some((role) => role.includes("instructor") || role.includes("facilitator") || role.includes("teacher"))) {
    return "instructor";
  }
  if (normalizedRoles.some((role) => role.includes("student") || role.includes("learner"))) {
    return "student";
  }

  return null;
}

export function getInstructorNameForProfile(profile?: {
  user_id?: string | null;
  username?: string | null;
  display_name?: string | null;
} | null): string | null {
  if (!profile) {
    return null;
  }

  const seeded =
    findAcademyStreetProfileByUserId(profile.user_id) ??
    findAcademyStreetProfileByUsername(profile.username);

  return seeded?.academy_instructor_name ?? profile.display_name ?? null;
}

function hasItems(value: unknown): value is any[] {
  return Array.isArray(value) && value.length > 0;
}

function inferFallbackRole(profile: StreetProfileHydrationInput, seeded?: StreetProfileRecord | null): AcademyProfileRole {
  if (profile.academy_role) {
    return profile.academy_role;
  }
  if (seeded?.academy_role) {
    return seeded.academy_role;
  }

  const normalizedRoles = (profile.primary_roles || []).map((role) => role.toLowerCase());
  if (normalizedRoles.some((role) => role.includes("instructor") || role.includes("facilitator") || role.includes("teacher"))) {
    return "instructor";
  }

  return "student";
}

function buildFallbackBio(displayName: string, academyRole: AcademyProfileRole) {
  if (academyRole === "instructor") {
    return `${displayName} teaches and facilitates learning through Street Voices Academy.`;
  }

  return `${displayName} is learning and growing through Street Voices Academy.`;
}

function buildFallbackTagline(academyRole: AcademyProfileRole) {
  return academyRole === "instructor"
    ? "Teaching and building learning experiences through Street Voices Academy."
    : "Learning and growing through Street Voices Academy.";
}

function buildFallbackRoles(academyRole: AcademyProfileRole) {
  return academyRole === "instructor"
    ? ["Instructor", "Facilitator"]
    : ["Student", "Community Learner"];
}

function buildFallbackOpenTo(academyRole: AcademyProfileRole) {
  return academyRole === "instructor"
    ? ["Teaching", "Mentorship", "Workshops"]
    : ["Learning", "Peer Community"];
}

export function hydrateStreetProfileRecord(profile: StreetProfileHydrationInput): StreetProfileRecord {
  const seeded =
    findAcademyStreetProfileByUserId(profile.user_id) ??
    findAcademyStreetProfileByUsername(profile.username);
  const academyRole = inferFallbackRole(profile, seeded);
  const city = String(profile.city ?? seeded?.city ?? "Toronto").trim() || "Toronto";
  const country = String(profile.country ?? seeded?.country ?? "Canada").trim() || "Canada";
  const locationDisplay =
    String(profile.location_display ?? seeded?.location_display ?? "").trim() ||
    [city, country].filter(Boolean).join(", ");

  return {
    id: profile.id,
    user_id: profile.user_id,
    username: profile.username,
    display_name: profile.display_name,
    primary_roles: hasItems(profile.primary_roles)
      ? profile.primary_roles
      : seeded?.primary_roles ?? buildFallbackRoles(academyRole),
    secondary_skills: hasItems(profile.secondary_skills)
      ? profile.secondary_skills
      : seeded?.secondary_skills ?? [],
    bio: String(profile.bio ?? seeded?.bio ?? buildFallbackBio(profile.display_name, academyRole)),
    tagline: String(profile.tagline ?? seeded?.tagline ?? buildFallbackTagline(academyRole)),
    avatar_url: profile.avatar_url ?? seeded?.avatar_url ?? null,
    cover_url: profile.cover_url ?? seeded?.cover_url ?? null,
    city,
    country,
    location_display: locationDisplay,
    portfolio_items: Array.isArray(profile.portfolio_items)
      ? profile.portfolio_items
      : seeded?.portfolio_items ?? [],
    external_links: Array.isArray(profile.external_links)
      ? profile.external_links
      : seeded?.external_links ?? [],
    website: profile.website ?? seeded?.website ?? null,
    availability_status: String(profile.availability_status ?? seeded?.availability_status ?? "open"),
    open_to: hasItems(profile.open_to)
      ? profile.open_to
      : seeded?.open_to ?? buildFallbackOpenTo(academyRole),
    contact_email: profile.contact_email ?? seeded?.contact_email ?? null,
    contact_preference: String(profile.contact_preference ?? seeded?.contact_preference ?? "form"),
    is_public: profile.is_public ?? seeded?.is_public ?? true,
    is_featured: profile.is_featured ?? seeded?.is_featured ?? false,
    is_verified: profile.is_verified ?? seeded?.is_verified ?? false,
    followers_count: Number(profile.followers_count ?? seeded?.followers_count ?? 0),
    following_count: Number(profile.following_count ?? seeded?.following_count ?? 0),
    saves_count: Number(profile.saves_count ?? seeded?.saves_count ?? 0),
    profile_views: Number(profile.profile_views ?? seeded?.profile_views ?? 0),
    completeness_score: Number(profile.completeness_score ?? seeded?.completeness_score ?? 65),
    created_at: String(profile.created_at ?? seeded?.created_at ?? PROFILE_CREATED_AT),
    updated_at: String(profile.updated_at ?? seeded?.updated_at ?? PROFILE_UPDATED_AT),
    academy_role: profile.academy_role ?? seeded?.academy_role,
    academy_instructor_name: profile.academy_instructor_name ?? seeded?.academy_instructor_name ?? null,
  };
}

export function mergeStreetProfiles<T extends { username: string }>(primary: T[], secondary: T[]): T[] {
  const merged = new Map<string, T>();

  secondary.forEach((profile) => {
    merged.set(profile.username.toLowerCase(), profile);
  });

  primary.forEach((profile) => {
    merged.set(profile.username.toLowerCase(), profile);
  });

  return Array.from(merged.values());
}
