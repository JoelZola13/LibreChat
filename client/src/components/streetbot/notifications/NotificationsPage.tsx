import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@librechat/client';
import { useTheme } from '~/components/streetbot/shared/theme-provider';
import { useActiveUser } from '~/components/streetbot/shared/useActiveUser';
import { useAuthContext } from '~/hooks/AuthContext';
import NavDropdown from '~/components/streetbot/shared/NavDropdown';
import { STREET_PROFILE_NAV_ITEMS } from '~/components/streetbot/shared/streetProfileNavItems';
import { getSeamlessNavBarStyle } from '~/components/streetbot/shared/glassNav';
import {
  formatNotificationTimeAgo,
  getNotificationSourceColor,
  getNotificationSourceLabel,
  loadStreetNotificationSummary,
  loadStreetNotifications,
  markAllStreetNotificationsRead,
  markStreetNotificationRead,
  getCachedNotificationUserId,
  type NotificationRecord,
  type NotificationSummary,
} from './notificationData';

// ---------------------------------------------------------------------------
// Inline SVG Icons (replacing lucide-react)
// ---------------------------------------------------------------------------

type IconProps = { size?: number; color?: string; style?: React.CSSProperties };

const BellIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const MessageCircleIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const ListTodoIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    <rect x="3" y="5" width="6" height="6" rx="1" />
    <path d="m3 17 2 2 4-4" />
    <path d="M13 6h8" />
    <path d="M13 12h8" />
    <path d="M13 18h8" />
  </svg>
);

const CalendarIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const BriefcaseIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const MegaphoneIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    <path d="m3 11 18-5v12L3 13v-2z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </svg>
);

const RefreshCwIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const CheckCheckIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    <path d="M18 6 7 17l-5-5" />
    <path d="m22 10-9.5 9.5L10 17" />
  </svg>
);

const AlertCircleIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sourceLabel(source: string): string {
  return getNotificationSourceLabel(source);
}

// Spin keyframe id (injected once)
const SPIN_KEYFRAME_ID = 'sbp-notif-spin';
const NOTIFICATIONS_MAIN_NAV_LINKS = [
  { label: 'Street Gallery', to: '/gallery' },
  { label: 'Academy', to: '/academy' },
  { label: 'Job Board', to: '/jobs' },
  { label: 'Directory', to: '/directory' },
  { label: 'News', to: '/news' },
];
function ensureSpinKeyframe() {
  if (document.getElementById(SPIN_KEYFRAME_ID)) return;
  const style = document.createElement('style');
  style.id = SPIN_KEYFRAME_ID;
  style.textContent = `@keyframes sbpNotifSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { user } = useAuthContext();
  const { activeUser } = useActiveUser();
  const userId = user?.id || activeUser?.id || getCachedNotificationUserId() || 'anonymous';
  const isMobile = useMediaQuery('(max-width: 768px), (max-height: 500px)');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [summary, setSummary] = useState<NotificationSummary | null>(null);

  const [activeView, setActiveView] = useState<'all' | 'unread'>('all');
  const [activeSource, setActiveSource] = useState<string>('all');
  const [isTopNavScrolled, setIsTopNavScrolled] = useState(false);
  const loadRequestRef = useRef(0);
  const summaryRequestRef = useRef(0);

  // Inject spin keyframe for the refresh icon
  useEffect(() => {
    ensureSpinKeyframe();
  }, []);

  useEffect(() => {
    const readScrollTop = (event?: Event) => {
      const target = event?.target;
      if (target instanceof Element && target.closest('nav#chat-history-nav')) {
        return;
      }

      const targetScrollTop = target instanceof Element ? target.scrollTop : 0;
      const scrollTop = Math.max(
        window.scrollY,
        document.documentElement.scrollTop,
        document.body.scrollTop,
        targetScrollTop,
      );

      setIsTopNavScrolled(scrollTop > 8);
    };

    readScrollTop();
    window.addEventListener('scroll', readScrollTop, { passive: true });
    document.addEventListener('scroll', readScrollTop, { capture: true, passive: true });

    return () => {
      window.removeEventListener('scroll', readScrollTop);
      document.removeEventListener('scroll', readScrollTop, true);
    };
  }, []);

  // Theme colors -- glassmorphism translucent values
  const colors = useMemo(
    () => ({
      bg: isDark ? 'var(--sb-color-background)' : 'var(--sb-color-background)',
      surface: isDark ? 'rgba(24, 25, 34, 0.98)' : 'rgba(255, 255, 255, 0.98)',
      surfaceHover: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F2F3F5',
      surface2: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E7F3FF',
      border: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(17, 24, 39, 0.10)',
      borderHover: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(17, 24, 39, 0.14)',
      text: isDark ? '#fff' : '#1a1c24',
      textSecondary: isDark ? 'rgba(248, 250, 252, 0.72)' : '#65676B',
      textMuted: isDark ? 'rgba(248, 250, 252, 0.56)' : '#65676B',
      accent: '#FFD700',
      accentHover: '#e6c200',
      unreadBg: isDark ? 'rgba(255, 255, 255, 0.04)' : '#fff',
      accentText: isDark ? '#FFD700' : '#000',
      fbBlue: '#1877F2',
      danger: '#ef4444',
      glassShadow: isDark
        ? '0 24px 60px rgba(0, 0, 0, 0.45)'
        : '0 12px 32px rgba(0, 0, 0, 0.18)',
    }),
    [isDark],
  );

  // ------- Data loading -------

  const loadSummary = useCallback(async () => {
    const requestId = ++summaryRequestRef.current;
    try {
      const data = await loadStreetNotificationSummary(userId);
      if (requestId !== summaryRequestRef.current) return;
      setSummary(data);
    } catch (err) {
      console.error('Failed to load notification summary', err);
      // Non-critical -- we still show the page
    }
  }, [userId]);

  const loadNotifications = useCallback(
    async (opts?: { silent?: boolean }) => {
      const requestId = ++loadRequestRef.current;
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      } else {
        setRefreshing(true);
      }

      try {
        const unreadOnly = activeView === 'unread';
        const params = new URLSearchParams({
          user_id: userId,
          unread_only: unreadOnly ? 'true' : 'false',
          offset: '0',
          limit: '100',
        });
        const data = await loadStreetNotifications(userId, {
          unreadOnly,
          limit: Number(params.get('limit') || 100),
        });
        if (requestId !== loadRequestRef.current) return;
        setNotifications(Array.isArray(data) ? data : []);
      } catch (err: unknown) {
        if (requestId !== loadRequestRef.current) return;
        console.error('Failed to load notifications', err);
        // Graceful fallback -- show empty state instead of error when API is unavailable
        setNotifications([]);
        // Only show error state for non-network issues
        if (err instanceof TypeError && err.message.includes('fetch')) {
          // Network / CORS error -- just show empty
          setError(null);
        } else {
          setError(null); // Friendly fallback for now
        }
      } finally {
        if (requestId !== loadRequestRef.current) return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeView, userId],
  );

  useEffect(() => {
    void loadNotifications();
    void loadSummary();
  }, [loadNotifications, loadSummary]);

  // ------- Derived state -------

  const availableSources = useMemo(() => {
    const set = new Set<string>();
    notifications.forEach((n) => {
      if (n.source) set.add(n.source);
    });
    return ['all', ...Array.from(set).sort()];
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (activeSource === 'all') return notifications;
    return notifications.filter((n) => n.source === activeSource);
  }, [notifications, activeSource]);

  const unreadCount = useMemo(() => {
    if (summary && summary.total_count > 0) return summary.unread_count;
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications, summary]);

  // ------- Actions -------

  const markNotificationRead = useCallback(
    async (notificationId: string) => {
      // Optimistic update
      if (activeView === 'unread') {
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      } else {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n,
          ),
        );
      }

      try {
        await markStreetNotificationRead(userId, notificationId);
      } catch (err) {
        console.error('Failed to mark notification read', err);
        // Re-sync on failure
        void loadSummary();
        void loadNotifications({ silent: true });
        return;
      }

      void loadSummary();
      if (activeView === 'unread') {
        void loadNotifications({ silent: true });
      }
    },
    [activeView, loadNotifications, loadSummary, userId],
  );

  const markAllRead = useCallback(async () => {
    try {
      setRefreshing(true);
      await markAllStreetNotificationsRead(userId, notifications);

      if (activeView === 'unread') {
        setNotifications([]);
      } else {
        setNotifications((prev) =>
          prev.map((n) => ({
            ...n,
            is_read: true,
            read_at: n.read_at || new Date().toISOString(),
          })),
        );
      }
      void loadSummary();
    } catch (err) {
      console.error('Failed to mark all notifications read', err);
      void loadSummary();
      void loadNotifications({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [activeView, loadNotifications, loadSummary, userId]);

  const openNotification = useCallback(
    async (notif: NotificationRecord) => {
      if (!notif.is_read) {
        await markNotificationRead(notif.id);
      }
      if (notif.href) {
        navigate(notif.href);
      }
    },
    [navigate, markNotificationRead],
  );

  // ------- Icon picker -------

  const getIconComponent = (notif: NotificationRecord) => {
    if (notif.source === 'system') {
      return notif.type === 'announcement' ? MegaphoneIcon : BellIcon;
    }
    if (notif.source === 'messages') return MessageCircleIcon;
    if (notif.source === 'tasks') return ListTodoIcon;
    if (notif.source === 'calendar') return CalendarIcon;
    if (notif.source === 'documents' || notif.source === 'storage' || notif.source === 'news') {
      return MegaphoneIcon;
    }
    if (notif.source === 'jobs') return BriefcaseIcon;
    if (notif.source === 'academy') return BellIcon;
    if (notif.source === 'gallery') return BellIcon;
    if (notif.source === 'groups') return MessageCircleIcon;
    if (notif.source === 'profile') return BellIcon;
    if (notif.source === 'social' || notif.source === 'forum') return MessageCircleIcon;
    return BellIcon;
  };

  const sourceColor = (source: string) => {
    return getNotificationSourceColor(source);
  };

  // ------- Shared inline styles -------

  const glassCardBase: React.CSSProperties = {
    background: colors.surface,
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    boxShadow: colors.glassShadow,
  };

  // ------- Render -------

  return (
    <>
      <div
        translate="no"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          ...getSeamlessNavBarStyle(isDark, isTopNavScrolled),
          padding: '8px clamp(160px, 16.45vw, 220px)',
          boxSizing: 'border-box',
          display: isMobile ? 'none' : 'block',
        }}
      >
        <nav
          aria-label="Street Voices main navigation"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 28,
            minHeight: 38,
            height: 48,
            maxWidth: 859,
            width: 'min(859px, calc(100vw - 320px))',
            margin: '0 auto',
            fontFamily: 'Rubik, sans-serif',
            whiteSpace: 'nowrap',
          }}
        >
          <NavDropdown
            label="Street Profile"
            href="/profiles"
            items={STREET_PROFILE_NAV_ITEMS}
            textColor={colors.text}
            fontSize={14}
            buttonStyle={{ fontWeight: 800 }}
            menuMinWidth={240}
          />
          {NOTIFICATIONS_MAIN_NAV_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              style={{
                color: colors.text,
                fontSize: 14,
                fontWeight: 800,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 38,
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div
        style={{
          maxWidth: 780,
          margin: '0 auto',
          padding: isMobile ? '68px 14px 24px' : '86px 24px 24px',
          minHeight: '70vh',
          position: 'relative',
          zIndex: 1,
          fontFamily: 'Rubik, sans-serif',
        }}
      >
      <div
        style={{
          ...glassCardBase,
          padding: isMobile ? 14 : 16,
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: isMobile ? 26 : 28,
              fontWeight: 900,
              color: colors.text,
              fontFamily: 'Rubik, sans-serif',
              letterSpacing: 0,
            }}
          >
            Notifications
          </h1>
          <div
            style={{
              marginTop: 6,
              color: colors.textSecondary,
              fontSize: 14,
              fontFamily: 'Rubik, sans-serif',
            }}
          >
            {unreadCount > 0 ? (
              <span>
                <strong style={{ color: colors.text }}>{unreadCount}</strong> unread across the app
              </span>
            ) : (
              <span>You're all caught up.</span>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
            width: isMobile ? '100%' : undefined,
          }}
        >
          {/* Refresh button */}
          <button
            type="button"
            onClick={() => {
              void loadNotifications({ silent: true });
              void loadSummary();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: isMobile ? '10px 14px' : '10px 16px',
              borderRadius: 999,
              border: `1px solid ${colors.border}`,
              background: isDark ? 'rgba(255,255,255,0.08)' : '#F2F3F5',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: colors.text,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'Rubik, sans-serif',
              cursor: 'pointer',
              opacity: refreshing ? 0.7 : 1,
              transition: 'all 0.2s ease',
              boxShadow: colors.glassShadow,
            }}
            disabled={refreshing}
            aria-label="Refresh"
          >
            <RefreshCwIcon
              size={16}
              style={{
                animation: refreshing ? 'sbpNotifSpin 0.9s linear infinite' : 'none',
              }}
            />
            Refresh
          </button>

          {/* Mark all read button */}
          <button
            type="button"
            onClick={() => {
              void markAllRead();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: isMobile ? '10px 14px' : '10px 16px',
              borderRadius: 999,
              border: 'none',
              background: colors.accent,
              color: '#000',
              fontSize: 14,
              fontWeight: 900,
              fontFamily: 'Rubik, sans-serif',
              cursor: unreadCount === 0 ? 'not-allowed' : 'pointer',
              opacity: unreadCount === 0 ? 0.55 : 1,
              transition: 'all 0.2s ease',
              boxShadow: '0 0 20px rgba(255, 214, 0, 0.3)',
            }}
            disabled={unreadCount === 0 || refreshing}
          >
            <CheckCheckIcon size={16} color="#000" />
            Mark all read
          </button>
        </div>
      </div>

      <div
        style={{
          padding: isMobile ? '0 0 12px' : '0 8px 12px',
          marginBottom: 6,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['all', 'unread'] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setActiveView(view)}
              style={{
                padding: '9px 13px',
                borderRadius: 999,
                border: 'none',
                background: activeView === view ? colors.surface2 : 'transparent',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                color: activeView === view ? colors.fbBlue : colors.text,
                cursor: 'pointer',
                fontSize: 15,
                fontWeight: 800,
                fontFamily: 'Rubik, sans-serif',
                transition: 'all 0.2s ease',
              }}
            >
              {view === 'all' ? 'All' : 'Unread'}
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
            width: isMobile ? '100%' : undefined,
          }}
        >
          <span
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: 800,
              textTransform: 'uppercase',
              fontFamily: 'Rubik, sans-serif',
            }}
          >
            Source
          </span>
          <select
            value={activeSource}
            onChange={(e) => setActiveSource(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: `1px solid ${colors.border}`,
              background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              color: colors.text,
              fontSize: 13,
              fontFamily: 'Rubik, sans-serif',
              outline: 'none',
              minWidth: isMobile ? 0 : 160,
              width: isMobile ? '100%' : undefined,
              cursor: 'pointer',
            }}
          >
            {availableSources.map((s) => (
              <option
                key={s}
                value={s}
                style={{ background: isDark ? '#1f2027' : '#fff' }}
              >
                {s === 'all' ? 'All sources' : sourceLabel(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content area */}
      {loading ? (
        <div
          style={{
            padding: 20,
            color: colors.textSecondary,
            fontFamily: 'Rubik, sans-serif',
            ...glassCardBase,
          }}
        >
          Loading notifications...
        </div>
      ) : error ? (
        <div
          style={{
            padding: 20,
            background: colors.surface,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 16,
            boxShadow: colors.glassShadow,
            color: colors.text,
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            fontFamily: 'Rubik, sans-serif',
          }}
        >
          <AlertCircleIcon size={18} color={colors.danger} style={{ marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700 }}>Couldn't load notifications</div>
            <div style={{ marginTop: 4, color: colors.textSecondary, fontSize: 13 }}>
              {error}
            </div>
          </div>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div
          style={{
            padding: 40,
            color: colors.textSecondary,
            fontFamily: 'Rubik, sans-serif',
            textAlign: 'center',
            ...glassCardBase,
          }}
        >
          <BellIcon
            size={40}
            color={colors.textMuted}
            style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }}
          />
          <div style={{ fontSize: 16, fontWeight: 600, color: colors.text, marginBottom: 6 }}>
            No notifications yet
          </div>
          <div style={{ fontSize: 13, color: colors.textMuted }}>
            {activeView === 'unread'
              ? 'You have no unread notifications. Switch to "All" to see read notifications.'
              : 'When you receive notifications, they will appear here.'}
          </div>
        </div>
      ) : (
        <div style={{ ...glassCardBase, padding: 8 }}>
          {filteredNotifications.map((notif) => {
            const Icon = getIconComponent(notif);
            const accent = sourceColor(notif.source);
            const isUnread = !notif.is_read;

            return (
              <button
                key={notif.id}
                type="button"
                onClick={() => {
                  void openNotification(notif);
                }}
                style={{
                  textAlign: 'left',
                  width: '100%',
                  borderRadius: 10,
                  border: 'none',
                  background: 'transparent',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  display: 'grid',
                  gridTemplateColumns: '56px 1fr 12px',
                  gap: 12,
                  alignItems: 'center',
                  transition: 'background 160ms ease',
                  fontFamily: 'Rubik, sans-serif',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = colors.surfaceHover;
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = 'transparent';
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: accent === '#FFD600' ? '#111' : '#fff',
                    boxShadow: '0 8px 18px rgba(0, 0, 0, 0.22)',
                  }}
                  aria-hidden
                >
                  <Icon size={22} color={accent === '#FFD600' ? '#111' : '#fff'} />
                </div>

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        color: colors.text,
                        fontSize: 15,
                        lineHeight: 1.3,
                      }}
                    >
                      {notif.title}
                    </div>
                  </div>

                  {notif.message && (
                    <div
                      style={{
                        marginTop: 3,
                        color: colors.text,
                        fontSize: 14,
                        lineHeight: 1.35,
                        fontWeight: isUnread ? 800 : 500,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {notif.message}
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: 4,
                      color: isUnread ? colors.fbBlue : colors.textMuted,
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {formatNotificationTimeAgo(notif.created_at)} · {sourceLabel(notif.source)}
                  </div>
                </div>

                <span
                  aria-label={isUnread ? 'Unread' : undefined}
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: '50%',
                    background: isUnread ? colors.fbBlue : 'transparent',
                    justifySelf: 'center',
                  }}
                />
              </button>
            );
          })}
        </div>
      )}
      </div>
    </>
  );
}
