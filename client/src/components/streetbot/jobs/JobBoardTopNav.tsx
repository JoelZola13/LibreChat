/* eslint-disable i18next/no-literal-string */
import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useResponsive } from '../hooks/useResponsive';
import { getSeamlessNavBarStyle } from '../shared/glassNav';
import NavDropdown from '../shared/NavDropdown';
import {
  STREET_PROFILE_NAV_ITEMS,
  isStreetProfileNavActive,
} from '../shared/streetProfileNavItems';
import { useGlassStyles } from '../shared/useGlassStyles';
import { useTopNavScrolled } from '../shared/useTopNavScrolled';

type JobBoardTopNavProps = {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: (value: string) => void;
  placeholder?: string;
  rightSlot?: ReactNode;
};

const MAIN_NAV_LINKS = [
  { label: 'Street Profile', to: '/profiles' },
  { label: 'Street Gallery', to: '/gallery' },
  { label: 'Academy', to: '/academy' },
  { label: 'Job Board', to: '/jobs' },
  { label: 'Directory', to: '/directory' },
  { label: 'News', to: '/news' },
];

export default function JobBoardTopNav({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  placeholder = 'Search jobs, companies, skills...',
  rightSlot,
}: JobBoardTopNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark } = useGlassStyles();
  const { isMobile, width } = useResponsive();
  const isTopNavScrolled = useTopNavScrolled();
  const [internalSearch, setInternalSearch] = useState('');
  const compactLinksRef = useRef<HTMLDivElement | null>(null);
  const value = searchValue ?? internalSearch;
  const isCompactNav = width < 1080;
  const visiblePlaceholder = isMobile ? 'Search...' : placeholder;

  useEffect(() => {
    if (!isCompactNav) return;
    const activeLink = compactLinksRef.current?.querySelector<HTMLElement>(
      '[data-sv-active-nav-link="true"]',
    );
    activeLink?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
  }, [isCompactNav, location.pathname]);

  const updateSearch = (nextValue: string) => {
    if (onSearchChange) {
      onSearchChange(nextValue);
      return;
    }
    setInternalSearch(nextValue);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (onSearchSubmit) {
      onSearchSubmit(value);
      return;
    }
    const query = value.trim();
    if (query) {
      navigate(`/jobs?search=${encodeURIComponent(query)}`);
    }
  };

  const inactiveTextColor = isDark ? '#E6E7F2' : '#1f2937';
  const activeTextColor = isDark ? '#FFD600' : '#111827';
  const textColor = (active: boolean) => (active ? activeTextColor : inactiveTextColor);
  const navWidth = rightSlot
    ? 'min(1040px, calc(100vw - 320px))'
    : 'min(859px, calc(100vw - 320px))';
  const navLinkStyle = (active: boolean): CSSProperties => ({
    color: textColor(active),
    fontFamily: 'Rubik, sans-serif',
    fontSize: 14,
    fontWeight: active ? 900 : 700,
    lineHeight: 1.25,
    textDecoration: 'none',
    padding: '8px 12px',
    borderRadius: 8,
  });

  return (
    <>
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
            display: none !important;
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
          aria-label="Job board main navigation"
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: isCompactNav ? 8 : 4,
            height: isCompactNav ? 'auto' : 48,
            whiteSpace: 'nowrap',
            maxWidth: rightSlot ? '1040px' : '859px',
            width: isCompactNav ? '100%' : navWidth,
            margin: '0 auto',
            flexWrap: isCompactNav ? 'wrap' : 'nowrap',
            overflow: isCompactNav ? 'hidden' : undefined,
          }}
        >
          <div
            ref={compactLinksRef}
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
            {MAIN_NAV_LINKS.map((item) => {
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
                    textColor={textColor(isActive)}
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
                  data-sv-active-nav-link={isActive ? 'true' : undefined}
                  style={navLinkStyle(isActive)}
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
            <form
              role="search"
              aria-label="Search Job Board"
              onSubmit={submitSearch}
              style={{
                width: '100%',
                height: 41,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '4px 4px 4px 14px',
                borderRadius: 999,
                border: isDark
                  ? '1px solid rgba(255,255,255,0.16)'
                  : '1px solid rgba(17,24,39,0.12)',
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)',
                boxShadow: isDark
                  ? '0 8px 24px rgba(0,0,0,0.16)'
                  : '0 8px 20px rgba(17,24,39,0.08)',
                backdropFilter: 'blur(18px) saturate(160%)',
                WebkitBackdropFilter: 'blur(18px) saturate(160%)',
                transform: 'translateY(-1px)',
              }}
            >
              <Search size={17} color={isDark ? 'rgba(230,231,242,0.64)' : 'rgba(31,41,55,0.56)'} />
              <label
                htmlFor="job-board-top-nav-search"
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
                Search jobs
              </label>
              <input
                id="job-board-top-nav-search"
                type="search"
                value={value}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder={visiblePlaceholder}
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
          </div>
          {rightSlot ? <div style={{ flexShrink: 0 }}>{rightSlot}</div> : null}
        </nav>
      </div>
      <div
        className="sv-feature-top-nav-spacer"
        aria-hidden="true"
        style={{ height: isCompactNav ? '166px' : '64px' }}
      />
    </>
  );
}
