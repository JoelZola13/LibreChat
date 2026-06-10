import {
  useCallback,
  useEffect,
  useState,
  useMemo,
  memo,
  lazy,
  Suspense,
  useRef,
  startTransition,
} from 'react';
import { createPortal } from 'react-dom';
import { useRecoilValue } from 'recoil';
import { motion } from 'framer-motion';
import { useLocation, Link } from 'react-router-dom';
import { Skeleton, useMediaQuery } from '@librechat/client';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import type { InfiniteQueryObserverResult } from '@tanstack/react-query';
import type { ConversationListResponse } from 'librechat-data-provider';
import type { List } from 'react-virtualized';
import {
  useLocalize,
  useHasAccess,
  useAuthContext,
  useLocalStorage,
  useNavScrolling,
} from '~/hooks';
import { useConversationsInfiniteQuery, useTitleGeneration } from '~/data-provider';
import { Conversations } from '~/components/Conversations';
import { useShowMarketplace } from '~/hooks';
import SearchChatsModal from './SearchChatsModal';
// NotificationSettingsPanel removed — now uses /notifications route
import NewChat from './NewChat';
import { cn } from '~/utils';
import { useTheme } from '~/components/streetbot/shared/theme-provider';
import { useUserRole } from '~/components/streetbot/lib/auth/useUserRole';
import {
  isDirectory,
  isStreetBot,
  isStreetBotDeployedHost,
  isStreetBotLocal3180,
  isStreetBotStagingHost,
  variantConfig,
} from '~/config/appVariant';
import store from '~/store';

const AccountSettings = lazy(() => import('./AccountSettings'));

export const NAV_WIDTH = {
  MOBILE: 320,
  DESKTOP: 260,
} as const;

const SIDEBAR_ASSET_VERSION = 'sidebar-icons-20260523';
const sidebarAsset = (path: string) =>
  path.startsWith('data:') ? path : `${path}?v=${SIDEBAR_ASSET_VERSION}`;
const EMAIL_SIDEBAR_ICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.75 6.75H19.25V17.25H4.75V6.75Z" stroke="black" stroke-width="1.8" stroke-linejoin="round"/><path d="M5.25 7.25L12 12.25L18.75 7.25" stroke="black" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
)}`;

// Street Voices menu items — mirrors the 3190 sidebar source of truth.
const sidePanelNavItems = [
  {
    key: 'profile',
    label: 'Street Profile',
    icon: '/images/sidebar-icons/profile-avatar.svg',
    path: '/profiles',
    external: false,
  },
  {
    key: 'email',
    label: 'Email',
    icon: EMAIL_SIDEBAR_ICON,
    path: '/email/campaigns',
    external: false,
  },
  {
    key: 'forum',
    label: 'Word On The Street',
    icon: '/images/sidebar-icons/word.svg',
    path: '/word-on-the-street',
    external: false,
  },
  {
    key: 'gallery',
    label: 'Street Gallery',
    icon: '/images/sidebar-icons/gallery.svg',
    path: '/gallery',
    external: false,
  },
  {
    key: 'groups',
    label: 'Groups',
    icon: '/images/sidebar-icons/groups.svg',
    path: '/groups',
    external: false,
  },
  {
    key: 'news',
    label: 'News',
    icon: '/images/sidebar-icons/news.svg',
    path: '/news',
    external: false,
  },
  {
    key: 'messages',
    label: 'Messages',
    icon: '/images/sidebar-icons/messages-bubble.svg',
    path: '/messages',
    external: false,
  },
  {
    key: 'directory',
    label: 'Directory',
    icon: '/images/sidebar-icons/directory-grid.svg',
    path: '/directory',
    external: false,
  },
  {
    key: 'jobs',
    label: 'Job Board',
    icon: '/images/sidebar-icons/job-briefcase.svg',
    path: '/jobs',
    external: false,
  },
  {
    key: 'learning',
    label: 'Academy',
    icon: '/images/sidebar-icons/lms-cap.svg',
    path: '/academy',
    external: false,
  },
  {
    key: 'calendar',
    label: 'Calendar',
    icon: '/images/sidebar-icons/calendar-square.svg',
    path: '/calendar',
    external: false,
  },
  {
    key: 'case-management',
    label: 'Case Management',
    icon: '/images/sidebar-icons/case-management.svg',
    path: '/directory?categories=Case%20Management',
    external: false,
  },
  {
    key: 'social-media',
    label: 'Social Media',
    icon: '/images/sidebar-icons/social-media.svg',
    path: '/social-media',
    external: false,
  },
  {
    key: 'tasks',
    label: 'Task',
    icon: '/images/sidebar-icons/tasks-clipboard.svg',
    path: '/tasks',
    external: false,
  },
  {
    key: 'documents',
    label: 'Documents',
    icon: '/images/sidebar-icons/documents.svg',
    path: '/documents',
    external: false,
  },
  {
    key: 'storage',
    label: 'Storage',
    icon: '/images/sidebar-icons/storage.svg',
    path: '/storage',
    external: false,
  },
  {
    key: 'data',
    label: 'Database',
    icon: '/images/sidebar-icons/database-grid.svg',
    path: '/data',
    external: false,
  },
  {
    key: 'grantwriter',
    label: 'Grant Writer',
    icon: '/images/sidebar-icons/grantwriter.svg',
    path: '/grantwriter',
    external: false,
  },
];

const DEPLOYED_STREETBOT_HIDDEN_NAV_KEYS = new Set([
  'case-management',
  'social-media',
  'documents',
  'storage',
  'data',
  'grantwriter',
]);

// Theme colors
const getThemeColors = (isDark: boolean) => ({
  sidebarBg: isDark ? '#000000' : 'rgba(255, 255, 255, 0.95)',
  overlaySurface: isDark ? 'rgba(44, 45, 56, 0.85)' : 'rgba(240, 241, 247, 0.9)',
  footerBg: isDark ? '#000000' : 'rgb(248, 249, 252)',
  hoverBg: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
  activeBg: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
  border: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.08)',
  borderLight: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
  text: isDark ? '#fff' : '#1a1c24',
  textSecondary: isDark ? 'rgba(255, 255, 255, 0.7)' : '#4b4d59',
  textMuted: isDark ? 'rgba(255, 255, 255, 0.5)' : '#6b7280',
});

const getPalette = (isDark: boolean) => ({
  textPrimary: isDark ? '#E6E7F2' : '#1a1c24',
  textSecondary: isDark ? '#9C9DB5' : '#4b5563',
});

const NavMask = memo(
  ({ navVisible, toggleNavVisible }: { navVisible: boolean; toggleNavVisible: () => void }) => (
    <div
      id="mobile-nav-mask-toggle"
      role="button"
      tabIndex={0}
      className={`nav-mask transition-opacity duration-200 ease-in-out ${navVisible ? 'active opacity-100' : 'opacity-0'}`}
      onClick={toggleNavVisible}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          toggleNavVisible();
        }
      }}
      aria-label="Toggle navigation"
    />
  ),
);

const Nav = memo(
  ({
    navVisible,
    setNavVisible,
  }: {
    navVisible: boolean;
    setNavVisible: React.Dispatch<React.SetStateAction<boolean>>;
  }) => {
    const localize = useLocalize();
    const { isAuthenticated, user } = useAuthContext();
    useTitleGeneration(isAuthenticated && !isStreetBot);
    const location = useLocation();

    const isFromHomepage = location.pathname === '/home';
    const isHomeActive = location.pathname === '/' || location.pathname === '/home';

    const isSmallScreen = useMediaQuery('(max-width: 768px)');
    const [newUser, setNewUser] = useLocalStorage('newUser', true);
    const [isMenuCollapsed, setIsMenuCollapsed] = useLocalStorage('menuCollapsed', false);
    const [isYourChatsCollapsed, setIsYourChatsCollapsed] = useLocalStorage(
      'chatsCollapsed',
      false,
    );
    const [isSidebarMinimized, setIsSidebarMinimized] = useLocalStorage(
      'sidebarMinimized',
      isStreetBot ? false : true,
    );
    const [showLoading, setShowLoading] = useState(false);
    const [tags, setTags] = useState<string[]>([]);
    const [showSearchModal, setShowSearchModal] = useState(false);
    // showNotifications state removed — now navigates to /notifications route
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const colors = useMemo(() => getThemeColors(isDark), [isDark]);
    const palette = useMemo(() => getPalette(isDark), [isDark]);
    const showAgentMarketplace = useShowMarketplace();
    const { canAccess } = useUserRole();
    const isDeployedStreetBot = isStreetBotDeployedHost();
    const isLocalStreetBot = isStreetBotLocal3180();
    const isStagingStreetBot = isStreetBotStagingHost();
    const visibleNavItems = useMemo(() => {
      let items = sidePanelNavItems;
      if (variantConfig.sidebarNavKeys) {
        const allowedKeys = new Set(variantConfig.sidebarNavKeys);
        items = items.filter((item) => allowedKeys.has(item.key));
      }
      if (isDeployedStreetBot) {
        items = items.filter(
          (item) =>
            !DEPLOYED_STREETBOT_HIDDEN_NAV_KEYS.has(item.key) ||
            (isStagingStreetBot && item.key === 'data'),
        );
      }
      return items.filter((item) => item.key === 'messages' || canAccess(item.key));
    }, [canAccess, isDeployedStreetBot, isStagingStreetBot]);

    const search = useRecoilValue(store.search);

    const { data, fetchNextPage, isFetchingNextPage, isLoading, isFetching, refetch } =
      useConversationsInfiniteQuery(
        {
          tags: tags.length === 0 ? undefined : tags,
          search: search.debouncedQuery || undefined,
        },
        {
          enabled: isAuthenticated,
          staleTime: 30000,
          cacheTime: 300000,
        },
      );

    const computedHasNextPage = useMemo(() => {
      if (data?.pages && data.pages.length > 0) {
        const lastPage: ConversationListResponse = data.pages[data.pages.length - 1];
        return lastPage.nextCursor !== null;
      }
      return false;
    }, [data?.pages]);

    const outerContainerRef = useRef<HTMLDivElement>(null);
    const conversationsRef = useRef<List | null>(null);

    const { moveToTop } = useNavScrolling<ConversationListResponse>({
      setShowLoading,
      fetchNextPage: async (options?) => {
        if (computedHasNextPage) {
          return fetchNextPage(options);
        }
        return Promise.resolve(
          {} as InfiniteQueryObserverResult<ConversationListResponse, unknown>,
        );
      },
      isFetchingNext: isFetchingNextPage,
    });

    const conversations = useMemo(() => {
      return data ? data.pages.flatMap((page) => page.conversations) : [];
    }, [data]);

    const toggleNavVisible = useCallback(() => {
      startTransition(() => {
        setNavVisible((prev: boolean) => {
          localStorage.setItem('navVisible', JSON.stringify(!prev));
          return !prev;
        });
        if (newUser) {
          setNewUser(false);
        }
      });
    }, [newUser, setNavVisible, setNewUser]);

    const itemToggleNav = useCallback(() => {
      if (isSmallScreen) {
        toggleNavVisible();
      }
    }, [isSmallScreen, toggleNavVisible]);

    useEffect(() => {
      if (isSmallScreen) {
        const savedNavVisible = localStorage.getItem('navVisible');
        if (savedNavVisible === null) {
          setNavVisible(false);
          localStorage.setItem('navVisible', JSON.stringify(false));
        }
      }
    }, [isSmallScreen, setNavVisible]);

    useEffect(() => {
      if (!isStreetBot || isSmallScreen) {
        return;
      }

      const restoredKey = 'streetbotFullSidebarRestored:v3190-sidebar';
      if (!isSidebarMinimized) {
        localStorage.setItem(restoredKey, 'true');
        return;
      }

      if (localStorage.getItem(restoredKey) === 'true') {
        return;
      }

      if (isSidebarMinimized) {
        setIsSidebarMinimized(false);
      }
      localStorage.setItem(restoredKey, 'true');
    }, [isSidebarMinimized, isSmallScreen, setIsSidebarMinimized]);

    useEffect(() => {
      refetch();
    }, [tags, refetch]);

    const loadMoreConversations = useCallback(() => {
      if (isFetchingNextPage || !computedHasNextPage) {
        return;
      }
      fetchNextPage();
    }, [isFetchingNextPage, computedHasNextPage, fetchNextPage]);

    const [isSearchLoading, setIsSearchLoading] = useState(
      !!search.query && (search.isTyping || isLoading || isFetching),
    );

    useEffect(() => {
      if (search.isTyping) {
        setIsSearchLoading(true);
      } else if (!isLoading && !isFetching) {
        setIsSearchLoading(false);
      } else if (!!search.query && (isLoading || isFetching)) {
        setIsSearchLoading(true);
      }
    }, [search.query, search.isTyping, isLoading, isFetching]);

    const sidebarWidth = isSmallScreen
      ? NAV_WIDTH.MOBILE
      : isSidebarMinimized
        ? 80
        : NAV_WIDTH.DESKTOP;

    // Profile display
    const profileName = user?.name || user?.username || 'Street Voices User';
    const profileTitle = 'Community Member';

    // Street Voices styled sidebar content
    const sidebarContent = (
      <div
        className="flex h-full flex-col"
        style={{
          backgroundColor: colors.sidebarBg,
          borderRight: `0.5px solid ${colors.border}`,
          fontFamily: 'Rubik, -apple-system, BlinkMacSystemFont, sans-serif',
          overflow: 'visible',
        }}
      >
        <nav
          id="chat-history-nav"
          aria-label={localize('com_ui_chat_history')}
          className="flex h-full flex-col"
          style={{ padding: isSidebarMinimized ? '16px 12px 24px' : '0 8px 14px' }}
          aria-hidden={!navVisible}
        >
          {/* Fixed header area */}
          <div style={{ flexShrink: 0 }}>
            {/* Header with logo and toggle */}
            <header
              id="sv-sidebar-header"
              data-minimized={isSidebarMinimized ? 'true' : 'false'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isSidebarMinimized ? 'center' : 'space-between',
                width: isSidebarMinimized ? 'auto' : 260,
                minHeight: isSidebarMinimized ? 56 : 64,
                padding: isSidebarMinimized ? '8px 0' : '18px 16px 14px 16px',
                marginBottom: 0,
                gap: isSidebarMinimized ? 12 : 0,
                flexDirection: isSidebarMinimized ? 'column' : 'row',
                boxSizing: 'border-box',
                background: 'transparent',
              }}
            >
              {variantConfig.showSidebarBranding &&
                (isSidebarMinimized ? (
                  /* Collapsed: Show only megaphone icon */
                  <img
                    className="sv-logo-img sv-sidebar-logo-mark"
                    src={sidebarAsset('/images/streetbot/megaphone-icon.svg')}
                    alt="Street Voices"
                    width={30}
                    height={30}
                    style={{ width: 30, height: 30, minWidth: 30, flexShrink: 0 }}
                  />
                ) : (
                  <div className="flex items-center gap-2" aria-label="Street Voices">
                    <img
                      className="sv-logo-img sv-sidebar-logo-mark"
                      src={sidebarAsset('/images/streetbot/megaphone-icon.svg')}
                      alt=""
                      width={30}
                      height={30}
                      style={{ width: 30, height: 30, minWidth: 30, flexShrink: 0 }}
                    />
                    <img
                      className="sv-logo-img sv-sidebar-logo-wordmark"
                      src={sidebarAsset('/images/streetbot/streetvoices-text.svg')}
                      alt="Street Voices"
                      width={140}
                      height={20}
                      style={{ width: 140, height: 'auto', flexShrink: 0 }}
                    />
                  </div>
                ))}
              <button
                id="sv-header-collapse"
                type="button"
                title={isSidebarMinimized ? 'Open sidebar' : 'Close sidebar'}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsSidebarMinimized((value: boolean) => !value);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: '0.5rem',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  marginLeft: 'auto',
                }}
                aria-label={isSidebarMinimized ? 'Expand sidebar' : 'Minimize sidebar'}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ transform: isSidebarMinimized ? 'rotate(180deg)' : 'none' }}
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
              </button>
            </header>

            <div
              id="sv-sidebar-static"
              style={{
                padding: isSidebarMinimized ? '0' : '4px 10px 0',
                boxSizing: 'border-box',
              }}
            >
              {/* Home button */}
              <Link
                to="/home"
                className={`sb-action-btn sv-sidebar-btn${isSidebarMinimized ? 'sb-action-minimized' : ''}${isHomeActive ? 'sb-nav-active' : ''}`}
                title={isSidebarMinimized ? 'Home' : undefined}
              >
                <img
                  src={sidebarAsset('/images/sidebar-icons/home.svg')}
                  alt=""
                  width={18}
                  height={18}
                  className="sb-action-icon sv-sidebar-icon"
                />
                {!isSidebarMinimized && <span className="sv-sidebar-btn-label">Home</span>}
              </Link>

              {/* New chat button */}
              <NewChat
                toggleNav={toggleNavVisible}
                isSmallScreen={isSmallScreen}
                isMinimized={isSidebarMinimized}
              />

              {/* Notifications button */}
              <Link
                to="/notifications"
                className={`sb-action-btn sv-sidebar-btn${isSidebarMinimized ? 'sb-action-minimized' : ''}`}
                title={isSidebarMinimized ? 'Notifications' : undefined}
              >
                <img
                  src={sidebarAsset('/images/sidebar-icons/notifications.svg')}
                  alt=""
                  width={18}
                  height={18}
                  className="sb-action-icon sv-sidebar-icon"
                />
                {!isSidebarMinimized && <span className="sv-sidebar-btn-label">Notifications</span>}
              </Link>

              {/* Agent Marketplace button */}
              {(isLocalStreetBot || (!isDeployedStreetBot && (isStreetBot || showAgentMarketplace))) && (
                <Link
                  to="/agents"
                  className={`sb-action-btn sv-sidebar-btn${isSidebarMinimized ? 'sb-action-minimized' : ''}`}
                  title={isSidebarMinimized ? 'Agent Marketplace' : undefined}
                >
                  <img
                    src={sidebarAsset('/images/sidebar-icons/agent-marketplace.svg')}
                    alt=""
                    width={18}
                    height={18}
                    className="sb-action-icon sv-sidebar-icon"
                  />
                  {!isSidebarMinimized && (
                    <span className="sv-sidebar-btn-label">Agent Marketplace</span>
                  )}
                </Link>
              )}

              {/* Automations button */}
              {isStreetBot && !isDeployedStreetBot && (
                <Link
                  to="/tasks"
                  className={`sb-action-btn sv-sidebar-btn${isSidebarMinimized ? 'sb-action-minimized' : ''}`}
                  title={isSidebarMinimized ? 'Automations' : undefined}
                >
                  <img
                    src={sidebarAsset('/images/sidebar-icons/automations.svg')}
                    alt=""
                    width={18}
                    height={18}
                    className="sb-action-icon sv-sidebar-icon"
                  />
                  {!isSidebarMinimized && <span className="sv-sidebar-btn-label">Automations</span>}
                </Link>
              )}

              {/* Search messages button */}
              <button
                type="button"
                onClick={() => setShowSearchModal(true)}
                className={`sb-action-btn sv-sidebar-btn${isSidebarMinimized ? 'sb-action-minimized' : ''}`}
                title={isSidebarMinimized ? 'Search Messages' : undefined}
              >
                <img
                  src={sidebarAsset('/images/streetbot/icon-search.svg')}
                  alt=""
                  width={18}
                  height={18}
                  className="sb-action-icon sv-sidebar-icon"
                />
                {!isSidebarMinimized && (
                  <span className="sv-sidebar-btn-label">Search Messages</span>
                )}
              </button>
            </div>
          </div>

          {/* Scrollable area: Navigation + chat history */}
          <div
            className="sidebar-scroll"
            ref={outerContainerRef}
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              overflowX: 'hidden',
              scrollbarGutter: 'stable',
              paddingRight: 0,
              marginRight: 0,
              marginTop: 0,
            }}
          >
            {/* Navigation items */}
            <div
              id="sv-sidebar-nav-list"
              style={{
                marginBottom: 0,
                marginTop: isStreetBot && !isSidebarMinimized ? 10 : 0,
                borderTop:
                  isStreetBot && !isSidebarMinimized ? '1px solid rgba(127,127,136,0.18)' : 'none',
                padding: isStreetBot && !isSidebarMinimized ? '12px 10px 0' : 0,
                maxHeight: undefined,
                overflowY: 'visible',
                overflowX: 'visible',
                boxSizing: 'border-box',
              }}
            >
              {/* Menu header - only show when not minimized */}
              {!isStreetBot && !isSidebarMinimized && (
                <button
                  type="button"
                  onClick={() => setIsMenuCollapsed(!isMenuCollapsed)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    marginLeft: 9,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      color: palette.textSecondary,
                      fontSize: 12,
                      fontFamily: 'Rubik, sans-serif',
                      letterSpacing: '0.04em',
                    }}
                  >
                    MENU
                  </span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={palette.textSecondary}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: isMenuCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              )}

              {/* Show nav items when not collapsed, or always show when minimized (icons only) */}
              {(isStreetBot || !isMenuCollapsed || isSidebarMinimized) && (
                <nav style={{ display: 'flex', flexDirection: 'column' }}>
                  {visibleNavItems.map((item) => {
                    const isActive =
                      location.pathname === item.path ||
                      location.pathname.startsWith(item.path + '/');
                    const cls = `sb-nav-item sv-sidebar-btn${isSidebarMinimized ? ' sb-nav-minimized' : ''}${isActive ? ' sb-nav-active' : ''}`;

                    if (item.external) {
                      return (
                        <a
                          key={item.key}
                          href={item.path}
                          className={cls}
                          title={isSidebarMinimized ? item.label : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={sidebarAsset(item.icon)}
                            alt=""
                            width={18}
                            height={18}
                            className="sb-nav-icon sv-sidebar-icon"
                          />
                          {!isSidebarMinimized && (
                            <span className="sv-sidebar-btn-label">{item.label}</span>
                          )}
                        </a>
                      );
                    }

                    return (
                      <Link
                        key={item.key}
                        to={item.path}
                        className={cls}
                        title={isSidebarMinimized ? item.label : undefined}
                      >
                        <img
                          src={sidebarAsset(item.icon)}
                          alt=""
                          width={18}
                          height={18}
                          className="sb-nav-icon sv-sidebar-icon"
                        />
                        {!isSidebarMinimized && (
                          <span className="sv-sidebar-btn-label">{item.label}</span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              )}
            </div>

            {/* Your chats section - only show when not minimized */}
            {!isSidebarMinimized && isAuthenticated && (
              <div
                style={{
                  flex: isStreetBot ? '0 0 280px' : 1,
                  minHeight: isStreetBot ? 240 : 0,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsYourChatsCollapsed(!isYourChatsCollapsed)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    marginLeft: 9,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      color: palette.textSecondary,
                      fontSize: isStreetBot ? 13 : 12,
                      fontFamily: 'Rubik, sans-serif',
                      fontWeight: isStreetBot ? 700 : 400,
                      letterSpacing: isStreetBot ? '0' : '0.04em',
                    }}
                  >
                    {isStreetBot ? 'Chats' : 'YOUR CHATS'}
                  </span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={palette.textSecondary}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: isYourChatsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {!isYourChatsCollapsed && (
                  <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                    <Conversations
                      conversations={conversations}
                      moveToTop={moveToTop}
                      toggleNav={itemToggleNav}
                      containerRef={conversationsRef}
                      loadMoreConversations={loadMoreConversations}
                      isLoading={isFetchingNextPage || showLoading || isLoading}
                      isSearchLoading={isSearchLoading}
                      isChatsExpanded={!isYourChatsCollapsed}
                      setIsChatsExpanded={(val) => setIsYourChatsCollapsed(!val)}
                      hideHeader={isStreetBot}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer - Profile section */}
          <div
            style={{
              marginTop: 'auto',
              marginLeft: isSidebarMinimized ? -12 : -8,
              marginRight: isSidebarMinimized ? -12 : -8,
              marginBottom: isSidebarMinimized ? -24 : -14,
              paddingTop: 0,
              paddingBottom: 0,
              paddingLeft: isSidebarMinimized ? 12 : 18,
              paddingRight: isSidebarMinimized ? 12 : 18,
              borderTop: `1px solid ${colors.border}`,
              backgroundColor: colors.footerBg,
              flexShrink: 0,
            }}
          >
            {!isSidebarMinimized ? (
              <Suspense fallback={<Skeleton className="mt-1 h-12 w-full rounded-xl" />}>
                <AccountSettings />
              </Suspense>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 0',
                }}
              >
                <Suspense fallback={<Skeleton className="h-8 w-8 rounded-full" />}>
                  <AccountSettings />
                </Suspense>
              </div>
            )}
          </div>
        </nav>
      </div>
    );

    const modals = (
      <>
        {showSearchModal && (
          <SearchChatsModal
            conversations={conversations}
            onClose={() => setShowSearchModal(false)}
            onNewChat={() => {
              toggleNavVisible();
            }}
          />
        )}
      </>
    );

    // Mobile: Fixed positioned sidebar
    if (isSmallScreen) {
      return (
        <>
          <div
            data-testid="nav"
            className={cn('nav fixed left-0 top-0 z-[110] h-full', navVisible && 'active')}
            style={{
              width: sidebarWidth,
              transform: navVisible ? 'translateX(0)' : `translateX(-${sidebarWidth}px)`,
              transition: 'transform 0.2s ease-out',
            }}
          >
            {sidebarContent}
          </div>
          <NavMask navVisible={navVisible} toggleNavVisible={toggleNavVisible} />
          {createPortal(modals, document.body)}
        </>
      );
    }

    // Desktop: Inline sidebar
    return (
      <>
        <div
          className="flex-shrink-0"
          style={{ width: navVisible ? sidebarWidth : 0, transition: 'width 0.2s ease-out' }}
        >
          <motion.div
            data-testid="nav"
            className={cn('nav h-full', navVisible && 'active')}
            style={{ width: sidebarWidth, position: 'relative', zIndex: 1400 }}
            initial={false}
            animate={{ x: navVisible ? 0 : -sidebarWidth }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {sidebarContent}
          </motion.div>
        </div>
        {createPortal(modals, document.body)}
      </>
    );
  },
);

Nav.displayName = 'Nav';

export default Nav;
