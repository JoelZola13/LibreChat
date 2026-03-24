// Push Notification utilities for the frontend

// Your VAPID public key (get from Supabase edge function env)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

/**
 * Convert a base64 string to Uint8Array (required for applicationServerKey)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get the current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    throw new Error('Notifications not supported');
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers not supported');
  }

  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
  });

  // Wait for the service worker to be ready
  await navigator.serviceWorker.ready;

  return registration;
}

/**
 * Get the current push subscription
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(): Promise<PushSubscription> {
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('VAPID public key not configured');
  }

  // Request permission first
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied');
  }

  // Get service worker registration
  const registration = await navigator.serviceWorker.ready;

  // Check for existing subscription
  let subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    return subscription;
  }

  // Create new subscription
  subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  });

  return subscription;
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  const subscription = await getCurrentSubscription();

  if (!subscription) {
    return true;
  }

  return subscription.unsubscribe();
}

/**
 * Convert PushSubscription to the format expected by the backend
 */
export function subscriptionToJson(subscription: PushSubscription): {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
} {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint!,
    keys: {
      p256dh: json.keys!.p256dh,
      auth: json.keys!.auth,
    },
  };
}

/**
 * Get browser info for subscription metadata
 */
export function getBrowserInfo(): { browser: string; deviceType: string } {
  const ua = navigator.userAgent;
  let browser = 'unknown';
  let deviceType = 'web';

  if (ua.includes('Chrome')) browser = 'chrome';
  else if (ua.includes('Firefox')) browser = 'firefox';
  else if (ua.includes('Safari')) browser = 'safari';
  else if (ua.includes('Edge')) browser = 'edge';

  if (/iPhone|iPad|iPod/.test(ua)) deviceType = 'ios';
  else if (/Android/.test(ua)) deviceType = 'android';

  return { browser, deviceType };
}

/**
 * Send subscription to the backend
 */
export async function saveSubscriptionToBackend(
  subscription: PushSubscription,
  supabaseUrl: string,
  accessToken: string
): Promise<void> {
  const { browser, deviceType } = getBrowserInfo();
  const subscriptionData = subscriptionToJson(subscription);

  const response = await fetch(`${supabaseUrl}/functions/v1/push-subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: 'subscribe',
      subscription: subscriptionData,
      browser,
      device_type: deviceType,
      device_name: `${browser} on ${deviceType}`,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save subscription');
  }
}

/**
 * Remove subscription from the backend
 */
export async function removeSubscriptionFromBackend(
  subscription: PushSubscription,
  supabaseUrl: string,
  accessToken: string
): Promise<void> {
  const subscriptionData = subscriptionToJson(subscription);

  const response = await fetch(`${supabaseUrl}/functions/v1/push-subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: 'unsubscribe',
      subscription: subscriptionData,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove subscription');
  }
}

/**
 * Show a local notification (for testing)
 */
export async function showLocalNotification(
  title: string,
  options?: NotificationOptions
): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    icon: '/icons/notification-icon.png',
    badge: '/icons/badge-icon.png',
    ...options,
  });
}
