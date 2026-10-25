/*
 * The Enclosure — Cup live poll (E9).
 *
 * Every 30 seconds, ask /cup/live.json for the three rendered
 * fragments (hero, progress, board) and swap them into their
 * placeholders. The pattern mirrors feed_live.js: server-side
 * rendering, no client-side diffing, small payloads.
 *
 * Two stop conditions:
 *   * Visibility API — pause when the tab is hidden; resume on
 *     visibilitychange. Same battery-friendly behaviour as Feed.
 *   * `all_settled` — the moment the server tells us every race
 *     is settled, we stop polling entirely. The leaderboard can't
 *     move any more, and the live pill switches to "Cup settled"
 *     at that point too.
 */
(function () {
  'use strict';

  var POLL_MS = 30000;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var cup = document.querySelector('.enc-cup[data-live-endpoint]');
    if (!cup) return;
    if (cup.getAttribute('data-all-settled') === '1') return;

    var endpoint = cup.getAttribute('data-live-endpoint');
    var hero = cup.querySelector('[data-role="cup-hero"]');
    var progress = cup.querySelector('[data-role="cup-progress"]');
    var picks = cup.querySelector('[data-role="cup-picks"]');
    var board = cup.querySelector('[data-role="cup-board"]');
    var pauseChip = cup.querySelector('[data-role="poll-meta"]');
    if (!hero || !progress || !board) return;

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
          if (typeof payload.hero_html === 'string') {
            hero.innerHTML = payload.hero_html;
          }
          if (typeof payload.progress_html === 'string') {
            progress.innerHTML = payload.progress_html;
          }
          if (picks && typeof payload.picks_html === 'string') {
            picks.innerHTML = payload.picks_html;
          }
          if (typeof payload.board_html === 'string') {
            board.innerHTML = payload.board_html;
          }
          if (payload.all_settled) {
            stopPolling();
            // Leave the swapped HTML in place; the next full page
            // load will flip the pill chip to 'Cup settled'.
          }
        })
        .catch(function (err) {
          if (window.console && console.warn) {
            console.warn('[enclosure] cup poll failed:', err);
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
