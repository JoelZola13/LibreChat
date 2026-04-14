import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import {
  Login,
  VerifyEmail,
  Registration,
  ResetPassword,
  ApiErrorWatcher,
  TwoFactorScreen,
  RequestPasswordReset,
} from '~/components/Auth';
import { MarketplaceProvider } from '~/components/Agents/MarketplaceContext';
const AgentMarketplace = lazy(() => import('~/components/Agents/Marketplace'));
import { OAuthSuccess, OAuthError } from '~/components/OAuth';
import { AuthContextProvider } from '~/hooks/AuthContext';
import { useUserRole } from '~/components/streetbot/lib/auth/useUserRole';
import { isStreetBot } from '~/config/appVariant';
// StreetBotLogin removed — using standard LibreChat Login with Casdoor SSO
import RouteErrorBoundary from './RouteErrorBoundary';
import StartupLayout from './Layouts/Startup';
import LoginLayout from './Layouts/Login';
import dashboardRoutes from './Dashboard';


// Lazy-loaded core routes (moves highlight.js, katex, ChatView out of initial bundle)
const ChatRoute = lazy(() => import('./ChatRoute'));
const Search = lazy(() => import('./Search'));
const ShareRoute = lazy(() => import('./ShareRoute'));
const Root = lazy(() => import('./Root'));

// Lazy-loaded Street Bot Pro pages
const ProfilePage = lazy(() => import('~/components/streetbot/profile/ProfilePage'));
const ForumPage = lazy(() => import('~/components/streetbot/forum/ForumPage'));
const GalleryPage = lazy(() => import('~/components/streetbot/gallery/GalleryPage'));
const GroupsPage = lazy(() => import('~/components/streetbot/groups/GroupsPage'));
const GroupDetailPage = lazy(() => import('~/components/streetbot/groups/GroupDetailPage'));
const NewsPage = lazy(() => import('~/components/streetbot/news/NewsPage'));
const NewsEditorPage = lazy(() => import('~/components/streetbot/news/editor/EditorPage'));
const DirectoryPage = lazy(() => import('~/components/streetbot/directory/DirectoryPage'));
const ServiceDetailPage = lazy(() => import('~/components/streetbot/directory/ServiceDetailPage'));
const JobsPage = lazy(() => import('~/components/streetbot/jobs/JobsPage'));
const MyApplicationsPage = lazy(() => import('~/components/streetbot/jobs/MyApplicationsPage'));
const EmployerDashboardPage = lazy(() => import('~/components/streetbot/jobs/EmployerDashboardPage'));
const CalendarPage = lazy(() => import('~/components/streetbot/calendar/CalendarPage'));
const MessagesPage = lazy(() => import('~/components/streetbot/messages/MessagesPage'));
const DocumentsPage = lazy(() => import('~/components/streetbot/documents/DocumentsPage'));
const CaseManagementPage = lazy(
  () => import('~/components/streetbot/case-management/CaseManagementPage'),
);
const AcademyPage = lazy(() => import('~/components/streetbot/academy/AcademyPage'));
const AcademyCoursesPage = lazy(() => import('~/components/streetbot/academy/AcademyCoursesPage'));
const AcademyPathsPage = lazy(() => import('~/components/streetbot/academy/AcademyPathsPage'));
const AcademyLivePage = lazy(() => import('~/components/streetbot/academy/AcademyLivePage'));
const AcademyInstructorPage = lazy(
  () => import('~/components/streetbot/academy/AcademyInstructorPage'),
);
const MissionControlPage = lazy(() => import('~/components/streetbot/mission-control/MissionControlPage'));
const NotificationsPage = lazy(
  () => import('~/components/streetbot/notifications/NotificationsPage'),
);
const SocialMediaPage = lazy(() => import('~/components/streetbot/social-media/SocialMediaPage'));
const StoragePage = lazy(() => import('~/components/streetbot/storage/StoragePage'));
const DatabasePage = lazy(() => import('~/components/streetbot/database/DatabasePage'));
const GrantWriterPage = lazy(() => import('~/components/streetbot/grantwriter/GrantWriterPage'));
const AgentMarketplacePage = lazy(() => import('~/components/streetbot/agents/AgentMarketplacePage'));
const CreativeProfilePage = lazy(() => import('~/components/streetbot/profile/CreativeProfilePage'));
const BookingPage = lazy(() => import('~/components/streetbot/profile/BookingPage'));
const MyProfilePage = lazy(() => import('~/components/streetbot/profile/MyProfilePage'));
const SettingsPage = lazy(() => import('~/components/streetbot/settings/SettingsPage'));
const SBDashboardPage = lazy(() => import('~/components/streetbot/dashboard/DashboardPage'));
const HowItWorksPage = lazy(() => import('~/components/streetbot/info/HowItWorksPage'));
const AboutPage = lazy(() => import('~/components/streetbot/info/AboutPage'));
const TermsPage = lazy(() => import('~/components/streetbot/info/TermsPage'));
const PrivacyPage = lazy(() => import('~/components/streetbot/info/PrivacyPage'));
const AddListingPage = lazy(() => import('~/components/streetbot/directory/AddListingPage'));
const EditListingPage = lazy(() => import('~/components/streetbot/directory/EditListingPage'));
const AdminClaimsPage = lazy(() => import('~/components/streetbot/admin/AdminClaimsPage'));
const AdminRolesPage = lazy(() => import('~/components/streetbot/admin/AdminRolesPage'));

const SBPageFallback = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: '#999',
    }}
  >
    Loading...
  </div>
);

const sbPage = (Component: React.LazyExoticComponent<React.ComponentType>) => (
  <Suspense fallback={<SBPageFallback />}>
    <Component />
  </Suspense>
);

const RoleGuard = ({ navKey, children }: { navKey: string; children: React.ReactNode }) => {
  const requireFreshRole = !isStreetBot || navKey === 'manage';
  const { canAccess, isLoading } = useUserRole({ requireFresh: requireFreshRole });
  if (isLoading) return <SBPageFallback />;
  if (!canAccess(navKey)) return <Navigate to="/home" replace />;
  return <>{children}</>;
};

const guardedSbPage = (
  navKey: string,
  Component: React.LazyExoticComponent<React.ComponentType>,
) => (
  <RoleGuard navKey={navKey}>
    <Suspense fallback={<SBPageFallback />}>
      <Component />
    </Suspense>
  </RoleGuard>
);

const AuthLayout = () => (
  <AuthContextProvider>
    <Outlet />
    <ApiErrorWatcher />
  </AuthContextProvider>
);

const baseEl = document.querySelector('base');
const baseHref = baseEl?.getAttribute('href') || '/';

export const router = createBrowserRouter(
  [
    {
      path: 'share/:shareId',
      element: (
        <Suspense fallback={<SBPageFallback />}>
          <ShareRoute />
        </Suspense>
      ),
      errorElement: <RouteErrorBoundary />,
    },
    {
      path: 'oauth',
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: 'success',
          element: <OAuthSuccess />,
        },
        {
          path: 'error',
          element: <OAuthError />,
        },
      ],
    },
    {
      path: '/',
      element: <StartupLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: 'register',
          element: <Registration />,
        },
        {
          path: 'forgot-password',
          element: <RequestPasswordReset />,
        },
        {
          path: 'reset-password',
          element: <ResetPassword />,
        },
      ],
    },
    {
      path: 'verify',
      element: <VerifyEmail />,
      errorElement: <RouteErrorBoundary />,
    },
    // No public homepage — unauthenticated users go to /login via AuthContext
    {
      element: <AuthLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: '/',
          element: <LoginLayout />,
          children: [
            {
              path: 'login',
              element: <Login />,
            },
            {
              path: 'login/2fa',
              element: <TwoFactorScreen />,
            },
          ],
        },
        dashboardRoutes,
        // All authenticated routes use Root layout (with sidebar)
        {
          path: '/',
          element: (
            <Suspense fallback={<SBPageFallback />}>
              <Root />
            </Suspense>
          ),
          children: [
            // Default landing → chat interface (same as /c/new)
            {
              index: true,
              element: <Navigate to="/c/new" replace />,
            },
            {
              path: 'home',
              element: (
                <Suspense fallback={<SBPageFallback />}>
                  <ChatRoute />
                </Suspense>
              ),
            },
            {
              path: 'c/:conversationId?',
              element: (
                <Suspense fallback={<SBPageFallback />}>
                  <ChatRoute />
                </Suspense>
              ),
            },
            {
              path: 'search',
              element: (
                <Suspense fallback={<SBPageFallback />}>
                  <Search />
                </Suspense>
              ),
            },
            { path: 'agents', element: sbPage(AgentMarketplacePage) },
            { path: 'agents/:team', element: sbPage(AgentMarketplacePage) },
            // Street Bot Pro pages — shared across both variants
            { path: 'profile', element: guardedSbPage('profile', ProfilePage) },
            { path: 'profile/*', element: guardedSbPage('profile', ProfilePage) },
            { path: 'creatives/:username', element: guardedSbPage('profile', CreativeProfilePage) },
            { path: 'creatives/:username/book', element: guardedSbPage('profile', BookingPage) },
            { path: 'groups', element: guardedSbPage('groups', GroupsPage) },
            { path: 'groups/:groupId', element: guardedSbPage('groups', GroupDetailPage) },
            { path: 'news/editor', element: guardedSbPage('news', NewsEditorPage) },
            { path: 'news/editor/:id', element: guardedSbPage('news', NewsEditorPage) },
            { path: 'news', element: guardedSbPage('news', NewsPage) },
            { path: 'news/*', element: guardedSbPage('news', NewsPage) },
            // Info pages (public, no auth guard)
            { path: 'how-it-works', element: sbPage(HowItWorksPage) },
            { path: 'about', element: sbPage(AboutPage) },
            { path: 'terms', element: sbPage(TermsPage) },
            { path: 'privacy', element: sbPage(PrivacyPage) },
            // Directory pages
            { path: 'directory/add', element: guardedSbPage('directory', AddListingPage) },
            {
              path: 'directory/edit/:serviceId',
              element: guardedSbPage('directory', EditListingPage),
            },
            {
              path: 'directory/service/:serviceId',
              element: guardedSbPage('directory', ServiceDetailPage),
            },
            // Admin pages (use /manage prefix to avoid Vite /admin proxy to Directus)
            { path: 'manage/claims', element: sbPage(AdminClaimsPage) },
            { path: 'manage/roles', element: sbPage(AdminRolesPage) },
            { path: 'directory', element: guardedSbPage('directory', DirectoryPage) },
            { path: 'directory/*', element: guardedSbPage('directory', DirectoryPage) },
            { path: 'jobs', element: guardedSbPage('jobs', JobsPage) },
            { path: 'jobs/my-applications', element: guardedSbPage('jobs', MyApplicationsPage) },
            { path: 'jobs/employer', element: guardedSbPage('jobs', EmployerDashboardPage) },
            { path: 'jobs/*', element: guardedSbPage('jobs', JobsPage) },
            // Notifications — always accessible (not a nav item)
            { path: 'notifications', element: sbPage(NotificationsPage) },
            { path: 'notifications/*', element: sbPage(NotificationsPage) },
            { path: 'settings', element: guardedSbPage('settings', MyProfilePage) },
            { path: 'settings/*', element: guardedSbPage('settings', MyProfilePage) },
            // StreetBot-only pages
            ...(isStreetBot
              ? [
                  { path: 'forum', element: guardedSbPage('forum', ForumPage) },
                  { path: 'forum/*', element: guardedSbPage('forum', ForumPage) },
                  { path: 'gallery', element: guardedSbPage('gallery', GalleryPage) },
                  { path: 'gallery/*', element: guardedSbPage('gallery', GalleryPage) },
                  { path: 'calendar', element: guardedSbPage('calendar', CalendarPage) },
                  { path: 'calendar/*', element: guardedSbPage('calendar', CalendarPage) },
                  { path: 'case-management', element: guardedSbPage('case-management', CaseManagementPage) },
                  {
                    path: 'case-management/*',
                    element: guardedSbPage('case-management', CaseManagementPage),
                  },
                  { path: 'messages', element: guardedSbPage('messages', MessagesPage) },
                  { path: 'messages/*', element: guardedSbPage('messages', MessagesPage) },
                  { path: 'documents', element: guardedSbPage('documents', DocumentsPage) },
                  { path: 'documents/*', element: guardedSbPage('documents', DocumentsPage) },
                  { path: 'academy/courses', element: sbPage(AcademyCoursesPage) },
                  { path: 'academy/courses/*', element: sbPage(AcademyCoursesPage) },
                  { path: 'academy/paths', element: sbPage(AcademyPathsPage) },
                  { path: 'academy/paths/*', element: sbPage(AcademyPathsPage) },
                  { path: 'academy/live-sessions', element: sbPage(AcademyLivePage) },
                  { path: 'academy/live-sessions/*', element: sbPage(AcademyLivePage) },
                  { path: 'academy/instructor', element: sbPage(AcademyInstructorPage) },
                  { path: 'academy/instructor/*', element: sbPage(AcademyInstructorPage) },
                  { path: 'learning/courses', element: sbPage(AcademyCoursesPage) },
                  { path: 'learning/courses/*', element: sbPage(AcademyCoursesPage) },
                  { path: 'learning/paths', element: sbPage(AcademyPathsPage) },
                  { path: 'learning/paths/*', element: sbPage(AcademyPathsPage) },
                  { path: 'learning/live-sessions', element: sbPage(AcademyLivePage) },
                  { path: 'learning/live-sessions/*', element: sbPage(AcademyLivePage) },
                  { path: 'learning/instructor', element: sbPage(AcademyInstructorPage) },
                  { path: 'learning/instructor/*', element: sbPage(AcademyInstructorPage) },
                  { path: 'academy', element: sbPage(AcademyPage) },
                  { path: 'academy/*', element: sbPage(AcademyPage) },
                  { path: 'learning', element: sbPage(AcademyPage) },
                  { path: 'learning/*', element: sbPage(AcademyPage) },
                  { path: 'tasks', element: guardedSbPage('tasks', MissionControlPage) },
                  { path: 'tasks/*', element: guardedSbPage('tasks', MissionControlPage) },
                  { path: 'social-media', element: guardedSbPage('social-media', SocialMediaPage) },
                  {
                    path: 'social-media/*',
                    element: guardedSbPage('social-media', SocialMediaPage),
                  },
                  { path: 'storage', element: guardedSbPage('storage', StoragePage) },
                  { path: 'storage/*', element: guardedSbPage('storage', StoragePage) },
                  { path: 'data', element: guardedSbPage('data', DatabasePage) },
                  { path: 'data/*', element: guardedSbPage('data', DatabasePage) },
                  { path: 'grantwriter', element: guardedSbPage('grantwriter', GrantWriterPage) },
                  { path: 'grantwriter/*', element: guardedSbPage('grantwriter', GrantWriterPage) },
                  { path: 'dashboard', element: guardedSbPage('dashboard', SBDashboardPage) },
                  { path: 'dashboard/*', element: guardedSbPage('dashboard', SBDashboardPage) },
                ]
              : []),
          ],
        },
      ],
    },
  ],
  { basename: baseHref },
);
