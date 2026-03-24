/**
 * Route bundle preloader — eagerly imports all React.lazy route chunks after
 * initial page load so that navigation to any page has zero JS bundle delay.
 *
 * Uses requestIdleCallback (with setTimeout fallback) to avoid competing with
 * critical rendering work. Each chunk is loaded sequentially with a small gap
 * to avoid network congestion.
 */

// All lazy route chunks — ordered by navigation likelihood
const routeChunks: Array<() => Promise<unknown>> = [
  // Most commonly navigated pages first
  () => import('~/components/streetbot/news/NewsPage'),
  () => import('~/components/streetbot/directory/DirectoryPage'),
  () => import('~/components/streetbot/jobs/JobsPage'),
  () => import('~/components/streetbot/profile/ProfilePage'),
  () => import('~/components/streetbot/groups/GroupsPage'),
  () => import('~/components/streetbot/calendar/CalendarPage'),
  () => import('~/components/streetbot/messages/MessagesPage'),
  () => import('~/components/streetbot/forum/ForumPage'),
  () => import('~/components/streetbot/gallery/GalleryPage'),
  () => import('~/components/streetbot/documents/DocumentsPage'),
  () => import('~/components/streetbot/academy/AcademyPage'),
  () => import('~/components/streetbot/tasks/TasksPage'),
  () => import('~/components/streetbot/notifications/NotificationsPage'),
  () => import('~/components/streetbot/social-media/SocialMediaPage'),
  () => import('~/components/streetbot/storage/StoragePage'),
  () => import('~/components/streetbot/database/DatabasePage'),
  () => import('~/components/streetbot/grantwriter/GrantWriterPage'),
  () => import('~/components/streetbot/settings/SettingsPage'),
  () => import('~/components/streetbot/dashboard/DashboardPage'),
  // Info / static pages
  () => import('~/components/streetbot/info/HowItWorksPage'),
  () => import('~/components/streetbot/info/AboutPage'),
  () => import('~/components/streetbot/info/TermsPage'),
  () => import('~/components/streetbot/info/PrivacyPage'),
  // Directory sub-pages
  () => import('~/components/streetbot/directory/AddListingPage'),
  () => import('~/components/streetbot/directory/EditListingPage'),
  () => import('~/components/streetbot/directory/ServiceDetailPage'),
  // News editor
  () => import('~/components/streetbot/news/editor/EditorPage'),
  // Admin pages
  () => import('~/components/streetbot/admin/AdminClaimsPage'),
  () => import('~/components/streetbot/admin/AdminRolesPage'),
  // Core routes
  () => import('~/routes/ChatRoute'),
  () => import('~/routes/Search'),
  () => import('~/routes/ShareRoute'),
  () => import('~/routes/HomepageRoute'),
  () => import('~/components/Chat/PublicLanding'),
  () => import('~/components/Agents/Marketplace'),
];

let preloaded = false;

function scheduleIdle(fn: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(fn, { timeout: 5000 });
  } else {
    setTimeout(fn, 100);
  }
}

async function loadChunks(): Promise<void> {
  for (const loader of routeChunks) {
    try {
      await loader();
    } catch {
      // Chunk load failures are non-critical — the lazy import will retry on navigation
    }
    // Yield between chunks to avoid blocking the main thread
    await new Promise((r) => setTimeout(r, 20));
  }
}

/**
 * Preload all route JS bundles in the background. Safe to call multiple times.
 * Uses requestIdleCallback to start after critical work completes.
 */
export function preloadAllRoutes(): void {
  if (preloaded) return;
  preloaded = true;
  scheduleIdle(() => {
    loadChunks();
  });
}
