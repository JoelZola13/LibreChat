/* eslint-disable i18next/no-literal-string */
/**
 * Shared top navigation bar for directory pages.
 * Matches the streetvoices.ca/search nav layout.
 */
import { useState, useContext, useCallback, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { isDarkTheme, useTheme, ThemeContext } from '../shared/theme-provider';
import { isDirectory } from '~/config/appVariant';
import { useOutletContext } from 'react-router-dom';
import { useActiveUser } from '../shared/useActiveUser';
import { useResponsive } from '../hooks/useResponsive';
import SearchIcon from 'lucide-react/dist/esm/icons/search';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import X from 'lucide-react/dist/esm/icons/x';
import MobileMenuDrawer, {
  getMobileNavLinkStyle,
  getMobileDividerStyle,
  HamburgerButton,
} from '../shared/MobileMenuDrawer';
import AuthPopupModal from '../shared/AuthPopupModal';
import { getSeamlessNavBarStyle } from '../shared/glassNav';
import { profilePhotoAlt, sampleProfilePhotoForName } from '../shared/sampleProfilePhotos';
import { useTopNavScrolled } from '../shared/useTopNavScrolled';
import NavDropdown from '../shared/NavDropdown';
import {
  STREET_PROFILE_NAV_ITEMS,
  isStreetProfileNavActive,
} from '../shared/streetProfileNavItems';
import { readStoredBoolean } from '../shared/safeStorage';

type ContextType = { navVisible?: boolean };

type DirectoryNavBarProps = {
  /** Current search term (controlled) */
  searchTerm?: string;
  /** Callback when search term changes */
  onSearchChange?: (value: string) => void;
  /** Current city filter */
  cityFilter?: string;
  /** Callback when city filter changes */
  onCityChange?: (value: string) => void;
  /** Whether the viewport is mobile-sized */
  isMobile: boolean;
  /** When true, adds a semi-opaque background so text is readable over map tiles */
  mapMode?: boolean;
  /** When true, mobile nav mirrors directory-page expand/collapse search behavior */
  mobileSearchExpandable?: boolean;
};

const NAV_SEARCH_STROKE_WIDTH = 0.5;
const NAV_SEARCH_GLASS_DARK =
  'linear-gradient(90deg, rgba(84, 109, 132, 0.42), rgba(83, 87, 126, 0.34), rgba(96, 72, 112, 0.30))';
const NAV_SEARCH_GLASS_LIGHT = 'rgba(255, 255, 255, 0.70)';
const NAV_SEARCHBAR_HEIGHT = 41;

export default function DirectoryNavBar({
  searchTerm = '',
  onSearchChange,
  cityFilter = '',
  onCityChange,
  isMobile,
  mapMode = false,
  mobileSearchExpandable = false,
}: DirectoryNavBarProps) {
  const { theme } = useTheme();
  const { setTheme } = useContext(ThemeContext);
  const dark = isDarkTheme(theme);
  const navigate = useNavigate();
  const location = useLocation();
  const { activeUser, resolved: sessionResolved } = useActiveUser();
  const { isLargeDesktop } = useResponsive();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchTerm);
  const [localCity, setLocalCity] = useState(cityFilter);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const isTopNavScrolled = useTopNavScrolled();

  const toggleTheme = useCallback(() => {
    setTheme(dark ? 'light' : 'dark');
  }, [dark, setTheme]);

  const showLogin = !activeUser && sessionResolved;
  const userInitial =
    activeUser?.name?.charAt(0)?.toUpperCase() ||
    activeUser?.username?.charAt(0)?.toUpperCase() ||
    '?';
  const activeUserAvatarUrl =
    activeUser && activeUser.avatar && !avatarLoadError
      ? activeUser.avatar
      : activeUser
        ? sampleProfilePhotoForName(activeUser.name || activeUser.username)
        : null;

  useEffect(() => {
    setAvatarLoadError(false);
  }, [activeUser?.avatar]);

  useEffect(() => {
    setLocalSearch(searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    setLocalCity(cityFilter);
  }, [cityFilter]);

  useEffect(() => {
    if (!isMobile && mobileSearchOpen) {
      setMobileSearchOpen(false);
    }
  }, [isMobile, mobileSearchOpen]);

  const { navVisible } = useOutletContext<ContextType>() ?? { navVisible: false };
  const sidebarMinimized = readStoredBoolean('sidebarMinimized', true);
  const navLeft = isMobile ? 0 : isDirectory ? 0 : navVisible ? (sidebarMinimized ? 80 : 275) : 0;
  const navTextColor = dark ? '#fff' : '#1a1c24';
  const directoryLogoSrc = dark
    ? '/assets/streetvoices-text.svg'
    : '/assets/streetvoices-text-dark.svg';
  const navSearchGlassBg = dark ? NAV_SEARCH_GLASS_DARK : NAV_SEARCH_GLASS_LIGHT;
  const navSearchBorderColor = dark ? 'rgba(210, 216, 238, 0.34)' : 'rgba(43, 48, 64, 0.18)';
  const navSearchDividerColor = dark ? 'rgba(226, 230, 246, 0.42)' : 'rgba(43, 48, 64, 0.26)';
  const navSearchTextColor = dark ? '#F6F7FB' : '#111318';
  const navSearchPlaceholderColor = dark ? 'rgba(246, 247, 251, 0.78)' : 'rgba(17, 19, 24, 0.62)';
  const navSearchIconColor = dark ? 'rgba(236, 239, 250, 0.78)' : 'rgba(24, 28, 38, 0.58)';
  const navSearchShadow = dark ? '0 14px 38px rgba(0,0,0,0.28)' : '0 14px 32px rgba(31,41,55,0.10)';
  const showMobileSearchHeader = isMobile && mobileSearchExpandable && mobileSearchOpen;
  const mobileSearchBarHeight = NAV_SEARCHBAR_HEIGHT;
  const mobileSearchButtonSize = 31;
  const mobileSearchButtonInset = 5;
  const mobileSearchInputPadding = 10;
  const mainNavLinks = [
    { label: 'Street Profile', to: '/profiles' },
    { label: 'Street Gallery', to: '/gallery' },
    { label: 'Academy', to: '/academy' },
    { label: 'Job Board', to: '/jobs' },
    { label: 'Directory', to: '/directory' },
    { label: 'News', to: '/news' },
  ];

  const handleSearch = () => {
    if (onSearchChange) {
      onSearchChange(localSearch);
      if (onCityChange) onCityChange(localCity);
    } else {
      // Navigate to directory with search params
      const params = new URLSearchParams();
      if (localSearch) params.set('q', localSearch);
      if (localCity) params.set('city', localCity);
      navigate(`/directory${params.toString() ? `?${params}` : ''}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <>
      <style>{`
        .sv-search-input::placeholder { color: ${navSearchPlaceholderColor} !important; opacity: 1; }
        .sv-mobile-search-input { color: ${navSearchTextColor} !important; -webkit-text-fill-color: ${navSearchTextColor} !important; }
        .sv-mobile-search-input::placeholder { color: ${navSearchPlaceholderColor} !important; opacity: 1; }
        .sv-page-top-nav-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border-radius: 8px;
          padding: 8px 8px;
          transition: background-color 160ms ease, color 160ms ease;
        }
        .sv-page-top-nav-link:hover,
        .sv-page-top-nav-link:focus-visible {
          background: rgba(255, 255, 255, 0.12);
        }
        html.light .sv-page-top-nav-link:hover,
        html.light .sv-page-top-nav-link:focus-visible {
          background: rgba(17, 19, 24, 0.08);
        }
        @media (min-width: 1280px) {
          .sv-page-top-nav-link { padding-left: 12px; padding-right: 12px; }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: isMobile ? 0 : navLeft,
          right: 0,
          zIndex: 20,
          ...getSeamlessNavBarStyle(dark, isTopNavScrolled),
          padding: showMobileSearchHeader ? '0 15px' : isMobile ? '0 24px' : '0 24px',
          height: isMobile ? (mobileSearchExpandable ? 71 : 56) : 70,
          overflow: isMobile ? 'hidden' : 'visible',
          display: 'flex',
          alignItems: 'center',
          transition: 'left 0.2s ease-out',
        }}
      >
        {/* Logo */}
        {!showMobileSearchHeader && (
          <Link
            to="/home"
            aria-label="Street Voices home"
            title="Street Voices home"
            style={{ flexShrink: 0, marginRight: isMobile ? 10 : 24 }}
          >
            <img
              src={directoryLogoSrc}
              alt="Street Voices"
              style={{
                height: isMobile ? (mobileSearchExpandable ? 38 : 24) : 38,
                maxWidth: isMobile ? (mobileSearchExpandable ? 105 : 90) : 143,
              }}
            />
          </Link>
        )}

        {/* Search bar */}
        {isMobile ? (
          mobileSearchExpandable ? (
            mobileSearchOpen ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flex: 1,
                  minWidth: 0,
                  marginLeft: 0,
                  marginRight: 0,
                  height: mobileSearchBarHeight,
                  overflow: 'visible',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flex: 1,
                    minWidth: 0,
                    height: '100%',
                    background: navSearchGlassBg,
                    border: `${NAV_SEARCH_STROKE_WIDTH}px solid ${navSearchBorderColor}`,
                    borderRadius: 999,
                    boxShadow: navSearchShadow,
                    backdropFilter: 'blur(26px) saturate(150%)',
                    WebkitBackdropFilter: 'blur(26px) saturate(150%)',
                    overflow: 'hidden',
                    position: 'relative',
                    padding: 5,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flex: 1,
                      minWidth: 0,
                      height: '100%',
                      background: 'transparent',
                      borderRadius: 999,
                      padding: `0 ${mobileSearchInputPadding}px`,
                      gap: 10,
                    }}
                  >
                    <SearchIcon
                      size={16}
                      strokeWidth={2.1}
                      style={{ color: navSearchIconColor, flexShrink: 0 }}
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      className="sv-search-input sv-mobile-search-input"
                      value={localSearch}
                      onChange={(e) => {
                        setLocalSearch(e.target.value);
                        onSearchChange?.(e.target.value);
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="Search for free services"
                      style={{
                        width: '100%',
                        minWidth: 0,
                        height: '100%',
                        padding: 0,
                        border: 'none',
                        background: 'transparent',
                        color: navSearchTextColor,
                        fontSize: 'var(--sv-search-bar-font-size)',
                        fontWeight: 500,
                        lineHeight: `${mobileSearchBarHeight}px`,
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flex: '0 0 34%',
                      minWidth: 0,
                      maxWidth: 150,
                      height: '100%',
                      background: 'transparent',
                      borderLeft: `${NAV_SEARCH_STROKE_WIDTH}px solid ${navSearchDividerColor}`,
                      borderRadius: 0,
                      padding: `0 ${mobileSearchInputPadding}px`,
                      gap: 8,
                    }}
                  >
                    <MapPin
                      size={15}
                      strokeWidth={2.1}
                      style={{ color: navSearchIconColor, flexShrink: 0 }}
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      className="sv-search-input sv-mobile-search-input"
                      value={localCity}
                      onChange={(e) => {
                        setLocalCity(e.target.value);
                        onCityChange?.(e.target.value);
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="City"
                      style={{
                        width: '100%',
                        minWidth: 0,
                        height: '100%',
                        padding: 0,
                        border: 'none',
                        background: 'transparent',
                        color: navSearchTextColor,
                        fontSize: 'var(--sv-search-bar-font-size)',
                        fontWeight: 500,
                        lineHeight: `${mobileSearchBarHeight}px`,
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    aria-label="Search"
                    style={{
                      position: 'absolute',
                      top: mobileSearchButtonInset,
                      right: mobileSearchButtonInset,
                      height: mobileSearchButtonSize,
                      width: mobileSearchButtonSize,
                      borderRadius: 25,
                      border: 'none',
                      background: '#FFD600',
                      color: '#000',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      flexShrink: 0,
                      zIndex: 1,
                    }}
                  >
                    <SearchIcon size={22} />
                  </button>
                </div>
                <button
                  onClick={() => setMobileSearchOpen(false)}
                  aria-label="Close search"
                  style={{
                    marginLeft: 14,
                    border: 'none',
                    background: 'none',
                    color: dark ? '#FFD600' : '#2D2D2D',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    width: 16,
                    height: 16,
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            ) : null
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flex: 1,
                minWidth: 0,
                marginLeft: 6,
                marginRight: 6,
                height: NAV_SEARCHBAR_HEIGHT,
                overflow: 'visible',
                position: 'relative',
                background: navSearchGlassBg,
                border: `${NAV_SEARCH_STROKE_WIDTH}px solid ${navSearchBorderColor}`,
                borderRadius: 999,
                boxShadow: navSearchShadow,
                backdropFilter: 'blur(26px) saturate(150%)',
                WebkitBackdropFilter: 'blur(26px) saturate(150%)',
                padding: 4,
              }}
            >
              {/* Search input */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flex: 1,
                  minWidth: 0,
                  height: '100%',
                  background: 'transparent',
                  borderRadius: 999,
                  gap: 8,
                  padding: '0 0 0 8px',
                }}
              >
                <SearchIcon
                  size={15}
                  strokeWidth={2.1}
                  style={{ color: navSearchIconColor, flexShrink: 0 }}
                  aria-hidden="true"
                />
                <input
                  type="text"
                  className="sv-search-input sv-mobile-search-input"
                  value={localSearch}
                  onChange={(e) => {
                    setLocalSearch(e.target.value);
                    onSearchChange?.(e.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search for free services"
                  style={{
                    width: '100%',
                    minWidth: 0,
                    height: '100%',
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: navSearchTextColor,
                    fontSize: 'var(--sv-search-bar-font-size)',
                    fontWeight: 500,
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              {/* City input */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flex: '0 0 32%',
                  minWidth: 86,
                  height: '100%',
                  background: 'transparent',
                  borderLeft: `${NAV_SEARCH_STROKE_WIDTH}px solid ${navSearchDividerColor}`,
                  borderRadius: 0,
                  padding: '0 8px',
                  gap: 6,
                }}
              >
                <MapPin
                  size={14}
                  strokeWidth={2.1}
                  style={{ color: navSearchIconColor, flexShrink: 0 }}
                  aria-hidden="true"
                />
                <input
                  type="text"
                  className="sv-search-input sv-mobile-search-input"
                  value={localCity}
                  onChange={(e) => {
                    setLocalCity(e.target.value);
                    onCityChange?.(e.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="City"
                  style={{
                    width: '100%',
                    height: '100%',
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: navSearchTextColor,
                    fontSize: 'var(--sv-search-bar-font-size)',
                    fontWeight: 500,
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              {/* Search button — circular pill, overlaps city */}
              <button
                onClick={handleSearch}
                style={{
                  height: '100%',
                  width: 32,
                  padding: 0,
                  borderRadius: 30,
                  border: 'none',
                  background: '#FFD600',
                  color: '#000',
                  fontSize: 0,
                  fontWeight: 700,
                  fontFamily: 'Rubik, sans-serif',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  position: 'relative',
                  zIndex: 1,
                  boxShadow: '0 6px 14px rgba(0,0,0,0.18)',
                }}
              >
                <SearchIcon size={15} strokeWidth={2.6} aria-hidden="true" />
              </button>
            </div>
          )
        ) : (
          /* ── Desktop: original pill layout ── */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flex: '0 0 clamp(260px, calc(50vw - 386px), 372px)',
              maxWidth: 372,
              minWidth: 260,
              overflow: 'visible',
              height: 41,
              position: 'relative',
              marginRight: 16,
              gap: 10,
              background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)',
              border: dark ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(17,24,39,0.12)',
              borderRadius: 999,
              boxShadow: dark ? '0 8px 24px rgba(0,0,0,0.16)' : '0 8px 20px rgba(17,24,39,0.08)',
              backdropFilter: 'blur(18px) saturate(160%)',
              WebkitBackdropFilter: 'blur(18px) saturate(160%)',
              padding: '4px 4px 4px 14px',
            }}
          >
            {/* Search input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flex: 1,
                minWidth: 0,
                height: '100%',
                background: 'transparent',
                borderRadius: 999,
                gap: 10,
                padding: 0,
              }}
            >
              <SearchIcon
                size={17}
                style={{
                  color: dark ? 'rgba(230,231,242,0.64)' : 'rgba(31,41,55,0.56)',
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
              <input
                type="search"
                className="sv-search-input"
                value={localSearch}
                onChange={(e) => {
                  setLocalSearch(e.target.value);
                  onSearchChange?.(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search for free services"
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: '100%',
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  color: dark ? '#fff' : '#111827',
                  fontSize: 14,
                  outline: 'none',
                  fontFamily: 'Rubik, sans-serif',
                }}
              />
            </div>
            {/* Search button — yellow pill with text */}
            <button
              onClick={handleSearch}
              style={{
                height: '100%',
                minWidth: 86,
                padding: '0 12px',
                borderRadius: 30,
                border: 'none',
                background: '#FFD600',
                color: '#000',
                fontSize: 'var(--sv-search-bar-font-size)',
                fontWeight: 700,
                fontFamily: 'inherit',
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
          </div>
        )}

        {/* Nav links (desktop) / Hamburger (mobile) */}
        {!isMobile ? (
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isLargeDesktop ? 2 : 0,
              marginLeft: 'auto',
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
                    textColor={isActive ? (dark ? '#FFD600' : '#111827') : navTextColor}
                    fontSize={14}
                    buttonStyle={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      fontWeight: isActive ? 900 : 700,
                    }}
                    menuMinWidth={170}
                  />
                );
              }

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="sv-page-top-nav-link"
                  style={{
                    color: isActive ? (dark ? '#FFD600' : '#111827') : navTextColor,
                    fontSize: 14,
                    fontWeight: isActive ? 900 : 700,
                    textDecoration: 'none',
                    fontFamily: 'Rubik, sans-serif',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
            <a
              href="/donate"
              className="sv-donate-nav-label sv-nav-action-button sv-nav-action-button--donate"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 37,
                padding: '0 18px',
                borderRadius: 25,
                border: '2px solid #FFD600',
                background: '#FFD600',
                color: '#000',
                fontSize: 14,
                fontWeight: 900,
                textDecoration: 'none',
                fontFamily: 'Rubik, sans-serif',
                whiteSpace: 'nowrap',
                marginLeft: isLargeDesktop ? 12 : 8,
              }}
            >
              Donate
            </a>
            {showLogin && (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="sv-nav-action-button sv-nav-action-button--login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 37,
                  padding: '0 18px',
                  borderRadius: 25,
                  border: '2px solid #FFD600',
                  background: 'transparent',
                  color: navTextColor,
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: 'Rubik, sans-serif',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  marginLeft: isLargeDesktop ? 8 : 6,
                }}
              >
                Login
              </button>
            )}
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="sv-theme-toggle-button"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: isLargeDesktop ? 36 : 30,
                height: isLargeDesktop ? 36 : 30,
                borderRadius: '50%',
                border: 'none',
                background: 'none',
                color: navTextColor,
                cursor: 'pointer',
                flexShrink: 0,
                marginLeft: 4,
              }}
              aria-label="Toggle theme"
            >
              {dark ? (
                <svg
                  width={isLargeDesktop ? 18 : 16}
                  height={isLargeDesktop ? 18 : 16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg
                  width={isLargeDesktop ? 18 : 16}
                  height={isLargeDesktop ? 18 : 16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            {/* Profile avatar */}
            {activeUser && (
              <Link
                to="/myprofile"
                aria-label="Profile"
                style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
              >
                {activeUserAvatarUrl ? (
                  <img
                    src={activeUserAvatarUrl}
                    alt={profilePhotoAlt(activeUser.name || activeUser.username, 'Profile')}
                    style={{
                      width: isLargeDesktop ? 32 : 28,
                      height: isLargeDesktop ? 32 : 28,
                      borderRadius: '50%',
                      objectFit: 'cover',
                    }}
                    onError={() => setAvatarLoadError(true)}
                  />
                ) : (
                  <div
                    style={{
                      width: isLargeDesktop ? 32 : 28,
                      height: isLargeDesktop ? 32 : 28,
                      borderRadius: '50%',
                      background: '#7c3aed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: isLargeDesktop ? 12 : 10,
                      fontWeight: 700,
                    }}
                  >
                    {userInitial}
                  </div>
                )}
              </Link>
            )}
          </nav>
        ) : (
          <>
            {!mobileSearchExpandable && activeUser && (
              <Link
                to="/myprofile"
                aria-label="Profile"
                style={{ display: 'inline-flex', alignItems: 'center', marginRight: 8 }}
              >
                {activeUserAvatarUrl ? (
                  <img
                    src={activeUserAvatarUrl}
                    alt={profilePhotoAlt(activeUser.name || activeUser.username, 'Profile')}
                    style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                    onError={() => setAvatarLoadError(true)}
                  />
                ) : (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: '#7c3aed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {userInitial}
                  </div>
                )}
              </Link>
            )}
            {mobileSearchExpandable ? (
              !mobileSearchOpen ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginLeft: 'auto',
                    flexShrink: 0,
                  }}
                >
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setMobileSearchOpen(true);
                    }}
                    aria-label="Open search"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      border: 'none',
                      background: 'none',
                      color: dark ? '#fff' : '#1a1c24',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    <SearchIcon size={18} />
                  </button>
                  <HamburgerButton onClick={() => setMobileMenuOpen(true)} dark={dark} />
                </div>
              ) : null
            ) : (
              <HamburgerButton onClick={() => setMobileMenuOpen(true)} dark={dark} />
            )}
            <MobileMenuDrawer isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}>
              <Link
                to="/directory"
                style={getMobileNavLinkStyle(dark)}
                onClick={() => setMobileMenuOpen(false)}
              >
                Directory
              </Link>
              <a
                href="https://airtable.com/appBQoHCfq4nfspKj/shrVEiMPGLqetHMfw"
                target="_blank"
                rel="noopener noreferrer"
                style={getMobileNavLinkStyle(dark)}
                onClick={() => setMobileMenuOpen(false)}
              >
                Programs
              </a>
              <Link
                to="/news"
                style={getMobileNavLinkStyle(dark)}
                onClick={() => setMobileMenuOpen(false)}
              >
                News
              </Link>
              <Link
                to="/about"
                style={{ ...getMobileNavLinkStyle(dark), borderBottom: 'none' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                About Us
              </Link>
              <div style={getMobileDividerStyle(dark)} />
              {showLogin && (
                <button
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '13px 16px',
                    color: dark ? '#E6E7F2' : '#1f2937',
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: 'Rubik, sans-serif',
                    textAlign: 'center',
                    borderRadius: 10,
                    background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    border: dark
                      ? '1px solid rgba(255,255,255,0.08)'
                      : '1px solid rgba(0,0,0,0.08)',
                    marginBottom: 10,
                    cursor: 'pointer',
                    letterSpacing: '0.01em',
                  }}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAuthModalOpen(true);
                  }}
                >
                  Login
                </button>
              )}
              <a
                href="/donate"
                className="sv-donate-nav-label"
                style={{
                  display: 'block',
                  padding: '13px 16px',
                  color: '#000',
                  fontSize: 14,
                  fontWeight: 900,
                  fontFamily: 'Rubik, sans-serif',
                  textDecoration: 'none',
                  textAlign: 'center',
                  borderRadius: 10,
                  background: '#FFD600',
                  letterSpacing: '0.01em',
                }}
                onClick={() => setMobileMenuOpen(false)}
              >
                Donate
              </a>
            </MobileMenuDrawer>
          </>
        )}

        <AuthPopupModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialTab="login"
        />
      </div>
    </>
  );
}
