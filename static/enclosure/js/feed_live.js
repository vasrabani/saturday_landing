/*
 * The Enclosure — Feed live poll.
 *
 * Every 30 seconds, ask /feed/live.json for the current top-of-stream
 * fragment and replace #enc-feed-stream innerHTML wholesale. No diff
 * algorithm: server rendering is fast, feed size is small, and a
 * clean swap avoids state drift between two DOM subtrees.
 *
 * Visibility API pauses the poll when the tab is hidden — no reason
 * to burn battery on a screen the guest can't see. Resumes on the
 * next visibilitychange. A pause chip announces the pause so guests
 * know why the LIVE dot stopped updating.
 *
 * The filter param round-trips on every poll so switching filters
 * with a URL bar edit stays sticky.
 */
(function () {
  'use strict';

  var POLL_MS = 30000;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var feed = document.querySelector('.enc-feed[data-live-endpoint]');
    if (!feed) return;
    var endpoint = feed.getAttribute('data-live-endpoint');
    var filter = feed.getAttribute('data-filter') || 'all';
    var stream = feed.querySelector('[data-role="stream"]');
    var pauseChip = feed.querySelector('[data-role="poll-meta"]');
    if (!stream) return;

    var timer = null;
    var inFlight = false;

    function tick() {
      if (inFlight || document.hidden) return;
      inFlight = true;
      var url = endpoint + '?filter=' + encodeURIComponent(filter);
      fetch(url, { credentials: 'same-origin', cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (payload) {
          if (payload && typeof payload.html === 'string') {
            stream.innerHTML = payload.html;
          }
        })
        .catch(function (err) {
          // Poll errors are non-fatal — the next tick tries again.
          if (window.console && console.warn) {
            console.warn('[enclosure] feed poll failed:', err);
          }
        })
        .then(function () { inFlight = false; });
    }

    function start() {
      if (timer !== null) return;
      timer = window.setInterval(tick, POLL_MS);
      if (pauseChip) pauseChip.hidden = true;
    }

    function stop() {
      if (timer === null) return;
      window.clearInterval(timer);
      timer = null;
      if (pauseChip) pauseChip.hidden = false;
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else { start(); tick(); }
    });

    // Manual resume: tapping the pause chip forces a poll + restart.
    if (pauseChip) {
      pauseChip.addEventListener('click', function () {
        start();
        tick();
      });
    }

    start();
  });
})();
