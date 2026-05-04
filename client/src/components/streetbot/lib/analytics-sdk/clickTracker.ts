// Click tracking — emits element_clicked, cta_clicked, navigation_clicked,
// dead_click_detected, rage_click_detected.
//
// Stable label keys come from data attributes:
//   data-track="gallery.upload.submit"   → element_clicked
//   data-cta="jobs.apply.quick"          → cta_clicked
//   <Link to="...">                      → navigation_clicked (caught via [data-router-link])
//
// We never read the visible text of the element — that text might contain
// user-generated content (a thread title, a service name, etc.).

import type { EngagementTracker } from './engagement';

export interface ClickEmitter {
  (eventName:
    | 'element_clicked'
    | 'cta_clicked'
    | 'navigation_clicked'
    | 'dead_click_detected'
    | 'rage_click_detected',
   props: Record<string, unknown>): void;
}

interface RecentClick {
  target:    EventTarget | null;
  labelKey:  string | null;
  ts:        number;
  domHash:   string;
}

export interface ClickTrackerOptions {
  rageThreshold?:        number;  // clicks within rageWindowMs to call it rage. Default 3.
  rageWindowMs?:         number;  // default 1000
  deadClickWindowMs?:    number;  // default 500 — DOM unchanged → dead. Default 500.
}

export class ClickTracker {
  private emit:  ClickEmitter;
  private engagement: EngagementTracker | null;
  private opts:  Required<ClickTrackerOptions>;
  private recents: RecentClick[] = [];
  private bound:   (e: MouseEvent) => void;
  private active:  boolean = false;

  constructor(emit: ClickEmitter, engagement: EngagementTracker | null, opts: ClickTrackerOptions = {}) {
    this.emit = emit;
    this.engagement = engagement;
    this.opts = {
      rageThreshold:     opts.rageThreshold ?? 3,
      rageWindowMs:      opts.rageWindowMs  ?? 1000,
      deadClickWindowMs: opts.deadClickWindowMs ?? 500,
    };
    this.bound = this.onClick.bind(this);
  }

  start() {
    if (this.active || typeof document === 'undefined') return;
    document.addEventListener('click', this.bound, { capture: true });
    this.active = true;
  }

  stop() {
    if (!this.active || typeof document === 'undefined') return;
    document.removeEventListener('click', this.bound, { capture: true } as EventListenerOptions);
    this.active = false;
  }

  private onClick(e: MouseEvent) {
    const target = e.target as Element | null;
    if (!target) return;

    // Walk up the tree to find the nearest element carrying a tracking attribute.
    const el = target.closest('[data-track], [data-cta], [data-router-link], a[href], button') as HTMLElement | null;
    if (!el) return;

    const dataCta   = el.getAttribute('data-cta');
    const dataTrack = el.getAttribute('data-track');
    const isLink    = el.tagName === 'A' || el.hasAttribute('data-router-link');
    const labelKey  = dataCta ?? dataTrack ?? null;
    const role      = el.getAttribute('role') ?? el.tagName.toLowerCase();
    const elementId = el.id || null;

    // Rage detection.
    const now = Date.now();
    this.recents = this.recents.filter((r) => now - r.ts < this.opts.rageWindowMs);
    const sameTargetRecent = this.recents.filter((r) => r.target === el || r.labelKey === labelKey);
    const isRage = sameTargetRecent.length + 1 >= this.opts.rageThreshold;

    const beforeHash = hashShape(el);
    this.recents.push({ target: el, labelKey, ts: now, domHash: beforeHash });

    this.engagement?.recordClick(isRage);

    if (dataCta) {
      this.emit('cta_clicked', {
        cta:         dataCta,
        destination: el.getAttribute('data-cta-destination') ?? (el as HTMLAnchorElement).href ?? null,
        source:      el.getAttribute('data-cta-source')      ?? null,
      });
    } else if (dataTrack) {
      this.emit('element_clicked', {
        label_key:    dataTrack,
        element_role: role,
        element_id:   elementId,
      });
    } else if (isLink) {
      const href = (el as HTMLAnchorElement).href ?? null;
      this.emit('navigation_clicked', {
        from_route: typeof location !== 'undefined' ? location.pathname : null,
        to_route:   stripOrigin(href),
        nav_source: el.getAttribute('data-nav-source') ?? 'in_page',
      });
    } else {
      // Untagged button — emit a generic element_clicked with role only.
      this.emit('element_clicked', {
        label_key:    null,
        element_role: role,
        element_id:   elementId,
      });
    }

    if (isRage) {
      this.emit('rage_click_detected', {
        element_role: role,
        count:        sameTargetRecent.length + 1,
      });
    }

    // Dead click detection — wait deadClickWindowMs, see if the DOM around
    // the element changed at all. If not, consider it a dead click.
    setTimeout(() => {
      const afterHash = hashShape(el);
      if (afterHash === beforeHash && el.isConnected) {
        this.emit('dead_click_detected', {
          element_role: role,
          element_id:   elementId,
        });
      }
    }, this.opts.deadClickWindowMs);
  }
}

/** Cheap structural fingerprint of the element + its first 5 children. */
function hashShape(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [el.tagName, el.className.slice(0, 50)];
  for (let i = 0; i < Math.min(el.children.length, 5); i++) {
    const c = el.children[i];
    parts.push(c.tagName, String(c.children.length));
  }
  return parts.join('|');
}

function stripOrigin(href: string | null): string | null {
  if (!href) return null;
  try {
    const u = new URL(href, typeof location !== 'undefined' ? location.origin : 'http://x');
    return u.pathname + u.search;
  } catch {
    return href;
  }
}
