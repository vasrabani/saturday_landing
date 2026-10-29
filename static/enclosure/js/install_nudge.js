/*
 * The Enclosure — Install nudge (E15).
 *
 * Progressive Add-to-Home-Screen prompt:
 *   * Chrome/Edge/Android — captures `beforeinstallprompt`, wires
 *     a real Install button that fires prompt().
 *   * iOS Safari — no API. Shows the "Share → Add to Home Screen"
 *     instruction chunk instead.
 *   * Already installed (standalone display mode) — never shown.
 *   * Dismissed in the last 14 days — never shown.
 *   * The first page of a visit — not shown yet: the guest is asked
 *     once they have seen what the app is for, not on load.
 *
 * Kept small: no framework, no fetch, no persistent state on the
 * server. LocalStorage flag + a captured event is all we need.
 */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function isStandalone() {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
    if (window.navigator.standalone === true) return true;
    return false;
  }

  function isIos() {
    var ua = window.navigator.userAgent || '';
    return /iPhone|iPad|iPod/.test(ua)
        && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  }

  function readDismissedAt(key) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return 0;
      var n = parseInt(raw, 10);
      return isNaN(n) ? 0 : n;
    } catch (e) {
      return 0;
    }
  }

  function writeDismissedAt(key, ts) {
    try { window.localStorage.setItem(key, String(ts)); }
    catch (e) { /* private-browsing / quota — never fatal */ }
  }

  function isDismissed(key, cooldownDays) {
    var last = readDismissedAt(key);
    if (!last) return false;
    var ageMs = Date.now() - last;
    var ttlMs = cooldownDays * 24 * 60 * 60 * 1000;
    return ageMs < ttlMs;
  }

  // Counts the pages of this visit (the browser tab's session).
  function isFirstPageOfVisit() {
    try {
      var seen = parseInt(window.sessionStorage.getItem('enc-pages-seen'), 10) || 0;
      window.sessionStorage.setItem('enc-pages-seen', String(seen + 1));
      return seen === 0;
    } catch (e) {
      return false;   /* storage off: ask as before */
    }
  }

  ready(function () {
    var nudge = document.getElementById('enc-install-nudge');
    if (!nudge) return;
    var later = isFirstPageOfVisit();

    var key = nudge.getAttribute('data-storage-key') || 'enc-install-dismissed';
    var cooldown = parseInt(nudge.getAttribute('data-cooldown-days') || '14', 10);

    if (isStandalone()) return;
    if (isDismissed(key, cooldown)) return;

    var installBtn = nudge.querySelector('[data-role="install"]');
    var dismissBtn = nudge.querySelector('[data-role="dismiss"]');
    var iosChunk   = nudge.querySelector('[data-role="ios"]');

    dismissBtn.addEventListener('click', function () {
      writeDismissedAt(key, Date.now());
      nudge.hidden = true;
    });

    var deferredPrompt = null;

    // The browser's own install bar is held back on every page; ours
    // shows from the second page of a visit.
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      installBtn.hidden = false;
      if (!later) nudge.hidden = false;
    });

    installBtn.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (choice) {
        writeDismissedAt(key, Date.now());
        deferredPrompt = null;
        installBtn.hidden = true;
        nudge.hidden = true;
        if (choice && choice.outcome === 'dismissed') {
          /* keep the 14-day cooldown either way */
        }
      });
    });

    window.addEventListener('appinstalled', function () {
      writeDismissedAt(key, Date.now());
      nudge.hidden = true;
    });

    /* iOS Safari path — no beforeinstallprompt, just show the
     * instructions and let the user run the OS share sheet. */
    if (isIos()) {
      iosChunk.hidden = false;
      if (!later) nudge.hidden = false;
    }
  });
})();
