import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { useMediaQuery, ThemeContext, isDark as checkDark } from '@librechat/client';
import type { ContextType } from '~/common';
import {
  useSearchEnabled,
  useAssistantsMap,
  useAuthContext,
  useAgentsMap,
  useFileMap,
} from '~/hooks';
import {
  PromptGroupsProvider,
  AssistantsMapContext,
  AgentsMapContext,
  SetConvoProvider,
  FileMapContext,
} from '~/Providers';
import { useUserTermsQuery, useGetStartupConfig } from '~/data-provider';
import { Nav, MobileNav, NAV_WIDTH } from '~/components/Nav';
import { TermsAndConditionsModal } from '~/components/ui';
import { useHealthCheck } from '~/data-provider';
import { isDirectory } from '~/config/appVariant';
import { Banner } from '~/components/Banners';
import { ThemeProvider } from '~/components/streetbot/shared/theme-provider';
import SbpBackgroundOrbs from '~/components/streetbot/shared/SbpBackgroundOrbs';

/** Theme toggle + profile button — matches HomepageTopNav right-side pattern.
 *  Hidden on homepage (which has its own in HomepageTopNav). */
function GlobalActions() {
  const { pathname } = useLocation();
  const { theme, setTheme } = useContext(ThemeContext);
  const dark = checkDark(theme);
  const { user } = useAuthContext();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');

  const hasOwnMobileNav = pathname === '/news'
    || pathname.startsWith('/news/')
    || pathname === '/directory'
    || pathname.startsWith('/directory/');

  const toggle = useCallback(() => {
    setTheme(dark ? 'light' : 'dark');
  }, [dark, setTheme]);

  const userInitial = useMemo(
    () => user?.name?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || '?',
    [user?.name, user?.username],
  );

  // Only show on chat pages (home / conversations), hide on all other pages
  const isChatPage = pathname === '/' || pathname === '/home' || pathname.startsWith('/c/');
  if (!isChatPage) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 14,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <button
        onClick={toggle}
        className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-surface-hover"
        style={{ color: dark ? '#E6E7F2' : '#1a1c24', background: 'none', border: 'none', cursor: 'pointer' }}
        aria-label="Toggle theme"
      >
        {dark ? (
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
      {user && (
        <Link
          to="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-surface-hover"
          aria-label="Settings"
        >
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name || 'Profile'}
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-xs font-medium text-white">
              {userInitial}
            </div>
          )}
        </Link>
      )}
    </div>
  );
}

export default function Root() {
  const [showTerms, setShowTerms] = useState(false);
  const [bannerHeight, setBannerHeight] = useState(0);
  const [navVisible, setNavVisible] = useState(() => {
    const savedNavVisible = localStorage.getItem('navVisible');
    return savedNavVisible !== null ? JSON.parse(savedNavVisible) : true;
  });
  const { pathname } = useLocation();

  const { isAuthenticated, logout } = useAuthContext();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');

  // StreetBot only: keep desktop sidebar visible for signed-in sessions.
  useEffect(() => {
    if (isDirectory || !isAuthenticated || isSmallScreen) {
      return;
    }
    if (!navVisible) {
      setNavVisible(true);
      localStorage.setItem('navVisible', JSON.stringify(true));
    }
  }, [isAuthenticated, isSmallScreen, navVisible, isDirectory]);

  // Global health check - runs once per authenticated session
  useHealthCheck(isAuthenticated);

  const assistantsMap = useAssistantsMap({ isAuthenticated });
  const agentsMap = useAgentsMap({ isAuthenticated });
  const fileMap = useFileMap({ isAuthenticated });

  const { data: config } = useGetStartupConfig();
  const { data: termsData } = useUserTermsQuery({
    enabled: isAuthenticated && config?.interface?.termsOfService?.modalAcceptance === true,
  });

  useSearchEnabled(isAuthenticated);

  useEffect(() => {
    if (termsData) {
      setShowTerms(!termsData.termsAccepted);
    }
  }, [termsData]);

  const handleAcceptTerms = () => {
    setShowTerms(false);
  };

  const handleDeclineTerms = () => {
    setShowTerms(false);
    logout('/login?redirect=false');
  };

  if (!isAuthenticated) {
    const isPublicPage = pathname === '/'
      || pathname === '/home'
      || pathname === '/about'
      || pathname === '/how-it-works'
      || pathname === '/terms'
      || pathname === '/privacy'
      || pathname === '/news'
      || pathname.startsWith('/news/')
      || pathname === '/directory'
      || pathname.startsWith('/directory/');

    if (!isPublicPage) {
      // Auth is still resolving (silentRefresh in flight) — show a minimal
      // loading screen instead of blank.  Once refresh completes, Root
      // re-renders authenticated OR AuthContext redirects to /login.
      return (
        <ThemeProvider>
          <SbpBackgroundOrbs />
          <div className="flex items-center justify-center" style={{ height: '100dvh' }} />
        </ThemeProvider>
      );
    }

    return (
      <ThemeProvider>
        <SbpBackgroundOrbs />
        <GlobalActions />
        <div className="flex" style={{ height: '100dvh', position: 'relative', zIndex: 1 }}>
          <div className="relative z-0 flex h-full w-full overflow-hidden">
            <div className="relative flex h-full max-w-full flex-1 flex-col overflow-y-auto">
              <Outlet context={{ navVisible: false, setNavVisible: () => {} } satisfies ContextType} />
            </div>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
    <SetConvoProvider>
      <FileMapContext.Provider value={fileMap}>
        <AssistantsMapContext.Provider value={assistantsMap}>
          <AgentsMapContext.Provider value={agentsMap}>
            <PromptGroupsProvider>
              <Banner onHeightChange={setBannerHeight} />
              <SbpBackgroundOrbs />
              <GlobalActions />
              <div className="flex" style={{ height: `calc(100dvh - ${bannerHeight}px)`, position: 'relative', zIndex: 1 }}>
                <div className="relative z-0 flex h-full w-full overflow-hidden">
                  {!isDirectory && <Nav navVisible={navVisible} setNavVisible={setNavVisible} />}
                  <div
                    className="relative flex h-full max-w-full flex-1 flex-col overflow-y-auto"
                    style={
                      !isDirectory && isSmallScreen
                        ? {
                            transform: navVisible
                              ? `translateX(${NAV_WIDTH.MOBILE}px)`
                              : 'translateX(0)',
                            transition: 'transform 0.2s ease-out',
                          }
                        : undefined
                    }
                  >
                    {!isDirectory && <MobileNav navVisible={navVisible} setNavVisible={setNavVisible} />}
                    <Outlet context={{ navVisible, setNavVisible } satisfies ContextType} />
                  </div>
                </div>
              </div>
            </PromptGroupsProvider>
          </AgentsMapContext.Provider>
          {config?.interface?.termsOfService?.modalAcceptance === true && (
            <TermsAndConditionsModal
              open={showTerms}
              onOpenChange={setShowTerms}
              onAccept={handleAcceptTerms}
              onDecline={handleDeclineTerms}
              title={config.interface.termsOfService.modalTitle}
              modalContent={config.interface.termsOfService.modalContent}
            />
          )}
        </AssistantsMapContext.Provider>
      </FileMapContext.Provider>
    </SetConvoProvider>
    </ThemeProvider>
  );
}
