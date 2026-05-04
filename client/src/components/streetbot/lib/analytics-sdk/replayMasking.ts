// Sensitive-route detection + PostHog session replay configuration.
//
// Routes in `SENSITIVE_ROUTES` disable replay capture entirely. On non-
// sensitive routes, replay is enabled with aggressive input masking.
// Source of truth: PRIVACY.md.

const SENSITIVE_ROUTE_PATTERNS: RegExp[] = [
  /^\/messages(\/|$)/,
  /^\/c\/[^/?]+/,                       // LibreChat conversation
  /^\/jobs\/resume(\/|$)/,
  /^\/jobs\/[^/]+(\?.*apply=1.*)?$/i,   // job apply form
  /^\/case-management(\/|$)/,
  /^\/documents(\/|$)/,
  /^\/settings(\/|$)/,
  /^\/profile\/edit(\/|$)/,
  /^\/grantwriter(\/|$)/,
];

export function isSensitiveRoute(pathnameWithSearch: string): boolean {
  for (const re of SENSITIVE_ROUTE_PATTERNS) {
    if (re.test(pathnameWithSearch)) return true;
  }
  return false;
}

/** PostHog session replay config. Apply at posthog.init time. */
export const POSTHOG_SESSION_REPLAY_CONFIG = {
  session_recording: {
    maskAllInputs: true,
    maskTextSelector: '[data-mask], [data-private], textarea, [contenteditable]',
    maskInputOptions: {
      password: true,
      email:    true,
      tel:      true,
      text:     true,
      textarea: true,
      select:   true,
      color:    true,
      date:     true,
      month:    true,
      week:     true,
      'datetime-local': true,
      number:   true,
      range:    true,
      search:   true,
      time:     true,
      url:      true,
    },
    blockSelector: '[data-no-record], .ph-no-capture',
    ignoreClass:   'ph-ignore-input',
  },
  // Top-level masking flags belt-and-suspenders. Older PostHog versions read these.
  mask_all_text:  false,
  mask_all_element_attributes: false,
  capture_pageview:  false, // we handle page_entered/exited ourselves
  capture_pageleave: false,
  autocapture:    false,    // we handle clicks ourselves with stable label_keys
  disable_session_recording: false,
};
