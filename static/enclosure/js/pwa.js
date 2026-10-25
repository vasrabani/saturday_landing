/*
 * The Enclosure — PWA bootstrap.
 *
 * Registers the service worker with scope=/enclosure/ so a single
 * registration covers every event page. Deliberately minimal in
 * E1 — no offline caching, no install prompt UI. Later PRs layer
 * on top:
 *   E4  · offline shell (asset caching)
 *   E16 · Web Push subscription bootstrap
 *   E17 · beforeinstallprompt handler + custom "Add to home screen"
 *         call-to-action on first visit
 */
(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/enclosure/sw.js', {
      scope: '/enclosure/'
    }).catch(function (err) {
      // Failure is non-fatal — the page still works without a SW.
      // A dev-only console note helps triage the (rare) case where
      // scope isn't accepted (usually a Service-Worker-Allowed
      // header issue behind a reverse proxy).
      if (window.console && console.warn) {
        console.warn('[enclosure] SW registration failed:', err);
      }
    });
  });
})();
