/* llama_index.js — finding a horse on the LLaMa Index.
 *
 * The page is every horse running on a day, rendered by the server in
 * one list, A to Z. This file is what makes the list a tool:
 *
 *   1. Search as you type. What is typed is read as the start of a
 *      name: a horse's first, then a jockey's, trainer's or course's.
 *      "am s" finds Am Still Here, not every horse with an "am" and
 *      an "s" somewhere about it.
 *   2. Filters (has a signal, steamers, top AI, still to run), a course
 *      and a sort order; each filter's count follows the search.
 *   3. The A to Z: a letter goes to its horses, a letter with none
 *      showing stands back, and the one the reader is in is marked.
 *   4. Details on a horse (the comment; on a phone, also who rides it,
 *      its form and ratings).
 *   5. The form's colours, as the meeting page has them.
 *   6. A place in the slip goes to its horse here, since the index has
 *      no race sections to go to.
 *
 * What is chosen is kept in the address (?q=, f=, c=, s=), so a search
 * can be sent to someone, and Back leaves the page rather than undoing
 * a keystroke.
 *
 * Everything is done on the rows the server rendered: nothing is
 * fetched. The slip is bet_slip.js's and meeting_slip.js's, untouched;
 * a row here is a .racecard__runner like any other to them.
 *
 * Zero deps, progressive enhancement: without this file the page is
 * still the whole list, with its letters, its links and the slip.
 */
(function () {
  'use strict';

  var list = document.querySelector('[data-li-list]');
  if (!list) return;

  var rows = Array.prototype.slice.call(list.querySelectorAll('.li-row'));
  var headings = Array.prototype.slice.call(list.querySelectorAll('[data-li-heading]'));
  var inOrder = Array.prototype.slice.call(list.children);       // letters and rows, as rendered
  if (!rows.length) return;

  var tools    = document.querySelector('[data-li-tools]');
  var search   = document.querySelector('[data-li-search]');
  var courseEl = document.querySelector('select[data-li-course]');
  var sortEl   = document.querySelector('[data-li-sort]');
  var readout  = document.querySelector('[data-li-readout]');
  var empty    = document.querySelector('[data-li-empty]');
  var reset    = document.querySelector('.li-reset');
  var az       = document.querySelector('[data-li-az]');
  var chips    = Array.prototype.slice.call(document.querySelectorAll('[data-li-filter]'));
  var wrap     = document.querySelector('.li-wrap');

  var SEARCH_MS = 90;
  var TOP_AI_STARS = 4;
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Names as they are searched: lower case, apostrophes and other
     marks aside ("o'brien" and "obrien" are one name). */
  function plain(text) {
    return String(text).toLowerCase().replace(/['’.]/g, '').replace(/[^a-z0-9|]+/g, ' ').replace(/ *\| */g, '|').trim();
  }

  /* Does `text` have `part` at the start of one of its words? */
  function startsWord(text, part) {
    for (var at = text.indexOf(part); at >= 0; at = text.indexOf(part, at + 1)) {
      if (at === 0 || text.charAt(at - 1) === ' ') return true;
    }
    return false;
  }

  /* What a row is, read once. */
  var items = rows.map(function (row, i) {
    var d = row.dataset;
    var signals = (d.liSignals || '').split(' ').filter(Boolean);
    var odds = parseFloat(d.oddsDecimal);
    return {
      row: row,
      at: i,
      fields: plain(d.liFind || '').split('|'),          // horse, jockey, trainer, course
      letter: d.liLetter || '',
      course: d.liCourse || '',
      time: d.liTime || '',
      name: d.liName || '',
      state: d.liState || '',
      signals: signals,
      steamer: d.liMove === 'steamer' || signals.indexOf('steamer') >= 0,
      stars: parseInt(d.liStars, 10) || 0,
      sr: parseInt(d.liSr, 10) || 0,
      odds: isFinite(odds) && odds > 1 ? odds : Infinity,
      shown: true,
    };
  });

  var FILTERS = {
    all:     function () { return true; },
    signal:  function (it) { return it.signals.length > 0; },
    steamer: function (it) { return it.steamer; },
    topai:   function (it) { return it.stars >= TOP_AI_STARS; },
    torun:   function (it) { return it.state === 'to_run'; },
  };

  var SORTS = {
    name:    null,                                      // the order rendered
    time:    function (a, b) { return a.time.localeCompare(b.time) || a.at - b.at; },
    price:   function (a, b) { return a.odds - b.odds || a.at - b.at; },
    sr:      function (a, b) { return b.sr - a.sr || a.at - b.at; },
    signals: function (a, b) { return b.signals.length - a.signals.length || a.at - b.at; },
  };

  var state = { q: '', f: 'all', c: '', s: 'name' };

  /* ── The address ───────────────────────────────────────────── */

  function readAddress() {
    var params = new URLSearchParams(window.location.search);
    state.q = (params.get('q') || '').slice(0, 80);
    state.f = FILTERS[params.get('f')] ? params.get('f') : 'all';
    state.c = params.get('c') || '';
    state.s = Object.prototype.hasOwnProperty.call(SORTS, params.get('s')) ? params.get('s') : 'name';
    if (state.c && !items.some(function (it) { return it.course === state.c; })) state.c = '';
  }

  function writeAddress() {
    if (!window.history.replaceState) return;
    var params = new URLSearchParams(window.location.search);
    var set = function (key, value, rest) {
      if (value && value !== rest) params.set(key, value);
      else params.delete(key);
    };
    set('q', state.q.trim(), '');
    set('f', state.f, 'all');
    set('c', state.c, '');
    set('s', state.s, 'name');
    var query = params.toString();
    window.history.replaceState(window.history.state, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
  }

  /* ── Showing ───────────────────────────────────────────────── */

  /* Which horses a search finds: a set of items, or null for all.
     The first of these that finds any horse is the answer:
       1. a horse whose name has what was typed at the start of a word;
       2. a jockey, trainer or course that has;
       3. every word typed starting a word somewhere on the row
          ("moore york": Ryan Moore's rides at York);
       4. a horse's name with it anywhere ("ill" in Am Still Here). */
  function findHorses(q) {
    var phrase = plain(q).replace(/\|/g, ' ').trim();
    if (!phrase) return null;
    var tokens = phrase.split(' ');
    var tests = [
      function (it) { return startsWord(it.fields[0] || '', phrase); },
      function (it) { return it.fields.slice(1).some(function (f) { return startsWord(f, phrase); }); },
      function (it) { return tokens.every(function (t) { return it.fields.some(function (f) { return startsWord(f, t); }); }); },
      function (it) { return (it.fields[0] || '').indexOf(phrase) >= 0; },
    ];
    for (var i = 0; i < tests.length; i++) {
      var found = items.filter(tests[i]);
      if (found.length) return found;
    }
    return [];
  }

  function apply() {
    var want = findHorses(state.q);
    var wanted = want && new Set(want);
    var passes = FILTERS[state.f] || FILTERS.all;
    var counts = {};
    Object.keys(FILTERS).forEach(function (key) { counts[key] = 0; });
    var shown = 0;
    var lettersShown = {};

    items.forEach(function (it) {
      /* The search and the course narrow what every filter counts;
         the filter then chooses among those. */
      var found = (!state.c || it.course === state.c) && (!wanted || wanted.has(it));
      if (found) {
        Object.keys(FILTERS).forEach(function (key) { if (FILTERS[key](it)) counts[key] += 1; });
      }
      var show = found && passes(it);
      if (show !== it.shown) {
        it.shown = show;
        it.row.hidden = !show;
      }
      if (show) {
        shown += 1;
        lettersShown[it.letter] = true;
      }
    });

    /* A letter with no horse showing goes; in any order but A to Z the
       letters mean nothing and all go. */
    var byName = state.s === 'name';
    headings.forEach(function (heading) {
      heading.hidden = !byName || !lettersShown[heading.getAttribute('data-li-heading')];
    });
    if (az) {
      az.hidden = !byName;
      Array.prototype.forEach.call(az.querySelectorAll('[data-li-jump]'), function (link) {
        var off = !lettersShown[link.getAttribute('data-li-jump')];
        if (off) link.setAttribute('data-li-off', '');
        else link.removeAttribute('data-li-off');
        link.setAttribute('aria-disabled', off ? 'true' : 'false');
        link.tabIndex = off ? -1 : 0;
      });
    }

    chips.forEach(function (chip) {
      var key = chip.getAttribute('data-li-filter');
      var n = chip.querySelector('[data-li-count]');
      if (n) n.textContent = counts[key];
      chip.setAttribute('aria-pressed', key === state.f ? 'true' : 'false');
      if (counts[key] === 0 && key !== state.f) chip.setAttribute('data-li-none', '');
      else chip.removeAttribute('data-li-none');
    });

    if (readout) {
      readout.textContent = shown === items.length
        ? items.length + ' horses'
        : shown + ' of ' + items.length + ' horses';
    }
    if (reset) reset.hidden = !(state.q.trim() || state.c || state.f !== 'all');
    if (empty) empty.hidden = shown > 0;
    list.hidden = shown === 0;
    return shown;
  }

  function reorder() {
    var compare = SORTS[state.s];
    var fragment = document.createDocumentFragment();
    if (!compare) {
      inOrder.forEach(function (node) { fragment.appendChild(node); });
    } else {
      headings.forEach(function (heading) { fragment.appendChild(heading); });
      items.slice().sort(compare).forEach(function (it) { fragment.appendChild(it.row); });
    }
    list.appendChild(fragment);
  }

  function refresh(order) {
    if (order) reorder();
    var shown = apply();
    writeAddress();
    measure();
    return shown;
  }

  /* ── The pinned tools' height, for what is pinned under them ── */

  function measure() {
    if (tools && wrap) wrap.style.setProperty('--li-tools', tools.offsetHeight + 'px');
  }

  /* ── The A to Z ────────────────────────────────────────────── */

  var pinTop = function () {
    return (tools ? tools.getBoundingClientRect().bottom : 0) + 2;
  };

  /* The letter the reader is in: the last heading at or above the
     foot of the pinned tools. */
  function markLetter() {
    if (!az || az.hidden) return;
    var line = pinTop() + 4;
    var current = '';
    for (var i = 0; i < headings.length; i++) {
      if (headings[i].hidden) continue;
      if (headings[i].getBoundingClientRect().top <= line) current = headings[i].getAttribute('data-li-heading');
      else break;
    }
    Array.prototype.forEach.call(az.querySelectorAll('[data-li-jump]'), function (link) {
      var on = link.getAttribute('data-li-jump') === current;
      if (on) {
        if (link.getAttribute('aria-current') !== 'true') {
          link.setAttribute('aria-current', 'true');
          /* Keep the marked letter in sight where the strip scrolls. */
          if (az.scrollWidth > az.clientWidth) {
            az.scrollLeft = link.offsetLeft - az.clientWidth / 2 + link.offsetWidth / 2;
          }
        }
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function goTo(node) {
    node.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  }

  /* ── Details, and the form's colours ───────────────────────── */

  function toggleDetails(button) {
    var row = button.closest('.li-row');
    if (!row) return;
    var open = row.getAttribute('data-li-open') !== 'true';
    row.setAttribute('data-li-open', String(open));
    button.setAttribute('aria-expanded', String(open));
  }

  /* The marking is meeting_form.js's, which the meeting page shares:
     a place a colour, the latest run marked. */
  function form() {
    if (window.mfrForm) window.mfrForm.colour(list);
  }

  /* ── A place in the slip goes to its horse ─────────────────── */

  function flash(row) {
    row.removeAttribute('data-li-flash');
    void row.offsetWidth;
    row.setAttribute('data-li-flash', '');
    setTimeout(function () { row.removeAttribute('data-li-flash'); }, 1500);
  }

  function showRow(row) {
    if (row.hidden) {
      /* It is filtered away: the reader asked for it, so the search and
         the filters give way. */
      state.q = '';
      state.f = 'all';
      state.c = '';
      if (search) search.value = '';
      if (courseEl) courseEl.value = '';
      refresh(false);
    }
    row.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
    flash(row);
  }

  /* ── Wiring ────────────────────────────────────────────────── */

  var timer = 0;
  if (search) {
    search.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        state.q = search.value;
        refresh(false);
      }, SEARCH_MS);
    });
    /* Enter with one answer goes to it. */
    search.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      clearTimeout(timer);
      state.q = search.value;
      refresh(false);
      var only = items.filter(function (it) { return it.shown; });
      if (only.length === 1) showRow(only[0].row);
    });
  }
  if (courseEl) courseEl.addEventListener('change', function () { state.c = courseEl.value; refresh(false); });
  if (sortEl) sortEl.addEventListener('change', function () { state.s = sortEl.value; refresh(true); });

  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target.closest) return;

    var chip = target.closest('[data-li-filter]');
    if (chip) {
      var key = chip.getAttribute('data-li-filter');
      /* Pressed again, a filter comes off. */
      state.f = key === state.f ? 'all' : key;
      refresh(false);
      return;
    }

    var more = target.closest('[data-li-more]');
    if (more) {
      toggleDetails(more);
      return;
    }

    var jump = target.closest('[data-li-jump]');
    if (jump) {
      e.preventDefault();
      if (jump.hasAttribute('data-li-off')) return;
      var letter = jump.getAttribute('data-li-jump');
      var heading = headings.filter(function (h) { return h.getAttribute('data-li-heading') === letter; })[0];
      if (heading) goTo(heading);
      return;
    }

    if (target.closest('[data-li-clear]')) {
      state.q = '';
      state.f = 'all';
      state.c = '';
      if (search) search.value = '';
      if (courseEl) courseEl.value = '';
      refresh(false);
      if (search) search.focus();
      return;
    }

    /* A place on the slip's card: meeting_slip.js links it to the race
       (#race-<id>), which here is only a mark. Go to the horse. */
    var place = target.closest('.mfr-card a[href^="#race-"], #slipLegs a[href^="#race-"]');
    if (place) {
      var raceId = place.getAttribute('href').slice('#race-'.length);
      var picked = list.querySelector('.li-row.racecard__runner--in-slip[data-race-id="' + raceId + '"]');
      if (picked) {
        e.preventDefault();
        e.stopPropagation();
        showRow(picked);
      }
    }
  }, true);

  /* "/" goes to the search, as on most lists that have one. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || !search) return;
    var el = document.activeElement;
    if (el && /^(input|textarea|select)$/i.test(el.tagName)) return;
    e.preventDefault();
    search.focus();
    search.select();
  });

  var queued = false;
  window.addEventListener('scroll', function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      markLetter();
    });
  }, { passive: true });
  window.addEventListener('resize', function () {
    measure();
    markLetter();
  });
  if ('ResizeObserver' in window && tools) new ResizeObserver(measure).observe(tools);

  /* A browser puts back what a form held when a page is reloaded or
     come back to, without saying so: read the controls again then, so
     the list is never narrowed by a course the reader cannot see why. */
  window.addEventListener('pageshow', function () {
    var q = search ? search.value : state.q;
    var c = courseEl ? courseEl.value : state.c;
    var s = sortEl ? sortEl.value : state.s;
    if (q === state.q && c === state.c && s === state.s) return;
    var order = s !== state.s;
    state.q = q; state.c = c; state.s = s;
    refresh(order);
  });

  /* ── Start ─────────────────────────────────────────────────── */

  readAddress();
  if (search) search.value = state.q;
  if (courseEl) courseEl.value = state.c;
  if (sortEl) sortEl.value = state.s;
  form();
  refresh(state.s !== 'name');
  markLetter();
})();
