// Meeting-full page enhancements:
//   1) Sticky jump-nav lights the currently-visible race's chip.
//   2) Next-off countdown updates the strip every second.
//   3) Sets .is-stuck on the jump nav once it's pinned to the top so
//      a subtle shadow appears.
//
// All effects are progressive enhancements — page still works without JS.
(function () {
  'use strict';

  function initActiveJumpChip() {
    var races = document.querySelectorAll('.mf-race[data-race-id]');
    var chips = document.querySelectorAll('[data-jump-target]');
    if (!races.length || !chips.length || !('IntersectionObserver' in window)) return;

    var chipByTarget = {};
    chips.forEach(function (c) {
      chipByTarget[c.getAttribute('data-jump-target')] = c;
    });

    var io = new IntersectionObserver(function (entries) {
      // Pick whichever observed race has the largest intersection ratio
      // — that's the one the viewer is "on" right now.
      var topRatio = 0;
      var topId    = null;
      entries.forEach(function (e) {
        if (e.intersectionRatio > topRatio) {
          topRatio = e.intersectionRatio;
          topId    = e.target.id;
        }
      });
      if (!topId) return;
      chips.forEach(function (c) {
        c.classList.toggle('is-active',
          c.getAttribute('data-jump-target') === topId);
      });
    }, {
      // Bias the trigger zone to the upper third so the chip flips as
      // the next race scrolls under the sticky jump nav rather than
      // when it's already past it.
      rootMargin: '-30% 0px -50% 0px',
      threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
    });

    races.forEach(function (r) { io.observe(r); });
  }

  function initStuckShadow() {
    var nav = document.querySelector('[data-mf-jump]');
    if (!nav || !('IntersectionObserver' in window)) return;
    // A 1px sentinel just above the nav — when it leaves the viewport
    // the nav is stuck. Standard sticky-detection trick.
    var sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;pointer-events:none;';
    nav.parentNode.insertBefore(sentinel, nav);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        nav.classList.toggle('is-stuck', !e.isIntersecting);
      });
    });
    io.observe(sentinel);
  }

  function initNextOffCountdown() {
    var strip = document.querySelector('[data-next-off-iso]');
    if (!strip) return;
    var iso = strip.getAttribute('data-next-off-iso');
    var out = strip.querySelector('[data-next-off-countdown]');
    if (!iso || !out) return;
    var offAt = new Date(iso);
    if (isNaN(offAt.getTime())) return;

    function tick() {
      var diff = offAt - new Date();
      if (diff <= 0) {
        out.textContent = 'AT THE POST';
        return;
      }
      var totalSec = Math.floor(diff / 1000);
      var mins = Math.floor(totalSec / 60);
      var secs = totalSec % 60;
      if (mins >= 60) {
        var hrs = Math.floor(mins / 60);
        out.textContent = hrs + 'h ' + (mins % 60) + 'm to post';
      } else if (mins > 0) {
        out.textContent = mins + ' min to post';
      } else {
        out.textContent = secs + 's to post';
      }
    }
    tick();
    setInterval(tick, 1000);
  }

  // Spoiler controls — winner-name reveal pill on resulted races.
  // Mirrors the meetings_browse implementation and shares the same
  // localStorage key (sr_revealed_races) so a reveal here stays
  // revealed when the user navigates between the two pages.
  function initSpoilers() {
    var STORAGE_KEY = 'sr_revealed_races';

    function readRevealed() {
      try {
        var raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return new Set();
        var parsed = JSON.parse(raw);
        return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
      } catch (e) {
        return new Set();
      }
    }
    function writeRevealed(set) {
      try {
        window.localStorage.setItem(
          STORAGE_KEY, JSON.stringify(Array.from(set))
        );
      } catch (e) { /* private mode / quota — silently fail */ }
    }
    function setSpoiler(btn, isRevealed) {
      if (!btn) return;
      btn.setAttribute('aria-pressed', isRevealed ? 'true' : 'false');
    }
    function isRevealed(btn) {
      return btn && btn.getAttribute('aria-pressed') === 'true';
    }

    var revealed = readRevealed();
    var pills = document.querySelectorAll('[data-spoiler][data-action="reveal-result"]');
    if (!pills.length) return;

    // Apply persisted reveals from prior visits / other pages.
    pills.forEach(function (sp) {
      if (revealed.has(String(sp.dataset.raceId))) {
        setSpoiler(sp, true);
      }
    });

    // Scope click delegation to the races main container so we don't
    // conflict with other pages' spoiler handlers if anything ever
    // shares the page body.
    var root = document.querySelector('.mf-races') || document.body;
    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action="reveal-result"]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var nowRevealed = !isRevealed(btn);
      setSpoiler(btn, nowRevealed);
      var id = String(btn.dataset.raceId);
      if (nowRevealed) {
        revealed.add(id);
      } else {
        revealed.delete(id);
      }
      writeRevealed(revealed);
    });
  }

  function boot() {
    initActiveJumpChip();
    initStuckShadow();
    initNextOffCountdown();
    initSpoilers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
