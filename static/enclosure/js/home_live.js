/*
 * The Enclosure — Home live poll (E12).
 *
 * Every 30 seconds, ask /home/live.json for a fresh HQ render and
 * swap it into the [data-role="home-content"] container. Countdown
 * ticks, nudge appears/disappears as races approach, triptych
 * refreshes after each settlement, feed-rail head updates.
 *
 * Two stop conditions:
 *   * Visibility API — pause when tab is hidden; resume on
 *     visibilitychange. Same battery discipline as Feed / Cup.
 *   * `is_post_meeting` — the moment the server tells us every
 *     race has settled, we stop polling permanently. Nothing on
 *     the Home surface can change any more, and the live pill
 *     already reads "Meeting done".
 *
 * Mirrors cup_live.js exactly — same pattern, single swap target.
 */
(function () {
  'use strict';

  var POLL_MS = 30000;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var home = document.querySelector('.enc-home[data-live-endpoint]');
    if (!home) return;
    if (home.getAttribute('data-post-meeting') === '1') return;

    var endpoint = home.getAttribute('data-live-endpoint');
    var content = home.querySelector('[data-role="home-content"]');
    var pauseChip = home.querySelector('[data-role="poll-meta"]');
    if (!content) return;

    var timer = null;
    var inFlight = false;
    var stopped = false;

    function tick() {
      if (stopped || inFlight || document.hidden) return;
      inFlight = true;
      fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (payload) {
          if (!payload) return;
          if (typeof payload.html === 'string') {
            content.innerHTML = payload.html;
          }
          if (payload.is_post_meeting) {
            stopPolling();
            // Leave the swapped HTML in place; the next full page
            // load flips the pill chip to "Meeting done".
          }
        })
        .catch(function (err) {
          if (window.console && console.warn) {
            console.warn('[enclosure] home poll failed:', err);
          }
        })
        .then(function () { inFlight = false; });
    }

    function start() {
      if (stopped || timer !== null) return;
      timer = window.setInterval(tick, POLL_MS);
      if (pauseChip) pauseChip.hidden = true;
    }

    function pause() {
      if (timer === null) return;
      window.clearInterval(timer);
      timer = null;
      if (pauseChip) pauseChip.hidden = false;
    }

    function stopPolling() {
      stopped = true;
      pause();
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pause();
      else { start(); tick(); }
    });

    if (pauseChip) {
      pauseChip.addEventListener('click', function () {
        start();
        tick();
      });
    }

    start();
  });
})();
