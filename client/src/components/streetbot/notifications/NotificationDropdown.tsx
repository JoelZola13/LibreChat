import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@librechat/client';
import {
  Bell,
  Briefcase,
  CalendarDays,
  CheckCheck,
  FileText,
  GraduationCap,
  HardDrive,
  Image,
  MessageCircle,
  MoreHorizontal,
  Newspaper,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  formatNotificationTimeAgo,
  getNotificationSourceColor,
  getNotificationSourceLabel,
  type NotificationRecord,
} from './notificationData';
import { useStreetNotifications } from './useStreetNotifications';
import { useActiveUser } from '~/components/streetbot/shared/useActiveUser';
import { SOCIAL_SAMPLE_PROFILES } from '~/components/streetbot/shared/socialNetworkSamples';
import {
  findAcademyStreetProfileByInstructorName,
  findAcademyStreetProfileByUserId,
  findAcademyStreetProfileByUsername,
} from '~/components/streetbot/profile/academyStreetProfiles';
import {
  getStreetProfileAvatarUrl,
  type StreetProfileAvatarLike,
} from '~/components/streetbot/profile/profileAvatarResolver';

type NotificationDropdownProps = {
  dark?: boolean;
  userId?: string | null;
  className?: string;
  style?: CSSProperties;
  buttonStyle?: CSSProperties;
  panelAlign?: 'left' | 'right';
};

const SETTINGS_STORAGE_KEY = 'streetbot:user-settings';

type NotificationProfileAvatar = {
  displayName: string;
  username?: string | null;
  avatarUrl: string;
};

function readStoredSettings(userId?: string | null): any {
  if (!userId || typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return {};
  }

  try {
    const raw =
      window.localStorage.getItem(`${SETTINGS_STORAGE_KEY}:${userId}`) ||
      window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function normalizeLookup(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[\s_-]+/g, '-');
}

function initialsForName(value?: string | null) {
  return (
    String(value || 'Street Voice')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'SV'
  );
}

function profileAvatar(profile: StreetProfileAvatarLike) {
  return getStreetProfileAvatarUrl(profile);
}

function avatarFromProfile(profile: StreetProfileAvatarLike): NotificationProfileAvatar {
  const displayName = String(profile.display_name || profile.username || 'Street Voice');
  return {
    displayName,
    username: profile.username,
    avatarUrl: profileAvatar(profile),
  };
}

function findKnownStreetProfile(nameOrUsername?: string | null): NotificationProfileAvatar | null {
  const lookup = normalizeLookup(nameOrUsername);
  if (!lookup) return null;

  const academyProfile =
    findAcademyStreetProfileByInstructorName(nameOrUsername) ||
    findAcademyStreetProfileByUsername(lookup);
  if (academyProfile) {
    return avatarFromProfile(academyProfile);
  }

  const socialProfile = SOCIAL_SAMPLE_PROFILES.find((profile) => {
    return (
      normalizeLookup(profile.username) === lookup ||
      normalizeLookup(profile.display_name) === lookup
    );
  });

  return socialProfile ? avatarFromProfile(socialProfile) : null;
}

function buildCurrentUserProfile(activeUser: any) {
  if (!activeUser) return null;

  const userId = activeUser?.id || activeUser?._id;
  const settings = readStoredSettings(userId);
  const storedProfile = settings.profile || {};
  const academyProfile = findAcademyStreetProfileByUserId(userId);
  const emailUsername = String(activeUser?.email || '').split('@')[0];

  return {
    username:
      activeUser?.username ||
      academyProfile?.username ||
      String(storedProfile.handle || '').replace(/^@/, '') ||
      emailUsername ||
      'street_user',
    display_name:
      activeUser?.name ||
      activeUser?.displayName ||
      academyProfile?.display_name ||
      storedProfile.name ||
      emailUsername ||
      'Street User',
    primary_roles:
      academyProfile?.primary_roles || (storedProfile.title ? [storedProfile.title] : ['Creative']),
    avatar_url:
      activeUser?.avatar ||
      activeUser?.avatar_url ||
      storedProfile.avatarUrl ||
      academyProfile?.avatar_url ||
      null,
  };
}

function resolveNotificationAvatar(
  notification: NotificationRecord,
  currentUserAvatar: NotificationProfileAvatar | null,
) {
  if (notification.actor_avatar) {
    return {
      displayName: notification.actor_name || getNotificationSourceLabel(notification.source),
      username: null,
      avatarUrl: notification.actor_avatar,
    };
  }

  if (notification.actor_name) {
    return (
      findKnownStreetProfile(notification.actor_name) ||
      avatarFromProfile({
        username: normalizeLookup(notification.actor_name),
        display_name: notification.actor_name,
        primary_roles: [],
        avatar_url: null,
      })
    );
  }

  return currentUserAvatar;
}

function getSourceIcon(source: string) {
  switch (source) {
    case 'messages':
      return MessageCircle;
    case 'groups':
      return Users;
    case 'jobs':
      return Briefcase;
    case 'academy':
      return GraduationCap;
    case 'gallery':
      return Image;
    case 'calendar':
      return CalendarDays;
    case 'documents':
      return FileText;
    case 'storage':
      return HardDrive;
    case 'news':
      return Newspaper;
    case 'profile':
    case 'social':
    case 'forum':
      return Sparkles;
    default:
      return Bell;
  }
}

function getPreviewText(notification: NotificationRecord) {
  return notification.message || notification.title;
}

export default function NotificationDropdown({
  dark = false,
  userId,
  className,
  style,
  buttonStyle,
  panelAlign = 'right',
}: NotificationDropdownProps) {
  const navigate = useNavigate();
  const { activeUser } = useActiveUser();
  const [open, setOpen] = useState(false);
  const [activeView, setActiveView] = useState<'all' | 'unread'>('all');
  const menuRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery('(max-width: 768px), (max-height: 500px)');
  const { notifications, unreadCount, loading, refreshing, refresh, markRead, markAllRead } =
    useStreetNotifications(userId, { limit: 12 });

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      void refresh(true);
    }
  }, [open, refresh]);

  const visibleNotifications = useMemo(
    () =>
      activeView === 'unread'
        ? notifications.filter((notification) => !notification.is_read)
        : notifications,
    [activeView, notifications],
  );

  const hasUnread = unreadCount > 0;
  const panelBg = dark ? 'rgba(24, 25, 34, 0.98)' : 'rgba(255, 255, 255, 0.98)';
  const panelBorder = dark ? 'rgba(255,255,255,0.12)' : 'rgba(17,24,39,0.1)';
  const text = dark ? '#F8FAFC' : '#050505';
  const muted = dark ? 'rgba(248,250,252,0.64)' : '#65676B';
  const hoverBg = dark ? 'rgba(255,255,255,0.08)' : '#F2F3F5';
  const chipBg = dark ? 'rgba(24,119,242,0.18)' : '#E7F3FF';
  const fbBlue = '#1877F2';
  const currentUserAvatar = useMemo(() => {
    const profile = buildCurrentUserProfile(activeUser);
    return profile ? avatarFromProfile(profile) : null;
  }, [activeUser]);

  const openNotification = useCallback(
    async (notification: NotificationRecord) => {
      if (!notification.is_read) {
        await markRead(notification.id);
      }
      setOpen(false);
      if (notification.href) {
        navigate(notification.href);
      }
    },
    [markRead, navigate],
  );

  return (
    <div
      ref={menuRef}
      data-notification-dropdown="true"
      className={className}
      style={{ position: 'relative', display: 'inline-flex', ...style }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={hasUnread ? `${unreadCount} unread notifications` : 'Notifications'}
        aria-expanded={open}
        title="Notifications"
        style={{
          position: 'relative',
          width: 36,
          height: 36,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: dark ? '#E6E7F2' : '#050505',
          border: isMobile
            ? 'none'
            : dark
              ? '1px solid rgba(255,255,255,0.16)'
              : '1px solid rgba(17,24,39,0.12)',
          background: isMobile
            ? 'transparent'
            : open
              ? chipBg
              : dark
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(255,255,255,0.72)',
          cursor: 'pointer',
          transition: 'background 160ms ease, transform 160ms ease',
          flexShrink: 0,
          ...buttonStyle,
        }}
      >
        <Bell size={isMobile ? 20 : 18} strokeWidth={2.2} aria-hidden="true" />
        {hasUnread && (
          <span
            style={{
              position: 'absolute',
              top: isMobile ? -3 : -4,
              right: isMobile ? -2 : -3,
              minWidth: isMobile ? 16 : 18,
              height: isMobile ? 16 : 18,
              padding: isMobile ? '0 4px' : '0 5px',
              borderRadius: 999,
              background: '#E41E3F',
              color: '#fff',
              border: dark ? '2px solid #181922' : '2px solid #fff',
              fontSize: isMobile ? 10 : 11,
              lineHeight: isMobile ? '12px' : '14px',
              fontWeight: 900,
              textAlign: 'center',
              fontFamily: 'Rubik, sans-serif',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{
            position: isMobile ? 'fixed' : 'absolute',
            top: isMobile ? 50 : 'calc(100% + 10px)',
            right: isMobile ? 12 : panelAlign === 'right' ? 0 : 'auto',
            left: isMobile ? 12 : panelAlign === 'left' ? 0 : 'auto',
            width: isMobile ? 'auto' : 'min(92vw, 380px)',
            maxHeight: isMobile ? 'calc(100dvh - 70px)' : 'min(680px, calc(100vh - 90px))',
            overflow: 'hidden',
            borderRadius: 12,
            background: panelBg,
            border: `1px solid ${panelBorder}`,
            boxShadow: dark ? '0 24px 60px rgba(0,0,0,0.45)' : '0 12px 32px rgba(0,0,0,0.18)',
            zIndex: 20000,
            color: text,
            fontFamily: 'Rubik, sans-serif',
          }}
        >
          <div style={{ padding: '16px 16px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2
                style={{ margin: 0, color: text, fontSize: 24, fontWeight: 900, letterSpacing: 0 }}
              >
                Notifications
              </h2>
              <button
                type="button"
                onClick={() => void markAllRead()}
                title="Mark all read"
                aria-label="Mark all notifications read"
                disabled={!hasUnread || refreshing}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'transparent',
                  color: hasUnread ? muted : dark ? 'rgba(248,250,252,0.28)' : '#BCC0C4',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: hasUnread ? 'pointer' : 'default',
                }}
              >
                {hasUnread ? <CheckCheck size={19} /> : <MoreHorizontal size={20} />}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {(['all', 'unread'] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setActiveView(view)}
                  style={{
                    border: 'none',
                    borderRadius: 999,
                    padding: '8px 12px',
                    background: activeView === view ? chipBg : 'transparent',
                    color: activeView === view ? fbBlue : text,
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {view === 'all' ? 'All' : 'Unread'}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              maxHeight: isMobile
                ? 'calc(100dvh - 172px)'
                : 'calc(min(680px, 100vh - 90px) - 102px)',
              overflowY: 'auto',
              padding: '0 8px 10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 900, color: text }}>New</div>
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                style={{
                  color: fbBlue,
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                See all
              </Link>
            </div>

            {loading ? (
              <div style={{ padding: '18px 10px', color: muted, fontSize: 14 }}>
                Loading notifications...
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div style={{ padding: '22px 10px 28px', color: muted, fontSize: 14 }}>
                {activeView === 'unread' ? "You're all caught up." : 'No notifications yet.'}
              </div>
            ) : (
              visibleNotifications.map((notification) => {
                const SourceIcon = getSourceIcon(notification.source);
                const sourceColor = getNotificationSourceColor(notification.source);
                const isUnread = !notification.is_read;
                const avatar = resolveNotificationAvatar(notification, currentUserAvatar);

                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => {
                      void openNotification(notification);
                    }}
                    style={{
                      width: '100%',
                      border: 'none',
                      borderRadius: 10,
                      background: 'transparent',
                      padding: '8px',
                      display: 'grid',
                      gridTemplateColumns: '56px 1fr 14px',
                      gap: 10,
                      textAlign: 'left',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = hoverBg;
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'relative',
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: sourceColor,
                        color: sourceColor === '#FFD600' ? '#111' : '#fff',
                        overflow: 'hidden',
                        fontWeight: 900,
                      }}
                    >
                      {avatar?.avatarUrl ? (
                        <img
                          src={avatar.avatarUrl}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        initialsForName(avatar?.displayName || notification.actor_name)
                      )}
                      <span
                        style={{
                          position: 'absolute',
                          right: -1,
                          bottom: -1,
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          border: `2px solid ${panelBg}`,
                          background: sourceColor,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: sourceColor === '#FFD600' ? '#111' : '#fff',
                        }}
                      >
                        <SourceIcon size={13} strokeWidth={2.4} />
                      </span>
                    </span>

                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          color: text,
                          fontSize: 14,
                          lineHeight: 1.32,
                          fontWeight: isUnread ? 800 : 500,
                        }}
                      >
                        {getPreviewText(notification)}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          marginTop: 3,
                          color: isUnread ? fbBlue : muted,
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {formatNotificationTimeAgo(notification.created_at)} ·{' '}
                        {getNotificationSourceLabel(notification.source)}
                      </span>
                    </span>

                    <span
                      aria-label={isUnread ? 'Unread' : undefined}
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: '50%',
                        background: isUnread ? fbBlue : 'transparent',
                        justifySelf: 'center',
                      }}
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
