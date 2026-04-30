/**
 * Nav link hover prefetch — when user hovers a nav link, eagerly loads both
 * the JS bundle and any prefetchable data for that route. This eliminates
 * ALL perceived load time when the user clicks.
 *
 * Each route is prefetched at most once per session.
 */

const prefetched = new Set<string>();

type PrefetchEntry = {
  /** Dynamically import the route chunk */
  chunk: () => Promise<unknown>;
  /** Optional data prefetch function */
  data?: () => Promise<unknown>;
};

// Lazy-build the map so we don't import anything at module level
let _map: Record<string, PrefetchEntry> | null = null;

function getMap(): Record<string, PrefetchEntry> {
  if (_map) return _map;
  _map = {
    '/news': {
      chunk: () => import('~/components/streetbot/news/NewsPage'),
      data: () => import('~/components/streetbot/news/newsPrefetch').then((m) => m.prefetchNews()),
    },
    '/directory': {
      chunk: () => import('~/components/streetbot/directory/DirectoryPage'),
      data: () => import('~/components/streetbot/directory/directoryPrefetch').then((m) => m.prefetchDirectory()),
    },
    '/jobs': {
      chunk: () => import('~/components/streetbot/jobs/JobsPage'),
      data: () => import('~/components/streetbot/jobs/jobsPrefetch').then((m) => m.prefetchJobs()),
    },
    '/profile': { chunk: () => import('~/components/streetbot/profile/ProfilePage') },
    '/gallery': { chunk: () => import('~/components/streetbot/gallery/GalleryPage') },
    '/learning': { chunk: () => import('~/components/streetbot/academy/AcademyPage') },
    '/forum': { chunk: () => import('~/components/streetbot/forum/ForumPage') },
    '/groups': { chunk: () => import('~/components/streetbot/groups/GroupsPage') },
    '/messages': { chunk: () => import('~/components/streetbot/messages/MessagesPage') },
    '/calendar': { chunk: () => import('~/components/streetbot/calendar/CalendarPage') },
    '/case-management': { chunk: () => import('~/components/streetbot/case-management/CaseManagementPage') },
    '/documents': { chunk: () => import('~/components/streetbot/documents/DocumentsPage') },
    '/tasks': { chunk: () => import('~/components/streetbot/tasks/TasksPage') },
    '/settings': { chunk: () => import('~/components/streetbot/settings/SettingsPage') },
    '/dashboard': { chunk: () => import('~/components/streetbot/dashboard/DashboardPage') },
    '/social-media': { chunk: () => import('~/components/streetbot/social-media/SocialMediaPage') },
    '/storage': { chunk: () => import('~/components/streetbot/storage/StoragePage') },
    '/data': { chunk: () => import('~/components/streetbot/database/DatabasePage') },
    '/grantwriter': { chunk: () => import('~/components/streetbot/grantwriter/GrantWriterPage') },
    '/notifications': { chunk: () => import('~/components/streetbot/notifications/NotificationsPage') },
    '/about': { chunk: () => import('~/components/streetbot/info/AboutPage') },
    '/terms': { chunk: () => import('~/components/streetbot/info/TermsPage') },
    '/privacy': { chunk: () => import('~/components/streetbot/info/PrivacyPage') },
    '/how-it-works': { chunk: () => import('~/components/streetbot/info/HowItWorksPage') },
  };
  return _map;
}

/**
 * Call this on mouseEnter of a nav link. Prefetches the route chunk and
 * optionally the page data. No-ops if already prefetched.
 */
export function prefetchRoute(href: string): void {
  if (prefetched.has(href)) return;
  prefetched.add(href);

  const entry = getMap()[href];
  if (!entry) return;

  // Fire and forget — errors are non-critical
  entry.chunk().catch(() => {});
  if (entry.data) {
    entry.data().catch(() => {});
  }
}
