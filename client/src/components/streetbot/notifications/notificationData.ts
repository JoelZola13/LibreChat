import { sbFetch } from '~/components/streetbot/shared/sbFetch';

export type NotificationRecord = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  source: string;
  type: string;
  href?: string;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
  actor_name?: string | null;
  actor_avatar?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type NotificationSummary = {
  user_id: string;
  unread_count: number;
  total_count: number;
};

export type CreateNotificationInput = {
  userId: string;
  title: string;
  message: string;
  source: string;
  type: string;
  href?: string;
  actorName?: string;
  actorAvatar?: string;
  dedupeKey?: string;
};

export const STREET_NOTIFICATIONS_CHANGED_EVENT = 'streetvoices:notifications-changed';

const LOCAL_KEY_PREFIX = 'streetvoices:notifications:v2:';
const READ_KEY_PREFIX = 'streetvoices:notifications-read:v2:';
const SEED_KEY_PREFIX = 'streetvoices:notifications-seeded:v2:';
const SESSION_USER_CACHE_KEY = 'streetbot:session-user:v1';

function getSafeUserId(userId?: string | null) {
  if (userId && userId !== 'anonymous') return userId;
  return getCachedNotificationUserId() || 'anonymous';
}

export function getCachedNotificationUserId() {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const value = parsed?.value;
    return String(value?.id || value?._id || '').trim() || null;
  } catch {
    return null;
  }
}

function keyFor(prefix: string, userId?: string | null) {
  return `${prefix}${getSafeUserId(userId)}`;
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is a progressive enhancement here.
  }
}

function dispatchChanged(userId: string) {
  if (!isBrowser()) return;
  window.dispatchEvent(
    new CustomEvent(STREET_NOTIFICATIONS_CHANGED_EVENT, { detail: { userId } }),
  );
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function createSeedNotifications(userId: string): NotificationRecord[] {
  return [
    {
      id: `seed-${userId}-message-fatima-doc`,
      user_id: userId,
      source: 'messages',
      type: 'message.direct.unread',
      title: 'Fatima sent you a new message',
      message: 'Fatima Hassan asked if you can join the mini-doc planning call before Friday.',
      href: '/messages',
      actor_name: 'Fatima Hassan',
      actor_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240',
      is_read: false,
      created_at: minutesAgo(4),
    },
    {
      id: `seed-${userId}-wots-reply`,
      user_id: userId,
      source: 'social',
      type: 'forum.reply',
      title: 'New reply on Word On The Street',
      message: 'Suki Park replied to your post about open mic nights and tagged two weekly events.',
      href: '/word-on-the-street',
      actor_name: 'Suki Park',
      actor_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=240',
      is_read: false,
      created_at: minutesAgo(11),
    },
    {
      id: `seed-${userId}-groups-mention`,
      user_id: userId,
      source: 'groups',
      type: 'group.mention',
      title: 'You were mentioned in a group',
      message: 'Ghost mentioned you in Street Voices Creators Circle while assigning weekend shoot roles.',
      href: '/groups/9001',
      actor_name: 'Ghost',
      actor_avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=240',
      is_read: false,
      created_at: minutesAgo(19),
    },
    {
      id: `seed-${userId}-profile-follow`,
      user_id: userId,
      source: 'profile',
      type: 'profile.follow',
      title: 'New profile follower',
      message: 'Maya Chen followed your Street Profile after viewing your portfolio.',
      href: '/profiles/maya_chen',
      actor_name: 'Maya Chen',
      actor_avatar: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=240',
      is_read: false,
      created_at: minutesAgo(32),
    },
    {
      id: `seed-${userId}-gallery-featured`,
      user_id: userId,
      source: 'gallery',
      type: 'gallery.artwork.featured',
      title: 'Your artwork was featured',
      message: 'Concrete Canvas was added to the Street Gallery featured row for this week.',
      href: '/gallery',
      actor_name: 'Street Gallery',
      is_read: false,
      created_at: minutesAgo(47),
    },
    {
      id: `seed-${userId}-job-interview`,
      user_id: userId,
      source: 'jobs',
      type: 'job.application.interview',
      title: 'Interview request',
      message: 'Street Voices wants to schedule an interview for the Volunteer Videographer role.',
      href: '/jobs?application=volunteer-videographer',
      actor_name: 'Street Voices',
      is_read: false,
      created_at: hoursAgo(1),
    },
    {
      id: `seed-${userId}-academy-assignment`,
      user_id: userId,
      source: 'academy',
      type: 'academy.assignment.due',
      title: 'Assignment due tomorrow',
      message: 'Your Media Training Cohort interview outline is due before tomorrow evening.',
      href: '/academy/dashboard',
      actor_name: 'Academy',
      is_read: false,
      created_at: hoursAgo(2),
    },
    {
      id: `seed-${userId}-directory-review`,
      user_id: userId,
      source: 'directory',
      type: 'directory.review',
      title: 'New directory review',
      message: 'The Community Legal Clinic received a new five-star review from a Street Voices member.',
      href: '/directory',
      actor_name: 'Directory',
      is_read: false,
      created_at: hoursAgo(3),
    },
    {
      id: `seed-${userId}-news-comment`,
      user_id: userId,
      source: 'news',
      type: 'news.comment',
      title: 'New comment on a news story',
      message: 'A reader replied to your comment on the Kensington Market arts funding story.',
      href: '/news',
      actor_name: 'Street Voices News',
      is_read: false,
      created_at: hoursAgo(4),
    },
    {
      id: `seed-${userId}-calendar-reminder`,
      user_id: userId,
      source: 'calendar',
      type: 'calendar.event.reminder',
      title: 'Event starts tomorrow',
      message: 'Street Art Festival panel prep starts tomorrow at 1:00 PM.',
      href: '/calendar',
      actor_name: 'Calendar',
      is_read: false,
      created_at: hoursAgo(5),
    },
    {
      id: `seed-${userId}-task-assigned`,
      user_id: userId,
      source: 'tasks',
      type: 'task.assigned',
      title: 'New task assigned',
      message: 'Communication Manager assigned you the sponsor thank-you draft for the mini-doc launch.',
      href: '/tasks',
      actor_name: 'Communication Manager',
      is_read: false,
      created_at: hoursAgo(7),
    },
    {
      id: `seed-${userId}-document-shared`,
      user_id: userId,
      source: 'documents',
      type: 'document.shared',
      title: 'Document shared with you',
      message: 'Fatima shared the Mini-doc shot list and added you as an editor.',
      href: '/documents',
      actor_name: 'Fatima Hassan',
      actor_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240',
      is_read: false,
      created_at: hoursAgo(9),
    },
    {
      id: `seed-${userId}-storage-upload`,
      user_id: userId,
      source: 'storage',
      type: 'storage.asset.uploaded',
      title: 'New file added to storage',
      message: 'Three mural reference images were uploaded to the Creators Circle folder.',
      href: '/storage',
      actor_name: 'Storage',
      is_read: false,
      created_at: hoursAgo(12),
    },
    {
      id: `seed-${userId}-groups-invite`,
      user_id: userId,
      source: 'groups',
      type: 'group.invite',
      title: 'Group invite',
      message: "You were invited to Toronto Photographers for next week's photo walk planning thread.",
      href: '/groups',
      actor_name: 'Toronto Photographers',
      is_read: false,
      created_at: daysAgo(1),
    },
    {
      id: `seed-${userId}-wots-reaction`,
      user_id: userId,
      source: 'social',
      type: 'forum.reaction',
      title: 'Your post is getting reactions',
      message: 'Fatima and 8 others reacted to your Word On The Street meme post.',
      href: '/word-on-the-street',
      actor_name: 'Fatima Hassan',
      actor_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240',
      is_read: false,
      created_at: daysAgo(1),
    },
    {
      id: `seed-${userId}-job-application-viewed`,
      user_id: userId,
      source: 'jobs',
      type: 'job.application.viewed',
      title: 'Application viewed',
      message: 'Black Voices Media Collective viewed your application for Youth Media Producer.',
      href: '/jobs?application=youth-media-producer',
      actor_name: 'Black Voices Media Collective',
      is_read: false,
      created_at: daysAgo(2),
    },
    {
      id: `seed-${userId}-academy-certificate`,
      user_id: userId,
      source: 'academy',
      type: 'academy.certificate.earned',
      title: 'Certificate earned',
      message: 'You completed Community Interview Basics and unlocked a profile certificate.',
      href: '/academy/certificates',
      actor_name: 'Academy',
      is_read: true,
      read_at: daysAgo(1),
      created_at: daysAgo(2),
    },
    {
      id: `seed-${userId}-gallery-like`,
      user_id: userId,
      source: 'gallery',
      type: 'gallery.artwork.liked',
      title: 'Gallery artwork liked',
      message: 'Ghost loved your piece Voices of the Underground.',
      href: '/gallery',
      actor_name: 'Ghost',
      actor_avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=240',
      is_read: true,
      read_at: daysAgo(2),
      created_at: daysAgo(3),
    },
    {
      id: `seed-${userId}-profile-booking`,
      user_id: userId,
      source: 'profile',
      type: 'profile.booking.request',
      title: 'New booking request',
      message: 'A community organizer requested availability for a live DJ set next month.',
      href: '/myprofile',
      actor_name: 'Community Organizer',
      is_read: true,
      read_at: daysAgo(2),
      created_at: daysAgo(3),
    },
    {
      id: `seed-${userId}-news-published`,
      user_id: userId,
      source: 'news',
      type: 'news.article.published',
      title: 'Article published',
      message: 'Your neighborhood spotlight draft was published in Street Voices News.',
      href: '/news',
      actor_name: 'Street Voices News',
      is_read: true,
      read_at: daysAgo(3),
      created_at: daysAgo(4),
    },
    {
      id: `seed-${userId}-directory-claim`,
      user_id: userId,
      source: 'directory',
      type: 'directory.claim.approved',
      title: 'Directory claim approved',
      message: 'Your claim for Community Media Lab was approved by the directory team.',
      href: '/directory',
      actor_name: 'Directory',
      is_read: true,
      read_at: daysAgo(3),
      created_at: daysAgo(4),
    },
    {
      id: `seed-${userId}-calendar-rsvp`,
      user_id: userId,
      source: 'calendar',
      type: 'calendar.rsvp',
      title: 'RSVP confirmed',
      message: 'Your seat is confirmed for the Thursday portfolio critique session.',
      href: '/calendar',
      actor_name: 'Calendar',
      is_read: true,
      read_at: daysAgo(4),
      created_at: daysAgo(5),
    },
    {
      id: `seed-${userId}-document-comment`,
      user_id: userId,
      source: 'documents',
      type: 'document.comment',
      title: 'New document comment',
      message: 'Ghost commented on the sponsorship one-pager.',
      href: '/documents',
      actor_name: 'Ghost',
      actor_avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=240',
      is_read: true,
      read_at: daysAgo(5),
      created_at: daysAgo(5),
    },
    {
      id: `seed-${userId}-storage-alert`,
      user_id: userId,
      source: 'storage',
      type: 'storage.near_limit',
      title: 'Storage almost full',
      message: 'Your Street Gallery folder is at 82% capacity after the latest video upload.',
      href: '/storage',
      actor_name: 'Storage',
      is_read: true,
      read_at: daysAgo(6),
      created_at: daysAgo(6),
    },
    {
      id: `seed-${userId}-system-digest`,
      user_id: userId,
      source: 'system',
      type: 'system.digest',
      title: 'Weekly Street Voices digest',
      message: 'You had 14 profile visits, 6 post reactions, 3 group mentions, and 2 job updates this week.',
      href: '/notifications',
      is_read: true,
      read_at: daysAgo(6),
      created_at: daysAgo(7),
    },
  ];
}

function normaliseNotification(raw: any, userId: string): NotificationRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || raw.notification_id || '');
  if (!id) return null;

  return {
    id,
    user_id: String(raw.user_id || userId),
    title: String(raw.title || raw.name || 'Notification'),
    message: String(raw.message || raw.body || raw.description || ''),
    source: String(raw.source || raw.category || 'system'),
    type: String(raw.type || raw.code || raw.notification_type || 'notification'),
    href: raw.href || raw.url || raw.link || undefined,
    is_read: Boolean(raw.is_read ?? raw.read ?? false),
    read_at: raw.read_at ?? null,
    created_at: String(raw.created_at || raw.createdAt || new Date().toISOString()),
    actor_name: raw.actor_name || raw.actorName || null,
    actor_avatar: raw.actor_avatar || raw.actorAvatar || null,
    metadata: raw.metadata || null,
  };
}

function isLowSignalNotification(item: NotificationRecord) {
  const combined = `${item.title} ${item.message}`.toLowerCase();
  return (
    combined.includes('activity tracked') ||
    combined.includes('will show here') ||
    combined.includes('your universal notification center is ready') ||
    combined.includes('you have unread messages waiting for you') ||
    combined.includes('we will notify you when people reply')
  );
}

function cleanNotifications(notifications: NotificationRecord[]) {
  const seen = new Set<string>();
  return notifications.filter((item) => {
    if (isLowSignalNotification(item)) return false;
    const key = [
      item.source,
      item.type,
      item.href || '',
      item.actor_name || '',
      item.title,
      item.message,
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getReadOverrides(userId: string) {
  return new Set(readJson<string[]>(keyFor(READ_KEY_PREFIX, userId), []));
}

function setReadOverrides(userId: string, ids: Iterable<string>) {
  writeJson(keyFor(READ_KEY_PREFIX, userId), Array.from(new Set(ids)));
}

export function getLocalNotifications(userId?: string | null) {
  const resolvedUserId = getSafeUserId(userId);
  ensureSeedNotifications(resolvedUserId);
  const notifications = cleanNotifications(
    readJson<NotificationRecord[]>(keyFor(LOCAL_KEY_PREFIX, resolvedUserId), []),
  );
  setLocalNotifications(resolvedUserId, notifications);
  return notifications;
}

function setLocalNotifications(userId: string, notifications: NotificationRecord[]) {
  writeJson(keyFor(LOCAL_KEY_PREFIX, userId), notifications);
}

export function ensureSeedNotifications(userId?: string | null) {
  const resolvedUserId = getSafeUserId(userId);
  if (!isBrowser()) return;
  const seedKey = keyFor(SEED_KEY_PREFIX, resolvedUserId);
  const existing = readJson<NotificationRecord[]>(keyFor(LOCAL_KEY_PREFIX, resolvedUserId), []);
  const existingIds = new Set(existing.map((item) => item.id));
  const seeded = createSeedNotifications(resolvedUserId).filter((item) => !existingIds.has(item.id));
  setLocalNotifications(resolvedUserId, cleanNotifications([...seeded, ...existing]));
  window.localStorage.setItem(seedKey, '1');
}

export async function loadStreetNotifications(
  userId?: string | null,
  options: { unreadOnly?: boolean; limit?: number } = {},
) {
  const resolvedUserId = getSafeUserId(userId);
  const readOverrides = getReadOverrides(resolvedUserId);
  let apiNotifications: NotificationRecord[] = [];

  try {
    const params = new URLSearchParams({
      user_id: resolvedUserId,
      unread_only: options.unreadOnly ? 'true' : 'false',
      offset: '0',
      limit: String(Math.max(options.limit || 50, 20)),
    });
    const response = await sbFetch(`/api/notifications?${params.toString()}`);
    if (response.ok) {
      const data = await response.json();
      apiNotifications = (Array.isArray(data) ? data : [])
        .map((item) => normaliseNotification(item, resolvedUserId))
        .filter(Boolean) as NotificationRecord[];
    }
  } catch {
    apiNotifications = [];
  }

  const localNotifications = getLocalNotifications(resolvedUserId);
  const merged = new Map<string, NotificationRecord>();

  cleanNotifications([...apiNotifications, ...localNotifications]).forEach((item) => {
    const overrideRead = readOverrides.has(item.id);
    merged.set(item.id, {
      ...item,
      is_read: overrideRead ? true : item.is_read,
      read_at: overrideRead ? item.read_at || new Date().toISOString() : item.read_at,
    });
  });

  let notifications = Array.from(merged.values()).sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );

  if (options.unreadOnly) {
    notifications = notifications.filter((item) => !item.is_read);
  }

  if (options.limit) {
    notifications = notifications.slice(0, options.limit);
  }

  return notifications;
}

export async function loadStreetNotificationSummary(userId?: string | null) {
  const resolvedUserId = getSafeUserId(userId);
  const notifications = await loadStreetNotifications(resolvedUserId);
  return {
    user_id: resolvedUserId,
    total_count: notifications.length,
    unread_count: notifications.filter((item) => !item.is_read).length,
  };
}

export async function markStreetNotificationRead(
  userId: string | null | undefined,
  notificationId: string,
) {
  const resolvedUserId = getSafeUserId(userId);
  const now = new Date().toISOString();
  const local = getLocalNotifications(resolvedUserId).map((item) =>
    item.id === notificationId ? { ...item, is_read: true, read_at: item.read_at || now } : item,
  );
  setLocalNotifications(resolvedUserId, local);

  const overrides = getReadOverrides(resolvedUserId);
  overrides.add(notificationId);
  setReadOverrides(resolvedUserId, overrides);

  if (!notificationId.startsWith('seed-') && !notificationId.startsWith('local-') && !notificationId.startsWith('fallback-')) {
    try {
      await sbFetch(`/api/notifications/${notificationId}/read`, { method: 'POST' });
    } catch {
      // Local read state is still preserved.
    }
  }

  dispatchChanged(resolvedUserId);
}

export async function markAllStreetNotificationsRead(
  userId?: string | null,
  notifications: NotificationRecord[] = [],
) {
  const resolvedUserId = getSafeUserId(userId);
  const now = new Date().toISOString();
  const local = getLocalNotifications(resolvedUserId).map((item) => ({
    ...item,
    is_read: true,
    read_at: item.read_at || now,
  }));
  setLocalNotifications(resolvedUserId, local);

  const overrides = getReadOverrides(resolvedUserId);
  notifications.forEach((item) => overrides.add(item.id));
  local.forEach((item) => overrides.add(item.id));
  setReadOverrides(resolvedUserId, overrides);

  try {
    await sbFetch(`/api/notifications/read-all?user_id=${encodeURIComponent(resolvedUserId)}`, {
      method: 'POST',
    });
  } catch {
    // Local read state is still preserved.
  }

  dispatchChanged(resolvedUserId);
}

export function createStreetNotification(input: CreateNotificationInput) {
  const userId = getSafeUserId(input.userId);
  const existing = getLocalNotifications(userId);
  const now = Date.now();

  if (input.dedupeKey) {
    const duplicate = existing.find((item) => {
      const metadata = item.metadata || {};
      const created = new Date(item.created_at).getTime();
      return metadata.dedupeKey === input.dedupeKey && now - created < 3 * 60 * 1000;
    });
    if (duplicate) return duplicate;
  }

  const notification: NotificationRecord = {
    id: `local-${userId}-${now}-${Math.random().toString(36).slice(2, 8)}`,
    user_id: userId,
    title: input.title,
    message: input.message,
    source: input.source,
    type: input.type,
    href: input.href,
    is_read: false,
    read_at: null,
    created_at: new Date(now).toISOString(),
    actor_name: input.actorName || null,
    actor_avatar: input.actorAvatar || null,
    metadata: input.dedupeKey ? { dedupeKey: input.dedupeKey } : null,
  };

  setLocalNotifications(userId, cleanNotifications([notification, ...existing]).slice(0, 80));
  dispatchChanged(userId);
  return notification;
}

export function getNotificationSourceLabel(source: string): string {
  switch (source) {
    case 'academy':
      return 'Academy';
    case 'directory':
      return 'Directory';
    case 'gallery':
      return 'Street Gallery';
    case 'groups':
      return 'Groups';
    case 'jobs':
      return 'Job Board';
    case 'messages':
      return 'Messages';
    case 'profile':
      return 'Street Profile';
    case 'social':
    case 'forum':
      return 'Word On The Street';
    case 'tasks':
      return 'Tasks';
    case 'calendar':
      return 'Calendar';
    case 'documents':
      return 'Documents';
    case 'storage':
      return 'Storage';
    case 'news':
      return 'News';
    case 'system':
      return 'Street Voices';
    default:
      return source ? source.charAt(0).toUpperCase() + source.slice(1) : 'Street Voices';
  }
}

export function getNotificationSourceColor(source: string): string {
  switch (source) {
    case 'messages':
      return '#1877F2';
    case 'profile':
      return '#8B5CF6';
    case 'social':
    case 'forum':
      return '#F97316';
    case 'groups':
      return '#06B6D4';
    case 'gallery':
      return '#EC4899';
    case 'jobs':
      return '#22C55E';
    case 'academy':
      return '#A855F7';
    case 'directory':
      return '#0EA5E9';
    case 'tasks':
      return '#FFD600';
    case 'calendar':
      return '#3B82F6';
    case 'documents':
      return '#38BDF8';
    case 'storage':
      return '#64748B';
    case 'news':
      return '#F59E0B';
    case 'system':
      return '#111827';
    default:
      return '#FFD600';
  }
}

export function formatNotificationTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 30) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

export function notifyForStreetAction({
  userId,
  pathname,
  label,
}: {
  userId?: string | null;
  pathname: string;
  label: string;
}) {
  const normalizedLabel = label.toLowerCase().replace(/\s+/g, ' ').trim();
  const resolvedUserId = getSafeUserId(userId);

  if (pathname.startsWith('/messages')) {
    return createStreetNotification({
      userId: resolvedUserId,
      source: 'messages',
      type: 'message.thread.updated',
      title: 'Message thread updated',
      message: includesAny(normalizedLabel, ['send', 'reply'])
        ? 'Your reply was sent and the conversation is now unread for the recipient.'
        : 'A direct message thread was opened from your Street Voices workspace.',
      href: '/messages',
      actorName: 'Messages',
      dedupeKey: `messages:thread:${pathname}`,
    });
  }

  if (pathname.startsWith('/word-on-the-street') || pathname.startsWith('/forum')) {
    const isReaction = includesAny(normalizedLabel, ['like', 'love', 'react', 'favorite']);
    const isPost = includesAny(normalizedLabel, ['post', 'create', 'submit']);
    return createStreetNotification({
      userId: resolvedUserId,
      source: 'social',
      type: isReaction ? 'forum.reaction' : isPost ? 'forum.post.created' : 'forum.reply',
      title: isReaction
        ? 'Post reaction saved'
        : isPost
          ? 'Word On The Street post published'
          : 'Post conversation updated',
      message: isReaction
        ? 'Your reaction was added to the Word On The Street feed.'
        : isPost
          ? 'Your post is live in the feed and will collect replies, reactions, and views.'
          : 'A Word On The Street thread now has new conversation activity.',
      href: '/word-on-the-street',
      actorName: 'Word On The Street',
      dedupeKey: `social:${pathname}:${isReaction ? 'reaction' : isPost ? 'post' : 'reply'}`,
    });
  }

  if (pathname.startsWith('/groups')) {
    const isJoin = includesAny(normalizedLabel, ['join']);
    const isCreate = includesAny(normalizedLabel, ['create group', 'create']);
    const isMessage = includesAny(normalizedLabel, ['message']);
    return createStreetNotification({
      userId: resolvedUserId,
      source: 'groups',
      type: isCreate
        ? 'group.created'
        : isJoin
          ? 'group.joined'
          : isMessage
            ? 'group.message'
            : 'group.discussion',
      title: isCreate
        ? 'Group created'
        : isJoin
          ? 'Group joined'
          : isMessage
            ? 'Group message opened'
            : 'Group discussion updated',
      message: isJoin
        ? 'Your membership was added to the group so messages, mentions, and events can reach you.'
        : isCreate
          ? 'Your new group is connected to messages, discussions, member requests, and mentions.'
          : isMessage
            ? 'The group message room is open for the latest collaboration thread.'
            : 'A group discussion was opened for replies, mentions, and member updates.',
      href: pathname.startsWith('/groups/') ? pathname : '/groups',
      actorName: 'Groups',
      dedupeKey: `groups:${pathname}:${
        isCreate ? 'create' : isJoin ? 'join' : isMessage ? 'message' : 'discussion'
      }`,
    });
  }

  if (pathname.startsWith('/gallery')) {
    const isSubmit = includesAny(normalizedLabel, ['submit', 'upload', 'add art']);
    const isSave = includesAny(normalizedLabel, ['save', 'bookmark']);
    return createStreetNotification({
      userId: resolvedUserId,
      source: 'gallery',
      type: isSubmit
        ? 'gallery.artwork.submitted'
        : isSave
          ? 'gallery.artwork.saved'
          : 'gallery.artwork.engaged',
      title: isSubmit ? 'Artwork submitted' : isSave ? 'Artwork saved' : 'Gallery interaction recorded',
      message: isSubmit
        ? 'Your Street Gallery submission is queued for review.'
        : isSave
          ? 'The artwork was saved to your gallery collection.'
          : 'Street Gallery engagement was added to your profile activity.',
      href: '/gallery',
      actorName: 'Street Gallery',
      dedupeKey: `gallery:${pathname}:${isSubmit ? 'submit' : isSave ? 'save' : 'engage'}`,
    });
  }

  if (pathname.startsWith('/jobs')) {
    const isApply = includesAny(normalizedLabel, ['apply', 'application']);
    const isSave = includesAny(normalizedLabel, ['save', 'favorite']);
    return createStreetNotification({
      userId: resolvedUserId,
      source: 'jobs',
      type: isApply ? 'job.application.sent' : isSave ? 'job.saved' : 'job.workspace.opened',
      title: isApply ? 'Application activity' : isSave ? 'Job saved' : 'Job Board workspace opened',
      message: isApply
        ? 'Your Job Board action is connected to application and employer updates.'
        : isSave
          ? 'This role was saved so deadline and employer updates can reach you.'
          : 'Job search, resumes, and applications are now connected to your notifications.',
      href: '/jobs',
      actorName: 'Job Board',
      dedupeKey: `jobs:${pathname}:${isApply ? 'apply' : isSave ? 'save' : 'workspace'}`,
    });
  }

  if (pathname.startsWith('/academy') || pathname.startsWith('/learning')) {
    const isEnroll = includesAny(normalizedLabel, ['enroll', 'course']);
    const isInstructor = includesAny(normalizedLabel, ['instructor']);
    return createStreetNotification({
      userId: resolvedUserId,
      source: 'academy',
      type: isEnroll ? 'academy.enrollment' : isInstructor ? 'academy.instructor' : 'academy.workspace',
      title: isEnroll
        ? 'Academy enrollment updated'
        : isInstructor
          ? 'Instructor workspace opened'
          : 'Academy workspace opened',
      message: isEnroll
        ? 'Your course activity will include assignment reminders, live sessions, grades, and certificates.'
        : isInstructor
          ? 'Instructor updates can notify you about submissions, cohorts, and grading work.'
          : 'Academy lessons, saved courses, assignments, and certificates are connected.',
      href: '/academy',
      actorName: 'Academy',
      dedupeKey: `academy:${pathname}:${isEnroll ? 'enroll' : isInstructor ? 'instructor' : 'workspace'}`,
    });
  }

  if (pathname.startsWith('/directory')) {
    const isClaim = includesAny(normalizedLabel, ['claim']);
    const isListing = includesAny(normalizedLabel, ['add listing', 'listing']);
    return createStreetNotification({
      userId: resolvedUserId,
      source: 'directory',
      type: isClaim ? 'directory.claim.started' : isListing ? 'directory.listing.updated' : 'directory.contact',
      title: isClaim ? 'Directory claim started' : isListing ? 'Directory listing updated' : 'Directory contact opened',
      message: isClaim
        ? 'Your claim request is connected to approval and admin follow-up notifications.'
        : isListing
          ? 'Listing edits, approvals, reviews, and contact requests can reach you here.'
          : 'Directory contact activity was linked to your notification center.',
      href: '/directory',
      actorName: 'Directory',
      dedupeKey: `directory:${pathname}:${isClaim ? 'claim' : isListing ? 'listing' : 'contact'}`,
    });
  }

  if (
    pathname.startsWith('/profiles') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/myprofile')
  ) {
    const isFollow = includesAny(normalizedLabel, ['follow']);
    const isMessage = includesAny(normalizedLabel, ['message']);
    return createStreetNotification({
      userId: resolvedUserId,
      source: 'profile',
      type: isFollow ? 'profile.follow' : isMessage ? 'profile.message' : 'profile.updated',
      title: isFollow ? 'Profile follow saved' : isMessage ? 'Profile message opened' : 'Street Profile updated',
      message: isFollow
        ? 'Following this creative will send profile, portfolio, and Word On The Street updates.'
        : isMessage
          ? 'Messages from this profile will appear in your notification center.'
          : 'Profile edits, bookings, saves, and portfolio changes are connected.',
      href: pathname.startsWith('/profiles/') ? pathname : '/myprofile',
      actorName: 'Street Profile',
      dedupeKey: `profile:${pathname}:${isFollow ? 'follow' : isMessage ? 'message' : 'update'}`,
    });
  }

  if (pathname.startsWith('/tasks')) {
    return createStreetNotification({
      userId: resolvedUserId,
      source: 'tasks',
      type: 'task.updated',
      title: 'Task workspace updated',
      message: 'Task changes, assignees, comments, due dates, and blockers will notify the right people.',
      href: '/tasks',
      actorName: 'Tasks',
      dedupeKey: `tasks:${pathname}`,
    });
  }

  if (pathname.startsWith('/calendar')) {
    return createStreetNotification({
      userId: resolvedUserId,
      source: 'calendar',
      type: 'calendar.updated',
      title: 'Calendar activity updated',
      message: 'Event reminders, RSVP changes, booking requests, and schedule moves are connected.',
      href: '/calendar',
      actorName: 'Calendar',
      dedupeKey: `calendar:${pathname}`,
    });
  }

  if (pathname.startsWith('/documents')) {
    return createStreetNotification({
      userId: resolvedUserId,
      source: 'documents',
      type: 'document.updated',
      title: 'Document activity updated',
      message: 'Document shares, comments, edits, and approval requests will notify collaborators.',
      href: '/documents',
      actorName: 'Documents',
      dedupeKey: `documents:${pathname}`,
    });
  }

  if (pathname.startsWith('/storage')) {
    return createStreetNotification({
      userId: resolvedUserId,
      source: 'storage',
      type: 'storage.updated',
      title: 'Storage activity updated',
      message: 'Uploads, folder shares, storage limits, and important asset changes are connected.',
      href: '/storage',
      actorName: 'Storage',
      dedupeKey: `storage:${pathname}`,
    });
  }

  if (pathname.startsWith('/news')) {
    return createStreetNotification({
      userId: resolvedUserId,
      source: 'news',
      type: 'news.updated',
      title: 'News activity updated',
      message: 'Article saves, comments, editorial updates, and publish activity can reach you here.',
      href: '/news',
      actorName: 'Street Voices News',
      dedupeKey: `news:${pathname}`,
    });
  }

  return null;
}
