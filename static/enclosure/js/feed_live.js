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
 *
 * Where the list shows results, the band carries the day's winners
 * ([data-role="winners"]). The poll answer brings them too, as
 * winners_html, so a race settled since the page loaded joins the strip;
 * an answer without the field leaves the strip as it is. A tap on a
 * winner scrolls to its result when this list has it; otherwise the link
 * opens the race.
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
    var winners = feed.querySelector('[data-role="winners"]');
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
          if (winners && payload && typeof payload.winners_html === 'string') {
            winners.innerHTML = payload.winners_html;
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

    // The day's winners: a tap goes to the result in this list, with a
    // brief highlight. A modified click (new tab) keeps the link.
    if (winners) {
      winners.addEventListener('click', function (evt) {
        if (evt.button !== 0 || evt.metaKey || evt.ctrlKey || evt.shiftKey || evt.altKey) return;
        var link = evt.target.closest('[data-race]');
        var entry = link && document.getElementById('enc-feed-race-' + link.getAttribute('data-race'));
        if (!entry) return;
        evt.preventDefault();
        var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        entry.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
        entry.classList.remove('is-flash');
        void entry.offsetWidth;                 // restart the highlight
        entry.classList.add('is-flash');
        var row = entry.querySelector('.enc-feed__row');
        if (row) row.focus({ preventScroll: true });
      });
    }

    start();
  });
})();
