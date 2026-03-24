import { useState, useEffect, useCallback, useRef } from "react";

interface UseInfiniteScrollOptions<T> {
  // Function to fetch more data, returns { items, hasMore }
  fetchMore: (cursor: string | null) => Promise<{ items: T[]; nextCursor: string | null; hasMore: boolean }>;
  // Initial cursor (usually null)
  initialCursor?: string | null;
  // Threshold in pixels before the edge to trigger loading
  threshold?: number;
  // Direction: "up" for loading older messages at top, "down" for newer at bottom
  direction?: "up" | "down";
  // Debounce time in ms
  debounce?: number;
}

interface UseInfiniteScrollReturn<T> {
  items: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  // Ref to attach to the scroll container
  containerRef: React.RefObject<HTMLDivElement | null>;
  // Ref to attach to the sentinel element (where loading triggers)
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  // Manually trigger loading more
  loadMore: () => Promise<void>;
  // Reset and reload
  reset: () => void;
  // Prepend items (for new messages)
  prependItems: (newItems: T[]) => void;
  // Append items
  appendItems: (newItems: T[]) => void;
  // Update a specific item
  updateItem: (index: number, item: T) => void;
  // Remove an item
  removeItem: (index: number) => void;
}

export function useInfiniteScroll<T>({
  fetchMore,
  initialCursor = null,
  threshold = 100,
  direction = "up",
  debounce = 200,
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollReturn<T> {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevScrollHeightRef = useRef<number>(0);

  // Load more function
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    setIsLoadingMore(true);
    setError(null);

    // Store scroll position before loading (for upward scroll)
    if (containerRef.current && direction === "up") {
      prevScrollHeightRef.current = containerRef.current.scrollHeight;
    }

    try {
      const result = await fetchMore(cursor);

      if (direction === "up") {
        // Prepend items for upward scroll (loading older messages)
        setItems((prev) => [...result.items, ...prev]);
      } else {
        // Append items for downward scroll
        setItems((prev) => [...prev, ...result.items]);
      }

      setCursor(result.nextCursor);
      setHasMore(result.hasMore);

      // Restore scroll position for upward scroll
      if (containerRef.current && direction === "up") {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            const newScrollHeight = containerRef.current.scrollHeight;
            const scrollDiff = newScrollHeight - prevScrollHeightRef.current;
            containerRef.current.scrollTop += scrollDiff;
          }
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load more items"));
    } finally {
      loadingRef.current = false;
      setIsLoadingMore(false);
      setIsLoading(false);
    }
  }, [fetchMore, cursor, hasMore, direction]);

  // Initial load
  useEffect(() => {
    loadMore();
  }, []);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !loadingRef.current) {
          // Debounce the load
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = setTimeout(() => {
            loadMore();
          }, debounce);
        }
      },
      {
        root: containerRef.current,
        rootMargin: `${threshold}px`,
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [hasMore, loadMore, threshold, debounce]);

  // Reset function
  const reset = useCallback(() => {
    setItems([]);
    setCursor(initialCursor);
    setHasMore(true);
    setError(null);
    setIsLoading(true);
    loadingRef.current = false;
  }, [initialCursor]);

  // Prepend items (for new incoming messages)
  const prependItems = useCallback((newItems: T[]) => {
    setItems((prev) => [...newItems, ...prev]);
  }, []);

  // Append items
  const appendItems = useCallback((newItems: T[]) => {
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  // Update a specific item
  const updateItem = useCallback((index: number, item: T) => {
    setItems((prev) => {
      const newItems = [...prev];
      newItems[index] = item;
      return newItems;
    });
  }, []);

  // Remove an item
  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    containerRef,
    sentinelRef,
    loadMore,
    reset,
    prependItems,
    appendItems,
    updateItem,
    removeItem,
  };
}

// Specialized hook for message history (loads older messages when scrolling up)
interface UseMessageHistoryOptions {
  conversationId: number;
  userId: string;
  apiUrl?: string;
  pageSize?: number;
}

export function useMessageHistory({
  conversationId,
  userId,
  apiUrl = "/api/messaging",
  pageSize = 50,
}: UseMessageHistoryOptions) {
  const fetchMessages = useCallback(
    async (cursor: string | null) => {
      const params = new URLSearchParams({
        user_id: userId,
        limit: pageSize.toString(),
      });

      if (cursor) {
        params.append("before_id", cursor);
      }

      const response = await fetch(
        `${apiUrl}/messages/${conversationId}/enhanced?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }

      const data = await response.json();

      return {
        items: data.messages || [],
        nextCursor: data.oldest_id?.toString() || null,
        hasMore: data.has_more || false,
      };
    },
    [conversationId, userId, apiUrl, pageSize]
  );

  return useInfiniteScroll({
    fetchMore: fetchMessages,
    direction: "up",
    threshold: 200,
  });
}

export default useInfiniteScroll;
