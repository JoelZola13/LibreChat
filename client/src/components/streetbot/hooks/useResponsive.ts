"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";

/**
 * Breakpoint definitions matching Tailwind CSS defaults
 */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export type Breakpoint = keyof typeof breakpoints;

interface ResponsiveState {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  breakpoint: Breakpoint | "xs";
}

const DEFAULT_RESPONSIVE_STATE: ResponsiveState = {
  width: 1024,
  height: 768,
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isLargeDesktop: false,
  breakpoint: "lg",
};

const getBreakpointForWidth = (width: number): Breakpoint | "xs" => {
  if (width >= breakpoints["2xl"]) return "2xl";
  if (width >= breakpoints.xl) return "xl";
  if (width >= breakpoints.lg) return "lg";
  if (width >= breakpoints.md) return "md";
  if (width >= breakpoints.sm) return "sm";
  return "xs";
};

const toResponsiveState = (width: number, height: number): ResponsiveState => ({
  width,
  height,
  isMobile: width < breakpoints.md,
  isTablet: width >= breakpoints.md && width < breakpoints.lg,
  isDesktop: width >= breakpoints.lg,
  isLargeDesktop: width >= breakpoints.xl,
  breakpoint: getBreakpointForWidth(width),
});

let viewportState: ResponsiveState =
  typeof window !== "undefined"
    ? toResponsiveState(window.innerWidth, window.innerHeight)
    : DEFAULT_RESPONSIVE_STATE;
const viewportListeners = new Set<() => void>();
let detachViewportListeners: (() => void) | null = null;
let resizeAnimationFrame: number | null = null;

const publishViewportState = () => {
  const nextState = toResponsiveState(window.innerWidth, window.innerHeight);
  if (
    nextState.width === viewportState.width &&
    nextState.height === viewportState.height &&
    nextState.breakpoint === viewportState.breakpoint
  ) {
    return;
  }
  viewportState = nextState;
  viewportListeners.forEach((listener) => listener());
};

const ensureViewportListeners = () => {
  if (typeof window === "undefined" || detachViewportListeners) return;

  const handleResize = () => {
    if (resizeAnimationFrame !== null) {
      window.cancelAnimationFrame(resizeAnimationFrame);
    }
    resizeAnimationFrame = window.requestAnimationFrame(() => {
      resizeAnimationFrame = null;
      publishViewportState();
    });
  };

  window.addEventListener("resize", handleResize, { passive: true });
  window.addEventListener("orientationchange", handleResize, { passive: true });
  publishViewportState();

  detachViewportListeners = () => {
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("orientationchange", handleResize);
    if (resizeAnimationFrame !== null) {
      window.cancelAnimationFrame(resizeAnimationFrame);
      resizeAnimationFrame = null;
    }
  };
};

const subscribeViewport = (listener: () => void) => {
  viewportListeners.add(listener);
  ensureViewportListeners();
  return () => {
    viewportListeners.delete(listener);
    if (viewportListeners.size === 0 && detachViewportListeners) {
      detachViewportListeners();
      detachViewportListeners = null;
    }
  };
};

const getViewportSnapshot = () => viewportState;
const getServerViewportSnapshot = () => DEFAULT_RESPONSIVE_STATE;

/**
 * Hook to detect current viewport size and responsive breakpoints
 */
export function useResponsive(): ResponsiveState {
  return useSyncExternalStore(subscribeViewport, getViewportSnapshot, getServerViewportSnapshot);
}

/**
 * Hook to check if a specific breakpoint is active
 */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  const { width } = useResponsive();
  return width >= breakpoints[breakpoint];
}

/**
 * Hook to detect if user prefers reduced motion
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * Hook to detect touch device
 */
export function useTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch(
      "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error - msMaxTouchPoints is IE specific
        navigator.msMaxTouchPoints > 0
    );
  }, []);

  return isTouch;
}

/**
 * Hook for responsive sidebar state
 */
export function useResponsiveSidebar() {
  const { isMobile, isTablet } = useResponsive();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-collapse on tablet, auto-close on mobile
  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
      setIsCollapsed(false);
    } else if (isTablet) {
      setIsOpen(true);
      setIsCollapsed(true);
    } else {
      setIsOpen(true);
      setIsCollapsed(false);
    }
  }, [isMobile, isTablet]);

  const toggle = useCallback(() => {
    if (isMobile) {
      setIsOpen((prev) => !prev);
    } else {
      setIsCollapsed((prev) => !prev);
    }
  }, [isMobile]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return {
    isOpen,
    isCollapsed,
    isMobile,
    toggle,
    open,
    close,
    setIsOpen,
    setIsCollapsed,
  };
}
