/* trail_course.js — the course bar: getting about the race day.
 *
 * A bar above the board that stays with the reader down the course:
 *
 *   - back and forward one race, on the bar or with the arrow keys;
 *   - a map of the day, one tick per race, built here from the cells;
 *   - the race the reader is level with;
 *   - a way back to the fox marker, at the next race;
 *   - links to the page's other sections.
 *
 * It also keeps the "next race" call under the introduction in step
 * with the fox marker, and holds the Reveal results toggle back until
 * there is a result to reveal.
 *
 * Markup: .trail__course and .trail__next in trail.html. The wording
 * lives there (data-* on the call and on the status line, like data-on
 * and data-off on the reveal toggle); the strings below are only
 * fallbacks.
 *
 * It reads the cells and leaves them alone, apart from focus and the
 * `cell--just-reached` flash on a card it has taken the reader to. The
 * live poller settles races and moves the fox marker by swapping
 * classes; a MutationObserver sees that and the bar follows. No
 * cross-file coupling.
 *
 * Zero deps, progressive enhancement: if a hook is missing the bar
 * stays as static markup and the board works as before.
 */
(function () {
  'use strict';

  var grid = document.getElementById('trailGrid');
  var bar  = document.querySelector('[data-role="course"]');
  if (!grid || !bar) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll('.cell[data-race-id]:not(.cell--ghost)'));
  if (!cards.length) return;

  var part = function (role) { return bar.querySelector('[data-role="course-' + role + '"]'); };
  var prevBtn = part('prev');
  var nextBtn = part('next');
  var map     = part('map');
  var number  = part('number');
  var total   = part('total');
  var raceEl  = part('race');
  var status  = part('status');
  var foxBtn  = part('fox');
  var toggle  = document.querySelector('[data-role="reveal-toggle"]');
  var call    = document.querySelector('[data-role="next-race"]');

  var SETTLED     = ['won', 'placed', 'lost', 'void'];
  var FLASH_MS    = 1600;   // how long a card stays marked after the reader is taken to it
  var ARRIVE_MS   = 160;    // no scroll event for this long: the page has stopped moving
  var NO_MOVE_MS  = 400;    // nothing to scroll at all: the card was already in place
  var SAME_ROW_PX = 2;
  var REFRESH_MS  = 120;

  var smooth = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

  var current     = 0;      // the race the reader is level with
  var centres     = [];     // each card's vertical centre, measured from the top of the grid
  var travelling  = false;  // on the way to a race the reader chose
  var travelTimer = 0;
  var flashed     = null;   // the card marked as the one just reached
  var flashTimer  = 0;

  /* ── Reading the board ─────────────────────────────────────── */

  function text(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }

  function raceOf(card) {
    return {
      time:   text(card.querySelector('.cell__time')),
      course: text(card.querySelector('.cell__course')),
      horse:  text(card.querySelector('.cell__horse')),
    };
  }

  function has(card, state) { return card.classList.contains('cell--' + state); }

  function isSettled(card) {
    return SETTLED.some(function (state) { return has(card, state); });
  }

  function foxIndex() {
    for (var i = 0; i < cards.length; i++) if (has(cards[i], 'now')) return i;
    return -1;
  }

  /* Where the cards are laid out, not where they are drawn: offset*
   * ignores transforms, so a card lifted by the pointer or still on
   * its way up is level with the rest of its row all the same. */
  function measure() {
    var parent = grid.offsetParent;
    centres = cards.map(function (card) {
      var y = 0;
      for (var el = card; el && el !== parent; el = el.offsetParent) y += el.offsetTop;
      return y - grid.offsetTop + card.offsetHeight / 2;
    });
  }

  /* ── The map of the day ────────────────────────────────────── */

  /* A shortcut for a pointer: a tick is small, and there may be sixty.
   * The markup hides the map from assistive tech, and the keyboard has
   * the two step buttons and the arrow keys instead. */
  function buildMap() {
    if (!map) return;
    var fragment = document.createDocumentFragment();
    cards.forEach(function (card, i) {
      var race = raceOf(card);
      var tick = document.createElement('li');
      tick.className = 'course__tick';
      tick.setAttribute('data-index', i);
      tick.title = [i + 1, race.time + ' ' + race.course, race.horse].filter(Boolean).join(' · ');
      fragment.appendChild(tick);
    });
    map.textContent = '';
    map.appendChild(fragment);
  }

  /* ── Following the day ─────────────────────────────────────── */

  function label(el, key, fallback) {
    return (el && el.getAttribute('data-' + key)) || fallback;
  }

  function sayNextRace(fox) {
    if (!call) return;
    var lead = call.querySelector('[data-role="next-lead"]');
    var name = call.querySelector('[data-role="next-name"]');
    var more = call.querySelector('[data-role="next-more"]');
    if (!lead || !name || !more) return;

    if (fox >= 0) {
      var race = raceOf(cards[fox]);
      var which = has(cards[fox], 'live') ? label(call, 'live', 'Running now')
                : fox === 0               ? label(call, 'first', 'First race')
                :                           label(call, 'next', 'Next race');
      lead.textContent = which + ':';
      name.textContent = race.time + ' ' + race.course;
      more.textContent = race.horse;
      return;
    }
    // No fox marker: the day is over. The tally is the masthead's own
    // number and word ("8 gold"), so the two can never disagree.
    var gold = document.querySelector('[data-role="gold-count"]');
    var tally = gold ? text(gold.parentNode) : '';
    lead.textContent = label(call, 'done', 'The day is run') + (tally ? ':' : '');
    name.textContent = tally;
    more.textContent = label(call, 'walk', 'walk the course');
  }

  function syncDay() {
    var fox = foxIndex();
    if (map) {
      Array.prototype.forEach.call(map.children, function (tick, i) {
        var card = cards[i];
        tick.classList.toggle('is-won', has(card, 'won'));
        tick.classList.toggle('is-run', has(card, 'placed') || has(card, 'lost') || has(card, 'void'));
        tick.classList.toggle('is-live', has(card, 'live'));
        tick.classList.toggle('is-now', i === fox);
      });
    }
    if (foxBtn) foxBtn.hidden = fox < 0;
    if (toggle) toggle.disabled = !cards.some(isSettled);
    sayNextRace(fox);
  }

  function setCurrent(i) {
    current = i;
    var race = raceOf(cards[i]);
    if (number) number.textContent = i + 1;
    if (total) total.textContent = cards.length;
    if (raceEl) raceEl.textContent = race.time + ' ' + race.course;
    if (prevBtn) prevBtn.disabled = i <= 0;
    if (nextBtn) nextBtn.disabled = i >= cards.length - 1;
    if (map) {
      Array.prototype.forEach.call(map.children, function (tick, k) {
        tick.classList.toggle('is-current', k === i);
      });
    }
  }

  /* The race the reader is level with: the card nearest the middle of
   * the window. A whole row is level at once, so a choice within the
   * row is kept (the reader may have stepped along it); a new row
   * starts at its first race. */
  function spy() {
    if (travelling) return;
    var top = grid.getBoundingClientRect().top;
    var middle = window.innerHeight / 2;
    var best = 0;
    var nearest = Infinity;
    for (var i = 0; i < centres.length; i++) {
      var distance = Math.abs(top + centres[i] - middle);
      if (distance < nearest - SAME_ROW_PX) {
        nearest = distance;
        best = i;
      }
    }
    if (Math.abs(top + centres[current] - middle) - nearest <= SAME_ROW_PX) best = current;
    if (best !== current) setCurrent(best);
  }

  /* ── Going to a race ───────────────────────────────────────── */

  /* While the page scrolls to a chosen race the rows it passes are not
   * where the reader is: the choice stands until the scrolling stops. */
  function arrive() {
    if (!travelling) return;
    travelling = false;
    clearTimeout(travelTimer);
    spy();                  // the reader may have scrolled away on the way
  }

  /* Mark the card the reader has been taken to, for a moment. One card
   * at a time: stepping on takes the mark along. */
  function unflash() {
    clearTimeout(flashTimer);
    if (flashed) flashed.classList.remove('cell--just-reached');
    flashed = null;
  }

  function flash(card) {
    unflash();
    void card.offsetWidth;  // lets the flash start again on a card just flashed
    card.classList.add('cell--just-reached');
    flashed = card;
    flashTimer = setTimeout(unflash, FLASH_MS);
  }

  /* `takeFocus` moves the keyboard to the card as well: for a reader who
   * asked to be taken to a race, not one stepping along with a button
   * they will want to press again. */
  function goTo(index, takeFocus) {
    var i = Math.max(0, Math.min(cards.length - 1, index));
    var card = cards[i];

    travelling = true;
    clearTimeout(travelTimer);
    travelTimer = setTimeout(arrive, NO_MOVE_MS);
    card.scrollIntoView({ behavior: smooth, block: 'center' });
    flash(card);
    setCurrent(i);

    // A card that has the focus is announced by its own label; when the
    // focus stays where it was, the status line says where the page went.
    if (takeFocus) card.focus({ preventScroll: true });
    if (status && document.activeElement !== card) {
      var race = raceOf(card);
      var where = label(status, 'say', 'Race {n} of {total}').replace('{n}', i + 1).replace('{total}', cards.length);
      status.textContent = [where, race.time + ' ' + race.course, race.horse].filter(Boolean).join(', ');
    }
  }

  /* To the fox marker. False once the day is over and it has gone. */
  function goToFox() {
    var fox = foxIndex();
    if (fox >= 0) goTo(fox, true);
    return fox >= 0;
  }

  /* ── Wiring ────────────────────────────────────────────────── */

  function debounce(fn, ms) {
    var timer = null;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, ms);
    };
  }

  buildMap();
  measure();
  syncDay();
  setCurrent(0);
  spy();

  // A link to a section this page does not have goes nowhere: a past
  // day, for one, is rendered without its spotlight. Put it away.
  Array.prototype.forEach.call(bar.querySelectorAll('a[href^="#"]'), function (link) {
    link.hidden = !document.getElementById(link.getAttribute('href').slice(1));
  });

  if (prevBtn) prevBtn.addEventListener('click', function () { goTo(current - 1, false); });
  if (nextBtn) nextBtn.addEventListener('click', function () { goTo(current + 1, false); });
  if (foxBtn)  foxBtn.addEventListener('click', goToFox);
  if (map) {
    map.addEventListener('click', function (e) {
      var tick = e.target.closest('[data-index]');
      if (tick) goTo(parseInt(tick.getAttribute('data-index'), 10), false);
    });
  }

  /* In-page links. site.js scrolls every "#" link to a fixed 76px from
   * the top of the window, which on this page is underneath the bar.
   * The links here are taken on the way down instead, before that
   * handler sees them, and followed as a real navigation to the
   * fragment: the keyboard's place, and a screen reader's, moves with
   * the page. replace() leaves the back button for leaving the page.
   * The scroll is asked for as well, to the target's own scroll margin,
   * because a navigation does not take over from a scroll already
   * under way. */
  function followHere(e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var hash = link.getAttribute('href');
    var target = document.getElementById(hash.slice(1));
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    if (link === call && goToFox()) return;
    window.location.replace(hash);
    target.scrollIntoView({ behavior: smooth, block: 'start' });
  }
  bar.addEventListener('click', followHere, true);
  if (call && call.parentNode) call.parentNode.addEventListener('click', followHere, true);

  /* Left and right step along the course, from the board, the bar, or
   * with nothing in particular focused. Anywhere else the keys belong
   * to whatever has the focus. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var from = e.target;
    if (from !== document.body && !grid.contains(from) && !bar.contains(from)) return;
    // Not behind an open panel: the cell drawer, or the legend on a phone.
    var page = document.body.classList;
    if (page.contains('has-cell-drawer-open') || page.contains('trail-nav-lock')) return;
    e.preventDefault();
    goTo(current + (e.key === 'ArrowRight' ? 1 : -1), true);
  });

  var scrollQueued = false;
  window.addEventListener('scroll', function () {
    if (travelling) {
      clearTimeout(travelTimer);
      travelTimer = setTimeout(arrive, ARRIVE_MS);
      return;
    }
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(function () {
      scrollQueued = false;
      spy();
    });
  }, { passive: true });
  window.addEventListener('scrollend', arrive);

  var remeasure = debounce(function () {
    measure();
    spy();
  }, REFRESH_MS);
  window.addEventListener('resize', remeasure);
  window.addEventListener('load', remeasure);
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(grid);

  // A race settling or the fox marker moving shows up as a class
  // change on a cell. So does a card flashing or flipping, which costs
  // one cheap pass here and changes nothing.
  new MutationObserver(debounce(function () {
    syncDay();
    measure();
  }, REFRESH_MS)).observe(grid, {
    attributes:      true,
    attributeFilter: ['class'],
    subtree:         true,
  });
})();
