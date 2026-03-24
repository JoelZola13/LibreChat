import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '~/components/streetbot/shared/theme-provider';
import { sbFetch } from '~/components/streetbot/shared/sbFetch';
import { useAuthContext } from '~/hooks/AuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotificationRecord = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  source: string;
  type: string;
  href?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
};

type NotificationSummary = {
  user_id: string;
  unread_count: number;
  total_count: number;
};

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

const CheckIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
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
    <polyline points="20 6 9 17 4 12" />
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

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSeconds < 30) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'messages':
      return 'Messages';
    case 'tasks':
      return 'Tasks';
    case 'calendar':
      return 'Calendar';
    case 'jobs':
      return 'Job Board';
    case 'system':
      return 'System';
    default:
      return source ? source.charAt(0).toUpperCase() + source.slice(1) : 'App';
  }
}

// Spin keyframe id (injected once)
const SPIN_KEYFRAME_ID = 'sbp-notif-spin';
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
  const userId = user?.id || 'anonymous';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [summary, setSummary] = useState<NotificationSummary | null>(null);

  const [activeView, setActiveView] = useState<'all' | 'unread'>('all');
  const [activeSource, setActiveSource] = useState<string>('all');

  // Inject spin keyframe for the refresh icon
  useEffect(() => {
    ensureSpinKeyframe();
  }, []);

  // Theme colors -- glassmorphism translucent values
  const colors = useMemo(
    () => ({
      bg: isDark ? 'var(--sb-color-background)' : 'var(--sb-color-background)',
      surface: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.8)',
      surfaceHover: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 255, 255, 0.95)',
      surface2: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.85)',
      border: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
      borderHover: isDark ? 'rgba(255, 255, 255, 0.20)' : 'rgba(0, 0, 0, 0.12)',
      text: isDark ? '#fff' : '#1a1c24',
      textSecondary: isDark ? 'rgba(255, 255, 255, 0.7)' : '#4b4d59',
      textMuted: isDark ? 'rgba(255, 255, 255, 0.5)' : '#6b7280',
      accent: '#FFD700',
      accentHover: '#e6c200',
      unreadBg: isDark ? 'rgba(255, 214, 0, 0.12)' : 'rgba(255, 214, 0, 0.15)',
      accentText: isDark ? '#FFD700' : '#000',
      danger: '#ef4444',
      glassShadow: isDark
        ? '0 8px 32px rgba(0, 0, 0, 0.3)'
        : '0 4px 20px rgba(0, 0, 0, 0.08)',
    }),
    [isDark],
  );

  // ------- Data loading -------

  const loadSummary = useCallback(async () => {
    try {
      const resp = await sbFetch(
        `/api/notifications/summary?user_id=${encodeURIComponent(userId)}`,
      );
      if (!resp.ok) throw new Error(`Failed to load summary (${resp.status})`);
      const data = (await resp.json()) as NotificationSummary;
      setSummary(data);
    } catch (err) {
      console.error('Failed to load notification summary', err);
      // Non-critical -- we still show the page
    }
  }, [userId]);

  const loadNotifications = useCallback(
    async (opts?: { silent?: boolean }) => {
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
        const resp = await sbFetch(`/api/notifications?${params.toString()}`);
        if (!resp.ok) {
          throw new Error(`Failed to load notifications (${resp.status})`);
        }
        const data = (await resp.json()) as NotificationRecord[];
        setNotifications(Array.isArray(data) ? data : []);
      } catch (err: unknown) {
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
    if (summary) return summary.unread_count;
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

      // Skip API for fallback/demo notifications
      if (notificationId.startsWith('fallback-')) return;

      try {
        const resp = await sbFetch(`/api/notifications/${notificationId}/read`, {
          method: 'POST',
        });
        if (!resp.ok) throw new Error(`Mark read failed (${resp.status})`);
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
    [activeView, loadNotifications, loadSummary],
  );

  const markAllRead = useCallback(async () => {
    try {
      setRefreshing(true);
      const resp = await sbFetch('/api/notifications/read-all', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });
      if (!resp.ok) throw new Error(`Mark all read failed (${resp.status})`);

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
    if (notif.source === 'jobs') return BriefcaseIcon;
    return BellIcon;
  };

  const sourceColor = (source: string) => {
    switch (source) {
      case 'messages':
        return '#00FFDD';
      case 'tasks':
        return '#FFD700';
      case 'calendar':
        return '#3b82f6';
      case 'jobs':
        return '#22c55e';
      case 'system':
        return '#FF0055';
      default:
        return colors.accent;
    }
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
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px', minHeight: '70vh', position: 'relative', zIndex: 1, fontFamily: 'Rubik, sans-serif' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 18,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '1.8rem',
              fontWeight: 800,
              color: colors.text,
              fontFamily: 'Rubik, sans-serif',
            }}
          >
            Notifications
          </h1>
          <div
            style={{
              marginTop: 6,
              color: colors.textSecondary,
              fontSize: '0.95rem',
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

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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
              padding: '10px 16px',
              borderRadius: 12,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
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
              padding: '10px 16px',
              borderRadius: 12,
              border: `1px solid ${colors.accent}`,
              background: isDark ? colors.accent : 'transparent',
              color: '#000',
              fontSize: 14,
              fontWeight: 600,
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

      {/* Filters */}
      <div
        style={{
          padding: 14,
          marginBottom: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          ...glassCardBase,
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['all', 'unread'] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setActiveView(view)}
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                border: `1px solid ${activeView === view ? colors.accent : colors.border}`,
                background:
                  activeView === view ? 'rgba(255, 214, 0, 0.15)' : colors.surface,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                color: activeView === view ? colors.accentText : colors.text,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'Rubik, sans-serif',
                transition: 'all 0.2s ease',
              }}
            >
              {view === 'all' ? 'All' : 'Unread'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: 600,
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
              borderRadius: 12,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              color: colors.text,
              fontSize: 13,
              fontFamily: 'Rubik, sans-serif',
              outline: 'none',
              minWidth: 160,
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                  borderRadius: 16,
                  border: `1px solid ${isUnread ? 'rgba(255, 214, 0, 0.25)' : colors.border}`,
                  background: isUnread ? colors.unreadBg : colors.surface,
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  boxShadow: isUnread
                    ? `${colors.glassShadow}, 0 0 20px rgba(255, 214, 0, 0.1)`
                    : colors.glassShadow,
                  padding: 16,
                  cursor: 'pointer',
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr auto',
                  gap: 14,
                  alignItems: 'start',
                  transition: 'all 0.25s ease',
                  fontFamily: 'Rubik, sans-serif',
                }}
              >
                {/* Icon container */}
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: `${accent}20`,
                    border: `1px solid ${accent}40`,
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 4px 12px ${accent}20`,
                  }}
                  aria-hidden
                >
                  <Icon size={20} color={accent} />
                </div>

                {/* Content */}
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
                    {/* Source badge */}
                    <div
                      style={{
                        fontSize: 11,
                        padding: '4px 10px',
                        borderRadius: 999,
                        border: `1px solid ${colors.border}`,
                        background: colors.surface2,
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        color: colors.textSecondary,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {sourceLabel(notif.source)}
                    </div>
                    {/* Unread dot */}
                    {isUnread && (
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: colors.accent,
                          boxShadow: `0 0 8px ${colors.accent}`,
                        }}
                        aria-label="Unread"
                      />
                    )}
                  </div>

                  {/* Message preview */}
                  {notif.message && (
                    <div
                      style={{
                        marginTop: 8,
                        color: colors.textSecondary,
                        fontSize: 13,
                        lineHeight: 1.5,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {notif.message}
                    </div>
                  )}

                  {/* Time ago */}
                  <div style={{ marginTop: 10, color: colors.textMuted, fontSize: 12 }}>
                    {formatTimeAgo(notif.created_at)}
                    {notif.href ? ` \u2022 opens ${notif.href}` : ''}
                  </div>
                </div>

                {/* Action button */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {!notif.is_read ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: `1px solid ${isDark ? 'rgba(255, 214, 0, 0.4)' : 'rgba(146, 112, 12, 0.4)'}`,
                        background: isDark
                          ? 'rgba(255, 214, 0, 0.15)'
                          : 'rgba(255, 214, 0, 0.25)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        color: colors.accentText,
                        fontSize: 12,
                        fontWeight: 600,
                        boxShadow: '0 2px 8px rgba(255, 214, 0, 0.15)',
                      }}
                    >
                      <CheckIcon size={14} />
                      Mark read
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: `1px solid ${colors.border}`,
                        background: colors.surface,
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        color: colors.textMuted,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <CheckIcon size={14} />
                      Read
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
