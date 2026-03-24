import React, { useEffect, useState, useMemo } from 'react';
import { useGlassStyles } from '../shared/useGlassStyles';
import { sbFetch } from '../shared/sbFetch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Platform = 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube' | 'threads' | 'pinterest';

type DashboardStats = {
  activeAccounts: number;
  scheduledPosts: number;
  publishedPosts: number;
  inboxUnread: number;
};

type SocialPost = {
  id: string;
  content: string;
  platforms: Platform[];
  status: string;
  scheduledAt?: string;
  publishedAt?: string;
  createdAt: string;
  cmsHeadline?: string;
};

type InboxSummary = {
  totalUnread: number;
  totalPending: number;
  totalEscalated: number;
  byPlatform: Record<string, number>;
};

type SocialAccount = {
  id: string;
  platform: Platform;
  platformUsername: string;
  displayName?: string;
  healthStatus: 'healthy' | 'warning' | 'error';
};

// ---------------------------------------------------------------------------
// snake_case -> camelCase mapper
// ---------------------------------------------------------------------------

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function mapKeys<T>(obj: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[snakeToCamel(k)] = v;
  }
  return out as T;
}

// ---------------------------------------------------------------------------
// Inline SVG Icons
// ---------------------------------------------------------------------------

type IconProps = { size?: number; color?: string; style?: React.CSSProperties };

const UsersIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ClockIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const CheckCircleIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const MessageSquareIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const TrendingUpIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
);

const EditIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const CalendarIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const BarChartIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);

const SendIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const PlusIcon = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

// ---------------------------------------------------------------------------
// Platform styles
// ---------------------------------------------------------------------------

const platformColors: Record<Platform, string> = {
  twitter: '#000000',
  facebook: '#1877F2',
  instagram: '#E4405F',
  linkedin: '#0A66C2',
  tiktok: '#000000',
  youtube: '#FF0000',
  threads: '#000000',
  pinterest: '#E60023',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SocialMediaPage() {
  const { isDark, colors, glassCard, glassSurface } = useGlassStyles();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentPosts, setRecentPosts] = useState<SocialPost[]>([]);
  const [inboxSummary, setInboxSummary] = useState<InboxSummary | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsResp, postsResp, inboxResp, accountsResp] = await Promise.allSettled([
          sbFetch('/api/social-media/dashboard?user_id=demo-user'),
          sbFetch('/api/social-media/posts?user_id=demo-user&limit=5'),
          sbFetch('/api/social-media/inbox/summary?user_id=demo-user'),
          sbFetch('/api/social-media/accounts?user_id=demo-user'),
        ]);

        if (statsResp.status === 'fulfilled' && statsResp.value.ok) {
          const raw = await statsResp.value.json();
          setStats(mapKeys<DashboardStats>(raw));
        }
        if (postsResp.status === 'fulfilled' && postsResp.value.ok) {
          const data = await postsResp.value.json();
          const rawPosts: Record<string, unknown>[] = Array.isArray(data) ? data : data?.posts || [];
          setRecentPosts(rawPosts.map((p) => mapKeys<SocialPost>(p)));
        }
        if (inboxResp.status === 'fulfilled' && inboxResp.value.ok) {
          const raw = await inboxResp.value.json();
          setInboxSummary(mapKeys<InboxSummary>(raw));
        }
        if (accountsResp.status === 'fulfilled' && accountsResp.value.ok) {
          const data = await accountsResp.value.json();
          const rawAccounts: Record<string, unknown>[] = Array.isArray(data) ? data : [];
          setAccounts(rawAccounts.map((a) => mapKeys<SocialAccount>(a)));
        }
      } catch (err) {
        console.error('Failed to load social media data:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Quick actions config
  const quickActions = useMemo(() => [
    { title: 'Create Post', description: 'Compose and schedule a new post', icon: EditIcon },
    { title: 'View Calendar', description: 'See your content schedule', icon: CalendarIcon },
    { title: 'Respond to Messages', description: 'Check your inbox', icon: MessageSquareIcon },
    { title: 'View Analytics', description: 'Track performance metrics', icon: BarChartIcon },
  ], []);

  const statusColors: Record<string, { bg: string; text: string }> = {
    draft: { bg: 'rgba(107, 114, 128, 0.2)', text: '#9ca3af' },
    scheduled: { bg: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa' },
    published: { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ade80' },
    failed: { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171' },
    pending_approval: { bg: 'rgba(245, 158, 11, 0.2)', text: '#fbbf24' },
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', color: colors.textSecondary, fontFamily: 'Rubik, sans-serif' }}>
        Loading social media dashboard...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px', minHeight: '70vh', position: 'relative', zIndex: 1, fontFamily: 'Rubik, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: colors.text }}>
            Social Media Management
          </h1>
          <p style={{ marginTop: 6, color: colors.textSecondary, fontSize: '0.95rem' }}>
            Schedule posts, manage accounts, and track engagement across all platforms.
          </p>
        </div>
        <button
          type="button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 20px',
            borderRadius: 14,
            border: 'none',
            background: colors.accent,
            color: '#000',
            fontSize: 14,
            fontWeight: 700,
            fontFamily: 'Rubik, sans-serif',
            cursor: 'pointer',
            boxShadow: `0 4px 14px ${colors.accentGlow}`,
          }}
        >
          <PlusIcon size={18} color="#000" />
          Create Post
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        {[
          { title: 'Connected Accounts', value: stats?.activeAccounts ?? 0, icon: UsersIcon },
          { title: 'Scheduled Posts', value: stats?.scheduledPosts ?? 0, icon: ClockIcon },
          { title: 'Published This Month', value: stats?.publishedPosts ?? 0, icon: CheckCircleIcon },
          { title: 'Inbox Items', value: stats?.inboxUnread ?? 0, icon: MessageSquareIcon },
        ].map((stat) => (
          <div
            key={stat.title}
            style={{
              ...glassCard,
              padding: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>{stat.title}</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: colors.text }}>{stat.value}</div>
            </div>
            <div style={{ padding: 10, borderRadius: 12, background: `${colors.accent}20` }}>
              <stat.icon size={22} color={colors.accent} />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: colors.text, marginBottom: 14 }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {quickActions.map((action) => (
            <div
              key={action.title}
              style={{
                ...glassSurface,
                padding: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ padding: 10, borderRadius: 12, background: `${colors.accent}15` }}>
                <action.icon size={20} color={colors.accent} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: colors.text, fontSize: 14 }}>{action.title}</div>
                <div style={{ fontSize: 13, color: colors.textSecondary }}>{action.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Grid: Recent Posts + Sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        {/* Recent Posts */}
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: colors.text, marginBottom: 14 }}>Recent Posts</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recentPosts.length > 0 ? (
              recentPosts.map((post) => {
                const sc = statusColors[post.status] || statusColors.draft;
                return (
                  <div key={post.id} style={{ ...glassCard, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {post.platforms.map((p) => (
                          <span
                            key={p}
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: platformColors[p] || '#666',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            {p.charAt(0).toUpperCase()}
                          </span>
                        ))}
                      </div>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          background: sc.bg,
                          color: sc.text,
                        }}
                      >
                        {post.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, color: colors.text, marginBottom: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {post.content}
                    </div>
                    <div style={{ fontSize: 12, color: colors.textMuted }}>
                      {post.scheduledAt
                        ? `Scheduled: ${new Date(post.scheduledAt).toLocaleDateString()}`
                        : post.publishedAt
                        ? `Published: ${new Date(post.publishedAt).toLocaleDateString()}`
                        : `Created: ${new Date(post.createdAt).toLocaleDateString()}`}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ ...glassCard, padding: 40, textAlign: 'center' }}>
                <SendIcon size={40} color={colors.textMuted} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
                <div style={{ fontSize: 16, fontWeight: 600, color: colors.text, marginBottom: 6 }}>No posts yet</div>
                <div style={{ fontSize: 13, color: colors.textMuted }}>
                  Create your first social media post to get started.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Inbox */}
          <div style={{ ...glassCard, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontWeight: 600, fontSize: 15, color: colors.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquareIcon size={18} color={colors.accent} />
                Inbox
              </h3>
            </div>
            {inboxSummary ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Unread', count: inboxSummary.totalUnread, dotColor: '#ef4444' },
                  { label: 'Pending', count: inboxSummary.totalPending, dotColor: '#eab308' },
                  { label: 'Escalated', count: inboxSummary.totalEscalated, dotColor: '#f97316' },
                ].map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: colors.surface,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.dotColor }} />
                      <span style={{ fontSize: 14, color: colors.text }}>{row.label}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: colors.text }}>{row.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: colors.textMuted }}>No inbox data available</div>
            )}
          </div>

          {/* Connected Accounts */}
          <div style={{ ...glassCard, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontWeight: 600, fontSize: 15, color: colors.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                <UsersIcon size={18} color={colors.accent} />
                Connected Accounts
              </h3>
            </div>
            {accounts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {accounts.slice(0, 4).map((account) => (
                  <div
                    key={account.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: colors.surface,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: platformColors[account.platform] || '#666',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      {account.platform.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {account.displayName || account.platformUsername}
                      </div>
                      <div style={{ fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize' }}>
                        {account.platform}
                      </div>
                    </div>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: account.healthStatus === 'healthy' ? '#22c55e' : account.healthStatus === 'warning' ? '#eab308' : '#ef4444',
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: colors.textSecondary, fontSize: 14 }}>
                No accounts connected yet
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: colors.errorBg, border: `1px solid ${colors.error}40`, color: colors.error, fontSize: 14 }}>
          {error}
        </div>
      )}
    </div>
  );
}
