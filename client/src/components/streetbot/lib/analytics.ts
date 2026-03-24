/**
 * Platform Analytics Client
 *
 * Provides client-side event tracking following the platform-wide
 * analytics architecture. Events are batched and sent to the backend
 * analytics service.
 *
 * Usage:
 *   import { analytics } from "@/lib/analytics";
 *
 *   // Track an event
 *   analytics.track("service_clicked", { service_id: "123", position: 1 });
 *
 *   // Track a page view
 *   analytics.pageView("/directory", "Service Directory");
 *
 *   // Identify a user
 *   analytics.identify("user-uuid", { role: "user", plan: "free" });
 */

// Event taxonomy - must match backend
type ProductArea =
  | "street_bot"
  | "tasks"
  | "calendar"
  | "messages"
  | "directory"
  | "jobs"
  | "gallery"
  | "groups"
  | "news"
  | "academy"
  | "profiles"
  | "billing"
  | "admin"
  | "auth";

interface AnalyticsContext {
  page_url?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  device_type?: string;
  browser?: string;
  os?: string;
  product_area?: string;
  environment?: string;
  app_version?: string;
}

interface AnalyticsEvent {
  event_name: string;
  user_id?: string;
  anonymous_id?: string;
  session_id?: string;
  properties?: Record<string, unknown>;
  context?: AnalyticsContext;
  timestamp?: string;
}

interface AnalyticsConfig {
  backendUrl: string;
  batchSize: number;
  flushInterval: number;
  debug: boolean;
}

const DEFAULT_CONFIG: AnalyticsConfig = {
  backendUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  batchSize: 10,
  flushInterval: 5000, // 5 seconds
  debug: process.env.NODE_ENV === "development",
};

class AnalyticsClient {
  private config: AnalyticsConfig;
  private eventQueue: AnalyticsEvent[] = [];
  private sessionId: string | null = null;
  private userId: string | null = null;
  private anonymousId: string;
  private userProperties: Record<string, unknown> = {};
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.anonymousId = this.getOrCreateAnonymousId();
  }

  /**
   * Initialize the analytics client.
   * Should be called once on app load.
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    // Start a new session
    await this.startSession();

    // Set up periodic flush
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);

    // Flush on page unload
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        this.flush(true);
      });

      // Track page visibility changes
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          this.flush(true);
        }
      });
    }

    this.isInitialized = true;
    this.log("Analytics initialized");
  }

  /**
   * Identify a user (call after login).
   */
  identify(userId: string, properties?: Record<string, unknown>): void {
    this.userId = userId;
    if (properties) {
      this.userProperties = { ...this.userProperties, ...properties };
    }
    this.log("User identified:", userId);
  }

  /**
   * Reset user identity (call after logout).
   */
  reset(): void {
    this.userId = null;
    this.userProperties = {};
    this.anonymousId = this.generateId();
    this.saveAnonymousId(this.anonymousId);
    this.log("Analytics reset");
  }

  /**
   * Track an event.
   */
  track(
    eventName: string,
    properties?: Record<string, unknown>,
    productArea?: ProductArea
  ): void {
    const event: AnalyticsEvent = {
      event_name: eventName,
      user_id: this.userId || undefined,
      anonymous_id: this.anonymousId,
      session_id: this.sessionId || undefined,
      properties: properties || {},
      context: this.buildContext(productArea),
      timestamp: new Date().toISOString(),
    };

    this.eventQueue.push(event);
    this.log("Event tracked:", eventName, properties);

    // Flush if batch size reached
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Track a page view.
   */
  pageView(path: string, title?: string, productArea?: ProductArea): void {
    this.track(
      "page_view",
      {
        page: path,
        title: title || document.title,
      },
      productArea
    );
  }

  /**
   * Street Bot specific event tracking.
   */
  streetBot = {
    chatStarted: (source?: string) => {
      this.track("chat_started", { source }, "street_bot");
    },

    messageSent: (messageType: string, length: number) => {
      this.track("message_sent", { message_type: messageType, length }, "street_bot");
    },

    serviceResultsShown: (count: number, category?: string) => {
      this.track("service_results_shown", { count, category }, "street_bot");
    },

    serviceClicked: (serviceId: string, position: number) => {
      this.track("service_clicked", { service_id: serviceId, position }, "street_bot");
    },

    serviceSaved: (serviceId: string) => {
      this.track("service_saved", { service_id: serviceId }, "street_bot");
    },

    callClicked: (serviceId: string) => {
      this.track("call_clicked", { service_id: serviceId }, "street_bot");
    },

    directionsClicked: (serviceId: string) => {
      this.track("directions_clicked", { service_id: serviceId }, "street_bot");
    },

    websiteClicked: (serviceId: string) => {
      this.track("website_clicked", { service_id: serviceId }, "street_bot");
    },

    referralCompleted: (serviceId: string, outcome?: string) => {
      this.track("referral_completed", { service_id: serviceId, outcome }, "street_bot");
    },

    feedbackSubmitted: (rating: number, type?: string) => {
      this.track("feedback_submitted", { rating, type }, "street_bot");
    },

    crisisFlowTriggered: (crisisType: string) => {
      this.track("crisis_flow_triggered", { crisis_type: crisisType }, "street_bot");
    },
  };

  /**
   * Directory specific event tracking.
   */
  directory = {
    search: (query: string, filters?: Record<string, unknown>, resultsCount?: number) => {
      this.track("service_search", { query, filters, results_count: resultsCount }, "directory");
    },

    serviceViewed: (serviceId: string) => {
      this.track("service_viewed", { service_id: serviceId }, "directory");
    },

    serviceFiltered: (filterType: string, value: string) => {
      this.track("service_filtered", { filter_type: filterType, value }, "directory");
    },
  };

  /**
   * Jobs specific event tracking.
   */
  jobs = {
    search: (query: string, filters?: Record<string, unknown>) => {
      this.track("job_search", { query, filters }, "jobs");
    },

    jobViewed: (jobId: string) => {
      this.track("job_viewed", { job_id: jobId }, "jobs");
    },

    jobApplied: (jobId: string) => {
      this.track("job_applied", { job_id: jobId }, "jobs");
    },

    jobSaved: (jobId: string) => {
      this.track("job_saved", { job_id: jobId }, "jobs");
    },
  };

  /**
   * Profile specific event tracking.
   */
  profile = {
    created: (profileType: string) => {
      this.track("profile_created", { profile_type: profileType }, "profiles");
    },

    updated: (fieldsUpdated: string[]) => {
      this.track("profile_updated", { fields_updated: fieldsUpdated }, "profiles");
    },

    viewed: (profileId: string) => {
      this.track("profile_viewed", { profile_id: profileId }, "profiles");
    },
  };

  /**
   * Groups specific event tracking.
   */
  groups = {
    joined: (groupId: string) => {
      this.track("group_joined", { group_id: groupId }, "groups");
    },

    left: (groupId: string) => {
      this.track("group_left", { group_id: groupId }, "groups");
    },

    postCreated: (groupId: string) => {
      this.track("group_post_created", { group_id: groupId }, "groups");
    },
  };

  /**
   * Content event tracking.
   */
  content = {
    newsArticleRead: (articleId: string, readTime?: number) => {
      this.track("news_article_read", { article_id: articleId, read_time: readTime }, "news");
    },

    galleryItemViewed: (itemId: string) => {
      this.track("gallery_item_viewed", { item_id: itemId }, "gallery");
    },

    galleryItemUploaded: (itemType: string) => {
      this.track("gallery_item_uploaded", { item_type: itemType }, "gallery");
    },
  };

  /**
   * Auth event tracking.
   */
  auth = {
    signedUp: (method: string) => {
      this.track("user_signed_up", { method }, "auth");
    },

    loggedIn: (method: string) => {
      this.track("user_logged_in", { method }, "auth");
    },

    loggedOut: () => {
      this.track("user_logged_out", {}, "auth");
      this.reset();
    },
  };

  /**
   * Flush events to the backend.
   */
  async flush(sync = false): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    const payload = {
      events: events.map((e) => ({
        event_name: e.event_name,
        user_id: e.user_id,
        anonymous_id: e.anonymous_id,
        session_id: e.session_id,
        properties: e.properties,
        context: e.context,
      })),
    };

    this.log("Flushing events:", events.length);

    try {
      if (sync && typeof navigator !== "undefined" && navigator.sendBeacon) {
        // Use sendBeacon for sync flush (page unload)
        navigator.sendBeacon(
          `${this.config.backendUrl}/api/analytics/events/batch`,
          JSON.stringify(payload)
        );
      } else {
        await fetch(`${this.config.backendUrl}/api/analytics/events/batch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      }
    } catch (error) {
      // Re-queue events on failure
      this.eventQueue = [...events, ...this.eventQueue];
      console.error("Analytics flush failed:", error);
    }
  }

  /**
   * Start a new session.
   */
  private async startSession(): Promise<void> {
    if (typeof window === "undefined") return;

    try {
      const response = await fetch(`${this.config.backendUrl}/api/analytics/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: this.userId,
          anonymous_id: this.anonymousId,
          context: this.buildContext(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.sessionId = data.session_id;
        this.log("Session started:", this.sessionId);
      }
    } catch (error) {
      // Generate local session ID if backend unavailable
      this.sessionId = this.generateId();
      console.error("Failed to start session:", error);
    }
  }

  /**
   * Build context object with device/browser info.
   */
  private buildContext(productArea?: ProductArea): AnalyticsContext {
    if (typeof window === "undefined") {
      return { product_area: productArea };
    }

    const ua = navigator.userAgent;
    const urlParams = new URLSearchParams(window.location.search);

    return {
      page_url: window.location.href,
      referrer: document.referrer,
      utm_source: urlParams.get("utm_source") || undefined,
      utm_medium: urlParams.get("utm_medium") || undefined,
      utm_campaign: urlParams.get("utm_campaign") || undefined,
      device_type: this.getDeviceType(),
      browser: this.getBrowser(ua),
      os: this.getOS(ua),
      product_area: productArea,
      environment: process.env.NODE_ENV,
      app_version: process.env.NEXT_PUBLIC_APP_VERSION,
    };
  }

  /**
   * Get or create anonymous ID.
   */
  private getOrCreateAnonymousId(): string {
    if (typeof window === "undefined") {
      return this.generateId();
    }

    const stored = localStorage.getItem("analytics_anonymous_id");
    if (stored) return stored;

    const newId = this.generateId();
    this.saveAnonymousId(newId);
    return newId;
  }

  /**
   * Save anonymous ID to storage.
   */
  private saveAnonymousId(id: string): void {
    if (typeof window !== "undefined") {
      localStorage.setItem("analytics_anonymous_id", id);
    }
  }

  /**
   * Generate a unique ID.
   */
  private generateId(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Detect device type.
   */
  private getDeviceType(): string {
    if (typeof window === "undefined") return "unknown";

    const width = window.innerWidth;
    if (width < 768) return "mobile";
    if (width < 1024) return "tablet";
    return "desktop";
  }

  /**
   * Detect browser.
   */
  private getBrowser(ua: string): string {
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Safari")) return "Safari";
    if (ua.includes("Edge")) return "Edge";
    if (ua.includes("MSIE") || ua.includes("Trident")) return "IE";
    return "Other";
  }

  /**
   * Detect OS.
   */
  private getOS(ua: string): string {
    if (ua.includes("Windows")) return "Windows";
    if (ua.includes("Mac")) return "macOS";
    if (ua.includes("Linux")) return "Linux";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
    return "Other";
  }

  /**
   * Debug logging.
   */
  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log("[Analytics]", ...args);
    }
  }

  /**
   * Cleanup on unmount.
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush(true);
  }
}

// Export singleton instance
export const analytics = new AnalyticsClient();

// Export class for custom instances
export { AnalyticsClient };

// React hook for easy integration
export function useAnalytics() {
  return analytics;
}
