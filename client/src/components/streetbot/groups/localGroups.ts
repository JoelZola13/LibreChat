const LOCAL_GROUPS_KEY = 'streetvoices:groups:custom:v1';

export type LocalGroup = {
  id: number;
  name: string;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
  tags: string[];
  is_public: boolean;
  is_member: boolean;
  channel_slug: string;
  channel_id: string;
  agents: string[];
  featured_post_id?: string;
  featured_member_usernames: string[];
  message_count: number;
  last_message: {
    content: string;
    timestamp: string;
    author: string;
    is_agent: boolean;
  } | null;
  created_by?: string;
  created_at: string;
};

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'group'
  );
}

export function normalizeGroupTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim().replace(/^#/, '').toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

function isLocalGroup(value: unknown): value is LocalGroup {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as LocalGroup).id === 'number' &&
      typeof (value as LocalGroup).name === 'string',
  );
}

export function readLocalGroups(): LocalGroup[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(LOCAL_GROUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isLocalGroup) : [];
  } catch {
    return [];
  }
}

export function writeLocalGroups(groups: LocalGroup[]) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(LOCAL_GROUPS_KEY, JSON.stringify(groups.slice(0, 80)));
  } catch {
    // Local group storage is a fallback for local/dev social features.
  }
}

export function saveLocalGroup(group: LocalGroup) {
  const nextGroups = [group, ...readLocalGroups().filter((existing) => existing.id !== group.id)];
  writeLocalGroups(nextGroups);
}

export function findLocalGroupById(id?: string | number | null) {
  if (id === undefined || id === null) return null;
  return readLocalGroups().find((group) => String(group.id) === String(id)) || null;
}

export function isLocalGroupId(id?: string | number | null) {
  return Boolean(findLocalGroupById(id));
}

export function buildLocalGroup(input: {
  name: string;
  description?: string;
  tags?: string[];
  isPublic?: boolean;
  userId?: string;
}): LocalGroup {
  const createdAt = new Date().toISOString();
  const id = Date.now();
  const slug = `${slugify(input.name)}-${id.toString(36)}`;

  return {
    id,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    avatar_url: null,
    member_count: 1,
    tags: input.tags ?? [],
    is_public: input.isPublic ?? true,
    is_member: true,
    channel_slug: slug,
    channel_id: `group-${id}`,
    agents: [],
    featured_member_usernames: [],
    message_count: 0,
    last_message: {
      content: 'Group created. Start the conversation.',
      timestamp: createdAt,
      author: 'Street Voices',
      is_agent: true,
    },
    created_by: input.userId,
    created_at: createdAt,
  };
}
