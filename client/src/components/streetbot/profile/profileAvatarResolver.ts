export type StreetProfileAvatarLike = {
  username?: string | null;
  display_name?: string | null;
  primary_roles?: string[] | null;
  avatar_url?: string | null;
};

const PLACEHOLDER_AVATAR_PATTERN =
  /images\.unsplash\.com|source\.unsplash\.com|ui-avatars\.com|picsum\.photos|dicebear|loremfaces|^data:image\/svg\+xml/i;

const CURRENT_PROFILE_AVATAR_IDS: Record<string, number> = {
  "neon_dreams": 1,
  "film_by_fatima": 2,
  "chef_streets": 3,
  "faith-macpherson": 4,
  "beats_by_nova": 5,
  "thejoelzola": 6,
  "dj_solaris": 7,
  "thread_queen": 8,
  "safe_space_sam": 9,
  "lens_and_light": 10,
  "academy-learner-lsmoke": 11,
  "concrete_canvas": 12,
  "healing_hands": 13,
  "street_lens": 14,
  "thejoezola": 15,
  "maya_chen": 16,
  "zuri-bennett": 17,
  "academy-learner-60414b": 18,
  "graffiti_ghost": 19,
  "peer_power_pete": 20,
  "aria_designs": 21,
  "code_for_change": 22,
  "wordsmith_jay": 23,
  "found_art_collective": 24,
  "devon-carter": 25,
  "urban_voice": 26,
  "rhythm_roots": 27,
  "amara-lewis": 28,
  "marcus_wright": 29,
  "digital_dreamer": 30,
  "community_care": 31,
};

const FALLBACK_PHOTO_ID_START = 32;
const TOTAL_PHOTO_AVATAR_COUNT = 70;
const PHOTO_AVATAR_SIZE = 800;

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function buildAvatarSeed(profile?: StreetProfileAvatarLike | null) {
  const username = String(profile?.username || "").trim();
  const displayName = String(profile?.display_name || "").trim();
  const roles = (profile?.primary_roles || []).join("|");

  return `${username}:${displayName}:${roles}` || "street-voice-profile";
}

function buildInitialsFallback(profile?: StreetProfileAvatarLike | null) {
  const displayName = String(profile?.display_name || profile?.username || "Street Voice").trim();
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "SV";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="${displayName}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#8B5CF6" />
          <stop offset="100%" stop-color="#EC4899" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="40" fill="url(#g)" />
      <circle cx="256" cy="256" r="156" fill="rgba(255,255,255,0.22)" />
      <text x="256" y="286" text-anchor="middle" font-size="156" font-family="Inter, Arial, sans-serif" font-weight="700" fill="rgba(27,27,31,0.68)">
        ${initials}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function shouldUsePhotoPlaceholder(avatarUrl?: string | null) {
  const normalized = String(avatarUrl || "").trim();
  if (!normalized) {
    return true;
  }

  return PLACEHOLDER_AVATAR_PATTERN.test(normalized);
}

function selectPhotoAvatarId(profile?: StreetProfileAvatarLike | null) {
  const username = String(profile?.username || "").trim().toLowerCase();
  if (username && CURRENT_PROFILE_AVATAR_IDS[username]) {
    return CURRENT_PROFILE_AVATAR_IDS[username];
  }

  const remainingIds = TOTAL_PHOTO_AVATAR_COUNT - FALLBACK_PHOTO_ID_START + 1;
  const hash = hashString(buildAvatarSeed(profile));
  return FALLBACK_PHOTO_ID_START + (hash % remainingIds);
}

function buildPhotoAvatarUrl(profile?: StreetProfileAvatarLike | null) {
  return `https://i.pravatar.cc/${PHOTO_AVATAR_SIZE}?img=${selectPhotoAvatarId(profile)}`;
}

export function getStreetProfileAvatarUrl(profile?: StreetProfileAvatarLike | null) {
  if (!profile) {
    return buildInitialsFallback(profile);
  }

  const existingAvatarUrl = String(profile.avatar_url || "").trim();
  if (!shouldUsePhotoPlaceholder(existingAvatarUrl)) {
    return existingAvatarUrl;
  }

  return buildPhotoAvatarUrl(profile);
}
