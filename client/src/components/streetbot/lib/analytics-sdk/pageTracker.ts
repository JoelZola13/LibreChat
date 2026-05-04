// Page lifecycle tracker — emits page_entered / page_engagement_tick / page_exited.
// Hooks into the browser's history API so it works whether the host app uses
// react-router, Next App Router, or any other client-side router.

import { EngagementTracker } from './engagement';
import type { ProductArea, RoutePatternResolver } from './types';

type EmitFn = (eventName: string, properties: Record<string, unknown>) => void;

export interface PageTrackerOptions {
  resolver:        RoutePatternResolver;
  engagementTickMs?: number;
  idleAfterMs?:    number;
  emit:            EmitFn;
  /** Called whenever route changes — used to (re)compute replay capture state. */
  onRouteChange?:  (info: { pathname: string; route_pattern: string; product_area: ProductArea }) => void;
  /** Called on hard exit (unload/visibility). Should sync-flush any queued events. */
  onHardExit?:     () => void;
}

export class PageTracker {
  private opts: Required<Omit<PageTrackerOptions, 'engagementTickMs' | 'idleAfterMs' | 'onRouteChange' | 'onHardExit'>> & {
    engagementTickMs: number;
    idleAfterMs:      number;
    onRouteChange?:   PageTrackerOptions['onRouteChange'];
    onHardExit?:      PageTrackerOptions['onHardExit'];
  };
  private engagement: EngagementTracker;
  private currentPath: string = '';
  private currentPattern: string = '';
  private currentArea:    ProductArea = '_global';
  private prevPattern:    string | null = null;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private historyPatched = false;
  private boundUnload: () => void;
  private boundVisibility: () => void;
  private active = false;

  constructor(opts: PageTrackerOptions) {
    this.opts = {
      resolver:           opts.resolver,
      emit:               opts.emit,
      engagementTickMs:   opts.engagementTickMs ?? 20_000,
      idleAfterMs:        opts.idleAfterMs ?? 30_000,
      onRouteChange:      opts.onRouteChange,
      onHardExit:         opts.onHardExit,
    };
    this.engagement = new EngagementTracker({ idleAfterMs: this.opts.idleAfterMs });
    this.boundUnload    = this.handleHardExit.bind(this);
    this.boundVisibility = this.onVisibility.bind(this);
  }

  start() {
    if (this.active || typeof window === 'undefined') return;
    this.active = true;
    this.patchHistory();
    window.addEventListener('popstate',    this.routeChangeListener);
    window.addEventListener('pagehide',    this.boundUnload);
    window.addEventListener('beforeunload',this.boundUnload);
    document.addEventListener('visibilitychange', this.boundVisibility);
    this.fireRouteChange(true);
    this.tickHandle = setInterval(() => this.fireTick(), this.opts.engagementTickMs);
  }

  stop() {
    if (!this.active || typeof window === 'undefined') return;
    this.active = false;
    if (this.tickHandle) { clearInterval(this.tickHandle); this.tickHandle = null; }
    window.removeEventListener('popstate', this.routeChangeListener);
    window.removeEventListener('pagehide', this.boundUnload);
    window.removeEventListener('beforeunload', this.boundUnload);
    document.removeEventListener('visibilitychange', this.boundVisibility);
    this.engagement.stop();
  }

  /** Called by routers that don't go through pushState (older react-router or
   *  custom history). Most modern apps don't need to call this. */
  notifyRouteChange() {
    this.fireRouteChange(false);
  }

  currentRouteInfo() {
    return {
      pathname:       this.currentPath,
      route_pattern:  this.currentPattern,
      product_area:   this.currentArea,
    };
  }

  private patchHistory() {
    if (this.historyPatched) return;
    this.historyPatched = true;
    const tracker = this;
    const _push    = history.pushState.bind(history);
    const _replace = history.replaceState.bind(history);
    history.pushState = function (data: unknown, unused: string, url?: string | URL | null) {
      const ret = _push(data, unused, url);
      tracker.fireRouteChange(false);
      return ret;
    };
    history.replaceState = function (data: unknown, unused: string, url?: string | URL | null) {
      const ret = _replace(data, unused, url);
      tracker.fireRouteChange(false);
      return ret;
    };
  }

  private routeChangeListener = () => this.fireRouteChange(false);

  private fireRouteChange(isInitial: boolean) {
    const path = (typeof location !== 'undefined' ? location.pathname : '') || '/';
    if (!isInitial && path === this.currentPath) return;

    if (!isInitial && this.currentPattern) {
      const snap = this.engagement.snapshot();
      this.opts.emit('page_exited', {
        route:                this.currentPath,
        route_pattern:        this.currentPattern,
        product_area:         this.currentArea,
        active_time_ms:       snap.active_time_ms,
        idle_time_ms:         snap.idle_time_ms,
        scroll_depth_percent: snap.scroll_depth_percent,
        click_count:          snap.click_count,
        rage_click_count:     snap.rage_click_count,
      });
      this.engagement.stop();
    }

    const { route_pattern, product_area } = this.opts.resolver(path);
    this.prevPattern = this.currentPattern || null;
    this.currentPath = path;
    this.currentPattern = route_pattern;
    this.currentArea = product_area;

    this.opts.onRouteChange?.({ pathname: path, route_pattern, product_area });

    this.opts.emit('page_entered', {
      route:                  path,
      route_pattern:          route_pattern,
      product_area:           product_area,
      referrer_route_pattern: this.prevPattern,
    });

    this.engagement.start();
  }

  private fireTick() {
    if (!this.currentPattern) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const snap = this.engagement.tick();
    this.opts.emit('page_engagement_tick', {
      route_pattern:        this.currentPattern,
      product_area:         this.currentArea,
      active_time_ms:       snap.active_time_ms,
      idle_time_ms:         snap.idle_time_ms,
      scroll_depth_percent: snap.scroll_depth_percent,
    });
  }

  private onVisibility() {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      // Tab hidden — fire a soft page_exited equivalent so we don't lose the
      // page-time when the user switches tabs and never comes back.
      this.handleHardExit();
    }
  }

  private handleHardExit() {
    if (!this.currentPattern) return;
    const snap = this.engagement.snapshot();
    this.opts.emit('page_exited', {
      route:                this.currentPath,
      route_pattern:        this.currentPattern,
      product_area:         this.currentArea,
      active_time_ms:       snap.active_time_ms,
      idle_time_ms:         snap.idle_time_ms,
      scroll_depth_percent: snap.scroll_depth_percent,
      click_count:          snap.click_count,
      rage_click_count:     snap.rage_click_count,
    });
    this.opts.onHardExit?.();
  }
}
