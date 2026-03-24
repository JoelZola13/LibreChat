/**
 * Directus Real-time Client for Street Voices
 *
 * Provides WebSocket-based real-time updates from Directus CMS
 */

import { useEffect } from 'react';
import { createDirectus, realtime, staticToken } from '@directus/sdk';

const DIRECTUS_URL = import.meta.env.VITE_DIRECTUS_URL || '/cms';
const DIRECTUS_TOKEN = import.meta.env.VITE_DIRECTUS_TOKEN || 'streetvoices-admin-token-2026';

// Real-time client with WebSocket support
export const directusRealtime = createDirectus(DIRECTUS_URL)
  .with(staticToken(DIRECTUS_TOKEN))
  .with(realtime());

// Subscription types
export type SubscriptionEvent = 'create' | 'update' | 'delete';

export interface SubscriptionCallback<T> {
  (event: SubscriptionEvent, data: T): void;
}

/**
 * Subscribe to real-time updates for a collection
 *
 * @example
 * ```ts
 * // Subscribe to new articles
 * const unsubscribe = subscribeToCollection('news_articles', (event, article) => {
 *   if (event === 'create') {
 *     console.log('New article:', article.title);
 *   }
 * });
 *
 * // Later, unsubscribe
 * unsubscribe();
 * ```
 */
export function subscribeToCollection<T>(
  collection: string,
  callback: SubscriptionCallback<T>,
  options?: {
    event?: SubscriptionEvent;
    filter?: Record<string, unknown>;
  }
): () => void {
  let isActive = true;
  let abortController: AbortController | null = null;

  const connect = async () => {
    try {
      abortController = new AbortController();
      const { subscription } = await directusRealtime.subscribe(collection, {
        event: options?.event as "create" | "update" | "delete" | undefined,
        query: options?.filter ? { filter: options.filter } : undefined,
      });

      // Listen for messages from the async generator
      for await (const message of subscription) {
        if (!isActive) break;
        if (message.type === 'subscription' && message.event && 'data' in message) {
          const data = (message as unknown as { data: T }).data;
          callback(message.event as SubscriptionEvent, data);
        }
      }
    } catch (error) {
      if (isActive) {
        console.error(`Real-time subscription error for ${collection}:`, error);
      }
    }
  };

  connect();

  return () => {
    isActive = false;
    abortController?.abort();
  };
}

/**
 * React hook for real-time collection updates
 *
 * @example
 * ```tsx
 * function ArticleList() {
 *   const [articles, setArticles] = useState<Article[]>([]);
 *
 *   useRealtimeCollection('news_articles', {
 *     onCreate: (article) => setArticles(prev => [article, ...prev]),
 *     onUpdate: (article) => setArticles(prev =>
 *       prev.map(a => a.id === article.id ? article : a)
 *     ),
 *     onDelete: (article) => setArticles(prev =>
 *       prev.filter(a => a.id !== article.id)
 *     ),
 *   });
 *
 *   return <ul>{articles.map(a => <li key={a.id}>{a.title}</li>)}</ul>;
 * }
 * ```
 */
export function useRealtimeCollection<T extends { id: string | number }>(
  collection: string,
  handlers: {
    onCreate?: (item: T) => void;
    onUpdate?: (item: T) => void;
    onDelete?: (item: T) => void;
  }
) {
  useEffect(() => {
    // Skip real-time on server-side
    if (typeof window === 'undefined') {
      return;
    }

    const unsubscribe = subscribeToCollection<T>(collection, (event, data) => {
      switch (event) {
        case 'create':
          handlers.onCreate?.(data);
          break;
        case 'update':
          handlers.onUpdate?.(data);
          break;
        case 'delete':
          handlers.onDelete?.(data);
          break;
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection]);
}

/**
 * Subscribe to multiple collections at once
 */
export function subscribeToCollections(
  subscriptions: Array<{
    collection: string;
    callback: SubscriptionCallback<unknown>;
    options?: {
      event?: SubscriptionEvent;
      filter?: Record<string, unknown>;
    };
  }>
): () => void {
  const unsubscribers = subscriptions.map(({ collection, callback, options }) =>
    subscribeToCollection(collection, callback, options)
  );

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

/**
 * Real-time notification listener
 * Listens for Directus notifications and triggers callbacks
 */
export function subscribeToNotifications(
  userId: string,
  callback: (notification: {
    id: string;
    recipient: string;
    subject: string;
    message: string;
    collection?: string;
    item?: string;
  }) => void
): () => void {
  return subscribeToCollection('directus_notifications', (event, data) => {
    if (event === 'create') {
      callback(data as any);
    }
  }, {
    event: 'create',
    filter: { recipient: { _eq: userId } },
  });
}

export default directusRealtime;
