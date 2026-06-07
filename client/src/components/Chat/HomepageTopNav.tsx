import { lazy, memo, Suspense, useCallback, useContext, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ThemeContext, isDark } from '@librechat/client';
import MobileMenuDrawer, {
  HamburgerButton,
  getMobileNavLinkStyle,
  getMobileDividerStyle,
  getMobileSectionHeaderStyle,
} from '~/components/streetbot/shared/MobileMenuDrawer';
import { useActiveUser } from '~/components/streetbot/shared/useActiveUser';
import NavDropdown from '~/components/streetbot/shared/NavDropdown';
import { PRODUCT_NAV_ITEMS, PRICING_NAV_ITEMS } from '~/components/streetbot/shared/commerceNav';
import TopRightAccountMenu from '~/components/streetbot/shared/TopRightAccountMenu';
import NotificationDropdown from '~/components/streetbot/notifications/NotificationDropdown';
import { getGlassNavBarStyle } from '~/components/streetbot/shared/glassNav';
import { STREET_PROFILE_NAV_ITEMS } from '~/components/streetbot/shared/streetProfileNavItems';
import { Home } from 'lucide-react';

const AuthPopupModal = lazy(() => import('~/components/streetbot/shared/AuthPopupModal'));

const HOMEPAGE_NAV_ITEMS = [
  { label: 'Street Gallery', href: '/gallery' },
  { label: 'Academy', href: '/academy' },
  { label: 'Job Board', href: '/jobs' },
  { label: 'Directory', href: '/directory' },
  { label: 'News', href: '/news' },
  { label: 'About Us', href: '/about' },
];

function HomepageTopNav() {
  const { pathname } = useLocation();
  const { activeUser, resolved: sessionResolved } = useActiveUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');
  const [isScrolled, setIsScrolled] = useState(false);
  const { theme, setTheme } = useContext(ThemeContext);
  const dark = isDark(theme);
  const toggleTheme = useCallback(() => {
    setTheme(isDark(theme) ? 'light' : 'dark');
  }, [theme, setTheme]);
  const isHomePage = pathname === '/' || pathname === '/home';
  const showHomeLogo = pathname.startsWith('/products') || pathname.startsWith('/pricing');
  const navGlassStyle = getGlassNavBarStyle(dark);
  const showNavSurface = !isHomePage || isScrolled;
  const mobileMainMenuItems = STREET_PROFILE_NAV_ITEMS.filter(
    (item) => item.href !== '/myprofile',
  );

  useEffect(() => {
    const updateScrolled = () => setIsScrolled(window.scrollY > 8);
    updateScrolled();
    window.addEventListener('scroll', updateScrolled, { passive: true });
    return () => window.removeEventListener('scroll', updateScrolled);
  }, [pathname]);

  return (
    <>
      <style>{`
      .sv-login-btn { background: transparent; border: 2px solid #FFD600; color: #000; transition: 0.3s ease-in-out; }
      html.dark .sv-login-btn { color: #fff; }
      .sv-login-btn:hover { background: #FFD600 !important; color: #000 !important; }
      .sv-home-top-nav-link:hover,
      .sv-home-top-nav-link:focus-visible { background: rgba(255, 255, 255, 0.12); }
      html.light .sv-home-top-nav-link:hover,
      html.light .sv-home-top-nav-link:focus-visible { background: rgba(17, 19, 24, 0.08); }
      @media (max-width: 1399px) {
        .sv-home-desktop-nav { display: none !important; }
      }
      @media (max-width: 768px) {
        .sv-homepage-top-nav {
          z-index: 90 !important;
          pointer-events: none;
        }
        .sv-homepage-top-nav .sv-home-top-actions {
          pointer-events: auto;
          right: 10px !important;
          top: 12px !important;
          transform: none !important;
          height: 36px;
          align-items: center !important;
          gap: 8px !important;
        }
        .sv-homepage-top-nav .sv-home-top-actions > a[aria-label="Go to home"],
        .sv-homepage-top-nav .sv-home-top-actions .sv-donate-nav-label {
          display: none !important;
        }
      }
    `}</style>
      <div
        className="sv-homepage-top-nav fixed left-0 right-0 top-0 z-[1200] px-4 sm:px-6"
        style={{
          ...(showNavSurface
            ? navGlassStyle
            : {
                background: 'transparent',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
                borderBottom: '1px solid transparent',
                boxShadow: 'none',
              }),
          borderBottom:
            showNavSurface && isScrolled ? navGlassStyle.borderBottom : '1px solid transparent',
          boxShadow: showNavSurface && isScrolled ? navGlassStyle.boxShadow : 'none',
        }}
      >
        <div className="relative flex h-[60px] w-full items-center justify-end">
          {showHomeLogo && (
            <Link
              to="/home"
              aria-label="Street Voices home"
              title="Street Voices home"
              className="absolute left-0 inline-flex items-center"
              style={{ textDecoration: 'none' }}
            >
              <img
                src={dark ? '/assets/streetvoices-text.svg' : '/assets/streetvoices-text-dark.svg'}
                alt="Street Voices"
                style={{
                  height: 38,
                  maxWidth: 143,
                }}
              />
            </Link>
          )}

          {/* Desktop navigation */}
          <nav className="sv-home-desktop-nav absolute left-1/2 hidden h-[60px] -translate-x-1/2 items-center gap-0 lg:flex xl:gap-1">
            <NavDropdown
              label="Street Profile"
              href="/profiles"
              items={STREET_PROFILE_NAV_ITEMS}
              textColor={dark ? '#E6E7F2' : '#1f2937'}
              fontSize={14}
              buttonStyle={{ padding: '8px 12px', borderRadius: 8, fontWeight: 700 }}
              menuMinWidth={170}
            />
            {HOMEPAGE_NAV_ITEMS.map((item) =>
              item.href.startsWith('http') ? (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sv-home-top-nav-link flex items-center gap-1 rounded-lg px-2 py-2 text-text-primary transition-colors xl:px-3"
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: 'Rubik, sans-serif',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.label}
                  to={item.href}
                  className="sv-home-top-nav-link flex items-center gap-1 rounded-lg px-2 py-2 text-text-primary transition-colors xl:px-3"
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: 'Rubik, sans-serif',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </Link>
              ),
            )}
            <NavDropdown
              label="Products"
              href="/products"
              items={PRODUCT_NAV_ITEMS}
              textColor={dark ? '#E6E7F2' : '#1f2937'}
              fontSize={14}
              buttonStyle={{ padding: '8px 12px', borderRadius: 8, fontWeight: 700 }}
            />
            <NavDropdown
              label="Pricing"
              href="/pricing"
              items={PRICING_NAV_ITEMS}
              textColor={dark ? '#E6E7F2' : '#1f2937'}
              fontSize={14}
              buttonStyle={{ padding: '8px 12px', borderRadius: 8, fontWeight: 700 }}
              menuMinWidth={160}
            />
          </nav>

          {/* Right actions */}
          <div className="sv-home-top-actions absolute right-0 top-1/2 z-[2] flex -translate-y-1/2 items-center gap-2">
            {!isHomePage && (
              <Link
                to="/home"
                aria-label="Go to home"
                title="Go to home"
                className="hidden lg:inline-flex"
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  border: dark
                    ? '1px solid rgba(255,255,255,0.16)'
                    : '1px solid rgba(17,24,39,0.12)',
                  background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
                  color: dark ? '#E6E7F2' : '#374151',
                  textDecoration: 'none',
                  boxShadow: dark
                    ? '0 8px 24px rgba(0,0,0,0.16)'
                    : '0 8px 20px rgba(17,24,39,0.08)',
                  backdropFilter: 'blur(18px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(18px) saturate(160%)',
                }}
              >
                <Home size={18} strokeWidth={2} />
              </Link>
            )}
            {activeUser && (
              <NotificationDropdown
                dark={dark}
                userId={activeUser.id}
                className="inline-flex"
              />
            )}
            <Link
              to="/donate"
              className="sv-donate-nav-label sv-nav-action-button sv-nav-action-button--donate hidden font-bold text-black lg:inline-flex"
              style={{
                fontSize: 14,
                fontWeight: 900,
                fontFamily: 'Rubik, sans-serif',
                background: '#FFD600',
                borderRadius: 25,
                padding: '8px 18px',
                border: '2px solid #FFD600',
              }}
            >
              Donate
            </Link>
            {!activeUser && sessionResolved && (
              <button
                onClick={() => {
                  setAuthModalTab('login');
                  setAuthModalOpen(true);
                }}
                className="sv-nav-action-button sv-nav-action-button--login sv-login-btn hidden font-bold lg:inline-flex"
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: 'Rubik, sans-serif',
                  borderRadius: 25,
                  padding: '8px 18px',
                  cursor: 'pointer',
                }}
              >
                Login
              </button>
            )}
            <button
              onClick={toggleTheme}
              className="sv-theme-toggle-button flex h-9 w-9 items-center justify-center rounded-lg text-text-primary transition-colors hover:bg-surface-hover"
              aria-label="Toggle theme"
            >
              {isDark(theme) ? (
                <svg
                  width="20"
                  height="20"
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
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            <TopRightAccountMenu dark={dark} size={28} />
            <div className="lg:hidden">
              <HamburgerButton onClick={() => setMobileMenuOpen(true)} dark={dark} />
            </div>
          </div>
        </div>

        {/* Mobile hamburger menu — mirrors original streetvoices.ca pattern */}
        <MobileMenuDrawer isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            {!activeUser && sessionResolved && (
              <>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAuthModalTab('login');
                    setAuthModalOpen(true);
                  }}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '10px 0',
                    borderRadius: 12,
                    background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    border: dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                    color: dark ? '#E6E7F2' : '#1f2937',
                    fontFamily: 'Rubik, sans-serif',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAuthModalTab('register');
                    setAuthModalOpen(true);
                  }}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '10px 0',
                    borderRadius: 12,
                    background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    border: dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                    color: dark ? '#E6E7F2' : '#1f2937',
                    fontFamily: 'Rubik, sans-serif',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Sign Up
                </button>
              </>
            )}
            <Link
              to="/donate"
              className="sv-donate-nav-label"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '10px 0',
                borderRadius: 12,
                background: '#FFD600',
                border: '1px solid #FFD600',
                color: '#000',
                fontFamily: 'Rubik, sans-serif',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 900,
              }}
            >
              Donate
            </Link>
          </div>

          <div style={getMobileDividerStyle(dark)} />

          {activeUser && (
            <a
              href="/myprofile"
              onClick={() => setMobileMenuOpen(false)}
              style={getMobileNavLinkStyle(dark)}
            >
              My Profile
            </a>
          )}
          {activeUser && (
            <Link
              to="/notifications"
              onClick={() => setMobileMenuOpen(false)}
              style={getMobileNavLinkStyle(dark)}
            >
              Notifications
            </Link>
          )}

          <div style={getMobileSectionHeaderStyle(dark)}>Main Menu</div>
          {mobileMainMenuItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              style={getMobileNavLinkStyle(dark)}
            >
              {item.label}
            </Link>
          ))}

          {HOMEPAGE_NAV_ITEMS.map((item) =>
            item.href.startsWith('http') ? (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                style={getMobileNavLinkStyle(dark)}
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.label}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                style={getMobileNavLinkStyle(dark)}
              >
                {item.label}
              </Link>
            ),
          )}
          <Link
            to="/products"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              ...getMobileSectionHeaderStyle(dark),
              display: 'block',
              textDecoration: 'none',
            }}
          >
            Products
          </Link>
          {PRODUCT_NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              style={getMobileNavLinkStyle(dark)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/pricing"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              ...getMobileSectionHeaderStyle(dark),
              display: 'block',
              textDecoration: 'none',
            }}
          >
            Pricing
          </Link>
          {PRICING_NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              style={getMobileNavLinkStyle(dark)}
            >
              {item.label}
            </Link>
          ))}
        </MobileMenuDrawer>

        <Suspense fallback={null}>
          <AuthPopupModal
            isOpen={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
            initialTab={authModalTab}
          />
        </Suspense>
      </div>
    </>
  );
}

export default memo(HomepageTopNav);
