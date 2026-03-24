/**
 * Accessibility Hooks and Utilities
 * Provides keyboard navigation, focus management, and screen reader support.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  KeyboardEvent,
  RefObject,
} from "react";

// ============================================================================
// Keyboard Navigation Hook
// ============================================================================

export interface UseKeyboardNavigationOptions {
  itemCount: number;
  onSelect?: (index: number) => void;
  onEscape?: () => void;
  wrap?: boolean;
  orientation?: "vertical" | "horizontal";
  initialIndex?: number;
}

export function useKeyboardNavigation({
  itemCount,
  onSelect,
  onEscape,
  wrap = true,
  orientation = "vertical",
  initialIndex = 0,
}: UseKeyboardNavigationOptions) {
  const [focusedIndex, setFocusedIndex] = useState(initialIndex);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const prevKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
      const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";

      switch (event.key) {
        case prevKey:
          event.preventDefault();
          setFocusedIndex((prev) => {
            if (prev <= 0) return wrap ? itemCount - 1 : 0;
            return prev - 1;
          });
          break;
        case nextKey:
          event.preventDefault();
          setFocusedIndex((prev) => {
            if (prev >= itemCount - 1) return wrap ? 0 : itemCount - 1;
            return prev + 1;
          });
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          onSelect?.(focusedIndex);
          break;
        case "Escape":
          event.preventDefault();
          onEscape?.();
          break;
        case "Home":
          event.preventDefault();
          setFocusedIndex(0);
          break;
        case "End":
          event.preventDefault();
          setFocusedIndex(itemCount - 1);
          break;
      }
    },
    [itemCount, focusedIndex, onSelect, onEscape, wrap, orientation]
  );

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
    getItemProps: (index: number) => ({
      tabIndex: index === focusedIndex ? 0 : -1,
      "aria-selected": index === focusedIndex,
      onFocus: () => setFocusedIndex(index),
    }),
  };
}

// ============================================================================
// Focus Trap Hook
// ============================================================================

export interface UseFocusTrapOptions {
  isActive: boolean;
  onEscape?: () => void;
  autoFocus?: boolean;
  returnFocus?: boolean;
}

export function useFocusTrap({
  isActive,
  onEscape,
  autoFocus = true,
  returnFocus = true,
}: UseFocusTrapOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isActive) {
      previousActiveElement.current = document.activeElement as HTMLElement;
    }
  }, [isActive]);

  useEffect(() => {
    return () => {
      if (returnFocus && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [returnFocus]);

  useEffect(() => {
    if (isActive && autoFocus && containerRef.current) {
      const focusable = getFocusableElements(containerRef.current);
      if (focusable.length > 0) focusable[0].focus();
    }
  }, [isActive, autoFocus]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isActive || !containerRef.current) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onEscape?.();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(containerRef.current);
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    },
    [isActive, onEscape]
  );

  return {
    containerRef,
    handleKeyDown,
    containerProps: {
      ref: containerRef,
      onKeyDown: handleKeyDown,
      role: "dialog",
      "aria-modal": true,
    },
  };
}

// ============================================================================
// Live Region Hook
// ============================================================================

export type LiveRegionPoliteness = "polite" | "assertive" | "off";

export function useLiveRegion(defaultPoliteness: LiveRegionPoliteness = "polite") {
  const [announcement, setAnnouncement] = useState("");
  const [politeness, setPoliteness] = useState(defaultPoliteness);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const announce = useCallback(
    (message: string, priority: LiveRegionPoliteness = defaultPoliteness) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setAnnouncement("");
      setPoliteness(priority);
      timeoutRef.current = setTimeout(() => setAnnouncement(message), 100);
    },
    [defaultPoliteness]
  );

  const clear = useCallback(() => setAnnouncement(""), []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return {
    announcement,
    politeness,
    announce,
    clear,
    LiveRegion: () => (
      <div
        role="status"
        aria-live={politeness}
        aria-atomic="true"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {announcement}
      </div>
    ),
  };
}

// ============================================================================
// Reduced Motion Hook
// ============================================================================

export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return reducedMotion;
}

// ============================================================================
// Utility Functions
// ============================================================================

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  return Array.from(elements).filter(
    (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
  );
}

// ============================================================================
// ARIA Helper Functions
// ============================================================================

export function getMessageAriaLabel(
  senderName: string,
  content: string,
  timestamp: string,
  hasAttachments: boolean,
  reactionCount: number
): string {
  let label = `Message from ${senderName}: ${content}. Sent ${timestamp}`;
  if (hasAttachments) label += ". Has attachments";
  if (reactionCount > 0) label += `. ${reactionCount} reactions`;
  return label;
}

export function getConversationAriaLabel(
  name: string,
  unreadCount: number,
  lastMessage?: string,
  isGroup?: boolean
): string {
  let label = isGroup ? `Group conversation: ${name}` : `Conversation with ${name}`;
  if (unreadCount > 0) label += `. ${unreadCount} unread messages`;
  if (lastMessage) label += `. Last message: ${lastMessage}`;
  return label;
}
