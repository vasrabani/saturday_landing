/* trail_cards.js — two finishing touches on the race cards that a
 * stylesheet cannot make on its own.
 *
 *   1. Long names. A horse whose name is one long word
 *      ("Sunriseontheboyne") would run out of a narrow card, or break
 *      in the middle. Its type is set to the largest size at which the
 *      word fits, down to a floor of 11px; only below that does the
 *      stylesheet let it break.
 *
 *   2. The entrance. Cards further down the board come up onto the
 *      track as the reader reaches them. Cards already on screen are
 *      never hidden first, so nothing flashes on load, and anyone who
 *      has asked for reduced motion gets the board as it is.
 *
 * Both are presentation only: `--cell-horse-size` on a name, `is-seen`
 * on a card and `trail--entrance` on main.trail are read by trail.css
 * and by nothing else. Zero deps; without this file names fall back to
 * breaking where they must and every card is simply there.
 */
(function () {
  'use strict';

  var grid = document.getElementById('trailGrid');
  var main = document.querySelector('main.trail');
  if (!grid || !main) return;

  /* ── 1. Long names ─────────────────────────────────────────── */

  var MIN_NAME_PX = 11;
  var STEP_PX     = 0.5;
  var SETTLE_MS   = 120;    // the board's width must hold still this long before names are fitted to it

  function horseNames() {
    return Array.prototype.slice.call(grid.querySelectorAll('.cell__horse'));
  }

  /* Back to the stylesheet's size. */
  function unfitNames() {
    horseNames().forEach(function (name) { name.style.removeProperty('--cell-horse-size'); });
  }

  /* Give each name that overflows the largest size at which it fits.
   * It expects names at the stylesheet's size: one fitted earlier no
   * longer overflows, and is left as it is. */
  function fitNames() {
    var names = horseNames();

    // No breaking inside a word while measuring, so that a long word
    // shows up as overflow.
    names.forEach(function (name) { name.style.overflowWrap = 'normal'; });

    // Read everything in one go: one layout for the board, not one a name.
    var sizes = names.map(function (name) {
      var room = name.clientWidth;
      var needed = name.scrollWidth;
      if (!room || needed <= room) return null;
      // Width follows type size, so the ratio gives the size that fits;
      // rounded down a step to be sure of it.
      var size = parseFloat(getComputedStyle(name).fontSize);
      return Math.max(MIN_NAME_PX, Math.floor(size * room / needed / STEP_PX) * STEP_PX - STEP_PX);
    });

    names.forEach(function (name, i) {
      name.style.overflowWrap = '';
      if (sizes[i]) name.style.setProperty('--cell-horse-size', sizes[i] + 'px');
    });
  }

  function debounce(fn, ms) {
    var timer = null;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, ms);
    };
  }

  /* When a name's room changes, start again from the stylesheet's size.
   * Clearing a fitting and measuring cannot be done in one go: for a
   * reader who has asked for less motion the site gives every property
   * a near-instant transition (chrome.css), so a size that has just
   * changed is not in the layout yet when a script asks in the same
   * breath. So the names go back at once, and are fitted when the
   * board has held still for a moment. */
  var fitSoon = debounce(fitNames, SETTLE_MS);
  function refit() {
    unfitNames();
    fitSoon();
  }

  fitNames();

  // A name's room is its card's width, which follows the board's. The
  // board's height changing (a name fitted, a race settled) is no
  // reason to fit again, and reacting to it would chase its own tail.
  if ('ResizeObserver' in window) {
    var boardWidth = grid.offsetWidth;
    new ResizeObserver(function () {
      if (grid.offsetWidth === boardWidth) return;
      boardWidth = grid.offsetWidth;
      refit();
    }).observe(grid);
  } else {
    window.addEventListener('resize', refit);
  }
  // Names change width when the web font replaces the fallback.
  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', refit);
  }

  /* ── 2. The entrance ───────────────────────────────────────── */

  var REACHED_AT = 0.94;    // a card is reached once its top is this far down the window

  var wantsMotion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!wantsMotion || !('IntersectionObserver' in window)) return;

  // The cards that are races: not the empty seats that pad out a short
  // row (.cell--ghost), which the stylesheet hides.
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.cell[data-race-id]:not(.cell--ghost)'));
  var reached = -1;         // the furthest card the reader has got to

  /* Everything up to the furthest card reached is up: a reader who
   * jumps down the board has passed the cards in between. */
  function bringUpTo(index, observer) {
    for (var i = reached + 1; i <= index; i++) {
      cards[i].classList.add('is-seen');
      if (observer) observer.unobserve(cards[i]);
    }
    reached = Math.max(reached, index);
  }

  // Whatever shows in the window now, by however little, is already up
  // before the effect is switched on: nothing on screen is taken away.
  var onScreen = -1;
  cards.forEach(function (card, i) {
    if (card.getBoundingClientRect().top < window.innerHeight) onScreen = i;
  });
  bringUpTo(onScreen, null);
  main.classList.add('trail--entrance');

  var observer = new IntersectionObserver(function (entries) {
    var furthest = -1;
    entries.forEach(function (entry) {
      // In view, or already above the window.
      if (entry.isIntersecting || entry.boundingClientRect.bottom < 0) {
        furthest = Math.max(furthest, cards.indexOf(entry.target));
      }
    });
    if (furthest > reached) bringUpTo(furthest, observer);
  }, { rootMargin: '0px 0px -' + Math.round((1 - REACHED_AT) * 100) + '% 0px', threshold: 0.1 });

  for (var i = reached + 1; i < cards.length; i++) observer.observe(cards[i]);
})();
