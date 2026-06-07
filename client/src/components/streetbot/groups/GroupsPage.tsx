import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Grid as GridIcon,
  List,
  Users,
  Plus,
  MessageCircle,
  MoreHorizontal,
} from 'lucide-react';
import { SB_API_BASE, STREETBOT_READ_API_BASE } from '~/components/streetbot/shared/apiConfig';
import { useGlassStyles } from '../shared/useGlassStyles';
import { GlassBackground } from '../shared/GlassBackground';
import { useAuthContext } from '~/hooks/AuthContext';
import { getOrCreateUserId } from '@/lib/userId';
import { getSeamlessNavBarStyle } from '../shared/glassNav';
import { useTopNavScrolled } from '../shared/useTopNavScrolled';
import NavDropdown from '../shared/NavDropdown';
import {
  STREET_PROFILE_NAV_ITEMS,
  isStreetProfileNavActive,
} from '../shared/streetProfileNavItems';
import { GROUP_ICONS, GROUP_COLORS } from './agentIcons';
import {
  buildLocalGroup,
  normalizeGroupTags,
  readLocalGroups,
  saveLocalGroup,
} from './localGroups';
import {
  SOCIAL_SAMPLE_GROUPS,
  getGroupMessagesHref,
  mergeSocialItems,
} from '../shared/socialNetworkSamples';

const GROUPS_API_URL = `${SB_API_BASE}/groups`;
const GROUPS_READ_API_URL = `${STREETBOT_READ_API_BASE}/groups`;

type LastMessage = {
  content: string;
  timestamp: string;
  author: string;
  is_agent: boolean;
};

type Group = {
  id: number;
  name: string;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
  tags: string[];
  is_public: boolean;
  is_member: boolean;
  last_message?: LastMessage | null;
  message_count?: number;
  channel_slug?: string;
  channel_id?: string;
  agents?: string[];
  featured_post_id?: string;
  featured_member_usernames?: string[];
};

export default function GroupsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isDark, colors, glassCard, glassSurface } = useGlassStyles();
  const { user: authUser } = useAuthContext();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupTags, setNewGroupTags] = useState('');
  const [newGroupIsPublic, setNewGroupIsPublic] = useState(true);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const userId = getOrCreateUserId(authUser?.id);
  const selectedMember = searchParams.get('member');
  const isCreateRoute = location.pathname.endsWith('/create');
  const isTopNavScrolled = useTopNavScrolled();

  const searchPlaceholderColor = isDark ? 'rgba(246,247,251,0.78)' : 'rgba(17,19,24,0.62)';
  const createGroupLabel = 'Create Group';
  const mainNavLinks = [
    { label: 'Street Profile', to: '/profiles' },
    { label: 'Street Gallery', to: '/gallery' },
    { label: 'Academy', to: '/academy' },
    { label: 'Job Board', to: '/jobs' },
    { label: 'Directory', to: '/directory' },
    { label: 'News', to: '/news' },
  ];

  // Load groups
  const loadGroups = useCallback(async () => {
    const matchesGroupFilter = (group: Group) => {
      if (selectedMember && !group.featured_member_usernames?.includes(selectedMember))
        return false;
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return [
        group.name,
        group.description,
        ...(group.tags ?? []),
        ...(group.featured_member_usernames ?? []),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    };

    const sampleGroups = SOCIAL_SAMPLE_GROUPS.filter((group) => {
      if (selectedMember && !group.featured_member_usernames.includes(selectedMember)) return false;
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return [
        group.name,
        group.description,
        group.category,
        ...group.tags,
        ...group.featured_member_usernames,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
    const localGroups = readLocalGroups().filter((group) => matchesGroupFilter(group as Group));

    const mergeGroups = (apiGroups: Group[] = []) => {
      const mergedBase = mergeSocialItems(apiGroups, sampleGroups as Group[], (group) => group.id);
      const localIds = new Set(localGroups.map((group) => group.id));
      return [
        ...(localGroups as Group[]),
        ...mergedBase.filter((group) => !localIds.has(group.id)),
      ];
    };

    try {
      setLoading(true);
      const params = new URLSearchParams({ user_id: userId });
      if (searchQuery) params.append('search', searchQuery);

      const resp = await fetch(`${GROUPS_READ_API_URL}?${params}`);
      if (resp.ok) {
        const data = await resp.json();
        const apiGroups = (Array.isArray(data) ? data : []) as Group[];
        const filteredApiGroups = selectedMember
          ? apiGroups.filter((group) => group.featured_member_usernames?.includes(selectedMember))
          : apiGroups;
        setGroups(mergeGroups(filteredApiGroups));
      } else {
        setGroups(mergeGroups());
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
      setGroups(mergeGroups());
    } finally {
      setLoading(false);
    }
  }, [userId, searchQuery, selectedMember]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // Join/leave group
  const toggleMembership = async (groupId: number, isMember: boolean) => {
    const applyMembershipChange = () => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                is_member: !isMember,
                member_count: Math.max(0, isMember ? g.member_count - 1 : g.member_count + 1),
              }
            : g,
        ),
      );
    };

    try {
      const endpoint = isMember
        ? `${GROUPS_API_URL}/${groupId}/leave?user_id=${encodeURIComponent(userId)}`
        : `${GROUPS_API_URL}/${groupId}/join?user_id=${encodeURIComponent(userId)}`;

      const resp = await fetch(endpoint, {
        method: isMember ? 'DELETE' : 'POST',
      });

      if (!resp.ok && resp.status !== 204) {
        console.info('Group membership API returned a non-OK response; applying local feedback.');
      }
    } catch (error) {
      console.info('Group membership API was unavailable; applying local feedback.', error);
    }
    applyMembershipChange();
  };

  const filteredGroups = groups.filter((group) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      group.name.toLowerCase().includes(query) ||
      group.description?.toLowerCase().includes(query) ||
      group.tags.some((t) => t.toLowerCase().includes(query))
    );
  });

  const handleCreateGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newGroupName.trim();

    if (!name) {
      setCreateError('Add a group name first.');
      return;
    }

    setCreateError('');
    setCreating(true);

    const group = buildLocalGroup({
      name,
      description: newGroupDescription,
      tags: normalizeGroupTags(newGroupTags),
      isPublic: newGroupIsPublic,
      userId,
    });

    saveLocalGroup(group);
    setCreating(false);
    navigate(`/groups/${group.id}`);
  };

  if (isCreateRoute) {
    return (
      <div style={{ position: 'relative', minHeight: '100vh' }}>
        <GlassBackground />
        <div style={{ padding: '78px 24px 48px', position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <button
              type="button"
              onClick={() => navigate('/groups')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 999,
                border: `1px solid ${colors.border}`,
                background: colors.cardBg,
                color: colors.text,
                cursor: 'pointer',
                fontWeight: 700,
                marginBottom: 22,
              }}
            >
              <ArrowLeft size={16} />
              Back to Groups
            </button>

            <form
              onSubmit={handleCreateGroup}
              style={{
                ...glassCard,
                padding: '32px',
                borderRadius: 28,
              }}
            >
              <div style={{ marginBottom: 28 }}>
                <h1
                  style={{
                    color: colors.text,
                    fontSize: 'clamp(2rem, 4vw, 2.75rem)',
                    fontWeight: 800,
                    margin: '0 0 10px',
                  }}
                >
                  Create a Group
                </h1>
                <p style={{ color: colors.textSecondary, margin: 0, fontSize: 16 }}>
                  Start a Street Voices community with shared messages, discussions, and member
                  activity.
                </p>
              </div>

              <label
                style={{ display: 'block', color: colors.text, fontWeight: 800, marginBottom: 8 }}
              >
                Group name
              </label>
              <input
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder="Example: Toronto Filmmakers Circle"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 16,
                  border: `1px solid ${colors.border}`,
                  background: colors.cardBg,
                  color: colors.text,
                  outline: 'none',
                  fontSize: 16,
                  marginBottom: 18,
                }}
              />

              <label
                style={{ display: 'block', color: colors.text, fontWeight: 800, marginBottom: 8 }}
              >
                Description
              </label>
              <textarea
                value={newGroupDescription}
                onChange={(event) => setNewGroupDescription(event.target.value)}
                placeholder="What is this group for?"
                rows={5}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 16,
                  border: `1px solid ${colors.border}`,
                  background: colors.cardBg,
                  color: colors.text,
                  outline: 'none',
                  fontSize: 16,
                  resize: 'vertical',
                  marginBottom: 18,
                }}
              />

              <label
                style={{ display: 'block', color: colors.text, fontWeight: 800, marginBottom: 8 }}
              >
                Tags
              </label>
              <input
                value={newGroupTags}
                onChange={(event) => setNewGroupTags(event.target.value)}
                placeholder="media, community, collaboration"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 16,
                  border: `1px solid ${colors.border}`,
                  background: colors.cardBg,
                  color: colors.text,
                  outline: 'none',
                  fontSize: 16,
                  marginBottom: 18,
                }}
              />

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: colors.text,
                  fontWeight: 700,
                  marginBottom: 22,
                }}
              >
                <input
                  type="checkbox"
                  checked={newGroupIsPublic}
                  onChange={(event) => setNewGroupIsPublic(event.target.checked)}
                />
                Public group
              </label>

              {createError && (
                <div
                  style={{
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#ef4444',
                    padding: '12px 14px',
                    borderRadius: 14,
                    marginBottom: 18,
                    fontWeight: 700,
                  }}
                >
                  {createError}
                </div>
              )}

              <button
                type="submit"
                disabled={creating}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '15px 24px',
                  borderRadius: 999,
                  border: 'none',
                  background: colors.accent,
                  color: '#000',
                  fontSize: 16,
                  fontWeight: 900,
                  cursor: creating ? 'not-allowed' : 'pointer',
                  opacity: creating ? 0.72 : 1,
                  boxShadow: '0 10px 28px rgba(255, 214, 0, 0.26)',
                }}
              >
                <Plus size={18} />
                {creating ? 'Creating...' : 'Create Group'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <GlassBackground />

      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          ...getSeamlessNavBarStyle(isDark, isTopNavScrolled),
          padding: '8px clamp(160px, 16.45vw, 220px)',
          boxSizing: 'border-box',
        }}
      >
        <nav
          aria-label="Groups main navigation"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 4,
            height: 48,
            maxWidth: '859px',
            width: 'min(859px, calc(100vw - 320px))',
            margin: '0 auto',
            overflow: 'visible',
            whiteSpace: 'nowrap',
            position: 'relative',
          }}
        >
          <style>{`
            .groups-search-input::placeholder {
              color: ${searchPlaceholderColor};
              opacity: 1;
            }
            @media (max-width: 1180px) {
              .groups-page-nav-links {
                display: none !important;
              }
            }
            @media (max-width: 760px) {
              .groups-page-actions {
                width: 100%;
                padding-bottom: 0 !important;
                justify-content: space-between;
              }
            }
          `}</style>
          <div
            className="groups-page-nav-links"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 4,
              minWidth: 0,
              flexShrink: 0,
            }}
          >
            {mainNavLinks.map((item) => {
              const isActive =
                item.label === 'Street Profile'
                  ? isStreetProfileNavActive(location.pathname)
                  : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

              if (item.label === 'Street Profile') {
                return (
                  <NavDropdown
                    key={item.to}
                    label={item.label}
                    href={item.to}
                    items={STREET_PROFILE_NAV_ITEMS}
                    textColor={
                      isActive ? (isDark ? '#FFD600' : '#111827') : isDark ? '#E6E7F2' : '#1f2937'
                    }
                    fontSize={14}
                    buttonStyle={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontWeight: isActive ? 900 : 700,
                      lineHeight: 1.25,
                    }}
                    menuMinWidth={170}
                  />
                );
              }

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  style={{
                    color: isActive
                      ? isDark
                        ? '#FFD600'
                        : '#111827'
                      : isDark
                        ? '#E6E7F2'
                        : '#1f2937',
                    fontFamily: 'Rubik, sans-serif',
                    fontSize: 14,
                    fontWeight: isActive ? 900 : 700,
                    lineHeight: 1.25,
                    textDecoration: 'none',
                    padding: '8px 12px',
                    borderRadius: 8,
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <form
            role="search"
            aria-label="Search groups"
            onSubmit={(event) => event.preventDefault()}
            style={{
              flex: '0 0 clamp(260px, calc(50vw - 386px), 372px)',
              minWidth: 260,
              maxWidth: 372,
              display: 'flex',
              alignItems: 'center',
              height: 41,
              transform: 'translateY(-1px)',
              borderRadius: 999,
              gap: 10,
              border: isDark ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(17,24,39,0.12)',
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)',
              boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.16)' : '0 8px 20px rgba(17,24,39,0.08)',
              backdropFilter: 'blur(18px) saturate(160%)',
              WebkitBackdropFilter: 'blur(18px) saturate(160%)',
              padding: '4px 4px 4px 14px',
            }}
          >
            <Search size={17} color={isDark ? 'rgba(230,231,242,0.64)' : 'rgba(31,41,55,0.56)'} />
            <input
              type="search"
              className="groups-search-input"
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                height: '100%',
                minWidth: 0,
                border: 'none',
                background: 'transparent',
                color: isDark ? '#fff' : '#111827',
                fontSize: 14,
                outline: 'none',
                fontFamily: 'Rubik, sans-serif',
              }}
            />
            <button
              type="submit"
              style={{
                height: '100%',
                minWidth: 86,
                padding: '0 12px',
                border: 'none',
                borderRadius: 30,
                background: '#FFD600',
                color: '#000',
                fontFamily: 'inherit',
                fontSize: 'var(--sv-search-bar-font-size)',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                flexShrink: 0,
                position: 'relative',
                zIndex: 1,
                boxShadow: '0 7px 16px rgba(0,0,0,0.20)',
              }}
            >
              Search
            </button>
          </form>
        </nav>
      </div>

      <section
        style={{
          background: 'transparent',
          padding: '104px 24px 12px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ maxWidth: '1276px', margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              gap: '24px',
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: 'clamp(2.7rem, 5vw, 3.7rem)',
                  lineHeight: 0.94,
                  fontWeight: 900,
                  color: colors.text,
                  margin: '0 0 14px',
                  letterSpacing: 0,
                }}
              >
                Groups
              </h1>
              <p
                style={{
                  maxWidth: 420,
                  margin: 0,
                  color: isDark ? 'rgba(238,240,250,0.78)' : colors.textSecondary,
                  fontSize: 17,
                  lineHeight: 1.3,
                  fontWeight: 500,
                }}
              >
                Connect, collaborate, and grow with communities that share your passions and goals.
              </p>
              <div
                aria-hidden="true"
                style={{
                  width: 58,
                  height: 2,
                  marginTop: 12,
                  background: colors.accent,
                  borderRadius: 999,
                  boxShadow: '0 0 14px rgba(255, 214, 0, 0.36)',
                }}
              />
            </div>
            <div
              className="groups-page-actions"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                paddingBottom: 70,
              }}
            >
              <button
                title={createGroupLabel}
                onClick={() => navigate('/groups/create')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  height: 48,
                  padding: '0 30px',
                  borderRadius: '999px',
                  background: colors.accent,
                  color: '#000',
                  fontWeight: 900,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 12px 34px rgba(255, 214, 0, 0.36)',
                  fontFamily: 'Rubik, sans-serif',
                  fontSize: 14,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 14px 38px rgba(255, 214, 0, 0.46)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 12px 34px rgba(255, 214, 0, 0.36)';
                }}
              >
                <Plus size={18} />
                {createGroupLabel}
              </button>
              <div
                style={{
                  display: 'flex',
                  gap: 0,
                  ...glassSurface,
                  padding: 0,
                  borderRadius: 14,
                  height: 48,
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
              >
                {[
                  { mode: 'grid' as const, Icon: GridIcon, label: 'Grid' },
                  { mode: 'list' as const, Icon: List, label: 'List' },
                ].map(({ mode, Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    style={{
                      minWidth: 104,
                      height: '100%',
                      borderRadius: 13,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      color:
                        viewMode === mode ? (isDark ? '#fff' : '#111827') : colors.textSecondary,
                      transition: 'all 0.2s ease',
                      background:
                        viewMode === mode
                          ? isDark
                            ? 'rgba(135, 114, 197, 0.46)'
                            : 'rgba(255,255,255,0.72)'
                          : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'Rubik, sans-serif',
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                    onMouseEnter={(e) => {
                      if (viewMode !== mode) {
                        e.currentTarget.style.background = colors.surfaceHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (viewMode !== mode) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <Icon size={18} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div
        style={{
          padding: '8px 24px 32px',
          minHeight: '100vh',
          color: colors.text,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ maxWidth: '1276px', margin: '0 auto' }}>
          {/* Loading State */}
          {loading ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px',
                color: colors.textSecondary,
                ...glassSurface,
                borderRadius: '24px',
              }}
            >
              Loading groups...
            </div>
          ) : filteredGroups.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px',
                color: colors.textSecondary,
                ...glassSurface,
                borderRadius: '24px',
              }}
            >
              <Users size={48} color={colors.textMuted} style={{ marginBottom: '16px' }} />
              <h3
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: colors.text,
                  marginBottom: '8px',
                }}
              >
                No groups found
              </h3>
              <p>Be the first to create one!</p>
            </div>
          ) : (
            /* Groups Grid/List */
            <div
              style={{
                display: viewMode === 'grid' ? 'grid' : 'flex',
                gridTemplateColumns:
                  viewMode === 'grid'
                    ? 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))'
                    : undefined,
                flexDirection: viewMode === 'list' ? 'column' : undefined,
                gap: '24px',
              }}
            >
              {filteredGroups.map((group) => (
                <div
                  key={group.id}
                  style={{
                    ...glassCard,
                    padding: 0,
                    borderRadius: 13,
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: viewMode === 'list' ? 'row' : 'column',
                    alignItems: viewMode === 'list' ? 'stretch' : undefined,
                    minHeight: viewMode === 'grid' ? 326 : 190,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.borderHover;
                    e.currentTarget.style.transform =
                      viewMode === 'list' ? 'translateX(6px)' : 'translateY(-6px)';
                    e.currentTarget.style.background = colors.surfaceHover;
                    e.currentTarget.style.boxShadow = isDark
                      ? '0 20px 40px rgba(0,0,0,0.4), 0 0 20px rgba(139, 92, 246, 0.15)'
                      : '0 20px 40px rgba(31, 38, 135, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = colors.border;
                    e.currentTarget.style.transform = 'translateY(0) translateX(0)';
                    e.currentTarget.style.background = colors.cardBg;
                    e.currentTarget.style.boxShadow = colors.glassShadow;
                  }}
                >
                  <div
                    onClick={() => navigate(`/groups/${group.id}`)}
                    style={{
                      display: viewMode === 'list' ? 'flex' : 'block',
                      gap: viewMode === 'list' ? 18 : 0,
                      marginBottom: 0,
                      flex: viewMode === 'list' ? 1 : undefined,
                      cursor: 'pointer',
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: viewMode === 'list' ? 180 : '100%',
                        height: viewMode === 'list' ? 'auto' : 138,
                        minHeight: viewMode === 'list' ? 190 : undefined,
                        borderRadius: 0,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                        background: group.avatar_url
                          ? 'rgba(255, 255, 255, 0.08)'
                          : GROUP_COLORS[group.id] || '#666',
                        boxShadow: 'none',
                        border: 'none',
                      }}
                    >
                      {group.avatar_url ? (
                        <>
                          <img
                            src={group.avatar_url}
                            alt={group.name}
                            loading="lazy"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background:
                                'linear-gradient(180deg, rgba(4, 8, 18, 0.05), rgba(9, 12, 28, 0.46))',
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              left: 16,
                              bottom: -2,
                              width: 42,
                              height: 42,
                              borderRadius: 10,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              background: 'rgba(8, 10, 18, 0.72)',
                              border: '1px solid rgba(255, 255, 255, 0.72)',
                              fontSize: '0.72rem',
                              fontWeight: 900,
                              letterSpacing: '0',
                              backdropFilter: 'blur(10px)',
                            }}
                          >
                            {group.name
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((word) => word[0])
                              .join('')
                              .toUpperCase()}
                          </div>
                        </>
                      ) : GROUP_ICONS[group.id] ? (
                        <img
                          src={GROUP_ICONS[group.id]}
                          alt={group.name}
                          style={{
                            width: '32px',
                            height: '32px',
                            filter: 'brightness(0) invert(1)',
                          }}
                        />
                      ) : (
                        <Users size={32} color="#fff" />
                      )}
                      <button
                        type="button"
                        aria-label={`${group.name} options`}
                        onClick={(event) => event.stopPropagation()}
                        style={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          width: 31,
                          height: 28,
                          borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.16)',
                          background: 'rgba(17, 19, 30, 0.45)',
                          color: 'rgba(255,255,255,0.78)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          backdropFilter: 'blur(8px)',
                        }}
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: viewMode === 'list' ? '22px 22px 16px 0' : '18px 20px 0',
                      }}
                    >
                      <h3
                        style={{
                          fontSize: viewMode === 'list' ? '1.28rem' : '1.18rem',
                          lineHeight: 1.18,
                          fontWeight: 900,
                          color: colors.text,
                          margin: '0 0 8px 0',
                        }}
                      >
                        {group.name}
                      </h3>
                      <p
                        style={{
                          fontSize: '0.9rem',
                          color: isDark ? 'rgba(238,240,250,0.74)' : colors.textSecondary,
                          lineHeight: 1.45,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          margin: '0 0 12px 0',
                        }}
                      >
                        {group.description || 'No description'}
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 9,
                          marginBottom: viewMode === 'list' ? 0 : 14,
                        }}
                      >
                        {group.tags.map((tag) => (
                          <span
                            key={tag}
                            style={{
                              background: isDark
                                ? 'rgba(255, 255, 255, 0.05)'
                                : 'rgba(0, 0, 0, 0.05)',
                              color: colors.textSecondary,
                              fontSize: '0.69rem',
                              fontWeight: 900,
                              padding: '5px 13px',
                              borderRadius: 999,
                              border: `1px solid ${colors.border}`,
                            }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Action Buttons */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: viewMode === 'list' ? 'auto' : '100%',
                      padding:
                        viewMode === 'list'
                          ? '0 20px'
                          : group.is_member
                            ? '12px 20px 13px'
                            : '0 20px 14px',
                      marginTop: viewMode === 'list' ? 0 : 'auto',
                      borderTop: viewMode === 'list' ? 'none' : `1px solid ${colors.border}`,
                    }}
                  >
                    {/* Chat Button - Only show for members */}
                    {group.is_member && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(getGroupMessagesHref(group));
                        }}
                        style={{
                          flex: 'none',
                          width: 'auto',
                          padding: 0,
                          borderRadius: 0,
                          fontWeight: 900,
                          fontSize: 13,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          background: 'transparent',
                          color: isDark ? '#F6F7FB' : '#111827',
                          transition: 'all 0.2s ease',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <MessageCircle size={18} />
                        Messages
                      </button>
                    )}
                    {group.is_member && (
                      <>
                        <div
                          style={{
                            height: 26,
                            width: 1,
                            background: colors.border,
                            opacity: 0.8,
                          }}
                        />
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 7,
                            color: colors.textSecondary,
                            fontSize: 13,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Users size={15} />
                          {group.member_count} members
                        </div>
                      </>
                    )}

                    {/* Join/Joined Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMembership(group.id, group.is_member);
                      }}
                      style={{
                        marginLeft: 'auto',
                        flex: group.is_member ? 'none' : 1,
                        minWidth: group.is_member ? 80 : 0,
                        width: group.is_member ? undefined : '100%',
                        height: group.is_member ? 33 : 40,
                        padding: group.is_member ? '0 18px' : '0 24px',
                        borderRadius: group.is_member ? 13 : 9,
                        fontWeight: 900,
                        fontSize: '14px',
                        background: group.is_member
                          ? isDark
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(0, 0, 0, 0.05)'
                          : colors.accent,
                        color: group.is_member ? colors.textSecondary : '#000',
                        transition: 'all 0.2s ease',
                        border: group.is_member ? `1px solid ${colors.border}` : 'none',
                        cursor: 'pointer',
                        boxShadow: group.is_member ? 'none' : '0 4px 14px rgba(255, 214, 0, 0.3)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                      onMouseEnter={(e) => {
                        if (!group.is_member) {
                          e.currentTarget.style.transform = 'scale(1.02)';
                          e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 214, 0, 0.5)';
                        } else {
                          e.currentTarget.style.borderColor = '#ef4444';
                          e.currentTarget.style.color = '#ef4444';
                          e.currentTarget.style.background = isDark
                            ? 'rgba(239, 68, 68, 0.1)'
                            : 'rgba(239, 68, 68, 0.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        if (group.is_member) {
                          e.currentTarget.style.borderColor = colors.border;
                          e.currentTarget.style.color = colors.textSecondary;
                          e.currentTarget.style.background = isDark
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(0, 0, 0, 0.05)';
                          e.currentTarget.style.boxShadow = 'none';
                        } else {
                          e.currentTarget.style.boxShadow = '0 4px 14px rgba(255, 214, 0, 0.3)';
                        }
                      }}
                    >
                      {!group.is_member && <Users size={16} />}
                      {group.is_member ? 'Joined' : 'Join Group'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
