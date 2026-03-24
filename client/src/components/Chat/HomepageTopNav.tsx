import { lazy, memo, Suspense, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ThemeContext, isDark } from '@librechat/client';
import { useUserRole } from '~/components/streetbot/lib/auth/useUserRole';
import MobileMenuDrawer, { HamburgerButton, getMobileNavLinkStyle, getMobileDividerStyle } from '~/components/streetbot/shared/MobileMenuDrawer';
import { variantConfig, isDirectory } from '~/config/appVariant';
import { useActiveUser } from '~/components/streetbot/shared/useActiveUser';

const AuthPopupModal = lazy(() => import('~/components/streetbot/shared/AuthPopupModal'));

function HomepageTopNav() {
  const { canAccess } = useUserRole();
  const { activeUser, resolved: sessionResolved } = useActiveUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const { theme, setTheme } = useContext(ThemeContext);
  const dark = isDark(theme);
  const visibleNavItems = useMemo(() => variantConfig.topNavItems.filter(item => item.navKey === null || canAccess(item.navKey)), [canAccess]);

  const toggleTheme = useCallback(() => {
    setTheme(isDark(theme) ? 'light' : 'dark');
  }, [theme, setTheme]);

  const userInitial = activeUser?.name?.charAt(0)?.toUpperCase() || activeUser?.username?.charAt(0)?.toUpperCase() || '?';

  useEffect(() => {
    setAvatarLoadError(false);
  }, [activeUser?.avatar]);

  return (
    <>
    <style>{`.sv-login-btn { background: transparent; border: 2px solid #FFD600; color: #000; transition: 0.3s ease-in-out; } html.dark .sv-login-btn { color: #fff; } .sv-login-btn:hover { background: rgb(255, 198, 0) !important; color: #000 !important; }`}</style>
    <div className="absolute top-0 z-10 w-full px-4 sm:px-6">
      <div className="relative flex h-[60px] w-full items-center justify-between">
        {/* Left: phone (mobile) */}
        <div className="flex items-center gap-2">
          <a
            href="tel:+14166976626"
            className="flex items-center gap-2 rounded-lg text-text-primary transition-colors hover:bg-surface-hover lg:hidden"
            aria-label="Call Street Voices"
            style={{ padding: '6px 10px', fontSize: 14, fontFamily: 'Rubik, sans-serif', whiteSpace: 'nowrap' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            +1 416-697-6626
          </a>
          {isDirectory && (
            <a
              href="tel:+14166976626"
              className="hidden items-center gap-2 text-text-primary transition-colors hover:opacity-80 xl:flex"
              style={{ fontSize: 16, fontFamily: 'Rubik, sans-serif' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              +1 416-697-6626
            </a>
          )}
        </div>

        {/* Desktop navigation — absolutely centered */}
        <nav className="absolute left-1/2 top-0 hidden h-[60px] -translate-x-1/2 items-center gap-0 lg:flex xl:gap-1">
          {visibleNavItems.map((item) =>
            item.href.startsWith('http') ? (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg px-2 py-2 text-text-primary transition-colors hover:bg-surface-hover xl:px-3"
                style={{ fontSize: 14, fontFamily: 'Rubik, sans-serif', whiteSpace: 'nowrap' }}
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.label}
                to={item.href}
                className="flex items-center gap-1 rounded-lg px-2 py-2 text-text-primary transition-colors hover:bg-surface-hover xl:px-3"
                style={{ fontSize: 14, fontFamily: 'Rubik, sans-serif', whiteSpace: 'nowrap' }}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <Link
            to="/donate"
            className="hidden font-bold text-black transition-opacity hover:opacity-90 lg:inline-flex"
            style={{ fontSize: 14, fontFamily: 'Rubik, sans-serif', background: '#FFD600', borderRadius: 25, padding: '8px 18px', border: '2px solid #FFD600' }}
          >
            Donate
          </Link>
          {!activeUser && sessionResolved && (
            <button
              onClick={() => { setAuthModalTab('login'); setAuthModalOpen(true); }}
              className="hidden font-bold lg:inline-flex sv-login-btn"
              style={{ fontSize: 14, fontFamily: 'Rubik, sans-serif', borderRadius: 25, padding: '8px 18px', cursor: 'pointer' }}
            >
              Login
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-primary transition-colors hover:bg-surface-hover"
            aria-label="Toggle theme"
          >
            {isDark(theme) ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          {activeUser && (
            <a
              href="/settings"
              className="flex items-center"
              aria-label="Settings"
            >
              {activeUser.avatar && !avatarLoadError ? (
                <img
                  src={activeUser.avatar}
                  alt={activeUser.name || 'Profile'}
                  className="h-7 w-7 rounded-full object-cover"
                  width={28}
                  height={28}
                  loading="lazy"
                  onError={() => setAvatarLoadError(true)}
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-xs font-medium text-white">
                  {userInitial}
                </div>
              )}
            </a>
          )}
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
                onClick={() => { setMobileMenuOpen(false); setAuthModalTab('login'); setAuthModalOpen(true); }}
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
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Login
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); setAuthModalTab('register'); setAuthModalOpen(true); }}
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
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Sign Up
              </button>
            </>
          )}
          <Link
            to="/donate"
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
              fontWeight: 700,
            }}
          >
            Donate
          </Link>
        </div>

        <div style={getMobileDividerStyle(dark)} />

        {activeUser && (
          <a
            href="/settings"
            onClick={() => setMobileMenuOpen(false)}
            style={getMobileNavLinkStyle(dark)}
          >
            Settings
          </a>
        )}

        {visibleNavItems.map((item) =>
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
      </MobileMenuDrawer>

      <Suspense fallback={null}>
        <AuthPopupModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} initialTab={authModalTab} />
      </Suspense>
    </div>
    </>
  );
}

export default memo(HomepageTopNav);
