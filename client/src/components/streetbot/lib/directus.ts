/**
 * Directus CMS Client for Street Voices
 *
 * This is the central CMS that manages all content across the application.
 * Use this client to fetch and manage data from Directus.
 */

import { createDirectus, rest, graphql, authentication, realtime } from '@directus/sdk';

// Directus URL — uses /cms proxy in dev (vite.config.ts proxies to localhost:8055)
const DIRECTUS_URL = import.meta.env.VITE_DIRECTUS_URL || '/cms';

// Static token for admin operations
const DIRECTUS_TOKEN = import.meta.env.VITE_DIRECTUS_TOKEN || 'streetvoices-admin-token-2026';

// Type definitions for Street Voices collections
export interface Course {
  id: string;
  title: string;
  description: string;
  slug: string;
  thumbnail_url?: string;
  instructor_id?: string;
  category?: string;
  difficulty?: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  company_name: string;
  location: string;
  job_type: string;
  salary_min?: number;
  salary_max?: number;
  is_active: boolean;
  created_at: string;
}

export interface Article {
  id: string;
  title: string;
  content: string;
  slug: string;
  author_id?: string;
  featured_image?: string;
  status: string;
  published_at?: string;
  created_at: string;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  owner_id: string;
  workspace_id?: string;
  folder_id?: string;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  is_private: boolean;
  member_count: number;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  province?: string;
  phone?: string;
  website?: string;
  categories?: string[];
}

export interface StreetProfile {
  id: string;
  user_id: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  cover_url?: string;
  skills?: string[];
  is_public: boolean;
}

export interface UserProfile {
  id: string;
  user_id: string;
  display_name: string;
  role: 'admin' | 'designer' | 'media' | 'service_user' | 'user';
  is_verified: boolean;
  is_banned: boolean;
  created_at: string;
  updated_at: string;
}

// Collection type mapping
export interface DirectusSchema {
  // Academy
  academy_courses: Course[];
  academy_modules: object[];
  academy_lessons: object[];
  academy_quizzes: object[];
  academy_enrollments: object[];
  academy_progress: object[];
  academy_certificates: object[];
  academy_learning_paths: object[];
  academy_badges: object[];

  // Jobs
  jobs: Job[];
  job_applications: object[];
  employer_profiles: object[];

  // News
  news_articles: Article[];

  // Documents
  documents: Document[];
  document_workspaces: object[];
  document_folders: object[];
  document_templates: object[];

  // Groups
  groups: Group[];
  group_members: object[];
  group_posts: object[];
  group_events: object[];

  // Messages
  dm_conversations: object[];
  dm_messages: object[];
  conversations: object[];
  messages: object[];

  // Tasks
  tasks: object[];
  task_projects: object[];

  // Directory
  directory_services: Service[];

  // Gallery
  artworks: object[];
  artwork_collections: object[];

  // Forum
  forum_categories: object[];
  forum_posts: object[];
  forum_replies: object[];

  // Profiles
  street_profiles: StreetProfile[];
  user_profiles: UserProfile[];

  // Analytics
  analytics_events: object[];
  analytics_sessions: object[];

  // Case Management
  social_work_cases: object[];
  case_assessments: object[];
  case_notes: object[];
}

/**
 * Create a Directus client with REST API support
 */
export const directus = createDirectus<DirectusSchema>(DIRECTUS_URL)
  .with(rest())
  .with(authentication());

/**
 * Create a Directus client with GraphQL support
 */
export const directusGraphQL = createDirectus<DirectusSchema>(DIRECTUS_URL)
  .with(graphql());

/**
 * Create a Directus client with real-time support
 */
export const directusRealtime = createDirectus<DirectusSchema>(DIRECTUS_URL)
  .with(realtime());

/**
 * Server-side Directus client with admin token
 * Use this for server components and API routes
 */
export const directusAdmin = createDirectus<DirectusSchema>(DIRECTUS_URL)
  .with(rest({
    onRequest: (options) => {
      return {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
        },
      };
    },
  }));

/**
 * Helper to get items from a collection
 */
export async function getItems<T>(
  collection: keyof DirectusSchema,
  options?: {
    filter?: Record<string, unknown>;
    sort?: string[];
    limit?: number;
    offset?: number;
    fields?: string[];
  }
): Promise<T[]> {
  const params = new URLSearchParams();

  if (options?.filter) {
    params.set('filter', JSON.stringify(options.filter));
  }
  if (options?.sort) {
    params.set('sort', options.sort.join(','));
  }
  if (options?.limit) {
    params.set('limit', options.limit.toString());
  }
  if (options?.offset) {
    params.set('offset', options.offset.toString());
  }
  if (options?.fields) {
    params.set('fields', options.fields.join(','));
  }

  const response = await fetch(
    `${DIRECTUS_URL}/items/${collection}?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
      },
}
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ${collection}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data as T[];
}

/**
 * Helper to get a single item by ID
 */
export async function getItem<T>(
  collection: keyof DirectusSchema,
  id: string | number,
  fields?: string[]
): Promise<T | null> {
  const params = new URLSearchParams();
  if (fields) {
    params.set('fields', fields.join(','));
  }

  const response = await fetch(
    `${DIRECTUS_URL}/items/${collection}/${id}?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
      },
}
  );

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to fetch ${collection}/${id}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data as T;
}

/**
 * Helper to create an item
 */
export async function createItem<T>(
  collection: keyof DirectusSchema,
  data: Partial<T>
): Promise<T> {
  const response = await fetch(
    `${DIRECTUS_URL}/items/${collection}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create ${collection}: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data as T;
}

/**
 * Helper to update an item
 */
export async function updateItem<T>(
  collection: keyof DirectusSchema,
  id: string | number,
  data: Partial<T>
): Promise<T> {
  const response = await fetch(
    `${DIRECTUS_URL}/items/${collection}/${id}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to update ${collection}/${id}: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data as T;
}

/**
 * Helper to delete an item
 */
export async function deleteItem(
  collection: keyof DirectusSchema,
  id: string | number
): Promise<void> {
  const response = await fetch(
    `${DIRECTUS_URL}/items/${collection}/${id}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to delete ${collection}/${id}: ${response.statusText}`);
  }
}

// Export Directus URL for direct use
export { DIRECTUS_URL, DIRECTUS_TOKEN };
