import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  STREET_NOTIFICATIONS_CHANGED_EVENT,
  getCachedNotificationUserId,
  loadStreetNotificationSummary,
  loadStreetNotifications,
  markAllStreetNotificationsRead,
  markStreetNotificationRead,
  type NotificationRecord,
  type NotificationSummary,
} from './notificationData';

export function useStreetNotifications(
  userId?: string | null,
  options: { limit?: number; unreadOnly?: boolean } = {},
) {
  const resolvedUserId = userId || getCachedNotificationUserId() || 'anonymous';
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [summary, setSummary] = useState<NotificationSummary>({
    user_id: resolvedUserId,
    unread_count: 0,
    total_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const limit = options.limit;
  const unreadOnly = Boolean(options.unreadOnly);

  const refresh = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [list, nextSummary] = await Promise.all([
          loadStreetNotifications(resolvedUserId, { limit, unreadOnly }),
          loadStreetNotificationSummary(resolvedUserId),
        ]);
        setNotifications(list);
        setSummary(nextSummary);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [limit, resolvedUserId, unreadOnly],
  );

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  useEffect(() => {
    const handleChanged = (event: Event) => {
      const detailUserId = (event as CustomEvent<{ userId?: string }>).detail?.userId;
      if (!detailUserId || detailUserId === resolvedUserId) {
        void refresh(true);
      }
    };

    window.addEventListener(STREET_NOTIFICATIONS_CHANGED_EVENT, handleChanged);
    return () => window.removeEventListener(STREET_NOTIFICATIONS_CHANGED_EVENT, handleChanged);
  }, [refresh, resolvedUserId]);

  const unreadCount = useMemo(
    () => summary.unread_count || notifications.filter((item) => !item.is_read).length,
    [notifications, summary.unread_count],
  );

  const markRead = useCallback(
    async (notificationId: string) => {
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId
            ? { ...item, is_read: true, read_at: item.read_at || new Date().toISOString() }
            : item,
        ),
      );
      setSummary((prev) => ({
        ...prev,
        unread_count: Math.max(0, prev.unread_count - 1),
      }));
      await markStreetNotificationRead(resolvedUserId, notificationId);
    },
    [resolvedUserId],
  );

  const markAllRead = useCallback(async () => {
    const currentNotifications = notifications;
    setNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        is_read: true,
        read_at: item.read_at || new Date().toISOString(),
      })),
    );
    setSummary((prev) => ({ ...prev, unread_count: 0 }));
    await markAllStreetNotificationsRead(resolvedUserId, currentNotifications);
  }, [notifications, resolvedUserId]);

  return {
    notifications,
    summary,
    unreadCount,
    loading,
    refreshing,
    refresh,
    markRead,
    markAllRead,
  };
}
