export type IdleHandle = number | null;

export function scheduleIdle(callback: () => void, timeout = 1500): IdleHandle {
  if (typeof window === "undefined") return null;

  const idleWindow = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (idleWindow.requestIdleCallback) {
    return idleWindow.requestIdleCallback(callback, { timeout });
  }

  return window.setTimeout(callback, 300);
}

export function cancelIdle(handle: IdleHandle): void {
  if (typeof window === "undefined" || handle === null) return;

  const idleWindow = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (idleWindow.cancelIdleCallback) {
    idleWindow.cancelIdleCallback(handle);
    return;
  }

  clearTimeout(handle);
}
