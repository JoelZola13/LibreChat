import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { isDirectory } from '~/config/appVariant';
import { useGlassStyles } from '../shared/useGlassStyles';
import { GlassBackground } from '../shared/GlassBackground';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext } from '~/hooks/AuthContext';
import { useDebounce } from 'use-debounce';
import {
  Search,
  MapPin,
  Bookmark,
  BookmarkCheck,
  Filter,
  X,
  Grid3X3,
  LayoutList,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Users,
  UserPlus,
  Briefcase,
  Globe,
  ArrowRight,
} from 'lucide-react';
import { SB_API_BASE, STREETBOT_READ_API_BASE } from '~/components/streetbot/shared/apiConfig';
import { useResponsive } from '../hooks/useResponsive';
import { getStreetProfileAvatarUrl } from './profileAvatarResolver';
import { getSeamlessNavBarStyle } from '../shared/glassNav';
import { useTopNavScrolled } from '../shared/useTopNavScrolled';
import NavDropdown from '../shared/NavDropdown';
import {
  STREET_PROFILE_NAV_ITEMS,
  isStreetProfileNavActive,
} from '../shared/streetProfileNavItems';
import StreetPagination from '../shared/StreetPagination';

// =============================================================================
// Types
// =============================================================================

type StreetProfile = {
  id: string;
  username: string;
  instagram_url?: string | null;
  linkedin_url?: string | null;
  trusted_linkedin_match?: boolean | null;
  display_name: string;
  primary_roles: string[];
  tagline?: string;
  avatar_url?: string;
  avatar_quality?: string;
  city?: string;
  country?: string;
  location_display?: string;
  availability_status: string;
  is_featured: boolean;
  is_verified: boolean;
  followers_count: number;
};

type DirectoryProfilesResponse = {
  items?: StreetProfile[];
  profiles?: StreetProfile[];
  total?: number;
  page?: number;
  limit?: number;
};

type FilterState = {
  search: string;
  roles: string[];
  city: string;
  availability: string;
};

type DirectoryStateSnapshot = {
  searchTerm: string;
  filters: FilterState;
  currentPage: number;
};

const DEFAULT_FILTERS: FilterState = {
  search: '',
  roles: [],
  city: '',
  availability: '',
};

const PROFILE_DIRECTORY_STATE_KEY = 'streetProfileDirectoryState';
let lastDirectoryStateSnapshot: DirectoryStateSnapshot | null = null;

// =============================================================================
// Filter Options
// =============================================================================

const ROLE_OPTIONS = [
  'Instructor',
  'Student',
  'Facilitator',
  'Community Learner',
  'Artist',
  'Rapper',
  'Singer / Vocalist',
  'Music Producer / DJ',
  'Host / MC',
  'Podcaster',
  'Visual Artist',
  'Painter',
  'Muralist',
  'Illustrator',
  'Photographer',
  'Videographer',
  'Video Editor',
  'Film Editor',
  'Filmmaker',
  'Editor',
  'Model',
  'DJ',
  'Music Producer',
  'Sound Designer',
  'Influencer / Content Creator',
  'Personality / Host / Influencer',
  'UI/UX Designer',
  'Brand Designer',
  'Graphic Designer',
  'Designer',
  'Motion Designer',
  '3D Artist',
  'Creative Director',
  'Creative Developer',
  'Developer / Technologist',
  'Writer',
  'Journalist',
  'Scriptwriter',
  'Media / News',
  'Architect',
  'Entrepreneur / Founder',
  'Brand / Business',
  'Business Professional',
  'Agency / Studio',
  'Marketing / PR',
  'Community Organizer',
  'Community Organization',
  'Community / Youth Organization',
  'Education / Training',
  'Educator / Mentor',
  'Event Producer',
  'Festival / Event',
  'Beauty / Makeup / Hair',
  'Wellness / Fitness',
  'Chef / Food Creator',
  'Fashion / Stylist',
  'Student / Academic',
];

const ROLE_CATEGORIES: Record<string, string[]> = {
  Academy: ['Instructor', 'Student', 'Facilitator', 'Community Learner'],
  Music: ['Rapper', 'Singer / Vocalist', 'Music Producer / DJ', 'DJ', 'Music Producer', 'Sound Designer', 'Host / MC', 'Podcaster'],
  Visual: ['Visual Artist', 'Painter', 'Muralist', 'Illustrator', 'Photographer', 'Videographer', 'Video Editor', 'Film Editor', 'Filmmaker', 'Editor', 'Model'],
  Media: ['Influencer / Content Creator', 'Personality / Host / Influencer', 'Writer', 'Journalist', 'Scriptwriter', 'Media / News'],
  Design: ['UI/UX Designer', 'Brand Designer', 'Graphic Designer', 'Designer', 'Motion Designer', '3D Artist', 'Creative Director'],
  Business: ['Entrepreneur / Founder', 'Brand / Business', 'Business Professional', 'Agency / Studio', 'Marketing / PR'],
  Community: ['Community Organizer', 'Community Organization', 'Community / Youth Organization', 'Education / Training', 'Educator / Mentor', 'Event Producer', 'Festival / Event'],
  Lifestyle: ['Beauty / Makeup / Hair', 'Wellness / Fitness', 'Chef / Food Creator', 'Fashion / Stylist', 'Student / Academic'],
  Tech: ['Creative Developer', 'Developer / Technologist', 'Architect'],
};

const CITY_OPTIONS = [
  'Toronto',
  'Vancouver',
  'Montreal',
  'Los Angeles',
  'New York',
  'Berlin',
  'London',
  'Seoul',
];

const AVAILABILITY_OPTIONS = [
  { value: 'open', label: 'Open to work' },
  { value: 'busy', label: 'Currently busy' },
];

function normalizeFilterSnapshot(snapshot?: Partial<DirectoryStateSnapshot> | null): DirectoryStateSnapshot {
  const rawFilters = snapshot?.filters || DEFAULT_FILTERS;
  const allowedRoles = new Set(ROLE_OPTIONS);
  const roles = Array.isArray(rawFilters.roles)
    ? rawFilters.roles.filter((role) => allowedRoles.has(role))
    : [];
  const city = CITY_OPTIONS.includes(rawFilters.city) ? rawFilters.city : '';
  const availability = AVAILABILITY_OPTIONS.some((option) => option.value === rawFilters.availability)
    ? rawFilters.availability
    : '';
  const currentPage = Number.isFinite(snapshot?.currentPage)
    ? Math.max(1, Math.floor(Number(snapshot?.currentPage)))
    : 1;

  return {
    searchTerm: String(snapshot?.searchTerm || rawFilters.search || ''),
    filters: {
      search: '',
      roles,
      city,
      availability,
    },
    currentPage,
  };
}

function parseDirectoryStateFromParams(params: URLSearchParams): DirectoryStateSnapshot | null {
  const searchTerm = params.get('q') || '';
  const roles = (params.get('roles') || '')
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);
  const city = params.get('city') || '';
  const availability = params.get('availability') || '';
  const page = Number(params.get('page') || 1);

  if (!searchTerm && roles.length === 0 && !city && !availability && !params.get('page')) {
    return null;
  }

  return normalizeFilterSnapshot({
    searchTerm,
    filters: { search: '', roles, city, availability },
    currentPage: page,
  });
}

function getInitialDirectoryState(): DirectoryStateSnapshot {
  if (typeof window === 'undefined') {
    return normalizeFilterSnapshot();
  }

  const urlSnapshot = parseDirectoryStateFromParams(new URLSearchParams(window.location.search));
  if (urlSnapshot) {
    lastDirectoryStateSnapshot = urlSnapshot;
    return urlSnapshot;
  }

  if (lastDirectoryStateSnapshot) {
    return normalizeFilterSnapshot(lastDirectoryStateSnapshot);
  }

  return normalizeFilterSnapshot();
}

function buildDirectorySearchParams(snapshot: DirectoryStateSnapshot) {
  const params = new URLSearchParams();
  if (snapshot.searchTerm.trim()) params.set('q', snapshot.searchTerm.trim());
  if (snapshot.filters.roles.length > 0) params.set('roles', snapshot.filters.roles.join(','));
  if (snapshot.filters.city) params.set('city', snapshot.filters.city);
  if (snapshot.filters.availability) params.set('availability', snapshot.filters.availability);
  if (snapshot.currentPage > 1) params.set('page', String(snapshot.currentPage));
  return params;
}

function matchesFilters(profile: StreetProfile, searchTerm: string, filters: FilterState) {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  if (normalizedSearch) {
    const searchable = [
      profile.display_name,
      profile.username,
      profile.tagline || '',
      profile.location_display || '',
      ...(profile.primary_roles || []),
    ]
      .join(' ')
      .toLowerCase();

    if (!searchable.includes(normalizedSearch)) {
      return false;
    }
  }

  if (
    filters.roles.length > 0 &&
    !filters.roles.some((role) => profile.primary_roles.includes(role))
  ) {
    return false;
  }

  if (filters.city) {
    const location = [profile.city || '', profile.location_display || '', profile.country || '']
      .join(' ')
      .toLowerCase();
    if (!location.includes(filters.city.toLowerCase())) {
      return false;
    }
  }

  if (filters.availability && profile.availability_status !== filters.availability) {
    return false;
  }

  return true;
}

function normalizeExternalUrl(url?: string | null) {
  const trimmed = url?.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

function getPrimarySocialProfileUrl(
  profile: Pick<StreetProfile, 'username' | 'instagram_url' | 'linkedin_url' | 'trusted_linkedin_match'>,
) {
  const storedUrl = normalizeExternalUrl(profile.instagram_url);
  if (storedUrl) {
    return storedUrl;
  }

  const linkedInUrl = normalizeExternalUrl(profile.linkedin_url);
  if (linkedInUrl) {
    return linkedInUrl;
  }

  const username = profile.username?.trim().replace(/^@/, '');
  return username ? `https://www.instagram.com/${username}/` : '';
}

async function loadLocalFallbackProfiles(
  searchTerm: string,
  filters: FilterState,
): Promise<StreetProfile[]> {
  const [academyModule, syncModule, samplesModule] = await Promise.all([
    import('./academyStreetProfiles'),
    import('./academyProfileSync'),
    import('../shared/socialNetworkSamples'),
  ]);

  const sampleProfiles = samplesModule.SOCIAL_SAMPLE_PROFILES.filter((profile) =>
    matchesFilters(profile as StreetProfile, searchTerm, filters),
  ) as StreetProfile[];
  const seededAcademyProfiles = (academyModule.getAcademyStreetProfiles() as StreetProfile[]).filter(
    (profile) => matchesFilters(profile, searchTerm, filters),
  );

  await syncModule.ensureStreetProfilesForActiveAcademyUsers().catch(() => []);
  const cmsProfiles = await syncModule.listCmsDirectoryStreetProfiles().catch(() => []);
  const cmsAcademyProfiles = cmsProfiles
    .map((profile) => academyModule.hydrateStreetProfileRecord(profile as any) as StreetProfile)
    .filter((profile) => matchesFilters(profile, searchTerm, filters));
  const academyProfiles = academyModule.mergeStreetProfiles(
    cmsAcademyProfiles,
    seededAcademyProfiles,
  );

  return academyModule.mergeStreetProfiles(academyProfiles, sampleProfiles);
}

// =============================================================================
// Component
// =============================================================================

export default function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();
  const {
    isDark,
    colors: sharedColors,
    glassCard,
    glassSurface,
    glassButton,
    accentButton,
    glassTag,
    cardHoverHandlers,
    accentButtonHoverHandlers,
    gradientOrbs,
  } = useGlassStyles();
  const { isMobile, width } = useResponsive();
  const isTopNavScrolled = useTopNavScrolled();
  const isCompactNav = width < 1080;
  const initialDirectoryState = useMemo(() => getInitialDirectoryState(), []);
  const didRestoreDirectoryState = useRef(false);

  // State
  const [profiles, setProfiles] = useState<StreetProfile[]>([]);
  const [totalProfileCount, setTotalProfileCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(initialDirectoryState.searchTerm);
  const [debouncedSearchTerm] = useDebounce(searchTerm, 250);
  const [savedProfiles, setSavedProfiles] = useState<Set<string>>(new Set());
  const [followedProfiles, setFollowedProfiles] = useState<Set<string>>(new Set());
  const [isGridView, setIsGridView] = useState(true);
  const [currentPage, setCurrentPage] = useState(initialDirectoryState.currentPage);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['roles', 'city']));
  // Create Profile modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [createForm, setCreateForm] = useState({
    display_name: '',
    username: '',
    role: '',
    bio: '',
    city: '',
    avatar: '' as string,
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [filters, setFilters] = useState<FilterState>(initialDirectoryState.filters);

  // Extend shared colors with page-specific profile colors
  const colors = useMemo(
    () => ({
      ...sharedColors,
      accentText: isDark ? '#FFD600' : '#000',
      accentDark: '#E6C200',
      glassGlow: isDark
        ? '0 0 0 1px rgba(255, 255, 255, 0.1)'
        : '0 0 0 1px rgba(255, 255, 255, 0.4)',
    }),
    [sharedColors, isDark],
  );
  // Load profiles
  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const PROFILES_PER_PAGE = 12;
      const params = new URLSearchParams();
      if (debouncedSearchTerm) params.append('q', debouncedSearchTerm);
      if (filters.roles.length > 0) params.append('roles', filters.roles.join(','));
      if (filters.city) params.append('city', filters.city);
      if (filters.availability) params.append('availability', filters.availability);
      params.append('page', String(currentPage));
      params.append('limit', String(PROFILES_PER_PAGE));
      params.append('view', 'directory');

      const url = `${STREETBOT_READ_API_BASE}/street-profiles/directory${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        if (!Array.isArray(data) && typeof data === 'object' && data) {
          const payload = data as DirectoryProfilesResponse;
          const apiProfiles = payload.items || payload.profiles || [];
          setProfiles(apiProfiles);
          setTotalProfileCount(payload.total ?? apiProfiles.length);
          return;
        }

        const apiProfiles = Array.isArray(data) ? (data as StreetProfile[]) : [];
        const isBulkApifyImport =
          apiProfiles.length > 1000 &&
          apiProfiles.some((profile) => String(profile.id || '').startsWith('apify-'));
        if (isBulkApifyImport) {
          const start = (currentPage - 1) * PROFILES_PER_PAGE;
          setProfiles(apiProfiles.slice(start, start + PROFILES_PER_PAGE));
          setTotalProfileCount(apiProfiles.length);
          return;
        }
      }

      const localProfiles = await loadLocalFallbackProfiles(debouncedSearchTerm, filters);
      const start = (currentPage - 1) * PROFILES_PER_PAGE;
      setProfiles(localProfiles.slice(start, start + PROFILES_PER_PAGE));
      setTotalProfileCount(localProfiles.length);
    } catch (error) {
      console.error('Failed to load profiles:', error);
      const localProfiles = await loadLocalFallbackProfiles(debouncedSearchTerm, filters).catch(
        () => [],
      );
      const start = (currentPage - 1) * PROFILES_PER_PAGE;
      setProfiles(localProfiles.slice(start, start + PROFILES_PER_PAGE));
      setTotalProfileCount(localProfiles.length);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearchTerm, filters]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    const snapshot = normalizeFilterSnapshot({
      searchTerm,
      filters,
      currentPage,
    });
    lastDirectoryStateSnapshot = snapshot;

    try {
      window.localStorage.setItem(PROFILE_DIRECTORY_STATE_KEY, JSON.stringify(snapshot));
    } catch {
      // Local storage can be unavailable in some browser modes.
    }

    if (location.pathname === '/profiles') {
      const nextParams = buildDirectorySearchParams(snapshot);
      const nextSearch = nextParams.toString();
      const currentSearch = window.location.search.replace(/^\?/, '');
      if (nextSearch !== currentSearch) {
        navigate(
          {
            pathname: location.pathname,
            search: nextSearch ? `?${nextSearch}` : '',
          },
          { replace: true },
        );
      }
    }
  }, [currentPage, filters, location.pathname, navigate, searchTerm]);

  // Handlers
  const toggleSave = (id: string) => {
    setSavedProfiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFollow = (id: string) => {
    setFollowedProfiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const toggleRole = (role: string) => {
    setFilters((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  const toggleCity = (city: string) => {
    setFilters((prev) => ({
      ...prev,
      city: prev.city === city ? '' : city,
    }));
  };

  const toggleAvailability = (availability: string) => {
    setFilters((prev) => ({
      ...prev,
      availability: prev.availability === availability ? '' : availability,
    }));
  };

  const clearFilters = () => {
    setFilters({ search: '', roles: [], city: '', availability: '' });
  };

  const hasActiveFilters =
    filters.roles.length > 0 || filters.city !== '' || filters.availability !== '';
  const PROFILES_PER_PAGE = 12;
  const totalProfiles = totalProfileCount || profiles.length;
  const totalPages = Math.max(1, Math.ceil(totalProfiles / PROFILES_PER_PAGE));
  const paginatedProfiles = profiles;

  useEffect(() => {
    if (!didRestoreDirectoryState.current) {
      didRestoreDirectoryState.current = true;
      return;
    }
    setCurrentPage(1);
  }, [debouncedSearchTerm, filters.roles, filters.city, filters.availability]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const mainNavLinks = [
    { label: 'Street Profile', to: '/profiles' },
    { label: 'Street Gallery', to: '/gallery' },
    { label: 'Academy', to: '/academy' },
    { label: 'Job Board', to: '/jobs' },
    { label: 'Directory', to: '/directory' },
    { label: 'News', to: '/news' },
  ];

  const streetProfileSearchBar = (
    <form
      role="search"
      aria-label="Search Street Profiles"
      onSubmit={(event) => {
        event.preventDefault();
        loadProfiles();
      }}
      style={{
        width: '100%',
        height: 41,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '4px 4px 4px 14px',
        borderRadius: 999,
        border: isDark ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(17,24,39,0.12)',
        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)',
        boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.16)' : '0 8px 20px rgba(17,24,39,0.08)',
        backdropFilter: 'blur(18px) saturate(160%)',
        WebkitBackdropFilter: 'blur(18px) saturate(160%)',
        transform: 'translateY(-1px)',
      }}
    >
      <Search size={17} color={isDark ? 'rgba(230,231,242,0.64)' : 'rgba(31,41,55,0.56)'} />
      <label
        htmlFor="street-profile-search"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          borderWidth: 0,
        }}
      >
        Search Street Profiles
      </label>
      <input
        id="street-profile-search"
        type="search"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search by name, role, or skill..."
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: isDark ? '#fff' : '#111827',
          fontFamily: 'Rubik, sans-serif',
          fontSize: 14,
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
  );

  const formatFollowers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <GlassBackground />
      <style>{`
        @media (max-width: 1079px) {
          .sv-feature-top-nav-shell { padding: 58px 14px 10px !important; }
          .sv-feature-top-nav {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
            overflow: hidden !important;
          }
          .sv-feature-top-nav-links {
            flex: 1 1 100% !important;
            min-width: 0 !important;
            overflow-x: auto !important;
            padding-bottom: 2px !important;
          }
          .sv-feature-top-nav-search {
            flex: 1 1 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
          }
          .sv-feature-top-nav-spacer { height: 166px !important; }
        }
      `}</style>

      <div
        className="sv-feature-top-nav-shell"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          ...getSeamlessNavBarStyle(isDark, isTopNavScrolled),
          padding: isCompactNav ? '58px 14px 10px' : '8px clamp(160px, 16.45vw, 220px)',
          boxSizing: 'border-box',
        }}
      >
        <nav
          className="sv-feature-top-nav"
          aria-label="Street Profile main navigation"
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: isCompactNav ? 8 : 4,
            height: isCompactNav ? 'auto' : 48,
            whiteSpace: 'nowrap',
            maxWidth: '859px',
            width: isCompactNav ? '100%' : 'min(859px, calc(100vw - 320px))',
            margin: '0 auto',
            flexWrap: isCompactNav ? 'wrap' : 'nowrap',
            overflow: isCompactNav ? 'hidden' : undefined,
          }}
        >
          <div
            className="sv-feature-top-nav-links"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 4,
              flex: isCompactNav ? '1 1 100%' : undefined,
              flexShrink: 0,
              minWidth: 0,
              overflowX: isCompactNav ? 'auto' : undefined,
              paddingBottom: isCompactNav ? 2 : 0,
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
                    fontSize: '14px',
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
          <div
            className="sv-feature-top-nav-search"
            style={{
              flex: isCompactNav ? '1 1 100%' : '0 0 clamp(260px, calc(50vw - 386px), 372px)',
              minWidth: isCompactNav ? 0 : 260,
              maxWidth: isCompactNav ? '100%' : 372,
            }}
          >
            {streetProfileSearchBar}
          </div>
        </nav>
      </div>
      <div
        className="sv-feature-top-nav-spacer"
        aria-hidden="true"
        style={{ height: isCompactNav ? '166px' : '64px' }}
      />

      {/* Main Content */}
      <div style={{ margin: '0 auto', padding: '0' }}>
        {/* Header Row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            maxWidth: '1600px',
            width: '100%',
            margin: '0 auto 8px',
            padding: isMobile ? '0 16px' : '0 20px',
            boxSizing: 'border-box',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <p style={{ fontSize: '1rem', color: colors.textSecondary }}>
              <span style={{ fontWeight: 600, color: colors.text }}>{totalProfiles}</span>{' '}
              profiles
            </p>

            {/* Filter Toggle - Desktop */}
            <button
              onClick={() =>
                isMobile
                  ? setIsMobileFilterOpen(!isMobileFilterOpen)
                  : setIsFilterOpen(!isFilterOpen)
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: colors.surface,
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: `1px solid ${colors.border}`,
                borderRadius: '14px',
                boxShadow: colors.glassShadow,
                fontSize: '14px',
                fontWeight: 500,
                color: colors.text,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Filter size={16} />
              {isMobile ? 'Filters' : isFilterOpen ? 'Hide Filters' : 'Show Filters'}
              {hasActiveFilters && (
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: colors.accent,
                    color: '#000',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {filters.roles.length + (filters.city ? 1 : 0) + (filters.availability ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          {/* View Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: colors.surface,
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              padding: '5px',
              borderRadius: '16px',
              border: `1px solid ${colors.border}`,
              boxShadow: colors.glassShadow,
            }}
          >
            <button
              onClick={() => setIsGridView(true)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: isGridView ? colors.accent : 'transparent',
                color: isGridView ? '#000' : colors.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Grid3X3 size={16} />
            </button>
            <button
              onClick={() => setIsGridView(false)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: !isGridView ? colors.accent : 'transparent',
                color: !isGridView ? '#000' : colors.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <LayoutList size={16} />
            </button>
          </div>
        </div>

        {/* Main Layout */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            minHeight: 'calc(100vh - 130px)',
            maxWidth: '1600px',
            margin: '0 auto',
            width: '100%',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Filter Sidebar - TRUE GLASSMORPHISM */}
          {(!isMobile || isMobileFilterOpen) && (
            <>
              {/* Mobile overlay backdrop */}
              {isMobile && (
                <div
                  onClick={() => setIsMobileFilterOpen(false)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 998,
                  }}
                />
              )}
              <aside
                style={{
                  ...(isMobile
                    ? {
                        position: 'fixed' as const,
                        top: 0,
                        right: 0,
                        bottom: 0,
                        width: '300px',
                        maxWidth: '85vw',
                        zIndex: 999,
                        overflowY: 'auto' as const,
                        borderRadius: '24px 0 0 24px',
                      }
                    : {
                        width: isFilterOpen ? '280px' : '0',
                        flexShrink: 0,
                        height: 'fit-content',
                        position: 'sticky' as const,
                        top: '24px',
                        borderRadius: '24px',
                        overflow: 'hidden' as const,
                        opacity: isFilterOpen ? 1 : 0,
                        transition: 'width 0.3s, opacity 0.3s',
                      }),
                  background: colors.surface,
                  backdropFilter: 'blur(24px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                  border: !isMobile && !isFilterOpen ? 'none' : `1px solid ${colors.border}`,
                  boxShadow: !isMobile && !isFilterOpen ? 'none' : colors.glassShadow,
                }}
              >
                <div style={{ padding: '20px', borderBottom: `1px solid ${colors.border}` }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <h3
                      style={{ fontSize: '1rem', fontWeight: 600, color: colors.text, margin: 0 }}
                    >
                      Filters
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {hasActiveFilters && (
                        <button
                          onClick={clearFilters}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: colors.accentText,
                            fontSize: '13px',
                            cursor: 'pointer',
                          }}
                        >
                          Clear all
                        </button>
                      )}
                      {isMobile && (
                        <button
                          onClick={() => setIsMobileFilterOpen(false)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <X size={18} color={colors.textSecondary} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  style={{ padding: '20px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}
                >
                  {/* Roles */}
                  <div style={{ marginBottom: '24px' }}>
                    <button
                      onClick={() => toggleSection('roles')}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        padding: '8px 0',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: '14px', fontWeight: 600, color: colors.text }}>
                        Creative Role
                        {filters.roles.length > 0 && (
                          <span
                            style={{
                              marginLeft: '8px',
                              padding: '2px 8px',
                              background: `rgba(255, 214, 0, 0.2)`,
                              borderRadius: '10px',
                              fontSize: '12px',
                              color: colors.accentText,
                            }}
                          >
                            {filters.roles.length}
                          </span>
                        )}
                      </span>
                      <ChevronDown
                        size={16}
                        color={colors.textSecondary}
                        style={{
                          transform: expandedSections.has('roles')
                            ? 'rotate(180deg)'
                            : 'rotate(0deg)',
                          transition: 'transform 0.2s',
                        }}
                      />
                    </button>
                    {expandedSections.has('roles') && (
                      <div
                        style={{
                          marginTop: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        {Object.entries(ROLE_CATEGORIES).map(([category, roles]) => (
                          <div key={category}>
                            <button
                              onClick={() => toggleSection(`role-${category}`)}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                width: '100%',
                                padding: '6px 10px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  color: colors.textSecondary,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                }}
                              >
                                {category}
                                {roles.filter((r) => filters.roles.includes(r)).length > 0 && (
                                  <span
                                    style={{
                                      marginLeft: '6px',
                                      padding: '1px 6px',
                                      background: 'rgba(255, 214, 0, 0.2)',
                                      borderRadius: '8px',
                                      fontSize: '11px',
                                      color: colors.accentText,
                                    }}
                                  >
                                    {roles.filter((r) => filters.roles.includes(r)).length}
                                  </span>
                                )}
                              </span>
                              <ChevronDown
                                size={14}
                                color={colors.textMuted}
                                style={{
                                  transform: expandedSections.has(`role-${category}`)
                                    ? 'rotate(180deg)'
                                    : 'rotate(0deg)',
                                  transition: 'transform 0.2s',
                                }}
                              />
                            </button>
                            {expandedSections.has(`role-${category}`) && (
                              <div
                                style={{
                                  marginTop: '4px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                  paddingLeft: '4px',
                                }}
                              >
                                {roles.map((role) => (
                                  <label
                                    key={role}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '10px',
                                      cursor: 'pointer',
                                      padding: '6px 10px',
                                      borderRadius: '8px',
                                      background: filters.roles.includes(role)
                                        ? 'rgba(255, 214, 0, 0.1)'
                                        : 'transparent',
                                      transition: 'background 0.2s',
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={filters.roles.includes(role)}
                                      onChange={() => toggleRole(role)}
                                      style={{ accentColor: colors.accent, width: 16, height: 16 }}
                                    />
                                    <span style={{ fontSize: '14px', color: colors.text }}>
                                      {role}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* City */}
                  <div style={{ marginBottom: '24px' }}>
                    <button
                      onClick={() => toggleSection('city')}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        padding: '8px 0',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: '14px', fontWeight: 600, color: colors.text }}>
                        Location
                      </span>
                      <ChevronDown
                        size={16}
                        color={colors.textSecondary}
                        style={{
                          transform: expandedSections.has('city')
                            ? 'rotate(180deg)'
                            : 'rotate(0deg)',
                          transition: 'transform 0.2s',
                        }}
                      />
                    </button>
                    {expandedSections.has('city') && (
                      <div
                        style={{
                          marginTop: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        {CITY_OPTIONS.map((city) => (
                          <label
                            key={city}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              cursor: 'pointer',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              background:
                                filters.city === city ? `rgba(255, 214, 0, 0.1)` : 'transparent',
                            }}
                          >
                            <input
                              type="checkbox"
                              name="city"
                              checked={filters.city === city}
                              onChange={() => toggleCity(city)}
                              style={{ accentColor: colors.accent, width: 16, height: 16 }}
                            />
                            <span style={{ fontSize: '14px', color: colors.text }}>{city}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Availability */}
                  <div>
                    <button
                      onClick={() => toggleSection('availability')}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        padding: '8px 0',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: '14px', fontWeight: 600, color: colors.text }}>
                        Availability
                      </span>
                      <ChevronDown
                        size={16}
                        color={colors.textSecondary}
                        style={{
                          transform: expandedSections.has('availability')
                            ? 'rotate(180deg)'
                            : 'rotate(0deg)',
                          transition: 'transform 0.2s',
                        }}
                      />
                    </button>
                    {expandedSections.has('availability') && (
                      <div
                        style={{
                          marginTop: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        {AVAILABILITY_OPTIONS.map((opt) => (
                          <label
                            key={opt.value}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              cursor: 'pointer',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              background:
                                filters.availability === opt.value
                                  ? `rgba(255, 214, 0, 0.1)`
                                  : 'transparent',
                            }}
                          >
                            <input
                              type="checkbox"
                              name="availability"
                              checked={filters.availability === opt.value}
                              onChange={() => toggleAvailability(opt.value)}
                              style={{ accentColor: colors.accent, width: 16, height: 16 }}
                            />
                            <span style={{ fontSize: '14px', color: colors.text }}>
                              {opt.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            </>
          )}

          {/* Profile Grid/List */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              padding: isMobile ? '0' : '20px',
              transition: 'padding 0.3s ease',
            }}
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: colors.textSecondary }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    border: `3px solid ${colors.border}`,
                    borderTopColor: colors.accent,
                    borderRadius: '50%',
                    margin: '0 auto 16px',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                Loading profiles...
              </div>
            ) : profiles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <Users size={56} color={colors.textMuted} style={{ marginBottom: '16px' }} />
                <h3
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: colors.text,
                    marginBottom: '8px',
                  }}
                >
                  No profiles found
                </h3>
                <p style={{ color: colors.textSecondary, marginBottom: '16px' }}>
                  Try adjusting your filters or search terms
                </p>
                <button
                  onClick={() => {
                    setShowCreateModal(true);
                    setCreateStep(1);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    borderRadius: '999px',
                    background: colors.accent,
                    color: '#000',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  Be the first — Create Your Street Profile
                </button>
              </div>
            ) : isGridView ? (
              // Grid View
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile
                    ? '1fr'
                    : isFilterOpen
                      ? 'repeat(auto-fill, minmax(360px, 1fr))'
                      : 'repeat(auto-fill, minmax(340px, 1fr))',
                  gap: isMobile ? '16px' : '24px',
                }}
              >
                {paginatedProfiles.map((profile) => {
                  const avatarUrl = getStreetProfileAvatarUrl(profile);
                  const isInstagramAvatar = profile.avatar_quality?.startsWith('instagram') ?? false;
                  const avatarFrameSize = isInstagramAvatar ? (isMobile ? 118 : 138) : isMobile ? 144 : 168;

                  return (
                    <div
                      key={profile.id}
                      onClick={() => navigate(`/profiles/${profile.username}`)}
                      style={{
                        background: colors.cardBg,
                        backdropFilter: 'blur(24px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                        borderRadius: '24px',
                        border: `1px solid ${colors.border}`,
                        boxShadow: colors.glassShadow,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        height: '450px',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = colors.borderHover;
                        e.currentTarget.style.transform = 'translateY(-8px)';
                        e.currentTarget.style.background = colors.surfaceHover;
                        e.currentTarget.style.boxShadow = isDark
                          ? '0 20px 40px rgba(0,0,0,0.4), 0 0 20px rgba(139, 92, 246, 0.15)'
                          : '0 20px 40px rgba(31, 38, 135, 0.2)';
                        const overlay =
                          e.currentTarget.querySelector<HTMLDivElement>('.sv-hover-overlay');
                        if (overlay) {
                          overlay.style.opacity = '1';
                          overlay.style.transform = 'translateY(0)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = colors.border;
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.background = colors.cardBg;
                        e.currentTarget.style.boxShadow = colors.glassShadow;
                        const overlay =
                          e.currentTarget.querySelector<HTMLDivElement>('.sv-hover-overlay');
                        if (overlay) {
                          overlay.style.opacity = '0';
                          overlay.style.transform = 'translateY(12px)';
                        }
                      }}
                    >
                      {/* Top Half: Profile image/logo */}
                      <div
                        style={{
                          height: '50%',
                          position: 'relative',
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isDark
                            ? 'radial-gradient(circle at center, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 58%, rgba(255,255,255,0.015) 100%)'
                            : 'radial-gradient(circle at center, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.025) 58%, rgba(0,0,0,0.01) 100%)',
                        }}
                      >
                        {avatarUrl ? (
                          <div
                            style={{
                              width: avatarFrameSize,
                              height: avatarFrameSize,
                              maxWidth: '58%',
                              maxHeight: '78%',
                              borderRadius: '50%',
                              overflow: 'hidden',
                              background: colors.cardBg,
                              border: `1px solid ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)'}`,
                              boxShadow: isDark
                                ? '0 18px 42px rgba(0,0,0,0.35)'
                                : '0 18px 42px rgba(31,38,135,0.16)',
                              padding: 0,
                            }}
                          >
                            <img
                              src={avatarUrl}
                              alt={profile.display_name}
                              loading="lazy"
                              decoding="async"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block',
                                borderRadius: '50%',
                              }}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: avatarFrameSize,
                              height: avatarFrameSize,
                              maxWidth: '58%',
                              maxHeight: '78%',
                              borderRadius: '50%',
                              background: `linear-gradient(135deg, ${colors.accent} 0%, #ff8800 100%)`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '64px',
                              fontWeight: 800,
                              color: 'rgba(0,0,0,0.1)',
                              boxShadow: isDark
                                ? '0 18px 42px rgba(0,0,0,0.35)'
                                : '0 18px 42px rgba(31,38,135,0.16)',
                            }}
                          >
                            {profile.display_name.charAt(0)}
                          </div>
                        )}

                        {/* Save Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSave(profile.id);
                          }}
                          style={{
                            position: 'absolute',
                            top: '16px',
                            right: '16px',
                            zIndex: 10,
                            padding: '8px',
                            borderRadius: '10px',
                            background: 'rgba(0, 0, 0, 0.4)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            cursor: 'pointer',
                            backdropFilter: 'blur(8px)',
                            color: '#fff',
                          }}
                        >
                          {savedProfiles.has(profile.id) ? (
                            <BookmarkCheck size={18} color={colors.accent} fill={colors.accent} />
                          ) : (
                            <Bookmark size={18} color="#fff" />
                          )}
                        </button>

                        {/* Featured Badge */}
                        {profile.is_featured && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '16px',
                              left: '16px',
                              zIndex: 10,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              background: colors.accent,
                              fontSize: '12px',
                              fontWeight: 700,
                              color: '#000',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            }}
                          >
                            <Sparkles size={14} />
                            Featured
                          </div>
                        )}
                      </div>

                      {/* Bottom Half: Info */}
                      <div
                        style={{
                          height: '50%',
                          padding: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          background: colors.cardBg,
                        }}
                      >
                        <div>
                          {/* Name & Verified */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '4px',
                            }}
                          >
                            <h3
                              style={{
                                fontSize: '1.25rem',
                                fontWeight: 700,
                                color: colors.text,
                                margin: 0,
                              }}
                            >
                              {profile.display_name}
                            </h3>
                            {profile.is_verified && (
                              <CheckCircle2 size={18} color={colors.accent} fill={colors.accent} />
                            )}
                          </div>

                          {/* Username */}
                          <a
                            href={getPrimarySocialProfileUrl(profile)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            onMouseEnter={(event) => {
                              event.currentTarget.style.color = colors.accent;
                            }}
                            onMouseLeave={(event) => {
                              event.currentTarget.style.color = colors.textSecondary;
                            }}
                            style={{
                              display: 'inline-block',
                              fontSize: '14px',
                              color: colors.textSecondary,
                              marginBottom: '12px',
                              textDecoration: 'none',
                              transition: 'color 0.18s ease',
                            }}
                          >
                            @{profile.username}
                          </a>

                          {/* Roles */}
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '6px',
                              marginBottom: '10px',
                            }}
                          >
                            {profile.primary_roles.slice(0, 3).map((role) => (
                              <span
                                key={role}
                                style={{
                                  fontSize: '12px',
                                  padding: '4px 10px',
                                  borderRadius: '100px',
                                  background: isDark
                                    ? 'rgba(255, 255, 255, 0.08)'
                                    : 'rgba(0, 0, 0, 0.05)',
                                  backdropFilter: 'blur(8px)',
                                  WebkitBackdropFilter: 'blur(8px)',
                                  color: colors.textSecondary,
                                  fontWeight: 500,
                                  border: `1px solid ${colors.border}`,
                                }}
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Footer Stats */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingTop: '16px',
                            borderTop: `1px solid ${colors.border}`,
                          }}
                        >
                          {profile.location_display ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '13px',
                                color: colors.textSecondary,
                              }}
                            >
                              <MapPin size={14} />
                              {profile.location_display}
                            </div>
                          ) : (
                            <div /> /* Spacer if no location */
                          )}

                          <div style={{ display: 'flex', gap: '16px' }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '13px',
                                color: colors.textSecondary,
                              }}
                            >
                              <Users size={14} />
                              {formatFollowers(profile.followers_count)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Hover Overlay — quick action CTAs */}
                      <div
                        className="sv-hover-overlay"
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          bottom: 0,
                          padding: '16px',
                          background: isDark
                            ? 'linear-gradient(to top, rgba(10,10,20,0.96) 0%, rgba(10,10,20,0.9) 70%, rgba(10,10,20,0) 100%)'
                            : 'linear-gradient(to top, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 70%, rgba(255,255,255,0) 100%)',
                          backdropFilter: 'blur(12px)',
                          WebkitBackdropFilter: 'blur(12px)',
                          borderBottomLeftRadius: '24px',
                          borderBottomRightRadius: '24px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          opacity: 0,
                          transform: 'translateY(12px)',
                          transition: 'opacity 0.25s ease-out, transform 0.25s ease-out',
                          pointerEvents: 'auto',
                        }}
                      >
                        {/* CTA Buttons */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFollow(profile.id);
                            }}
                            style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              padding: '10px 14px',
                              borderRadius: '10px',
                              border: `1px solid ${colors.border}`,
                              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                              color: colors.text,
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = isDark
                                ? 'rgba(255,255,255,0.12)'
                                : 'rgba(0,0,0,0.08)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = isDark
                                ? 'rgba(255,255,255,0.06)'
                                : 'rgba(0,0,0,0.04)';
                            }}
                          >
                            {followedProfiles.has(profile.id) ? (
                              <>
                                <CheckCircle2 size={14} /> Following
                              </>
                            ) : (
                              <>
                                <UserPlus size={14} /> Follow
                              </>
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/profiles/${profile.username}`);
                            }}
                            style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              padding: '10px 14px',
                              borderRadius: '10px',
                              border: 'none',
                              background: '#eab308',
                              color: '#000',
                              fontSize: '13px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#facc15';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#eab308';
                            }}
                          >
                            View Profile <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // List View
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {paginatedProfiles.map((profile) => {
                  const avatarUrl = getStreetProfileAvatarUrl(profile);

                  return (
                    <div
                      key={profile.id}
                      onClick={() => navigate(`/profiles/${profile.username}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px',
                        background: colors.cardBg,
                        backdropFilter: 'blur(24px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                        borderRadius: '24px',
                        border: `1px solid ${colors.border}`,
                        boxShadow: colors.glassShadow,
                        padding: '20px',
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = colors.borderHover;
                        e.currentTarget.style.background = colors.surfaceHover;
                        e.currentTarget.style.transform = 'translateX(8px)';
                        e.currentTarget.style.boxShadow = isDark
                          ? '0 16px 32px rgba(0,0,0,0.35), 0 0 16px rgba(139, 92, 246, 0.1)'
                          : '0 16px 32px rgba(31, 38, 135, 0.18)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = colors.border;
                        e.currentTarget.style.background = colors.cardBg;
                        e.currentTarget.style.transform = 'translateX(0)';
                        e.currentTarget.style.boxShadow = colors.glassShadow;
                      }}
                    >
                      {/* Avatar */}
                      {avatarUrl ? (
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            flexShrink: 0,
                            position: 'relative',
                          }}
                        >
                          <img
                            src={avatarUrl}
                            alt={profile.display_name}
                            loading="lazy"
                            decoding="async"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, ${colors.accent} 0%, #ff8800 100%)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '24px',
                            fontWeight: 700,
                            color: '#000',
                            flexShrink: 0,
                          }}
                        >
                          {profile.display_name.charAt(0)}
                        </div>
                      )}

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '4px',
                          }}
                        >
                          <h3
                            style={{
                              fontSize: '1rem',
                              fontWeight: 600,
                              color: colors.text,
                              margin: 0,
                            }}
                          >
                            {profile.display_name}
                          </h3>
                          {profile.is_verified && (
                            <CheckCircle2 size={16} color={colors.accent} fill={colors.accent} />
                          )}
                          {profile.is_featured && (
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: `rgba(255, 214, 0, 0.2)`,
                                fontSize: '11px',
                                fontWeight: 600,
                                color: colors.accentText,
                              }}
                            >
                              <Sparkles size={10} />
                              Featured
                            </span>
                          )}
                        </div>
                        <p
                          style={{
                            fontSize: '13px',
                            color: colors.textSecondary,
                            marginBottom: '8px',
                          }}
                        >
                          <a
                            href={getPrimarySocialProfileUrl(profile)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            onMouseEnter={(event) => {
                              event.currentTarget.style.color = colors.accent;
                            }}
                            onMouseLeave={(event) => {
                              event.currentTarget.style.color = colors.textSecondary;
                            }}
                            style={{
                              color: colors.textSecondary,
                              textDecoration: 'none',
                              transition: 'color 0.18s ease',
                            }}
                          >
                            @{profile.username}
                          </a>{' '}
                          {profile.location_display && `· ${profile.location_display}`}
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {profile.primary_roles.map((role) => (
                            <span
                              key={role}
                              style={{
                                fontSize: '12px',
                                padding: '3px 10px',
                                borderRadius: '8px',
                                background: isDark
                                  ? 'rgba(255, 255, 255, 0.08)'
                                  : 'rgba(0, 0, 0, 0.05)',
                                backdropFilter: 'blur(8px)',
                                WebkitBackdropFilter: 'blur(8px)',
                                color: colors.textSecondary,
                                border: `1px solid ${colors.border}`,
                              }}
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Right Side */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          flexShrink: 0,
                        }}
                      >
                        {profile.availability_status === 'open' && (
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              background: `rgba(34, 197, 94, 0.1)`,
                              fontSize: '13px',
                              color: colors.success,
                              fontWeight: 500,
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: colors.success,
                              }}
                            />
                            Available
                          </span>
                        )}

                        <div style={{ fontSize: '13px', color: colors.textMuted }}>
                          {formatFollowers(profile.followers_count)} followers
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSave(profile.id);
                          }}
                          style={{
                            padding: '8px',
                            borderRadius: '8px',
                            background: 'transparent',
                            border: `1px solid ${colors.border}`,
                            cursor: 'pointer',
                          }}
                        >
                          {savedProfiles.has(profile.id) ? (
                            <BookmarkCheck size={18} color={colors.accent} fill={colors.accent} />
                          ) : (
                            <Bookmark size={18} color={colors.textSecondary} />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {totalProfiles > PROFILES_PER_PAGE && (
              <StreetPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                colors={colors}
              />
            )}
          </div>
        </div>
      </div>

      {/* Create Street Profile Modal */}
      {showCreateModal && (
        <div
          onClick={() => setShowCreateModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10001,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? 'rgba(20,20,30,0.98)' : '#fff',
              borderRadius: '20px',
              padding: '32px',
              width: '100%',
              maxWidth: '540px',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: `1px solid ${colors.border}`,
              boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '8px',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '100px',
                    background: 'rgba(255,215,0,0.15)',
                    color: '#FFD700',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    marginBottom: '10px',
                  }}
                >
                  <Sparkles size={12} /> Step {createStep} of 3
                </div>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: colors.text }}>
                  {createStep === 1
                    ? 'Create your Street Profile'
                    : createStep === 2
                      ? 'Tell us about you'
                      : 'Almost done!'}
                </h2>
                <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: colors.textSecondary }}>
                  {createStep === 1
                    ? 'Your public identity on Street Voices.'
                    : createStep === 2
                      ? 'Add a few details so people can find you.'
                      : 'Add a photo and a short bio — you can change all of this later.'}
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Progress dots */}
            <div style={{ display: 'flex', gap: '6px', margin: '18px 0 22px' }}>
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  style={{
                    flex: 1,
                    height: '4px',
                    borderRadius: '100px',
                    background:
                      s <= createStep
                        ? '#FFD700'
                        : isDark
                          ? 'rgba(255,255,255,0.1)'
                          : 'rgba(0,0,0,0.08)',
                    transition: 'background 0.2s',
                  }}
                />
              ))}
            </div>

            {/* Step 1: Display name + username */}
            {createStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: colors.text,
                      marginBottom: '6px',
                      display: 'block',
                    }}
                  >
                    Display name *
                  </label>
                  <input
                    autoFocus
                    value={createForm.display_name}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        display_name: e.target.value,
                        username:
                          createForm.username ||
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9_]/g, '')
                            .slice(0, 20),
                      })
                    }
                    placeholder="e.g. Jane Doe or Ghost"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${colors.border}`,
                      color: colors.text,
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: colors.text,
                      marginBottom: '6px',
                      display: 'block',
                    }}
                  >
                    Username *
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '10px',
                      padding: '0 14px',
                    }}
                  >
                    <span style={{ color: colors.textSecondary, fontSize: '14px' }}>@</span>
                    <input
                      value={createForm.username}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          username: e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9_]/g, '')
                            .slice(0, 30),
                        })
                      }
                      placeholder="your_handle"
                      style={{
                        width: '100%',
                        padding: '12px 0',
                        background: 'transparent',
                        border: 'none',
                        color: colors.text,
                        fontSize: '14px',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '6px' }}>
                    This is your profile URL: /profiles/{createForm.username || 'your_handle'}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Role + City */}
            {createStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: colors.text,
                      marginBottom: '6px',
                      display: 'block',
                    }}
                  >
                    What do you do? *
                  </label>
                  <input
                    autoFocus
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    placeholder="e.g. Photographer, Muralist, Music Producer"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${colors.border}`,
                      color: colors.text,
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                    {[
                      'Photographer',
                      'Visual Artist',
                      'Muralist',
                      'Music Producer',
                      'Designer',
                      'Videographer',
                      'Writer',
                      'Filmmaker',
                    ].map((r) => (
                      <button
                        key={r}
                        onClick={() => setCreateForm({ ...createForm, role: r })}
                        style={{
                          fontSize: '12px',
                          padding: '5px 12px',
                          borderRadius: '100px',
                          background:
                            createForm.role === r
                              ? '#FFD700'
                              : isDark
                                ? 'rgba(255,255,255,0.06)'
                                : 'rgba(0,0,0,0.04)',
                          color: createForm.role === r ? '#000' : colors.textSecondary,
                          border: `1px solid ${createForm.role === r ? '#FFD700' : colors.border}`,
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: colors.text,
                      marginBottom: '6px',
                      display: 'block',
                    }}
                  >
                    Location
                  </label>
                  <input
                    value={createForm.city}
                    onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                    placeholder="e.g. Toronto, Canada"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${colors.border}`,
                      color: colors.text,
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Avatar + Bio */}
            {createStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: colors.text,
                      marginBottom: '8px',
                      display: 'block',
                    }}
                  >
                    Profile photo
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        border: `2px dashed ${colors.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {createForm.avatar ? (
                        <img
                          src={createForm.avatar}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <Users size={26} color={colors.textSecondary} />
                      )}
                    </div>
                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        border: `1px solid ${colors.border}`,
                        color: colors.text,
                        fontSize: '13px',
                        fontWeight: 600,
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onloadend = () =>
                            setCreateForm({ ...createForm, avatar: reader.result as string });
                          reader.readAsDataURL(file);
                        }}
                      />
                      Upload photo
                    </label>
                  </div>
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: colors.text,
                      marginBottom: '6px',
                      display: 'block',
                    }}
                  >
                    Short bio
                  </label>
                  <textarea
                    value={createForm.bio}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, bio: e.target.value.slice(0, 280) })
                    }
                    placeholder="Tell people who you are and what you create..."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${colors.border}`,
                      color: colors.text,
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      lineHeight: 1.5,
                      resize: 'vertical',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '11px',
                      color: colors.textSecondary,
                      marginTop: '4px',
                      textAlign: 'right',
                    }}
                  >
                    {createForm.bio.length}/280
                  </div>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '24px',
                gap: '10px',
              }}
            >
              {createStep > 1 ? (
                <button
                  onClick={() => setCreateStep(createStep - 1)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    background: 'transparent',
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
              ) : (
                <div />
              )}
              {createStep < 3 ? (
                <button
                  onClick={() => setCreateStep(createStep + 1)}
                  disabled={
                    (createStep === 1 &&
                      (!createForm.display_name.trim() || !createForm.username.trim())) ||
                    (createStep === 2 && !createForm.role.trim())
                  }
                  style={{
                    padding: '10px 22px',
                    borderRadius: '10px',
                    border: 'none',
                    background:
                      (createStep === 1 &&
                        (!createForm.display_name.trim() || !createForm.username.trim())) ||
                      (createStep === 2 && !createForm.role.trim())
                        ? isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.08)'
                        : '#FFD700',
                    color:
                      (createStep === 1 &&
                        (!createForm.display_name.trim() || !createForm.username.trim())) ||
                      (createStep === 2 && !createForm.role.trim())
                        ? colors.textSecondary
                        : '#000',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor:
                      (createStep === 1 &&
                        (!createForm.display_name.trim() || !createForm.username.trim())) ||
                      (createStep === 2 && !createForm.role.trim())
                        ? 'not-allowed'
                        : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  Next <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  disabled={createSubmitting}
                  onClick={async () => {
                    setCreateSubmitting(true);
                    try {
                      // Save draft to localStorage so the Street Profile page can pick it up
                      localStorage.setItem(
                        'sv_new_profile_draft',
                        JSON.stringify({
                          ...createForm,
                          created_at: new Date().toISOString(),
                        }),
                      );
                    } catch {}

                    if (!user?.id) {
                      setCreateSubmitting(false);
                      navigate('/register');
                      return;
                    }

                    const city = createForm.city.trim();
                    const displayName =
                      createForm.display_name.trim() || user.name || 'Street User';

                    await ensureStreetProfileForUser({
                      userId: user.id,
                      user,
                      overwrite: true,
                      profile: {
                        display_name: displayName,
                        username: createForm.username.trim(),
                        primary_roles: [createForm.role.trim() || 'Creative'],
                        bio:
                          createForm.bio.trim() ||
                          `${displayName} is building their Street Voices profile.`,
                        tagline:
                          createForm.bio.trim() || 'Connected through the Street Voices community.',
                        avatar_url: createForm.avatar || user.avatar || null,
                        city: city.split(',')[0]?.trim() || 'Toronto',
                        country: city.includes(',')
                          ? city.split(',').slice(1).join(',').trim()
                          : 'Canada',
                        location_display: city || 'Toronto, Canada',
                        contact_email: user.email || null,
                        is_public: true,
                        show_in_directory: true,
                        open_to_messages: true,
                      },
                    });

                    setCreateSubmitting(false);
                    setShowCreateModal(false);
                    navigate('/myprofile');
                  }}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#FFD700',
                    color: '#000',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {createSubmitting ? (
                    'Creating...'
                  ) : (
                    <>
                      Create Profile <Sparkles size={14} />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
