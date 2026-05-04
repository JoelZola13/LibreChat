// Engagement tracker — splits time on page into active vs idle, and tracks
// max scroll depth as a percentage. Owned by the page tracker.

export interface EngagementSnapshot {
  active_time_ms:        number;
  idle_time_ms:          number;
  scroll_depth_percent:  number;
  click_count:           number;
  rage_click_count:      number;
}

export interface EngagementOptions {
  idleAfterMs?: number;       // default 30_000
}

const ACTIVE_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'wheel', 'touchstart'] as const;

export class EngagementTracker {
  private idleAfterMs:    number;
  private startedAt:      number = 0;
  private lastActivityAt: number = 0;
  private accumulatedActive: number = 0;
  private accumulatedIdle:   number = 0;
  private clickCount:     number = 0;
  private rageClickCount: number = 0;
  private maxScrollDepth: number = 0;
  private isVisible:      boolean = true;
  private flushedAt:      number = 0;
  private boundHandler:   (e: Event) => void;
  private boundVisibility: () => void;
  private boundScroll:    () => void;

  constructor(options: EngagementOptions = {}) {
    this.idleAfterMs = options.idleAfterMs ?? 30_000;
    this.boundHandler   = this.onActivity.bind(this);
    this.boundVisibility = this.onVisibility.bind(this);
    this.boundScroll    = this.onScroll.bind(this);
  }

  start() {
    const now = Date.now();
    this.startedAt = now;
    this.lastActivityAt = now;
    this.flushedAt = now;
    this.accumulatedActive = 0;
    this.accumulatedIdle = 0;
    this.clickCount = 0;
    this.rageClickCount = 0;
    this.maxScrollDepth = 0;
    this.isVisible = typeof document !== 'undefined' ? !document.hidden : true;
    if (typeof window === 'undefined') return;
    for (const evt of ACTIVE_EVENTS) {
      window.addEventListener(evt, this.boundHandler, { passive: true, capture: true });
    }
    document.addEventListener('visibilitychange', this.boundVisibility);
    window.addEventListener('scroll', this.boundScroll, { passive: true });
  }

  stop() {
    this.tickAccumulators();
    if (typeof window === 'undefined') return;
    for (const evt of ACTIVE_EVENTS) {
      window.removeEventListener(evt, this.boundHandler, { capture: true } as EventListenerOptions);
    }
    document.removeEventListener('visibilitychange', this.boundVisibility);
    window.removeEventListener('scroll', this.boundScroll);
  }

  /** Returns the accumulated state and resets the *delta* counters so a
   * subsequent `tick()` only reports the time since the last tick. The
   * absolute counters keep accumulating for the final `snapshot()`. */
  tick(): EngagementSnapshot {
    this.tickAccumulators();
    return this.snapshot();
  }

  snapshot(): EngagementSnapshot {
    return {
      active_time_ms:        Math.round(this.accumulatedActive),
      idle_time_ms:          Math.round(this.accumulatedIdle),
      scroll_depth_percent:  Math.min(100, Math.round(this.maxScrollDepth)),
      click_count:           this.clickCount,
      rage_click_count:      this.rageClickCount,
    };
  }

  recordClick(isRage: boolean) {
    this.clickCount += 1;
    if (isRage) this.rageClickCount += 1;
    this.lastActivityAt = Date.now();
  }

  private tickAccumulators() {
    const now = Date.now();
    const elapsed = now - this.flushedAt;
    if (elapsed <= 0) return;
    const sinceActivity = now - this.lastActivityAt;
    if (!this.isVisible) {
      this.accumulatedIdle += elapsed;
    } else if (sinceActivity > this.idleAfterMs) {
      // Last `idleAfterMs` of the elapsed window counts as idle, the rest as active.
      const idlePortion = Math.min(elapsed, sinceActivity - this.idleAfterMs);
      this.accumulatedIdle += idlePortion;
      this.accumulatedActive += elapsed - idlePortion;
    } else {
      this.accumulatedActive += elapsed;
    }
    this.flushedAt = now;
  }

  private onActivity(_e: Event) {
    this.tickAccumulators();
    this.lastActivityAt = Date.now();
  }

  private onVisibility() {
    this.tickAccumulators();
    this.isVisible = !document.hidden;
    this.lastActivityAt = Date.now();
  }

  private onScroll() {
    this.tickAccumulators();
    this.lastActivityAt = Date.now();
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const docEl = document.documentElement;
    const total = (docEl?.scrollHeight ?? 0) - (window.innerHeight ?? 0);
    if (total <= 0) { this.maxScrollDepth = 100; return; }
    const scrolled = (window.scrollY ?? 0) + (window.innerHeight ?? 0);
    const pct = Math.min(100, Math.max(0, ((scrolled - (window.innerHeight ?? 0)) / total) * 100));
    if (pct > this.maxScrollDepth) this.maxScrollDepth = pct;
  }
}
