import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '~/hooks';
import { useUserRole, type UserRole } from '~/components/streetbot/lib/auth/useUserRole';
import { useGlassStyles } from '../shared/useGlassStyles';
import { GlassBackground } from '../shared/GlassBackground';
import { useResponsive } from '../hooks/useResponsive';

const DIRECTUS_URL = import.meta.env.VITE_DIRECTUS_URL || '/cms';
const DIRECTUS_TOKEN = import.meta.env.VITE_DIRECTUS_TOKEN || 'streetvoices-admin-token-2026';

const ALL_ROLES: UserRole[] = ['admin', 'designer', 'media', 'service_user', 'user'];

const ROLE_COLORS: Record<UserRole, { bg: string; text: string }> = {
  admin: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  designer: { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7' },
  media: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
  service_user: { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308' },
  user: { bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af' },
};

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  full_name: string | null;
  role: UserRole;
  is_verified: boolean;
  is_banned: boolean;
  created_at: string;
}

async function directusFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`Directus ${res.status}: ${res.statusText}`);
  return res.json();
}

export default function AdminRolesPage() {
  const navigate = useNavigate();
  const { user: authUser } = useAuthContext();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { colors, glassCard } = useGlassStyles();
  const { isMobile } = useResponsive();

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');

  // Redirect non-admin
  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate('/home', { replace: true });
    }
  }, [roleLoading, isAdmin, navigate]);

  // Fetch all user profiles
  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort: '-created_at',
        limit: '200',
        fields: 'id,user_id,display_name,full_name,role,is_verified,is_banned,created_at',
      });
      const json = await directusFetch(`/items/user_profiles?${params}`);
      setProfiles(json.data || []);
    } catch (err) {
      console.error('[AdminRolesPage] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  // Optimistic update helper
  const patchProfile = useCallback(async (
    profileId: string,
    field: Partial<Pick<UserProfile, 'role' | 'is_verified' | 'is_banned'>>,
  ) => {
    // Save old state for rollback
    const prev = profiles.map((p) => ({ ...p }));
    // Optimistic update
    setProfiles((ps) =>
      ps.map((p) => (p.id === profileId ? { ...p, ...field } : p)),
    );
    try {
      await directusFetch(`/items/user_profiles/${profileId}`, {
        method: 'PATCH',
        body: JSON.stringify(field),
      });
    } catch (err) {
      console.error('[AdminRolesPage] patch failed:', err);
      setProfiles(prev); // rollback
    }
  }, [profiles]);

  // Filter + search
  const filtered = useMemo(() => {
    let list = profiles;
    if (roleFilter !== 'all') {
      list = list.filter((p) => p.role === roleFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          (p.display_name || p.full_name || '').toLowerCase().includes(q) ||
          p.user_id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [profiles, roleFilter, search]);

  if (roleLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#999' }}>
        Loading...
      </div>
    );
  }

  if (!isAdmin) return null;

  const currentUserId = authUser?.id;

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 10,
    border: `1px solid ${colors.border}`,
    background: 'rgba(255,255,255,0.05)',
    color: colors.text,
    fontSize: 13,
    fontFamily: 'Rubik, sans-serif',
    outline: 'none',
    cursor: 'pointer',
  };

  const inputStyle: React.CSSProperties = {
    ...selectStyle,
    flex: 1,
    minWidth: 0,
    cursor: 'text',
  };

  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ fontFamily: 'Rubik, sans-serif' }}>
      <GlassBackground />
      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: 900, margin: '0 auto',
        padding: isMobile ? '24px 16px' : '40px 32px',
      }}>
        <h1 style={{ color: colors.text, fontSize: isMobile ? 26 : 34, fontWeight: 700, marginBottom: 8 }}>
          User Roles
        </h1>
        <p style={{ color: colors.textSecondary, fontSize: 15, marginBottom: 24 }}>
          Manage roles, verification, and ban status for all users.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
          <button
            onClick={() => navigate('/manage/claims')}
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              border: `1px solid ${colors.border}`,
              background: 'rgba(255,255,255,0.08)',
              color: colors.text,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Rubik, sans-serif',
              cursor: 'pointer',
            }}
          >
            Claims & Email Automation
          </button>
        </div>

        {/* Toolbar: search + filter + count */}
        <div style={{
          display: 'flex', gap: 10, marginBottom: 20,
          flexWrap: 'wrap', alignItems: 'center',
        }}>
          <input
            type="text"
            placeholder="Search by name or user ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={inputStyle}
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
            style={selectStyle}
          >
            <option value="all">All roles</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <span style={{ color: colors.textMuted, fontSize: 13, whiteSpace: 'nowrap' }}>
            {filtered.length} user{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* User list */}
        {loading ? (
          <div style={{ textAlign: 'center', color: colors.textMuted, padding: 60 }}>Loading users...</div>
        ) : filtered.length === 0 ? (
          <div style={{ ...glassCard, padding: '40px 24px', textAlign: 'center' }}>
            <p style={{ color: colors.textMuted, fontSize: 16 }}>No users found.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((profile) => {
              const isSelf = profile.user_id === currentUserId;
              const rc = ROLE_COLORS[profile.role] || ROLE_COLORS.user;

              return (
                <div key={profile.id} style={{ ...glassCard, padding: isMobile ? '14px' : '16px 20px' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    flexWrap: 'wrap', justifyContent: 'space-between',
                  }}>
                    {/* Left: info */}
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ color: colors.text, fontSize: 15, fontWeight: 600 }}>
                          {profile.display_name || profile.full_name || 'Unnamed'}
                        </span>
                        <span style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11,
                          fontWeight: 600, textTransform: 'uppercase',
                          background: rc.bg, color: rc.text,
                        }}>
                          {profile.role}
                        </span>
                        {profile.is_verified && (
                          <span title="Verified" style={{ fontSize: 14, color: '#22c55e' }}>&#10003;</span>
                        )}
                        {profile.is_banned && (
                          <span title="Banned" style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 8, fontSize: 10,
                            fontWeight: 600, background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                          }}>
                            BANNED
                          </span>
                        )}
                        {isSelf && (
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 8, fontSize: 10,
                            fontWeight: 600, background: 'rgba(59,130,246,0.15)', color: '#3b82f6',
                          }}>
                            YOU
                          </span>
                        )}
                      </div>
                      <div style={{ color: colors.textMuted, fontSize: 12 }}>
                        {profile.user_id}
                        {profile.created_at && (
                          <span style={{ marginLeft: 12 }}>
                            Joined {new Date(profile.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <select
                        value={profile.role}
                        onChange={(e) => patchProfile(profile.id, { role: e.target.value as UserRole })}
                        disabled={isSelf}
                        title={isSelf ? 'Cannot change your own role' : 'Change role'}
                        style={{
                          ...selectStyle,
                          opacity: isSelf ? 0.4 : 1,
                          cursor: isSelf ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {ALL_ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => patchProfile(profile.id, { is_verified: !profile.is_verified })}
                        title={profile.is_verified ? 'Unverify' : 'Verify'}
                        style={{
                          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          fontFamily: 'inherit', cursor: 'pointer',
                          border: `1px solid ${colors.border}`,
                          background: profile.is_verified ? 'rgba(34,197,94,0.15)' : 'transparent',
                          color: profile.is_verified ? '#22c55e' : colors.textSecondary,
                        }}
                      >
                        {profile.is_verified ? 'Verified' : 'Verify'}
                      </button>
                      <button
                        onClick={() => patchProfile(profile.id, { is_banned: !profile.is_banned })}
                        title={profile.is_banned ? 'Unban' : 'Ban'}
                        disabled={isSelf}
                        style={{
                          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          fontFamily: 'inherit',
                          cursor: isSelf ? 'not-allowed' : 'pointer',
                          border: `1px solid ${colors.border}`,
                          background: profile.is_banned ? 'rgba(239,68,68,0.15)' : 'transparent',
                          color: profile.is_banned ? '#ef4444' : colors.textSecondary,
                          opacity: isSelf ? 0.4 : 1,
                        }}
                      >
                        {profile.is_banned ? 'Banned' : 'Ban'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
