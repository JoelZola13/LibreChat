const ACADEMY_DATA_UPDATED_EVENT = "streetbot:academy-data-updated";

type AcademyDataUpdateDetail = {
  method?: string;
  path?: string;
};

function hasWindow() {
  return typeof window !== "undefined";
}

export function shouldBroadcastAcademyDataUpdate(path: string, method?: string, response?: Response) {
  const normalizedMethod = String(method || "GET").trim().toUpperCase();
  const normalizedPath = String(path || "");

  if (normalizedMethod === "GET" || normalizedMethod === "HEAD") {
    return false;
  }

  if (!response?.ok) {
    return false;
  }

  return normalizedPath.includes("/api/academy/") || normalizedPath.includes("/sbapi/api/academy/");
}

export function emitAcademyDataUpdated(detail: AcademyDataUpdateDetail = {}) {
  if (!hasWindow()) {
    return;
  }

  window.dispatchEvent(new CustomEvent(ACADEMY_DATA_UPDATED_EVENT, { detail }));
}

export function subscribeToAcademyDataRefresh(onRefresh: () => void) {
  if (!hasWindow()) {
    return () => undefined;
  }

  let rafId = 0;

  const queueRefresh = () => {
    if (rafId !== 0) {
      return;
    }

    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      onRefresh();
    });
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      queueRefresh();
    }
  };

  window.addEventListener(ACADEMY_DATA_UPDATED_EVENT, queueRefresh as EventListener);
  window.addEventListener("focus", queueRefresh);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    if (rafId !== 0) {
      window.cancelAnimationFrame(rafId);
    }

    window.removeEventListener(ACADEMY_DATA_UPDATED_EVENT, queueRefresh as EventListener);
    window.removeEventListener("focus", queueRefresh);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}
