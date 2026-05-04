// Map a concrete pathname to a stable route pattern + product area.
// This is the canonical map used for both event tagging and replay decisions.

import type { ProductArea, RoutePatternResolver } from './types';

interface RouteRule {
  pattern:      RegExp;
  route_pattern: string;
  product_area: ProductArea;
}

// Order matters — first match wins. More specific routes go first.
const RULES: RouteRule[] = [
  // Auth
  { pattern: /^\/login\/?$/,                       route_pattern: '/login',                        product_area: 'auth' },
  { pattern: /^\/signup\/?$/,                      route_pattern: '/signup',                       product_area: 'auth' },

  // Home
  { pattern: /^\/home\/?$/,                        route_pattern: '/home',                         product_area: 'home' },
  { pattern: /^\/$/,                               route_pattern: '/',                             product_area: 'home' },

  // AI / chat
  { pattern: /^\/c\/[^/]+$/,                       route_pattern: '/c/:conversationId',            product_area: 'ai'   },
  { pattern: /^\/search\/?$/,                      route_pattern: '/search',                       product_area: 'home' },

  // Agents
  { pattern: /^\/agents\/[^/]+$/,                  route_pattern: '/agents/:team',                 product_area: 'agents' },
  { pattern: /^\/agents\/?$/,                      route_pattern: '/agents',                       product_area: 'agents' },

  // Street Profile
  { pattern: /^\/profile\/edit(\/.*)?$/,           route_pattern: '/profile/edit',                 product_area: 'street_profile' },
  { pattern: /^\/profile\/?$/,                     route_pattern: '/profile',                      product_area: 'street_profile' },
  { pattern: /^\/profile\/[^/]+$/,                 route_pattern: '/profile/:section',             product_area: 'street_profile' },
  { pattern: /^\/creatives\/[^/]+$/,               route_pattern: '/creatives/:username',          product_area: 'street_profile' },

  // Groups & forum
  { pattern: /^\/groups\/[^/]+$/,                  route_pattern: '/groups/:groupId',              product_area: 'groups' },
  { pattern: /^\/groups\/?$/,                      route_pattern: '/groups',                       product_area: 'groups' },
  { pattern: /^\/forum\/[^/]+$/,                   route_pattern: '/forum/:postId',                product_area: 'groups' },
  { pattern: /^\/forum\/?$/,                       route_pattern: '/forum',                        product_area: 'groups' },

  // News
  { pattern: /^\/news\/dashboard(\/.*)?$/,         route_pattern: '/news/dashboard',               product_area: 'news' },
  { pattern: /^\/news\/[^/]+$/,                    route_pattern: '/news/:articleId',              product_area: 'news' },
  { pattern: /^\/news\/?$/,                        route_pattern: '/news',                         product_area: 'news' },

  // Directory
  { pattern: /^\/directory\/[^/]+$/,               route_pattern: '/directory/:serviceId',         product_area: 'directory' },
  { pattern: /^\/directory\/?$/,                   route_pattern: '/directory',                    product_area: 'directory' },

  // Jobs
  { pattern: /^\/jobs\/resume(\/.*)?$/,            route_pattern: '/jobs/resume',                  product_area: 'jobs' },
  { pattern: /^\/jobs\/employer(\/.*)?$/,          route_pattern: '/jobs/employer',                product_area: 'jobs' },
  { pattern: /^\/jobs\/applications\/[^/]+$/,      route_pattern: '/jobs/applications/:appId',     product_area: 'jobs' },
  { pattern: /^\/jobs\/[^/]+$/,                    route_pattern: '/jobs/:jobId',                  product_area: 'jobs' },
  { pattern: /^\/jobs\/?$/,                        route_pattern: '/jobs',                         product_area: 'jobs' },

  // Gallery
  { pattern: /^\/gallery\/upload(\/.*)?$/,         route_pattern: '/gallery/upload',               product_area: 'gallery' },
  { pattern: /^\/gallery\/dashboard(\/.*)?$/,      route_pattern: '/gallery/dashboard',            product_area: 'gallery' },
  { pattern: /^\/gallery\/artwork\/[^/]+$/,        route_pattern: '/gallery/artwork/:artworkId',   product_area: 'gallery' },
  { pattern: /^\/gallery\/?$/,                     route_pattern: '/gallery',                      product_area: 'gallery' },

  // Academy
  { pattern: /^\/academy\/courses\/[^/]+\/lessons\/[^/]+$/, route_pattern: '/academy/courses/:courseId/lessons/:lessonId', product_area: 'academy' },
  { pattern: /^\/academy\/courses\/[^/]+$/,                 route_pattern: '/academy/courses/:courseId',                   product_area: 'academy' },
  { pattern: /^\/academy\/paths\/[^/]+$/,                   route_pattern: '/academy/paths/:pathId',                       product_area: 'academy' },
  { pattern: /^\/academy(\/.*)?$/,                          route_pattern: '/academy',                                     product_area: 'academy' },
  { pattern: /^\/learning(\/.*)?$/,                         route_pattern: '/learning',                                    product_area: 'academy' },

  // Messages
  { pattern: /^\/messages\/[^/]+$/,                route_pattern: '/messages/:channelId',          product_area: 'messages' },
  { pattern: /^\/messages\/?$/,                    route_pattern: '/messages',                     product_area: 'messages' },

  // Tasks / Mission Control
  { pattern: /^\/tasks\/[^/]+$/,                   route_pattern: '/tasks/:projectId',             product_area: 'tasks' },
  { pattern: /^\/tasks\/?$/,                       route_pattern: '/tasks',                        product_area: 'tasks' },
  { pattern: /^\/mission-control(\/.*)?$/,         route_pattern: '/mission-control',              product_area: 'tasks' },

  // Calendar
  { pattern: /^\/calendar(\/.*)?$/,                route_pattern: '/calendar',                     product_area: 'calendar' },

  // Documents
  { pattern: /^\/documents\/[^/]+$/,               route_pattern: '/documents/:documentId',        product_area: 'documents' },
  { pattern: /^\/documents\/?$/,                   route_pattern: '/documents',                    product_area: 'documents' },

  // Case management
  { pattern: /^\/case-management(\/.*)?$/,         route_pattern: '/case-management',              product_area: 'case_management' },

  // Social media
  { pattern: /^\/social-media(\/.*)?$/,            route_pattern: '/social-media',                 product_area: 'social_media' },

  // Storage
  { pattern: /^\/storage(\/.*)?$/,                 route_pattern: '/storage',                      product_area: 'storage' },

  // Data workspace
  { pattern: /^\/data(\/.*)?$/,                    route_pattern: '/data',                         product_area: 'data' },

  // Grant writer
  { pattern: /^\/grantwriter(\/.*)?$/,             route_pattern: '/grantwriter',                  product_area: 'grantwriter' },

  // Admin
  { pattern: /^\/manage\/claims(\/.*)?$/,          route_pattern: '/manage/claims',                product_area: 'admin' },
  { pattern: /^\/manage\/roles(\/.*)?$/,           route_pattern: '/manage/roles',                 product_area: 'admin' },
  { pattern: /^\/manage(\/.*)?$/,                  route_pattern: '/manage',                       product_area: 'admin' },
  { pattern: /^\/analytics(\/.*)?$/,               route_pattern: '/analytics',                    product_area: 'admin' },

  // Settings
  { pattern: /^\/settings(\/.*)?$/,                route_pattern: '/settings',                     product_area: 'home' },

  // Notifications
  { pattern: /^\/notifications(\/.*)?$/,           route_pattern: '/notifications',                product_area: 'home' },
];

export const defaultRoutePatternResolver: RoutePatternResolver = (pathname: string) => {
  for (const rule of RULES) {
    if (rule.pattern.test(pathname)) {
      return { route_pattern: rule.route_pattern, product_area: rule.product_area };
    }
  }
  return { route_pattern: pathname || '/', product_area: '_global' };
};
