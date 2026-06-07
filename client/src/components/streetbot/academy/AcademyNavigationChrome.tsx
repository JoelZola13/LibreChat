import { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ThemeContext, isDark as checkDark } from '@librechat/client';
import { BookOpen, GraduationCap, LayoutDashboard, Search, Sparkles, Target } from 'lucide-react';
import { useAcademyNavScrolled } from './useAcademyNavScrolled';
import { getGlassNavBarStyle, getSeamlessNavBarStyle } from '../shared/glassNav';
import NavDropdown from '../shared/NavDropdown';
import {
  STREET_PROFILE_NAV_ITEMS,
  isStreetProfileNavActive,
} from '../shared/streetProfileNavItems';
import { useResponsive } from '../hooks/useResponsive';

export const ACADEMY_SIDEBAR_WIDTH = 0;
export const ACADEMY_TOP_NAV_HEIGHT = 64;
export const ACADEMY_DESKTOP_CONTENT_LEFT = 32;

function useAcademyBasePath() {
  const location = useLocation();
  return location.pathname.startsWith('/learning') ? '/learning' : '/academy';
}

function isPathActive(pathname: string, hash: string, href: string, basePath: string) {
  const [hrefPath, hrefHash] = href.split('#');
  const normalizedHrefPath = hrefPath.replace(/\/$/, '');
  const normalizedPath = pathname.replace(/\/$/, '');
  const normalizedHash = hash.replace(/^#/, '');
  const normalizedBasePath = basePath.replace(/\/$/, '');

  if (hrefHash) {
    return (
      normalizedPath === normalizedBasePath &&
      (normalizedHash === hrefHash || (hrefHash === 'programs' && normalizedHash === ''))
    );
  }

  if (normalizedHrefPath === normalizedBasePath) {
    return normalizedPath === normalizedBasePath && !normalizedHash;
  }

  return (
    normalizedPath === normalizedHrefPath || normalizedPath.startsWith(`${normalizedHrefPath}/`)
  );
}

export function AcademySidePanel() {
  const { theme } = useContext(ThemeContext);
  const dark = checkDark(theme);
  const location = useLocation();
  const basePath = useAcademyBasePath();
  const borderColor = dark ? 'rgba(255,255,255,0.14)' : 'rgba(17,24,39,0.10)';
  const textColor = dark ? '#f8fafc' : '#111827';
  const mutedColor = dark ? 'rgba(248,250,252,0.68)' : '#4b5563';
  const links = [
    { href: basePath, label: 'Academy', icon: Target },
    { href: `${basePath}/courses`, label: 'Courses', icon: BookOpen },
    { href: `${basePath}/student-workspace`, label: 'Student Workspace', icon: GraduationCap },
    { href: `${basePath}/instructor`, label: 'Instructor Workspace', icon: Sparkles },
    { href: `${basePath}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
  ];

  useEffect(() => {
    void Promise.all([
      import('./AcademyPage'),
      import('./AcademyCoursesPage'),
      import('./AcademyMyCoursesPage'),
      import('./AcademyInstructorPage'),
      import('./AcademyDashboardPage'),
    ]).catch(() => {
      // Navigation still works if a preloaded chunk is unavailable.
    });
  }, []);

  return (
    <aside
      aria-label="Academy navigation"
      style={{
        position: 'fixed',
        inset: '0 auto 0 0',
        zIndex: 80,
        width: ACADEMY_SIDEBAR_WIDTH,
        background: 'transparent',
        borderRight: `1px solid ${borderColor}`,
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        boxShadow: 'none',
      }}
    >
      <Link
        to="/home"
        aria-label="Street Voices home"
        title="Street Voices home"
        style={{
          display: 'flex',
          alignItems: 'center',
          height: ACADEMY_TOP_NAV_HEIGHT,
          padding: '0 24px',
          textDecoration: 'none',
        }}
      >
        <img
          src={dark ? '/assets/streetvoices-text.svg' : '/assets/streetvoices-text-dark.svg'}
          alt="Street Voices"
          style={{ height: 34, maxWidth: 150, display: 'block' }}
        />
      </Link>

      <nav style={{ padding: '18px 14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {links.map((item) => {
            const Icon = item.icon;
            const active = isPathActive(location.pathname, location.hash, item.href, basePath);

            return (
              <Link
                key={item.href}
                to={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 46,
                  padding: '11px 13px',
                  borderRadius: 14,
                  background: active ? '#FFD600' : 'transparent',
                  color: active ? '#080808' : mutedColor,
                  fontFamily: 'Rubik, sans-serif',
                  fontSize: 14,
                  fontWeight: 850,
                  letterSpacing: 0,
                  textDecoration: 'none',
                }}
              >
                <Icon size={17} strokeWidth={2.2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div
        style={{
          position: 'absolute',
          left: 24,
          right: 24,
          bottom: 24,
          color: textColor,
          fontFamily: 'Rubik, sans-serif',
          fontSize: 12,
          fontWeight: 700,
          opacity: 0.72,
        }}
      >
        Street Voices Academy
      </div>
    </aside>
  );
}

export function AcademyMainTopNav() {
  const { theme } = useContext(ThemeContext);
  const dark = checkDark(theme);
  const location = useLocation();
  const navigate = useNavigate();
  const isNavScrolled = useAcademyNavScrolled();
  const { width } = useResponsive();
  const basePath = useAcademyBasePath();
  const [academySearchQuery, setAcademySearchQuery] = useState('');
  const isCompactNav = width < 1080;
  const mainLinks = [
    { href: '/profiles', label: 'Street Profile' },
    { href: '/gallery', label: 'Street Gallery' },
    { href: basePath, label: 'Academy' },
    { href: '/jobs', label: 'Job Board' },
    { href: '/directory', label: 'Directory' },
    { href: '/news', label: 'News' },
  ];
  const navStyle = isNavScrolled ? getGlassNavBarStyle(dark) : getSeamlessNavBarStyle(dark, false);
  const handleAcademySearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = academySearchQuery.trim();
    navigate(
      query ? `${basePath}/courses?search=${encodeURIComponent(query)}` : `${basePath}/courses`,
    );
  };

  if (isCompactNav) {
    return null;
  }

  return (
    <>
      <style>{`
        @media (max-width: 1079px) {
          [data-academy-top-nav="true"] {
            display: none !important;
          }
        }
      `}</style>
      <nav
        data-academy-top-nav="true"
        aria-label="Street Voices navigation"
        style={{
          position: 'fixed',
          top: 0,
          left: ACADEMY_SIDEBAR_WIDTH,
          right: 0,
          zIndex: 50,
          height: ACADEMY_TOP_NAV_HEIGHT,
          ...navStyle,
          padding: '8px clamp(160px, 16.45vw, 220px)',
          boxSizing: 'border-box',
          transition:
            'background 0.2s ease, backdrop-filter 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        <div
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 4,
            maxWidth: '859px',
            width: 'min(859px, calc(100vw - 320px))',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 4,
              overflowX: 'auto',
              flexShrink: 0,
            }}
          >
            {mainLinks.map((item) => {
              const normalizedPath = location.pathname.replace(/\/$/, '');
              const normalizedBasePath = basePath.replace(/\/$/, '');
              const isActive =
                item.label === 'Street Profile'
                  ? isStreetProfileNavActive(location.pathname)
                  : item.href === basePath
                    ? normalizedPath === normalizedBasePath ||
                      normalizedPath.startsWith(`${normalizedBasePath}/`)
                    : isPathActive(location.pathname, location.hash, item.href, basePath);

              if (item.label === 'Street Profile') {
                return (
                  <NavDropdown
                    key={item.href}
                    label={item.label}
                    href={item.href}
                    items={STREET_PROFILE_NAV_ITEMS}
                    textColor={
                      isActive ? (dark ? '#FFD600' : '#111827') : dark ? '#E6E7F2' : '#1f2937'
                    }
                    fontSize={14}
                    buttonStyle={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontWeight: isActive ? 900 : 700,
                    }}
                    menuMinWidth={170}
                  />
                );
              }

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  style={{
                    color: isActive ? (dark ? '#FFD600' : '#111827') : dark ? '#E6E7F2' : '#1f2937',
                    fontFamily: 'Rubik, sans-serif',
                    fontSize: 14,
                    fontWeight: isActive ? 900 : 700,
                    letterSpacing: 0,
                    whiteSpace: 'nowrap',
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
            style={{
              flex: '0 0 clamp(260px, calc(50vw - 386px), 372px)',
              minWidth: 260,
              maxWidth: 372,
              marginTop: 0.5,
            }}
          >
            <form
              role="search"
              aria-label="Search Academy"
              onSubmit={handleAcademySearch}
              style={{
                width: '100%',
                height: 41,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '4px 4px 4px 14px',
                borderRadius: 999,
                border: dark ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(17,24,39,0.12)',
                background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)',
                boxShadow: dark ? '0 8px 24px rgba(0,0,0,0.16)' : '0 8px 20px rgba(17,24,39,0.08)',
                backdropFilter: 'blur(18px) saturate(160%)',
                WebkitBackdropFilter: 'blur(18px) saturate(160%)',
              }}
            >
              <Search size={17} color={dark ? 'rgba(230,231,242,0.64)' : 'rgba(31,41,55,0.56)'} />
              <label
                htmlFor="academy-search"
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
                Search programs
              </label>
              <input
                id="academy-search"
                type="search"
                value={academySearchQuery}
                onChange={(event) => setAcademySearchQuery(event.target.value)}
                placeholder="Search programs and courses..."
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: '100%',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: dark ? '#fff' : '#111827',
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
          </div>
        </div>
      </nav>
    </>
  );
}

export default function AcademyNavigationChrome() {
  return <AcademyMainTopNav />;
}
