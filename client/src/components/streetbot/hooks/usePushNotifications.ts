'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  isPushSupported,
  getNotificationPermission,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription,
  saveSubscriptionToBackend,
  removeSubscriptionFromBackend,
  subscriptionToJson,
} from '@/lib/pushNotifications';

interface UsePushNotificationsOptions {
  supabaseUrl: string;
  accessToken: string | null;
  autoRegister?: boolean;
}

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  checkSubscription: () => Promise<void>;
}

export function usePushNotifications({
  supabaseUrl,
  accessToken,
  autoRegister = true,
}: UsePushNotificationsOptions): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check support and register service worker on mount
  useEffect(() => {
    const init = async () => {
      const supported = isPushSupported();
      setIsSupported(supported);

      if (!supported) {
        setIsLoading(false);
        return;
      }

      setPermission(getNotificationPermission());

      try {
        if (autoRegister) {
          await registerServiceWorker();
        }

        const subscription = await getCurrentSubscription();
        setIsSubscribed(!!subscription);
      } catch (err) {
        console.error('Failed to initialize push notifications:', err);
        setError(err instanceof Error ? err.message : 'Initialization failed');
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [autoRegister]);

  // Check subscription status
  const checkSubscription = useCallback(async () => {
    if (!isSupported) return;

    try {
      const subscription = await getCurrentSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error('Failed to check subscription:', err);
    }
  }, [isSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError('Push notifications not supported');
      return;
    }

    if (!accessToken) {
      setError('Not authenticated');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get or create push subscription
      const subscription = await subscribeToPush();

      // Save to backend
      await saveSubscriptionToBackend(subscription, supabaseUrl, accessToken);

      setIsSubscribed(true);
      setPermission(getNotificationPermission());
    } catch (err) {
      console.error('Failed to subscribe:', err);
      setError(err instanceof Error ? err.message : 'Subscription failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, accessToken, supabaseUrl]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;

    setIsLoading(true);
    setError(null);

    try {
      const subscription = await getCurrentSubscription();

      if (subscription && accessToken) {
        // Remove from backend first
        await removeSubscriptionFromBackend(subscription, supabaseUrl, accessToken);
      }

      // Unsubscribe locally
      await unsubscribeFromPush();

      setIsSubscribed(false);
    } catch (err) {
      console.error('Failed to unsubscribe:', err);
      setError(err instanceof Error ? err.message : 'Unsubscribe failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, accessToken, supabaseUrl]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    checkSubscription,
  };
}

export default usePushNotifications;
