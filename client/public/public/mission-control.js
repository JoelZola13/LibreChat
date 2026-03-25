/**
 * Street Voices — Mission Control
 * Direct navigation to Paperclip pages via unified nginx proxy.
 * Both LibreChat and Paperclip are served from the same origin (localhost:3180).
 * Clicking "Mission Control" navigates to /STR/dashboard (Paperclip's full React app).
 * The unified-nav.js bar is injected into both apps by nginx sub_filter.
 */
(function () {
  'use strict';

  // When on a LibreChat page and user clicks Mission Control in the nav,
  // navigate directly to the Paperclip dashboard.
  window.__svShowMissionControl = function () {
    window.location.href = '/STR/dashboard';
  };
})();
