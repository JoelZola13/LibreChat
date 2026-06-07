import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { motion } from 'framer-motion';
import { Skeleton, useMediaQuery } from '@librechat/client';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import type { InfiniteQueryObserverResult } from '@tanstack/react-query';
import type { ConversationListResponse } from 'librechat-data-provider';
import type { List } from 'react-virtualized';
import { QueryKeys } from 'librechat-data-provider';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  Database,
  FileText,
  FolderKanban,
  GraduationCap,
  Grid3X3,
  Home,
  Image,
  MessageCircle,
  MessagesSquare,
  Search,
  Settings,
  Share2,
  User,
  Users,
} from 'lucide-react';
import {
  useAuthContext,
  useHasAccess,
  useLocalStorage,
  useNavScrolling,
} from '~/hooks';
import { useConversationsInfiniteQuery, useTitleGeneration } from '~/data-provider';
import { Conversations } from '~/components/Conversations';
import AccountSettings from './AccountSettings';
import BookmarkNav from './Bookmarks/BookmarkNav';
import { useNewConvo } from '~/hooks';
import { clearMessagesCache } from '~/utils';
import { cn } from '~/utils';
import store from '~/store';

const STREET_VOICES_NAV_WIDTH = {
  MOBILE: 320,
  DESKTOP: 260,
} as const;

const streetVoicesItems = [
  { label: 'Home', path: '/home', icon: Home, match: ['/home'] },
  { label: 'New Chat', path: '/c/new', icon: EditIcon, match: ['/c/'] },
  { label: 'Notifications', path: '/notifications', icon: Bell, match: ['/notifications'] },
  { label: 'Agent Marketplace', path: '/agents', icon: Grid3X3, match: ['/agents'] },
  { label: 'Automations', path: '/automations', icon: Settings, match: ['/automations'] },
  { label: 'Search Messages', path: '/search', icon: Search, match: ['/search'] },
] as const;

const streetVoicesPlatformItems = [
  { label: 'Street Profile', path: '/profiles', icon: User, match: ['/profile', '/profiles', '/myprofile', '/settings', '/creatives'] },
  { label: 'Word On The Street', path: '/word-on-the-street', icon: MessageCircle, match: ['/forum', '/word-on-the-street'] },
  { label: 'Street Gallery', path: '/gallery', icon: Image, match: ['/gallery'] },
  { label: 'Groups', path: '/groups', icon: Users, match: ['/groups'] },
  { label: 'News', path: '/news', icon: FileText, match: ['/news'] },
  { label: 'Messages', path: '/messages', icon: MessagesSquare, match: ['/messages'] },
  { label: 'Directory', path: '/directory', icon: DirectoryIcon, match: ['/directory'] },
  { label: 'Job Board', path: '/jobs', icon: BriefcaseBusiness, match: ['/jobs'] },
  { label: 'Academy', path: '/academy', icon: GraduationCap, match: ['/academy', '/learning'] },
  { label: 'Calendar', path: '/calendar', icon: CalendarDays, match: ['/calendar'] },
  { label: 'Case Management', path: '/case-management', icon: FolderKanban, match: ['/case-management'] },
  { label: 'Social Media', path: '/social-media', icon: Share2, match: ['/social-media'] },
  { label: 'Task', path: '/tasks', icon: ClipboardList, match: ['/tasks', '/mission-control'] },
  { label: 'Documents', path: '/documents', icon: FileText, match: ['/documents'] },
  { label: 'Storage', path: '/storage', icon: Database, match: ['/storage'] },
  { label: 'Database', path: '/data', icon: Database, match: ['/data'] },
  { label: 'Grant Writer', path: '/grantwriter', icon: ClipboardList, match: ['/grantwriter'] },
] as const;

function EditIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16.7929 2.79289C18.0118 1.57394 19.9882 1.57394 21.2071 2.79289C22.4261 4.01184 22.4261 5.98815 21.2071 7.20711L12.7071 15.7071C12.5196 15.8946 12.2652 16 12 16H9C8.44772 16 8 15.5523 8 15V12C8 11.7348 8.10536 11.4804 8.29289 11.2929L16.7929 2.79289ZM19.7929 4.20711C19.355 3.7692 18.645 3.7692 18.2071 4.2071L10 12.4142V14H11.5858L19.7929 5.79289C20.2308 5.35499 20.2308 4.64501 19.7929 4.20711ZM6 5C5.44772 5 5 5.44771 5 6V18C5 18.5523 5.44772 19 6 19H18C18.5523 19 19 18.5523 19 18V14C19 13.4477 19.4477 13 20 13C20.5523 13 21 13.4477 21 14V18C21 19.6569 19.6569 21 18 21H6C4.34315 21 3 19.6569 3 18V6C3 4.34314 4.34315 3 6 3H10C10.5523 3 11 3.44771 11 4C11 4.55228 10.5523 5 10 5H6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DirectoryIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="3" width="14" height="18" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <path d="M8 3v18M20 7h-2M20 12h-2M20 17h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SidebarToggleIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

function isItemActive(pathname: string, match: readonly string[]) {
  return match.some((entry) => pathname === entry || pathname.startsWith(`${entry}/`));
}

function NavItem({
  label,
  path,
  icon: Icon,
  active,
  onNavigate,
}: {
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean;
  onNavigate: (path: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(path)}
      className={cn(
        'group flex h-12 w-full items-center gap-4 rounded-[18px] border px-5 text-left text-[15px] font-semibold transition-colors',
        active
          ? 'border-[#2A2B31] bg-[#111111] text-white dark:border-[#2A2B31] dark:bg-[#111111] dark:text-white'
          : 'border-transparent text-[#AEB0C0] hover:border-[#2A2B31] hover:bg-[#111111] hover:text-white dark:text-[#AEB0C0]',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon size={22} className="shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

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

NavMask.displayName = 'StreetVoicesNavMask';

function StreetVoicesNav({
  navVisible,
  setNavVisible,
}: {
  navVisible: boolean;
  setNavVisible: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthContext();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const [newUser, setNewUser] = useLocalStorage('newUser', true);
  const [isChatsExpanded, setIsChatsExpanded] = useLocalStorage('chatsExpanded', true);
  const [showLoading, setShowLoading] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const outerContainerRef = useRef<HTMLDivElement>(null);
  const conversationsRef = useRef<List | null>(null);
  const conversation = useRecoilValue(store.conversationByIndex(0));
  const search = useRecoilValue(store.search);
  const { newConversation } = useNewConvo();

  useTitleGeneration(isAuthenticated);

  const hasAccessToBookmarks = useHasAccess({
    permissionType: PermissionTypes.BOOKMARKS,
    permission: Permissions.USE,
  });

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

  const conversations = useMemo(
    () => (data ? data.pages.flatMap((page) => page.conversations) : []),
    [data],
  );

  const { moveToTop } = useNavScrolling<ConversationListResponse>({
    setShowLoading,
    fetchNextPage: async (options?) => {
      if (computedHasNextPage) {
        return fetchNextPage(options);
      }
      return Promise.resolve({} as InfiniteQueryObserverResult<ConversationListResponse, unknown>);
    },
    isFetchingNext: isFetchingNextPage,
  });

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

  const handleNavigate = useCallback(
    (path: string) => {
      if (path === '/c/new') {
        clearMessagesCache(queryClient, conversation?.conversationId);
        queryClient.invalidateQueries([QueryKeys.messages]);
        newConversation();
      }
      navigate(path, path === '/c/new' ? { state: { focusChat: true } } : undefined);
      if (isSmallScreen) {
        toggleNavVisible();
      }
    },
    [conversation?.conversationId, isSmallScreen, navigate, newConversation, queryClient, toggleNavVisible],
  );

  const itemToggleNav = useCallback(() => {
    if (isSmallScreen) {
      toggleNavVisible();
    }
  }, [isSmallScreen, toggleNavVisible]);

  useEffect(() => {
    refetch();
  }, [tags, refetch]);

  const loadMoreConversations = useCallback(() => {
    if (isFetchingNextPage || !computedHasNextPage) {
      return;
    }
    fetchNextPage();
  }, [isFetchingNextPage, computedHasNextPage, fetchNextPage]);

  const isSearchLoading = !!search.query && (search.isTyping || isLoading || isFetching);
  const sidebarWidth = isSmallScreen
    ? STREET_VOICES_NAV_WIDTH.MOBILE
    : STREET_VOICES_NAV_WIDTH.DESKTOP;

  const sidebarContent = (
    <div className="flex h-full flex-col bg-black text-white">
      <div
        className="flex min-h-[64px] items-center justify-between"
        style={{ padding: '18px 16px 14px 16px' }}
      >
        <button
          type="button"
          onClick={() => handleNavigate('/home')}
          className="flex h-8 w-[170px] items-center gap-2 overflow-visible text-left"
          aria-label="Street Voices home"
        >
          <img
            src="/images/streetbot/megaphone-icon.svg"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 shrink-0"
          />
          <img
            src="/images/streetbot/streetvoices-text.svg"
            alt="Street Voices"
            width={130}
            height={19}
            className="h-auto w-[130px] shrink-0"
          />
        </button>
        <button
          type="button"
          onClick={toggleNavVisible}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/10"
          aria-label="Close sidebar"
          aria-expanded={navVisible}
        >
          <SidebarToggleIcon />
        </button>
      </div>

      <nav
        id="chat-history-nav"
        aria-label="Street Voices navigation"
        className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-3"
        aria-hidden={!navVisible}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden" ref={outerContainerRef}>
          <div className="space-y-1 pb-3">
            {streetVoicesItems.map((item) => (
              <NavItem
                key={item.label}
                label={item.label}
                path={item.path}
                icon={item.icon}
                active={isItemActive(pathname, item.match)}
                onNavigate={handleNavigate}
              />
            ))}
          </div>

          <div className="mx-2 mb-3 h-px bg-white/10" />

          <div className="min-h-0 flex-shrink-0 space-y-1 overflow-y-auto pb-2 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {streetVoicesPlatformItems.map((item) => (
              <NavItem
                key={item.label}
                label={item.label}
                path={item.path}
                icon={item.icon}
                active={isItemActive(pathname, item.match)}
                onNavigate={handleNavigate}
              />
            ))}
          </div>

          {hasAccessToBookmarks && (
            <div className="hidden">
              <Suspense fallback={null}>
                <BookmarkNav tags={tags} setTags={setTags} />
              </Suspense>
            </div>
          )}

          <div className="min-h-[120px] flex-1 overflow-hidden border-t border-white/10 pt-2">
            <Conversations
              conversations={conversations}
              moveToTop={moveToTop}
              toggleNav={itemToggleNav}
              containerRef={conversationsRef}
              loadMoreConversations={loadMoreConversations}
              isLoading={isFetchingNextPage || showLoading || isLoading}
              isSearchLoading={isSearchLoading}
              isChatsExpanded={isChatsExpanded}
              setIsChatsExpanded={setIsChatsExpanded}
            />
          </div>
        </div>

        <Suspense fallback={<Skeleton className="mt-1 h-12 w-full rounded-xl" />}>
          <AccountSettings />
        </Suspense>
      </nav>
    </div>
  );

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
      </>
    );
  }

  return (
    <div
      className="flex-shrink-0 overflow-hidden"
      style={{ width: navVisible ? sidebarWidth : 0, transition: 'width 0.2s ease-out' }}
    >
      <motion.div
        data-testid="nav"
        className={cn('nav h-full', navVisible && 'active')}
        style={{ width: sidebarWidth }}
        initial={false}
        animate={{ x: navVisible ? 0 : -sidebarWidth }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {sidebarContent}
      </motion.div>
    </div>
  );
}

export default memo(StreetVoicesNav);
