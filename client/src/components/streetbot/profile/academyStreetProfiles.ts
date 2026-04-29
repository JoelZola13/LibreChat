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

const GENERATED_ACADEMY_INSTRUCTOR_NAMES = [
  "Angela White",
  "Chris Anderson",
  "Diana Ross",
  "Kevin Martinez",
  "Michelle Clark",
  "Nicole Brown",
  "QA Instructor Updated",
  "Rebecca Taylor",
  "Steven Harris",
  "Thomas Jackson",
  "William Davis",
];

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
    id: "academy-profile-kadiatu-barrie",
    user_id: "academy-instructor-kadiatu-barrie",
    username: "kadiatu-barrie",
    display_name: "Kadiatu Barrie",
    primary_roles: ["Instructor", "Facilitator"],
    secondary_skills: ["Media Training", "Workshop Facilitation", "Community Storytelling"],
    bio: "Kadiatu facilitates Street Voices Academy learning experiences that help learners build practical media, communication, and storytelling skills with confidence.",
    tagline: "Facilitating practical media learning rooted in community voice.",
    avatar_url: null,
    cover_url: null,
    city: "Toronto",
    country: "Canada",
    location_display: "Toronto, Canada",
    portfolio_items: [],
    external_links: [],
    website: null,
    availability_status: "open",
    open_to: ["Teaching", "Workshops", "Mentorship"],
    contact_email: null,
    contact_preference: "form",
    is_public: true,
    is_featured: true,
    is_verified: true,
    followers_count: 84,
    following_count: 31,
    saves_count: 22,
    profile_views: 468,
    completeness_score: 91,
    created_at: PROFILE_CREATED_AT,
    updated_at: PROFILE_UPDATED_AT,
    academy_role: "instructor",
    academy_instructor_name: "Kadiatu Barrie",
  },
  {
    id: "academy-profile-duke-makanda",
    user_id: "academy-instructor-duke-makanda",
    username: "duke-makanda",
    display_name: "Duke Makanda",
    primary_roles: ["Instructor", "Facilitator"],
    secondary_skills: ["Public Speaking", "Facilitation", "Community Leadership"],
    bio: "Duke supports Street Voices Academy learners through practical sessions focused on clear communication, leadership, and community-centered confidence building.",
    tagline: "Helping learners strengthen their voice through clear communication and leadership.",
    avatar_url: null,
    cover_url: null,
    city: "Toronto",
    country: "Canada",
    location_display: "Toronto, Canada",
    portfolio_items: [],
    external_links: [],
    website: null,
    availability_status: "open",
    open_to: ["Teaching", "Mentorship", "Speaking"],
    contact_email: null,
    contact_preference: "form",
    is_public: true,
    is_featured: true,
    is_verified: true,
    followers_count: 79,
    following_count: 28,
    saves_count: 19,
    profile_views: 441,
    completeness_score: 90,
    created_at: PROFILE_CREATED_AT,
    updated_at: PROFILE_UPDATED_AT,
    academy_role: "instructor",
    academy_instructor_name: "Duke Makanda",
  },
  {
    id: "academy-profile-matthew-kelly",
    user_id: "academy-instructor-matthew-kelly",
    username: "matthew-kelly",
    display_name: "Matthew Kelly",
    primary_roles: ["Instructor", "Facilitator"],
    secondary_skills: ["Digital Skills", "Learning Design", "Career Readiness"],
    bio: "Matthew helps Street Voices Academy learners build practical digital and workplace skills through clear, supportive teaching and guided practice.",
    tagline: "Building practical digital and career skills one course at a time.",
    avatar_url: null,
    cover_url: null,
    city: "Toronto",
    country: "Canada",
    location_display: "Toronto, Canada",
    portfolio_items: [],
    external_links: [],
    website: null,
    availability_status: "open",
    open_to: ["Teaching", "Workshops", "Career Support"],
    contact_email: null,
    contact_preference: "form",
    is_public: true,
    is_featured: true,
    is_verified: true,
    followers_count: 73,
    following_count: 25,
    saves_count: 17,
    profile_views: 426,
    completeness_score: 89,
    created_at: PROFILE_CREATED_AT,
    updated_at: PROFILE_UPDATED_AT,
    academy_role: "instructor",
    academy_instructor_name: "Matthew Kelly",
  },
  {
    id: "academy-profile-selina-mccallum",
    user_id: "academy-instructor-selina-mccallum",
    username: "selina-mccallum",
    display_name: "Selina Mccallum",
    primary_roles: ["Instructor", "Facilitator"],
    secondary_skills: ["Storytelling", "Workshop Facilitation", "Learner Support"],
    bio: "Selina guides Street Voices Academy learners through supportive, hands-on sessions that connect storytelling, communication, and real-world confidence.",
    tagline: "Supporting learners with hands-on storytelling and communication practice.",
    avatar_url: null,
    cover_url: null,
    city: "Toronto",
    country: "Canada",
    location_display: "Toronto, Canada",
    portfolio_items: [],
    external_links: [],
    website: null,
    availability_status: "open",
    open_to: ["Teaching", "Mentorship", "Facilitation"],
    contact_email: null,
    contact_preference: "form",
    is_public: true,
    is_featured: true,
    is_verified: true,
    followers_count: 76,
    following_count: 29,
    saves_count: 20,
    profile_views: 452,
    completeness_score: 90,
    created_at: PROFILE_CREATED_AT,
    updated_at: PROFILE_UPDATED_AT,
    academy_role: "instructor",
    academy_instructor_name: "Selina Mccallum",
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

function slugifyAcademyProfileName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const GENERATED_ACADEMY_INSTRUCTOR_PROFILES: StreetProfileRecord[] = GENERATED_ACADEMY_INSTRUCTOR_NAMES.map((name, index) => {
  const slug = slugifyAcademyProfileName(name);

  return {
    id: `academy-profile-${slug}`,
    user_id: `academy-instructor-${slug}`,
    username: slug,
    display_name: name,
    primary_roles: ["Instructor", "Facilitator"],
    secondary_skills: ["Workshop Facilitation", "Community Learning", "Street Voices Academy"],
    bio: `${name} teaches through Street Voices Academy and supports learners with practical, community-rooted instruction.`,
    tagline: "Supporting Street Voices Academy learners through practical teaching and facilitation.",
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
    is_featured: false,
    is_verified: true,
    followers_count: 40 + index * 3,
    following_count: 16 + index,
    saves_count: 9 + index,
    profile_views: 180 + index * 17,
    completeness_score: 84,
    created_at: PROFILE_CREATED_AT,
    updated_at: PROFILE_UPDATED_AT,
    academy_role: "instructor",
    academy_instructor_name: name,
  };
});

const CASE_MANAGEMENT_PROFILE_SEEDS = [
  {
    name: "Maya Chen",
    roles: ["Client", "Housing Navigation"],
    skills: ["Housing intake", "ID replacement", "Benefits screening"],
    bio: "Maya is connected to Street Voices Case Management for urgent housing navigation, document recovery, and benefits screening. Her profile is linked from active cases, referrals, notes, and the Case Wiki.",
    tagline: "Case Management profile for housing, ID, and benefits coordination.",
    openTo: ["Case management", "Housing supports", "Document recovery"],
    views: 512,
  },
  {
    name: "Devon Brooks",
    roles: ["Client", "Employment Support"],
    skills: ["Employment readiness", "Clinic referral", "Food security"],
    bio: "Devon is working with the drop-in team on employment support, clinic follow-up, and food security referrals. His profile anchors the related tasks, appointments, and partner referrals.",
    tagline: "Case Management profile for employment and health navigation.",
    openTo: ["Employment support", "Health navigation", "Food security"],
    views: 438,
  },
  {
    name: "Alina Morgan",
    roles: ["Client", "Youth Program Participant"],
    skills: ["Youth media lab", "Benefits renewal", "Counseling intake"],
    bio: "Alina is connected to youth outreach for benefits renewal, counseling intake, and creative program referrals. Her wiki pages link back to this Street Profile for live context.",
    tagline: "Youth outreach profile for benefits, counseling, and creative program support.",
    openTo: ["Youth outreach", "Creative programs", "Benefits renewal"],
    views: 386,
  },
  {
    name: "Samir Ahmed",
    roles: ["Client", "Legal Support"],
    skills: ["Legal deadline tracking", "Medical coordination", "Shelter placement"],
    bio: "Samir's Case Management profile collects legal deadline follow-up, medical coordination, and shelter placement work so staff can keep urgent actions connected.",
    tagline: "Urgent case profile for legal, medical, and shelter coordination.",
    openTo: ["Legal support", "Medical coordination", "Shelter navigation"],
    views: 624,
  },
  {
    name: "Rosa Martinez",
    roles: ["Client", "Settlement Support"],
    skills: ["Settlement navigation", "ID replacement", "Food security"],
    bio: "Rosa is connected to case management for settlement supports, ID replacement, and family stability planning. Her profile connects service referrals with field notes.",
    tagline: "Case Management profile for settlement, ID, and food security support.",
    openTo: ["Settlement support", "Document recovery", "Food programs"],
    views: 402,
  },
  {
    name: "Jordan Lee",
    roles: ["Client", "Outreach Support"],
    skills: ["Harm reduction", "Counseling referral", "Clinic handoff"],
    bio: "Jordan's profile supports outreach coordination, counseling referrals, clinic handoffs, and safety planning from the west-end route.",
    tagline: "Outreach profile for harm reduction, counseling, and clinic coordination.",
    openTo: ["Outreach follow-up", "Counseling support", "Health navigation"],
    views: 479,
  },
  {
    name: "Keisha Thompson",
    roles: ["Client", "Health Navigation"],
    skills: ["Medical coordination", "Prescription pickup", "Housing forms"],
    bio: "Keisha's profile connects medical coordination, prescription support, housing form review, and accessibility notes for the health navigation team.",
    tagline: "Health navigation profile for appointments, forms, and accessibility needs.",
    openTo: ["Health navigation", "Accessible appointments", "Housing forms"],
    views: 354,
  },
  {
    name: "Tariq Johnson",
    roles: ["Client", "Youth Employment"],
    skills: ["Job readiness", "Digital media", "School re-entry"],
    bio: "Tariq's Street Profile keeps youth employment, school re-entry, and digital media supports connected to his Case Management record.",
    tagline: "Youth profile for employment, school re-entry, and media supports.",
    openTo: ["Youth employment", "School support", "Digital media"],
    views: 331,
  },
  {
    name: "Marion Green",
    roles: ["Client", "Housing Stability"],
    skills: ["Housing stabilization", "Benefits confirmation", "Closure planning"],
    bio: "Marion's profile preserves housing stabilization, benefits confirmation, and closure notes so historical case context remains available after resolution.",
    tagline: "Housing stability profile for closure review and follow-up context.",
    openTo: ["Housing stability", "Benefits follow-up", "Closure review"],
    views: 298,
  },
  {
    name: "Eli Novak",
    roles: ["Client", "Document Recovery"],
    skills: ["ID replacement", "Benefits appeal", "Food support"],
    bio: "Eli's profile ties document recovery, benefits appeal prep, food support, and plain-language action steps back to the live Street Profile layer.",
    tagline: "Document recovery profile for ID, benefits appeal, and food support.",
    openTo: ["Document recovery", "Benefits appeal", "Food programs"],
    views: 367,
  },
  {
    name: "Nia Patel",
    roles: ["Case Manager", "Outreach Worker"],
    skills: ["Housing navigation", "Youth outreach", "Document recovery"],
    bio: "Nia manages housing, youth outreach, and document recovery cases in Street Voices Case Management. Her profile is linked wherever she owns notes, tasks, and cases.",
    tagline: "Case manager for housing navigation, youth outreach, and document recovery.",
    openTo: ["Case management", "Outreach coordination", "Warm handoffs"],
    views: 703,
  },
  {
    name: "Omar Williams",
    roles: ["Case Manager", "Drop-in Team"],
    skills: ["Employment support", "Harm reduction", "Clinic handoffs"],
    bio: "Omar coordinates drop-in, employment, harm-reduction, and clinic handoff work across the Case Management workspace.",
    tagline: "Case manager for drop-in supports, employment pathways, and health handoffs.",
    openTo: ["Case coordination", "Employment referrals", "Health navigation"],
    views: 688,
  },
  {
    name: "Priya Singh",
    roles: ["Case Manager", "Housing Stability"],
    skills: ["Legal support", "Settlement navigation", "Closure planning"],
    bio: "Priya supports legal, settlement, housing stability, and closure-review workflows, with her profile connected to client records and wiki source notes.",
    tagline: "Case manager for legal, settlement, and housing stability workflows.",
    openTo: ["Case planning", "Legal referrals", "Settlement support"],
    views: 721,
  },
  {
    name: "Leah Fraser",
    roles: ["Case Manager", "Youth Outreach"],
    skills: ["Youth employment", "Document recovery", "Digital access"],
    bio: "Leah manages youth outreach and document recovery work, connecting tasks, notes, and referrals back to the Street Profile layer.",
    tagline: "Case manager for youth outreach, employment supports, and document recovery.",
    openTo: ["Youth outreach", "Employment support", "Document recovery"],
    views: 602,
  },
];

const CASE_MANAGEMENT_STREET_PROFILES: StreetProfileRecord[] = CASE_MANAGEMENT_PROFILE_SEEDS.map((seed, index) => {
  const slug = slugifyAcademyProfileName(seed.name);

  return {
    id: `case-management-profile-${slug}`,
    user_id: `case-management-${slug}`,
    username: slug,
    display_name: seed.name,
    primary_roles: seed.roles,
    secondary_skills: seed.skills,
    bio: seed.bio,
    tagline: seed.tagline,
    avatar_url: null,
    cover_url: null,
    city: "Toronto",
    country: "Canada",
    location_display: "Toronto, Canada",
    portfolio_items: [],
    external_links: [],
    website: null,
    availability_status: "open",
    open_to: seed.openTo,
    contact_email: null,
    contact_preference: "form",
    is_public: true,
    is_featured: index < 4,
    is_verified: true,
    followers_count: 42 + index * 4,
    following_count: 18 + index,
    saves_count: 12 + index,
    profile_views: seed.views,
    completeness_score: 88,
    created_at: PROFILE_CREATED_AT,
    updated_at: PROFILE_UPDATED_AT,
  };
});

function getAllAcademyStreetProfiles() {
  return [...ACADEMY_STREET_PROFILES, ...GENERATED_ACADEMY_INSTRUCTOR_PROFILES, ...CASE_MANAGEMENT_STREET_PROFILES];
}

export function getAcademyStreetProfiles(): StreetProfileRecord[] {
  return getAllAcademyStreetProfiles();
}

export function findAcademyStreetProfileByUsername(username?: string | null): StreetProfileRecord | null {
  const normalized = String(username || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return getAllAcademyStreetProfiles().find((profile) => profile.username.toLowerCase() === normalized) ?? null;
}

export function findAcademyStreetProfileByUserId(userId?: string | null): StreetProfileRecord | null {
  const normalized = String(userId || "").trim();
  if (!normalized) {
    return null;
  }

  return getAllAcademyStreetProfiles().find((profile) => profile.user_id === normalized) ?? null;
}

export function findAcademyStreetProfileByInstructorName(instructorName?: string | null): StreetProfileRecord | null {
  const normalized = String(instructorName || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return (
    getAllAcademyStreetProfiles().find((profile) => {
      const displayName = profile.display_name.trim().toLowerCase();
      const academyInstructorName = String(profile.academy_instructor_name || "").trim().toLowerCase();
      return normalized === displayName || normalized === academyInstructorName;
    }) ?? null
  );
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
