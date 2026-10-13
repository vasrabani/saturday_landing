/* Fox Signals — FS-PR-5 anon signup nudge.
 *
 * Renders as a hidden modal (see _signup_nudge.html) shipped once in
 * the shell for anon visitors. This script owns:
 *
 *   - opening the modal with contextual heading/body,
 *   - intercepting anon clicks on write-side controls (star buttons,
 *     locked shell tabs) so they raise the modal instead of the
 *     server's silent 302,
 *   - closing on backdrop, close-button, or Escape.
 *
 * Cubs never see the modal — the anon flag lives on .fx-shell as
 * data-fx-anon-preview="1" and the whole script exits early otherwise.
 *
 * Every CTA URL is UTM-tagged so FS-PR-7's dashboard can attribute
 * conversion by trigger (star vs. tab vs. any manual call).
 */
(function () {
  'use strict';

  // The v1 shell carries the flag on .fx-shell, the v2 shell on its
  // own wrapper: look for the flag, not the element.
  var shell = document.querySelector('[data-fx-anon-preview="1"]');
  if (!shell) return;

  var modal = document.getElementById('fx-nudge');
  if (!modal) return;

  var titleEl   = modal.querySelector('#fx-nudge-title');
  var bodyEl    = modal.querySelector('#fx-nudge-body');
  var primaryEl = modal.querySelector('[data-fx-nudge-cta]');

  // Contextual copy — keyed by trigger. Each entry paints the modal
  // headline + body + tags the primary CTA URL so FS-PR-7 can see
  // WHICH surface converted.
  var CONTEXTS = {
    star: {
      title: 'Save this race',
      body:  "Sign up free to star races into your Stable — one place " +
             "to track everything you're watching today.",
      utm:   'nudge_star',
    },
    alerts: {
      title: 'Get alerts when signals fire',
      body:  "Sign up free to wire up Alerts — the moment a big cut " +
             'or steamer lands, we ping you.',
      utm:   'nudge_alerts',
    },
    settings: {
      title: 'Tune your terminal',
      body:  'Sign up free to save your Settings — pill filters, ' +
             'signal thresholds, and Board defaults, remembered.',
      utm:   'nudge_settings',
    },
    den: {
      title: 'Open the DEN',
      body:  'Sign up free to open the LLaMa Chat DEN — ask any race ' +
             'question, get a Cub-only answer.',
      utm:   'nudge_den',
    },
    generic: {
      title: 'Free to sign up',
      body:  'Sign up free to unlock the full Fox Signals terminal.',
      utm:   'nudge_generic',
    },
  };

  function tagPrimary(utm) {
    var base = primaryEl.getAttribute('href').split('?')[0];
    primaryEl.setAttribute(
      'href',
      base + '?utm_source=fox_signals&utm_content=' + utm
    );
  }

  var lastFocused = null;

  // FS-PR-7 — engagement telemetry. Fires two channels:
  //  1. GA4 gtag() for the acquisition dashboard (guarded — no-op if
  //     gtag isn't loaded, e.g. dev without GA4).
  //  2. POST to /analytics/event/ so the server-side dashboard rollup
  //     works without depending on GA4 access. sendBeacon-first so a
  //     nudge open right before nav (CTA click) still lands.
  function ping(action, extra) {
    var payload = Object.assign({ action: action }, extra || {});
    // GA4 — event name namespaced so it shows up cleanly in Explore.
    if (typeof window.gtag === 'function') {
      try { window.gtag('event', 'fox_signals_' + action, payload); }
      catch (_) { /* never let a bad tag break the nudge */ }
    }
    // Server rollup — one bounded POST, never awaited.
    try {
      var body = JSON.stringify({ event: 'fox_preview_engage', meta: payload });
      var url  = '/analytics/event/';
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      } else {
        fetch(url, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          keepalive: true,
        }).catch(function () { /* fire-and-forget */ });
      }
    } catch (_) { /* fire-and-forget */ }
  }

  function open(contextKey) {
    var ctx = CONTEXTS[contextKey] || CONTEXTS.generic;
    titleEl.textContent = ctx.title;
    bodyEl.textContent  = ctx.body;
    tagPrimary(ctx.utm);
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.documentElement.classList.add('fx-nudge-open');
    // Focus the primary CTA so keyboard users land somewhere useful.
    setTimeout(function () { primaryEl.focus(); }, 0);
    ping('nudge_open', { trigger: contextKey, utm_content: ctx.utm });
  }

  function close() {
    modal.hidden = true;
    document.documentElement.classList.remove('fx-nudge-open');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  // ── Click routing ────────────────────────────────────────────
  document.addEventListener('click', function (evt) {
    // Anon star click — intercept BEFORE board_star.js reaches its
    // fetch. Capture-phase listener below fires first for that.
    // Locked shell tabs — anchors flagged with data-fx-locked-tab.
    var tab = evt.target.closest('[data-fx-locked-tab]');
    if (tab) {
      evt.preventDefault();
      open(tab.getAttribute('data-fx-locked-tab') || 'generic');
      return;
    }
    // FS-PR-7 — modal primary CTA: count as a conversion attempt
    // (server-side FOX_PREVIEW_CONVERT still fires only when the
    // signup actually completes — this counts the intent).
    var cta = evt.target.closest('[data-fx-nudge-cta]');
    if (cta) {
      ping('nudge_convert', {
        href: cta.getAttribute('href') || '',
      });
      // Do NOT preventDefault — let the browser follow the link.
      return;
    }
    // FS-PR-7 — inline mask CTAs (conviction / value_edge /
    // signal_evidence) carry data-fx-mask. Same fire-and-forget.
    var mask = evt.target.closest('[data-fx-mask]');
    if (mask) {
      ping('mask_cta', {
        kind: mask.getAttribute('data-fx-mask') || 'unknown',
      });
      return;
    }
    // Any element with data-fx-nudge-dismiss inside the modal closes.
    if (evt.target.closest('[data-fx-nudge-dismiss]')) {
      evt.preventDefault();
      close();
      return;
    }
  });

  // Star click — capture-phase so we run BEFORE board_star.js's
  // bubble-phase handler starts a POST that will 403 on the server.
  document.addEventListener('click', function (evt) {
    var star = evt.target.closest('[data-fx-star]');
    if (!star) return;
    evt.preventDefault();
    evt.stopPropagation();
    evt.stopImmediatePropagation();
    open('star');
  }, /* useCapture */ true);

  // Escape key closes.
  document.addEventListener('keydown', function (evt) {
    if (evt.key === 'Escape' && !modal.hidden) close();
  });

  // Expose a manual opener so future surfaces (DEN entry, alerts CTA
  // inside a partial) can raise the modal without re-declaring copy.
  window.fxSignupNudge = open;
})();
