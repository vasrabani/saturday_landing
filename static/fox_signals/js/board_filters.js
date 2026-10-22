/* Fox Signals v2 — the Board narrows and sorts itself in place.
 *
 * The meeting chips, the filters and the sort menu are links the server
 * answers (?meeting=Hereford, ?conviction=notlow, ?sort=price), and a
 * press used to fetch the page again for a list this page already has.
 * Here the press keeps the rows that match and puts them in order, at
 * once, and writes the choice into the address, so a reload (and the
 * server) shows the same page, and Back undoes it. A page opened at
 * such an address starts narrowed. Choices add up: a meeting and a
 * level together keep the rows that are both; a press on a chip already
 * chosen clears it. The "More filters" sheet closes on a press anywhere
 * else, or Escape, and its word says how many of its filters are on.
 * Without this script the links work as they did.
 *
 * The server sends only the rows that match the choices in the address,
 * so a page it narrowed can be narrowed further in place, but a wider
 * choice (another meeting, "All meetings") is the server's to send: that
 * press fetches the page, through the page-turn script when it is here.
 * (The sandbox's pages, and a static host, hold the whole day whatever
 * the address says, and every choice stays in place.)
 *
 * What is read from a row: the course (.fxv-row__link), its level
 * (.fxv-row--high/--medium/--low), the facts line ("Class 6 · Good to
 * Soft · 17 runners"), the race's time (.fxv-row__time time), the price
 * (.fxv-price) and, for a member, the conviction figure (.fxv-conv__pct).
 */
(function () {
  'use strict';

  var DIMS = ['meeting', 'conviction', 'class', 'field', 'going', 'sort'];
  var LINKS = '.fxv-tools a[href], .fxv-empty a[href]';
  var LEVEL = { high: 0, medium: 1, low: 2 };
  // The sandbox's Board is a file: the member Board's sort menu names
  // the visitor's file, and at a static host's root the Board has no
  // file name of its own.
  var BOARD_FILE = /\/fox-board(-member)?\.html$/;

  if (!window.URLSearchParams || !window.history || !document.querySelector('.fxv-wrap')) return;

  // The Board's list, when the page is the Board.
  function board() {
    return document.querySelector('.fxv-wrap[data-active-tab="board"] .fxv-list');
  }

  // ── The choice, in the address and out of it ───────────────────

  function stateOf(search) {
    var params = new URLSearchParams(search);
    var state = {};
    DIMS.forEach(function (dim) {
      var value = params.get(dim);
      if (value && value !== 'all' && !(dim === 'sort' && value === 'time')) state[dim] = value;
    });
    return state;
  }

  function addressFor(state) {
    var params = new URLSearchParams();
    DIMS.forEach(function (dim) { if (state[dim]) params.set(dim, state[dim]); });
    var query = params.toString();
    return window.location.pathname + (query ? '?' + query : '');
  }

  // Does the choice leave races out? (An order does not.)
  function narrows(state) {
    return DIMS.some(function (dim) { return dim !== 'sort' && !!state[dim]; });
  }

  // A press adds its choice to the choices made; a press on a chip
  // already chosen takes it away again (not the sort menu: a menu has
  // no "off"); a link with no query clears its own dimension ("All
  // meetings"), or everything (the empty note's "Show every race"). Only
  // the control's own dimension is read from its link: the server may
  // write the other choices into it too.
  function merge(state, search, control) {
    var params = new URLSearchParams(search);
    var own = control.getAttribute('data-dim') ||
      (control.classList.contains('fxv-select') ? 'sort' : '');
    var next = {};
    DIMS.forEach(function (dim) { if (state[dim]) next[dim] = state[dim]; });
    var canToggle = control.tagName === 'A';
    var touched = false;
    DIMS.forEach(function (dim) {
      if ((own && dim !== own) || !params.has(dim)) return;
      touched = true;
      var value = params.get(dim);
      if (value && value !== 'all' && !(dim === 'sort' && value === 'time')) {
        if (canToggle && state[dim] === value) delete next[dim];
        else next[dim] = value;
      } else {
        delete next[dim];
      }
    });
    if (!touched) {
      if (own) delete next[own]; else next = {};
    }
    return next;
  }

  // ── What a row says ─────────────────────────────────────────────

  function text(root, selector) {
    var el = root.querySelector(selector);
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  // A fractional price as a decimal; a race without one sorts last.
  function decimalOf(frac) {
    var m = /^(\d+)\s*\/\s*(\d+)$/.exec(frac);
    if (m && +m[2] > 0) return +m[1] / +m[2] + 1;
    if (/^ev(s|ens?)$/i.test(frac)) return 2;
    return Infinity;
  }

  function factsOf(row) {
    if (row.fxvFacts) return row.fxvFacts;
    var facts = text(row, '.fxv-row__facts');
    var cls = /class (\d+)/i.exec(facts);
    var runners = /(\d+) runners?/i.exec(facts);
    var going = facts.replace(/class \d+/i, '').replace(/\d+ runners?/i, '').replace(/·/g, ' ').trim().toLowerCase();
    var pct = parseFloat(text(row, '.fxv-conv__pct'));
    var time = row.querySelector('.fxv-row__time time');
    row.fxvFacts = {
      course: text(row, '.fxv-row__link'),
      level: row.classList.contains('fxv-row--high') ? 'high'
        : row.classList.contains('fxv-row--medium') ? 'medium' : 'low',
      cls: cls ? +cls[1] : null,
      runners: runners ? +runners[1] : null,
      going: going,
      time: time ? time.getAttribute('datetime') || time.textContent.trim() : '',
      price: decimalOf(text(row, '.fxv-price')),
      pct: isNaN(pct) ? null : pct,
    };
    return row.fxvFacts;
  }

  function matches(f, state) {
    if (state.meeting && f.course !== state.meeting) return false;
    if (state.conviction) {
      if (state.conviction === 'notlow' ? f.level === 'low' : f.level !== state.conviction) return false;
    }
    if (state['class']) {
      if (f.cls === null) return false;
      var band = f.cls <= 2 ? 'top' : f.cls <= 4 ? 'mid' : 'low';
      if (band !== state['class']) return false;
    }
    if (state.field) {
      if (f.runners === null) return false;
      var size = f.runners <= 7 ? 'small' : f.runners <= 14 ? 'medium' : 'large';
      if (size !== state.field) return false;
    }
    if (state.going && f.going.indexOf(state.going) === -1) return false;
    return true;
  }

  // The chosen order, then the race's time: the time is read from the
  // row, as a page the server sorted otherwise is not in time order.
  function compare(sort) {
    return function (a, b) {
      var fa = factsOf(a), fb = factsOf(b);
      var d = 0;
      if (sort === 'conviction') d = (LEVEL[fa.level] - LEVEL[fb.level]) || ((fb.pct || 0) - (fa.pct || 0));
      else if (sort === 'course') d = fa.course.localeCompare(fb.course);
      else if (sort === 'field') d = (fb.runners || 0) - (fa.runners || 0);
      else if (sort === 'price') d = fa.price - fb.price;
      if (!d) d = fa.time < fb.time ? -1 : fa.time > fb.time ? 1 : 0;
      return d || (a.fxvOrder - b.fxvOrder);
    };
  }

  // ── What the server sent ────────────────────────────────────────

  // The choices the page was made for, and whether it holds the whole
  // day: a page with rows its choices leave out was not narrowed by the
  // server, so it holds every race.
  var made = {};
  var whole = true;

  function takeStock() {
    var list = board();
    if (!list) return;
    made = stateOf(window.location.search);
    whole = !narrows(made) || Array.prototype.some.call(list.querySelectorAll('.fxv-row'), function (row) {
      return !matches(factsOf(row), made);
    });
  }

  // Can the races this page holds show the choice? A page the server
  // narrowed can only be narrowed further.
  function canShow(state) {
    return whole || DIMS.every(function (dim) {
      return dim === 'sort' || !made[dim] || state[dim] === made[dim];
    });
  }

  // A choice wider than the page: the server's page for it.
  function fetchWider(state) {
    var address = addressFor(state);
    if (typeof window.fxvTurn === 'function') window.fxvTurn(address);
    else window.location.assign(address);
  }

  // ── The Board, narrowed and ordered ─────────────────────────────

  function own(parent) {
    return Array.prototype.filter.call(parent.children, function (el) {
      return el.classList.contains('fxv-row');
    });
  }

  function apply(state) {
    var list = board();
    if (!list) return null;
    var sort = state.sort || 'time';
    var done = list.querySelector('.fxv-done');
    var all = list.querySelectorAll('.fxv-row');
    for (var i = 0; i < all.length; i++) {
      if (all[i].fxvOrder === undefined) all[i].fxvOrder = i;
    }

    // The finished races stay in their fold and the rest after it;
    // each group (the rows that share a parent) is ordered on its own.
    var parents = [];
    for (var k = 0; k < all.length; k++) {
      if (parents.indexOf(all[k].parentElement) === -1) parents.push(all[k].parentElement);
    }
    var shownDone = 0, shownToCome = 0;
    parents.forEach(function (parent) {
      var inFold = !!(done && done.contains(parent));
      own(parent).sort(compare(sort)).forEach(function (row) {
        parent.appendChild(row);
        var on = matches(factsOf(row), state);
        row.hidden = !on;
        if (on) { if (inFold) shownDone++; else shownToCome++; }
      });
    });

    // The fold: how many of its races, and of its winners, are shown;
    // the fold itself goes when none of its races is.
    if (done) {
      var total = done.querySelectorAll('.fxv-row').length;
      var every = shownDone === total;
      var n = done.querySelector('.fxv-done__n');
      if (n) {
        if (!n.hasAttribute('data-all')) n.setAttribute('data-all', n.textContent.trim());
        n.textContent = every ? n.getAttribute('data-all') : shownDone + ' of ' + n.getAttribute('data-all');
      }
      var won = done.querySelector('.fxv-done__won');
      if (won) {
        if (!won.hasAttribute('data-all')) won.setAttribute('data-all', won.textContent.trim());
        var wins = Array.prototype.filter.call(done.querySelectorAll('.fxv-row'), function (row) {
          return !row.hidden && row.querySelector('.fxv-result--won');
        }).length;
        won.textContent = every ? won.getAttribute('data-all') : wins + (wins === 1 ? ' Fox winner' : ' Fox winners');
        won.hidden = !every && wins === 0;
      }
      done.hidden = shownDone === 0;
    }

    // When no race to come matches the reader's choice: a note, and the
    // way back. Not with no choice made, nor over the server's own note
    // for a day with nothing left to run.
    var note = list.querySelector('.fxv-empty[data-fxv-note]');
    var theirs = list.querySelector('.fxv-empty:not([data-fxv-note])');
    if (shownToCome === 0 && narrows(state) && !theirs) {
      if (!note) {
        note = document.createElement('p');
        note.className = 'fxv-empty';
        note.setAttribute('data-fxv-note', '');
        list.appendChild(note);
      }
      var onlyMeeting = !!state.meeting && DIMS.every(function (dim) {
        return dim === 'meeting' || dim === 'sort' || !state[dim];
      });
      note.textContent = 'No races still to run ' + (state.meeting ? 'at ' + state.meeting : 'for these filters') + '. ';
      var back = document.createElement('a');
      back.href = window.location.pathname;
      back.textContent = onlyMeeting ? 'All meetings' : 'Show every race';
      if (onlyMeeting) back.setAttribute('data-dim', 'meeting');
      note.appendChild(back);
    } else if (note) {
      note.remove();
    }

    paintControls(state);
    return { toCome: shownToCome, done: shownDone };
  }

  // The chips and the menu say what is chosen (to the eye and to a
  // screen reader); "More filters" says how many of the sheet's
  // filters are on.
  function paintControls(state) {
    var chips = document.querySelectorAll('.fxv-tools a[data-dim]');
    for (var i = 0; i < chips.length; i++) {
      var dim = chips[i].getAttribute('data-dim');
      var query = (chips[i].getAttribute('href') || '').split('?')[1] || '';
      var value = new URLSearchParams(query).get(dim);
      if (value === 'all') value = null;
      var on = (state[dim] || null) === value;
      chips[i].classList.toggle('fxv-on', on);
      if (on) chips[i].setAttribute('aria-current', 'true');
      else chips[i].removeAttribute('aria-current');
    }
    var sheet = document.querySelector('.fxv-more');
    var summary = sheet && sheet.querySelector('summary');
    if (summary) {
      var count = 0;
      Array.prototype.forEach.call(sheet.querySelectorAll('a[data-dim]'), function (a) {
        var d = a.getAttribute('data-dim'), v = a.getAttribute('data-value');
        if (v && v !== 'all' && state[d] === v) count++;
      });
      summary.setAttribute('data-count', count ? String(count) : '');
      summary.classList.toggle('fxv-on', count > 0);
    }
    var menu = document.querySelector('.fxv-select');
    if (menu) {
      var want = state.sort || 'time';
      for (var j = 0; j < menu.options.length; j++) {
        var q = menu.options[j].value.split('?')[1] || '';
        if ((new URLSearchParams(q).get('sort') || 'time') === want) menu.value = menu.options[j].value;
      }
    }
  }

  // What a press did, for a reader who hears the page.
  function makeStatus() {
    var tools = document.querySelector('.fxv-tools');
    if (!tools || tools.querySelector('.fxv-status')) return;
    var status = document.createElement('p');
    status.className = 'fxv-status fx-visually-hidden';
    status.setAttribute('role', 'status');
    tools.appendChild(status);
  }

  function say(counts) {
    var status = document.querySelector('.fxv-tools .fxv-status');
    if (!status || !counts) return;
    status.textContent = counts.toCome + (counts.toCome === 1 ? ' race' : ' races') +
      ' to run, ' + counts.done + ' finished.';
  }

  function go(state, push) {
    say(apply(state));
    var address = addressFor(state);
    if (push && address !== window.location.pathname + window.location.search) {
      window.history.pushState({ fxv: true }, '', address);
    }
  }

  // Is this link's page this page?
  function isHere(href) {
    var url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    return url.pathname === window.location.pathname || BOARD_FILE.test(url.pathname);
  }

  // The note's link goes with the note: the keyboard goes on from the
  // first race shown.
  function focusFirstRace() {
    var list = board();
    var rows = list ? list.querySelectorAll('.fxv-row') : [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].hidden || rows[i].closest('details:not([open])')) continue;
      var link = rows[i].querySelector('a[href]');
      if (link) { link.focus(); return; }
    }
  }

  // ── The sheet closes when the reader looks away from it ─────────

  function openSheet() {
    return document.querySelector('.fxv-more[open]');
  }

  function closeSheet(refocus) {
    var sheet = openSheet();
    if (!sheet) return;
    sheet.removeAttribute('open');
    var summary = sheet.querySelector('summary');
    if (refocus && summary) summary.focus();
  }

  function closeIfOutside(e) {
    if (openSheet() && !(e.target.closest && e.target.closest('.fxv-more'))) closeSheet(false);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openSheet()) { closeSheet(true); e.preventDefault(); }
  });

  document.addEventListener('focusin', function (e) {
    var sheet = openSheet();
    if (sheet && !sheet.contains(e.target)) closeSheet(false);
  });

  // A touch screen may send no click for a tap on plain text: the press
  // itself closes the sheet.
  document.addEventListener('pointerdown', closeIfOutside, true);

  // ── The presses, caught before the page-turn script's ──────────

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    // A press outside the open sheet closes it, whatever else it does.
    closeIfOutside(e);
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var link = e.target.closest && e.target.closest(LINKS);
    if (!link || !board() || !isHere(link.href)) return;
    e.preventDefault();
    e.stopPropagation();
    var next = merge(stateOf(window.location.search), new URL(link.href, window.location.href).search, link);
    if (!canShow(next)) { fetchWider(next); return; }
    var fromNote = !!link.closest('.fxv-empty');
    go(next, true);
    if (fromNote) focusFirstRace();
  }, true);

  document.addEventListener('change', function (e) {
    var menu = e.target.closest && e.target.closest('.fxv-select');
    if (!menu || !menu.value || !board() || !isHere(menu.value)) return;
    e.stopPropagation();
    var next = merge(stateOf(window.location.search), new URL(menu.value, window.location.href).search, menu);
    if (canShow(next)) go(next, true);
    else fetchWider(next);
  }, true);

  // The page as it opens, and again whenever the Board is swapped in
  // (another room, or Back, through the page-turn script).
  function arrive() {
    if (!board()) return;
    takeStock();
    makeStatus();
    apply(stateOf(window.location.search));
  }
  arrive();
  if (window.MutationObserver) {
    new MutationObserver(arrive).observe(document.querySelector('.fxv-wrap'), { childList: true });
  }
})();
