/* Race Trace timeline chart — T2 + T4 + T5 + T6 + T9 + T10 + T11 + T12 + T13 + T14 + R1 + R3.
 *
 * Reads the JSON blob dropped into #fx-trace-data by the server
 * (see race_trace_detail.html) and draws:
 *   1. Per-runner price line inside the SVG stage (T2)
 *   2. Per-runner AI-confidence line, dashed, on its own axis (T4)
 *   3. Signal + event markers pinned to the time axis
 *   4. A scrub cursor driven by the range slider with a price
 *      readout of every priced runner at that time, shortest first
 *
 * Pointing at a line (or touching it) shows that runner's price at that
 * moment in a tip beside the pointer, with the time the price was set.
 *
 * Prices read as fractional odds (9/4), on the axis and in the readout.
 * The "Decimal odds" button switches both to decimal (3.25) and the
 * choice is kept in localStorage.
 *
 * T5 adds:
 *   5. Live auto-refresh — the .fx-trace root carries a data-live-url
 *      attribute; every POLL_MS we fetch fresh timeline JSON, replace
 *      `chart`, and call render() again. The SVG groups are
 *      cleared + repopulated so the redraw is idempotent.
 *   6. Freshness pill in the caption strip — "Live · Xs ago" that
 *      counts up between polls, plus a Pause/Resume chip.
 *
 * T6 adds:
 *   7. Click-to-lock focus — clicking a legend chip pins the highlight
 *      on that runner (dims the others) and switches the scrub
 *      readout to a focused card showing that runner's odds + AI% at
 *      the scrubbed moment. Escape or a second click unlocks.
 *
 * T9 adds:
 *   8. Focus dim carries over to the Value Edge rail and signals
 *      rail: sidebar items with a data-runner-id matching the lock
 *      get .fx-focus-match; non-matching rows get .fx-focus-dim;
 *      race-level signals (no data-runner-id) stay untouched.
 *
 * T10 adds:
 *   9. Runners table auto-refresh — the poll payload now carries a
 *      per-runner projection (odds + sparkline + tick count). We
 *      walk .fx-trace__runner[data-runner-id], update the odds
 *      cell text + rebuild the sparkline SVG when anything
 *      changed, and flash the row briefly to signal the update.
 *
 * T11 adds:
 *  10. Sidebar auto-refresh — Value Edge panel + signals rail
 *      swap in HTML fragments rendered server-side from the same
 *      partials the initial page uses. T9 focus dim is re-applied
 *      after each swap so a locked runner stays highlighted
 *      through the refresh.
 *
 * T12 adds:
 *  11. Events rail auto-refresh — third and final sidebar swap
 *      on the same swapSidebar primitive. Closes the live-refresh
 *      loop: every visible section of the detail page now stays
 *      live between polls.
 *
 * T13 adds:
 *  12. Permalink — ?at=HH:MM URL param preserves the scrubbed
 *      moment across page loads. history.replaceState keeps the
 *      URL fresh as the scrubber moves (no history spam). A
 *      "Copy link" chip in the caption strip copies the current
 *      URL to the clipboard with a brief "Copied" flash.
 *
 * T14 adds:
 *  13. Race-to-race nav — ArrowLeft / ArrowRight keyboard
 *      shortcuts jump to the sibling race chips rendered by the
 *      server. Runs before the chart-init early-exit so nav also
 *      works on races with no timeline yet.
 *
 * R1 adds:
 *  14. Post-race Replay pivot — when the server sets data-is-
 *      replay=1 (or a live poll returns is_replay=true), the loop
 *      halts entirely and the freshness pill freezes into a
 *      "settled" state. No point burning bandwidth on a race
 *      whose data won't change again.
 *
 * The October 2026 design (fox_signals_v2.css, section 3) reads the
 * chart as a race, and this file draws what that needs:
 *  15. The words beside the chart are HTML, placed by measuring the
 *      chart's box (placeOverlays): the prices down the left, the
 *      hours along the foot, and at the end of every line its
 *      runner's number cloth, name and price, pushed apart where
 *      lines end together. A press on one follows that runner, as
 *      the legend's chips do.
 *  16. A signal's marker sits on its runner's line where it fired
 *      (on the time axis when it is about the whole race); a press
 *      on it takes the replay to that moment, and the readout says
 *      what fired there.
 *  17. The readout is the ring at the scrubbed time: every runner
 *      in market order, with whether it has shortened or drifted
 *      since it opened.
 *  18. Each runner's hue is handed to the page (--hue on anything
 *      carrying its data-runner-id), so the runners table and the
 *      rails wear the lines' colours.
 *  19. The market's story, as tiles above the chart (renderStory):
 *      the favourite (the winner, on a replay), the most backed, the
 *      biggest drifter and the latest signal, each a press away.
 *  20. The front of the market (the four shortest) is drawn heavier
 *      than the rest, so the lines that matter read first.
 *
 * Everything is vanilla — no libraries. Small enough to inline
 * later if that ever wins on latency; for now it stays a static
 * file so the browser can cache it.
 */
(function () {
  'use strict';

  // ── T14 race-to-race keyboard shortcuts — runs before any early
  //    exit so ArrowLeft / ArrowRight nav works even on races with
  //    no timeline yet (nothing else in this file is needed). Skips
  //    when focus is inside a form control so scrubbing / typing
  //    isn't hijacked.
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    var t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
              t.tagName === 'SELECT' || t.isContentEditable)) return;
    var dir = ev.key === 'ArrowLeft' ? 'prev' : 'next';
    var chip = document.querySelector('[data-trace-nav="' + dir + '"]');
    if (!chip) return;
    ev.preventDefault();
    window.location.assign(chip.getAttribute('href'));
  });

  // ── Boot: read initial payload from json_script ─────────────────

  var dataEl = document.getElementById('fx-trace-data');
  if (!dataEl) return;
  var initial;
  try {
    initial = JSON.parse(dataEl.textContent);
  } catch (e) {
    return;
  }
  if (!initial || initial.empty ||
      !initial.series || !initial.series.length) return;

  // ── DOM handles ─────────────────────────────────────────────────

  var traceEl  = document.querySelector('.fx-trace');
  var liveUrl  = traceEl ? traceEl.getAttribute('data-live-url') : null;
  var initialScrubAttr = traceEl
    ? traceEl.getAttribute('data-initial-scrub') : null;
  // R1 — settled races don't poll. Server sets data-is-replay on
  // first render; the poll payload's is_replay flag also flips this
  // on later, catching the case where the race settles mid-session.
  var isReplay = !!(traceEl && traceEl.getAttribute('data-is-replay'));
  var copyBtn  = document.getElementById('fx-tchart-copy');
  var svg      = document.querySelector('.fx-tchart__svg');
  if (!svg) return;
  // Its flags are buttons, so the chart is a named group: an image may
  // not hold controls.
  svg.setAttribute('role', 'group');
  var linesG   = svg.querySelector('.fx-tchart__lines');
  var aiLinesG = svg.querySelector('.fx-tchart__ai-lines');
  var gridG    = svg.querySelector('.fx-tchart__grid');
  var aiAxisG  = svg.querySelector('.fx-tchart__ai-axis');
  var markersG = svg.querySelector('.fx-tchart__markers');
  var cursor   = svg.querySelector('.fx-tchart__cursor');
  var readTime = document.querySelector('.fx-tchart__readout-time');
  var readList = document.querySelector('.fx-tchart__readout-list');
  var scrub    = document.getElementById('fx-tchart-scrub');
  var aiToggle = document.getElementById('fx-tchart-ai-toggle');
  var oddsToggle = document.getElementById('fx-tchart-odds-toggle');
  var livePill = document.getElementById('fx-tchart-live');
  var liveAge  = document.getElementById('fx-tchart-live-age');
  var livePause = document.getElementById('fx-tchart-live-pause');

  // The words beside the chart are HTML, not SVG text: the chart is
  // stretched to its box (preserveAspectRatio="none"), which would
  // size its text by the window. Each is placed by measuring the
  // chart's box (placeOverlays below), so it stays with its line when
  // the chart resizes. The containers are made here, so the markup
  // stays as the templates write it.
  var stageEl = svg.parentNode;
  var overlayAnchor = svg.nextSibling;
  function overlay(cls) {
    var el = document.createElement('div');
    el.className = cls;
    el.setAttribute('aria-hidden', 'true');
    stageEl.insertBefore(el, overlayAnchor);
    return el;
  }
  var axisEl   = overlay('fx-tchart__axis');    // the prices, down the left
  var aiAxisEl = overlay('fx-tchart__aiaxis');  // AI %, down the right
  var endsEl   = overlay('fx-tchart__ends');    // each line's runner, at its end
  var timesEl  = overlay('fx-tchart__times');   // the hours, along the foot
  endsEl.removeAttribute('aria-hidden');        // its buttons are for everyone
  var endsG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  endsG.setAttribute('class', 'fx-tchart__ends-lines');
  endsG.setAttribute('aria-hidden', 'true');
  svg.insertBefore(endsG, markersG);
  // The story, between the caption and the chart.
  var capEl = stageEl.parentNode.querySelector('.fx-tchart__cap');
  var capMeta = capEl ? capEl.querySelector('.fx-tchart__cap-meta') : null;
  var capTitle = capEl ? capEl.querySelector('.fx-tchart__cap-title') : null;
  if (capTitle) capTitle.textContent = 'How the market ran';
  // The winning post: the replay's cursor is the post, and this its disc.
  var post = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  post.setAttribute('class', 'fx-tchart__post');
  post.setAttribute('aria-hidden', 'true');
  if (cursor && cursor.parentNode) cursor.parentNode.insertBefore(post, cursor.nextSibling);
  var figureEl = stageEl.parentNode;
  // The field switch: the chart shows the front of the market until
  // the reader asks for the whole field.
  var showField = false;
  var fieldToggle = document.createElement('button');
  fieldToggle.type = 'button';
  fieldToggle.className = 'fx-tchart__ai-toggle fx-tchart__field-toggle';
  fieldToggle.setAttribute('aria-pressed', 'false');
  fieldToggle.title = 'Show every runner on the chart';
  if (capEl) capEl.insertBefore(fieldToggle, livePill && livePill.parentNode === capEl ? livePill : null);
  var storyEl = document.createElement('div');
  storyEl.className = 'fx-tchart__story';
  storyEl.setAttribute('role', 'group');
  storyEl.setAttribute('aria-label', 'The market at a glance');
  if (capEl) capEl.parentNode.insertBefore(storyEl, capEl.nextSibling);
  else stageEl.parentNode.insertBefore(storyEl, stageEl);

  // ── Layout constants ────────────────────────────────────────────

  // The chart's own grid. A phone draws it 500 wide and taller, a
  // tablet a little taller (the stylesheet gives the box the same
  // shape at each width), so the lines stand apart.
  var VB_W = 1000;
  var VB_H = 260;
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : null; };
  var narrow = mq('(max-width: 767px)');
  var tablet = mq('(max-width: 1023px)');
  var laptop = mq('(max-width: 1279px)');
  var on = function (q) { return !!(q && q.matches); };
  function sizeGrid() {
    VB_W = on(narrow) ? 500 : 1000;
    VB_H = on(narrow) ? 440 : on(tablet) ? 400 : on(laptop) ? 340 : 260;
    svg.setAttribute('viewBox', '0 0 ' + VB_W + ' ' + VB_H);
    if (cursor) cursor.setAttribute('y2', VB_H);
    var disc = on(narrow) ? 8 : 5;
    post.setAttribute('r', disc);
    post.setAttribute('cy', 12 + disc);
  }
  sizeGrid();
  [narrow, tablet, laptop].forEach(function (query) {
    if (!query || !query.addEventListener) return;
    // Turned, or the window dragged across the width: draw it again.
    query.addEventListener('change', function () {
      sizeGrid();
      if (chart) { render(chart); onScrub(); }
    });
  });
  // The words are beside the chart, not in it, so it keeps only a
  // little margin: the lines end short of the right edge, and each
  // runs on from there to its runner's name.
  var PAD_L = 8;
  var PAD_R = 22;
  var PAD_T = 12;
  var PAD_B = 14;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var POLL_MS = 60000;
  var AGE_TICK_MS = 1000;

  // ── Mutable state (recomputed every render) ─────────────────────

  var chart    = initial;
  var pMin     = 0;
  var pMax     = 0;
  var minSpan  = 1;
  var hasAnyAI = false;
  var lastFetchAt = Date.now();
  var paused = false;
  // T6 — click a legend chip to lock focus on one runner. When set,
  // the chart dims everything else AND the readout narrows to that
  // horse. Escape or a second click on the same chip clears it.
  var focusedRunnerId = null;
  // The runners outside the market's front, by runner_id, and the
  // favourite's id (none on a replay, where the winner is marked
  // instead): renderLines.
  var backIds = {};
  var favId = null;
  // How many of the ring a phone shows before "Show all".
  var RING_SHOWN = 4;

  // The price scale is proportional: equal distances are equal
  // changes in the odds (5/6 to evens stands as tall as 250/1 to
  // 300/1). On an even scale one 300/1 outsider pressed every horse
  // under 6/1 into the bottom fiftieth of the chart. A price's place
  // is the log of its odds to one (decimal less the stake).
  function scaleOf(dec) {
    return Math.log(Math.max(dec - 1, 0.01));
  }
  function decOfScale(v) {
    return Math.exp(v) + 1;
  }

  function recomputeBounds(c) {
    // The market's front: the four shortest at the latest price (every
    // runner, in a small field), and on a replay the winner, wherever it
    // stood in the market. The rest are kept for the asking.
    var ranked = c.series.filter(function (s) { return s.points.length; })
      .sort(function (a, b) {
        return a.points[a.points.length - 1].decimal - b.points[b.points.length - 1].decimal;
      });
    var frontN = ranked.length > 6 ? 4 : ranked.length;
    backIds = {};
    ranked.slice(frontN).forEach(function (s) {
      if (s.finish_position !== 1) backIds[s.runner_id] = true;
    });
    var placed = c.series.some(function (s) { return s.finish_position; });
    favId = !placed && ranked.length ? ranked[0].runner_id : null;
    paintFieldToggle();
    // The scale fits the runners on the chart, so the front of the
    // market has the height when the outsiders are not drawn.
    var lo = Infinity, hi = -Infinity;
    c.series.forEach(function (s) {
      if (!s.points.length || !shown(s)) return;
      s.points.forEach(function (p) {
        if (p.decimal < lo) lo = p.decimal;
        if (p.decimal > hi) hi = p.decimal;
      });
    });
    pMin = isFinite(lo) ? lo : c.price_min;
    pMax = isFinite(hi) ? hi : c.price_max;
    if (pMax <= pMin) { pMax = pMin + 0.5; }
    // A little room above the longest price and below the shortest.
    var lo = scaleOf(pMin), hi = scaleOf(pMax);
    var room = Math.max((hi - lo) * 0.06, 0.05);
    pMin = Math.max(1.01, decOfScale(lo - room));
    pMax = decOfScale(hi + room);
    minSpan = Math.max(1, c.span_min);
    hasAnyAI = c.series.some(function (s) {
      return s.ai_points && s.ai_points.length;
    });
  }

  function xFor(minute) {
    var t = minute / minSpan;
    return PAD_L + t * (VB_W - PAD_L - PAD_R);
  }
  function yFor(dec) {
    // Longer prices sit at the top of the chart; the favourite runs
    // along the bottom.
    var lo = scaleOf(pMin);
    var t = (scaleOf(dec) - lo) / (scaleOf(pMax) - lo);
    return PAD_T + (1 - t) * (VB_H - PAD_T - PAD_B);
  }
  function yForAI(pct) {
    var t = Math.max(0, Math.min(100, pct)) / 100;
    return PAD_T + (1 - t) * (VB_H - PAD_T - PAD_B);
  }

  function clearG(g) {
    while (g.firstChild) g.removeChild(g.firstChild);
  }

  // ── Render helpers ──────────────────────────────────────────────

  // ── Odds format ───────────────────────────────────────────────
  // Fractional unless the reader has asked for decimal.
  var ODDS_KEY = 'fx-trace-odds';
  var showDecimal = false;
  try { showDecimal = window.localStorage.getItem(ODDS_KEY) === 'decimal'; }
  catch (e) { /* storage blocked: fractional */ }

  // A point's price in the chosen format.
  function priceText(pt) {
    return showDecimal ? pt.decimal.toFixed(2) : pt.fractional;
  }

  // A fractional price as text ("9/4", "evs") in the chosen format.
  // Anything that is not a price comes back as it was.
  function fracText(frac) {
    if (!frac) return '\u2014';
    if (!showDecimal) return frac;
    var m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(frac);
    if (m && +m[2] > 0) return (+m[1] / +m[2] + 1).toFixed(2);
    if (/^\s*ev(s|n|ens?)?\s*$/i.test(frac)) return '2.00';
    return frac;
  }

  // How a runner's price stands against its first: in (shortened,
  // backed), out (drifted), or where it opened.
  function moveOf(series, pt) {
    var first = series.points && series.points[0];
    if (!first || !pt) return 'flat';
    if (pt.decimal < first.decimal - 1e-9) return 'in';
    if (pt.decimal > first.decimal + 1e-9) return 'out';
    return 'flat';
  }

  // That, as a mark after the price.
  function moveMark(move) {
    if (move === 'in') return '<span class="fx-tchart__readout-move" title="Shorter than it opened">\u2198</span>';
    if (move === 'out') return '<span class="fx-tchart__readout-move" title="Longer than it opened">\u2197</span>';
    return '';
  }

  // A fractional price as a decimal; null for anything that is not one.
  function decOf(frac) {
    if (!frac) return null;
    var m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(frac);
    if (m && +m[2] > 0) return +m[1] / +m[2] + 1;
    if (/^\s*ev(s|n|ens?)?\s*$/i.test(frac)) return 2;
    return null;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Minutes as "3h 34m", "45m".
  function spanText(minutes) {
    var h = Math.floor(minutes / 60), m = minutes % 60;
    return (h ? h + 'h ' : '') + (m || !h ? m + 'm' : '');
  }

  function ordinal(n) {
    var ends = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (ends[(v - 20) % 10] || ends[v] || ends[0]);
  }

  // The runners table: Opened, the latest price, and the phone's
  // "from" line, each printed from the fractional price on the cell.
  function paintRunnerPrices(scope) {
    var cells = (scope || document).querySelectorAll('.fx-trace__runner [data-frac]');
    Array.prototype.forEach.call(cells, function (cell) {
      var price = cell.querySelector('[data-price]');
      if (price) price.textContent = fracText(cell.getAttribute('data-frac'));
    });
    var rows = (scope || document).querySelectorAll('.fx-trace__runner');
    Array.prototype.forEach.call(rows, function (row) {
      var opened = row.querySelector('[data-cell="opened"]');
      var now = row.querySelector('[data-cell="odds"]');
      if (!opened || !now) return;
      var from = now.querySelector('.fx-trace__from');
      if (!from) return;
      var first = opened.getAttribute('data-frac');
      var moved = first && first !== now.getAttribute('data-frac');
      from.hidden = !moved;
      var word = from.querySelector('[data-from]');
      if (word) word.textContent = fracText(first);
      // Which way the price has gone, for the row's colours.
      var d0 = decOf(first), d1 = decOf(now.getAttribute('data-frac'));
      var went = d0 !== null && d1 !== null && d1 !== d0 ? (d1 < d0 ? 'in' : 'out') : '';
      row.classList.toggle('fx-trace__runner--in', went === 'in');
      row.classList.toggle('fx-trace__runner--out', went === 'out');
    });
  }

  // The prices bookmakers quote, shortest to longest, as [n, d].
  var LADDER = [
    [1, 5], [1, 4], [2, 7], [3, 10], [1, 3], [4, 11], [2, 5], [4, 9],
    [1, 2], [8, 15], [4, 7], [8, 13], [4, 6], [8, 11], [4, 5], [5, 6],
    [10, 11], [1, 1], [11, 10], [6, 5], [5, 4], [11, 8], [6, 4], [13, 8],
    [7, 4], [15, 8], [2, 1], [9, 4], [5, 2], [11, 4], [3, 1], [10, 3],
    [7, 2], [4, 1], [9, 2], [5, 1], [11, 2], [6, 1], [13, 2], [7, 1],
    [15, 2], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [14, 1], [16, 1],
    [18, 1], [20, 1], [22, 1], [25, 1], [28, 1], [33, 1], [40, 1],
    [50, 1], [66, 1], [80, 1], [100, 1], [150, 1], [200, 1], [250, 1],
    [500, 1], [1000, 1]
  ];

  // Where the gridlines go: [{ dec, text }], top of the chart first.
  // In decimal, five values evenly spaced up the chart. In fractional a
  // line at an even spacing would sit at no real price (8.18 is not a
  // price), so the lines go on quoted prices instead: up to five of
  // them, the ones nearest the even spacing.
  function gridTicks() {
    var even = [];
    var lo = scaleOf(pMin), hi = scaleOf(pMax);
    for (var i = 0; i <= 4; i++) even.push(decOfScale(hi - (i / 4) * (hi - lo)));
    var decimalTicks = even.map(function (d) {
      return { dec: d, text: d.toFixed(2) };
    });
    if (showDecimal) return decimalTicks;

    var inView = [];
    LADDER.forEach(function (f) {
      var dec = f[0] / f[1] + 1;
      if (dec >= pMin && dec <= pMax) inView.push({ dec: dec, text: f[0] + '/' + f[1] });
    });
    if (inView.length < 2) return decimalTicks;
    if (inView.length <= 5) return inView.reverse();

    var picked = [];
    even.forEach(function (target) {
      var best = null;
      inView.forEach(function (t) {
        if (picked.indexOf(t) !== -1) return;
        if (!best || Math.abs(scaleOf(t.dec) - scaleOf(target)) <
                     Math.abs(scaleOf(best.dec) - scaleOf(target))) best = t;
      });
      if (best) picked.push(best);
    });
    return picked.sort(function (a, b) { return b.dec - a.dec; });
  }

  function renderGrid() {
    clearG(gridG);
    axisEl.textContent = '';
    gridTicks().forEach(function (tick) {
      var yv = yFor(tick.dec);

      var line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', PAD_L);
      line.setAttribute('x2', VB_W - PAD_R);
      line.setAttribute('y1', yv);
      line.setAttribute('y2', yv);
      line.setAttribute('class', 'fx-tchart__gridline');
      gridG.appendChild(line);

      var lab = document.createElement('span');
      lab.className = 'fx-tchart__gridlabel fx-num';
      lab.setAttribute('data-y', yv.toFixed(2));
      lab.textContent = tick.text;
      axisEl.appendChild(lab);
    });
  }

  // Each whole hour the chart spans, as minutes from its start, named
  // as the reader's clock has it (as the scrubber's time is).
  function hourMarks() {
    if (!chart.start_at) return [];
    var start = new Date(chart.start_at).getTime();
    var p = clockParts(new Date(start));
    var into = p.m * 60 + p.s;             // seconds into the start's hour
    var first = into ? start + (3600 - into) * 1000 : start;
    var marks = [];
    for (var t = first; t <= start + minSpan * 60000; t += 3600000) {
      var minute = (t - start) / 60000;
      marks.push({ minute: minute, text: fmtScrubTime(minute) });
    }
    return marks;
  }

  function renderTimes() {
    timesEl.textContent = '';
    hourMarks().forEach(function (h) {
      var lab = document.createElement('span');
      lab.className = 'fx-tchart__time fx-num';
      lab.setAttribute('data-x', xFor(h.minute).toFixed(2));
      lab.textContent = h.text;
      timesEl.appendChild(lab);
    });
  }

  // Each line runs on to its runner: the number cloth, the name and
  // the price at the line's end (and on a replay, where the horse
  // finished). The labels are HTML beside the chart, pushed apart
  // where lines end close together, each joined to its line.
  // Is a runner on the chart: the front of the market, the whole field
  // when asked for, and whoever is followed.
  function shown(s) {
    return showField || !backIds[s.runner_id] || s.runner_id === focusedRunnerId;
  }

  // Whose flags are flown: a followed runner's; else the favourite's
  // (the winner's, on a replay); the whole field's when asked for, the
  // race's own flags with them.
  function flagged(s) {
    if (focusedRunnerId !== null) return !!s && s.runner_id === focusedRunnerId;
    if (showField) return true;
    if (!s) return false;
    return s.runner_id === favId || !!s.finish_position && s.finish_position === 1;
  }

  function paintFieldToggle() {
    var n = chart.series.filter(function (s) { return s.points.length; }).length;
    var back = Object.keys(backIds).length;
    fieldToggle.hidden = !back;
    fieldToggle.textContent = 'Whole field \u00b7 ' + n;
    fieldToggle.setAttribute('aria-pressed', String(showField));
    fieldToggle.classList.toggle('fx-tchart__ai-toggle--on', showField);
    svg.classList.toggle('fx-tchart__svg--field', showField);
  }

  fieldToggle.addEventListener('click', function () {
    showField = !showField;
    render(chart);
    applyDimTo(focusedRunnerId);
  });

  function renderEnds() {
    endsEl.textContent = '';
    chart.series.forEach(function (s) {
      if (!s.points.length || !shown(s)) return;
      var last = s.points[s.points.length - 1];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fx-tchart__end' +
        (s.finish_position ? ' fx-tchart__end--pos-' + s.finish_position : '') +
        (backIds[s.runner_id] ? ' fx-tchart__end--back' : '') +
        (s.runner_id === favId ? ' fx-tchart__end--fav' : '') +
        (focusedRunnerId === null ? ''
          : s.runner_id === focusedRunnerId ? ' fx-tchart__end--hi' : ' fx-tchart__end--dim');
      btn.setAttribute('data-runner-id', s.runner_id);
      btn.setAttribute('data-x', xFor(last.minute).toFixed(2));
      btn.setAttribute('data-y', yFor(last.decimal).toFixed(2));
      btn.setAttribute('style', '--hue: ' + s.hue);
      btn.setAttribute('aria-pressed', String(focusedRunnerId === s.runner_id));
      btn.title = 'Follow ' + s.horse_name;
      // Its name for a screen reader: a narrow screen shows the cloth alone.
      btn.setAttribute('aria-label', 'Follow ' + s.horse_name + ', number ' + s.number + ', ' +
        priceText(last) + (s.finish_position ? ', ' + ordinal(s.finish_position) : ''));
      btn.appendChild(span('fx-tchart__end-horse', ''));
      btn.appendChild(span('fx-tchart__end-cloth fx-num', String(s.number)));
      btn.appendChild(span('fx-tchart__end-name', s.horse_name));
      if (s.finish_position) {
        btn.appendChild(span('fx-tchart__end-pos fx-num', ordinal(s.finish_position)));
      }
      btn.appendChild(span('fx-tchart__end-price fx-num', priceText(last)));
      endsEl.appendChild(btn);
    });
    placeOverlays();
  }

  // Put the words beside the chart where its units say: the chart's
  // box is measured, so a label's place is its unit times the box's
  // scale. Called after every draw and whenever the box changes.
  function placeOverlays() {
    var box = svg.getBoundingClientRect();
    var stageBox = stageEl.getBoundingClientRect();
    if (!box.width || !box.height) return;
    var ox = box.left - stageBox.left;
    var oy = box.top - stageBox.top;
    var sx = box.width / VB_W;
    var sy = box.height / VB_H;
    var put = function (el, x, y) {
      el.style.left = (ox + x * sx).toFixed(1) + 'px';
      el.style.top = (oy + y * sy).toFixed(1) + 'px';
    };
    axisEl.querySelectorAll('[data-y]').forEach(function (el) {
      put(el, 0, parseFloat(el.getAttribute('data-y')));
    });
    aiAxisEl.querySelectorAll('[data-y]').forEach(function (el) {
      put(el, VB_W, parseFloat(el.getAttribute('data-y')));
    });
    // The hours are named every hour where there is room, else every
    // second (third...) hour, evenly, so the foot reads as a scale.
    var hourEls = timesEl.querySelectorAll('[data-x]');
    var widest = 0;
    hourEls.forEach(function (el) { widest = Math.max(widest, el.offsetWidth || 36); });
    var perHour = sx * (VB_W - PAD_L - PAD_R) / Math.max(1, minSpan) * 60;
    var step = Math.max(1, Math.ceil((widest + 10) / Math.max(1, perHour)));
    hourEls.forEach(function (el, i) {
      put(el, parseFloat(el.getAttribute('data-x')), VB_H);
      el.style.visibility = i % step === 0 ? '' : 'hidden';
    });

    // The ends: each at its line's height, then pushed apart so no two
    // overlap, and kept within the chart's height.
    var ends = Array.prototype.slice.call(endsEl.querySelectorAll('.fx-tchart__end'));
    clearG(endsG);
    if (!ends.length) return;
    var h = ends[0].offsetHeight || 22;
    var gap = Math.min(h + 2, Math.max(h * 0.55, (box.height - h) / Math.max(1, ends.length - 1)));
    var items = ends.map(function (el) {
      return {
        el: el,
        x: parseFloat(el.getAttribute('data-x')),
        y0: parseFloat(el.getAttribute('data-y')) * sy,
        y: 0,
      };
    }).sort(function (a, b) { return a.y0 - b.y0; });
    var top = h / 2, bottom = box.height - h / 2;
    items.forEach(function (it, i) {
      it.y = Math.max(it.y0, top, i ? items[i - 1].y + gap : -Infinity);
    });
    if (items[items.length - 1].y > bottom) {
      for (var i = items.length - 1; i >= 0; i--) {
        var limit = i === items.length - 1 ? bottom : items[i + 1].y - gap;
        items[i].y = Math.min(items[i].y, limit);
      }
    }
    items.forEach(function (it) {
      it.el.style.left = (ox + box.width).toFixed(1) + 'px';
      it.el.style.top = (oy + it.y).toFixed(1) + 'px';
      // The join: from the line's end to the edge, at the label's height.
      var p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', 'M' + it.x.toFixed(2) + ',' + (it.y0 / sy).toFixed(2) +
        ' L' + VB_W + ',' + (it.y / sy).toFixed(2));
      p.setAttribute('class', 'fx-tchart__end-line' +
        (focusedRunnerId !== null && String(focusedRunnerId) === it.el.getAttribute('data-runner-id')
          ? ' fx-tchart__line--hi' : ''));
      p.setAttribute('data-runner-id', it.el.getAttribute('data-runner-id'));
      p.setAttribute('style', it.el.getAttribute('style'));
      endsG.appendChild(p);
    });
  }

  // The market's story, told before the chart: who is favourite (who
  // won, on a replay), who has been backed the most, who has drifted
  // the most, and the latest signal. Moves are measured as the change
  // in the price's share of the market (its implied probability), so
  // 5/6 to evens counts for more than 250/1 to 300/1.
  function storyRows() {
    return chart.series.filter(function (s) { return s.points.length; }).map(function (s) {
      var first = s.points[0], last = s.points[s.points.length - 1];
      return { s: s, first: first, last: last, pp: 100 / last.decimal - 100 / first.decimal };
    });
  }

  function tileWho(s, fallback) {
    var who = span('fx-tchart__tile-who', '');
    if (s) {
      who.appendChild(span('fx-tchart__tile-cloth fx-num', String(s.number)));
      who.appendChild(span('fx-tchart__tile-name', s.horse_name));
    } else {
      who.appendChild(span('fx-tchart__tile-name', fallback));
    }
    return who;
  }

  function runnerTile(row, lab, cls) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'fx-tchart__tile ' + cls;
    b.setAttribute('data-runner-id', row.s.runner_id);
    b.setAttribute('style', '--hue: ' + row.s.hue);
    b.setAttribute('aria-pressed', String(focusedRunnerId === row.s.runner_id));
    b.title = 'Follow ' + row.s.horse_name;
    b.appendChild(span('fx-tchart__tile-lab', lab));
    b.appendChild(tileWho(row.s));
    b.appendChild(span('fx-tchart__tile-price fx-num', priceText(row.last)));
    var move = moveOf(row.s, row.last);
    var note = move === 'flat' ? 'where it opened'
      : (move === 'in' ? '\u2198 from ' : '\u2197 from ') + priceText(row.first);
    b.appendChild(span('fx-tchart__tile-note fx-tchart__tile-note--' + move + ' fx-num', note));
    return b;
  }

  function emptyTile(lab, note) {
    var d = document.createElement('div');
    d.className = 'fx-tchart__tile fx-tchart__tile--empty';
    d.appendChild(span('fx-tchart__tile-lab', lab));
    d.appendChild(span('fx-tchart__tile-note', note));
    return d;
  }

  function renderStory() {
    storyEl.textContent = '';
    var rows = storyRows();
    if (!rows.length) return;
    var byPrice = rows.slice().sort(function (a, b) { return a.last.decimal - b.last.decimal; });
    var winner = rows.filter(function (r) { return r.s.finish_position === 1; })[0] || null;
    var lead = winner || byPrice[0];
    var backers = rows.filter(function (r) { return r.pp > 0.05; })
      .sort(function (a, b) { return b.pp - a.pp; });
    var drifters = rows.filter(function (r) { return r.pp < -0.05; })
      .sort(function (a, b) { return a.pp - b.pp; });
    // The favourite's (the winner's) own move is on its tile: the fact
    // beside it is the next runner to have moved that way.
    var backed = backers[0] || null;
    var backedLab = 'Most backed';
    if (backed && backed.s === lead.s) { backed = backers[1] || null; backedLab = 'Also backed'; }
    var drift = drifters[0] || null;
    var driftLab = 'Biggest drifter';
    if (drift && drift.s === lead.s) { drift = drifters[1] || null; driftLab = 'Also drifting'; }

    storyEl.appendChild(runnerTile(lead, winner ? 'Winner' : 'Favourite',
      winner ? 'fx-tchart__tile--win' : 'fx-tchart__tile--fav'));
    storyEl.appendChild(backed
      ? runnerTile(backed, backedLab, 'fx-tchart__tile--in')
      : emptyTile(backedLab, backers.length ? 'No other price has shortened' : 'No price has shortened'));
    storyEl.appendChild(drift
      ? runnerTile(drift, driftLab, 'fx-tchart__tile--out')
      : emptyTile(driftLab, drifters.length ? 'No other price has drifted' : 'No price has drifted'));
    // The latest signal is on the chart, as a flag, and in the signals
    // list; three facts are enough here.
  }

  // The caption's facts, in words: the day the prices cover, the
  // runners, the signals.
  function renderCaption() {
    if (!capMeta) return;
    capMeta.textContent = '';
    var add = function (text, num) {
      var el = document.createElement(num ? 'span' : 'span');
      if (num) el.className = 'fx-num';
      el.textContent = text;
      capMeta.appendChild(el);
    };
    add('Each line is a runner\u2019s price from ');
    add(fmtScrubTime(0), true);
    add(' to ');
    add(fmtScrubTime(chart.span_min), true);
    add(': the lower the line, the shorter the price. Flags are the Fox\u2019s signals. Press a horse to follow it.');
  }

  // The chart's colour for each runner, handed to the page: a number
  // cloth in the runners table or the rails is its line's colour. The
  // favourite's row in the table is marked, as its cloth is gold on the
  // chart.
  function paintRunnerHues() {
    chart.series.forEach(function (s) {
      document.querySelectorAll('[data-runner-id="' + s.runner_id + '"]').forEach(function (el) {
        if (!el.style.getPropertyValue('--hue')) el.style.setProperty('--hue', String(s.hue));
      });
    });
    document.querySelectorAll('.fx-trace__runner').forEach(function (row) {
      row.classList.toggle('fx-trace__runner--fav',
        favId !== null && row.getAttribute('data-runner-id') === String(favId));
    });
  }

  // Each signal's kind (the chip's word), handed to the page as an
  // attribute, so the stylesheet can draw the Board's mark for it.
  function paintSignalKinds() {
    document.querySelectorAll('.fx-trace__signal').forEach(function (li) {
      var chip = li.querySelector('.fx-trace__signal-chip');
      if (chip) li.setAttribute('data-kind', chip.textContent.trim().toLowerCase());
    });
  }

  // The value edge in words: each chance as a bar (the figure handed
  // to the stylesheet), "Mkt" written out, and the gap between the two
  // as "Market keener by 6.4 pts" rather than "-6.4pp".
  function paintEdges() {
    document.querySelectorAll('.fx-vedge__row').forEach(function (row) {
      row.querySelectorAll('.fx-vedge__prob').forEach(function (prob) {
        var lab = prob.querySelector('.fx-vedge__prob-lab');
        if (lab && /^mkt$/i.test(lab.textContent.trim())) lab.textContent = 'Market';
        var num = prob.querySelector('.fx-num');
        var pct = num ? parseFloat(num.textContent) : NaN;
        if (!isNaN(pct)) prob.style.setProperty('--pct', Math.max(0, Math.min(100, pct)) + '%');
      });
      var edge = row.querySelector('.fx-vedge__edge');
      if (!edge || edge.hasAttribute('data-words')) return;
      var m = /(-?\d+(?:\.\d+)?)\s*pp/.exec(edge.textContent);
      var down = row.classList.contains('fx-vedge__row--down');
      edge.setAttribute('data-words', down ? 'Market keener by' : 'AI keener by');
      if (m) edge.textContent = String(Math.abs(parseFloat(m[1]))).replace(/\.0$/, '') + ' pts';
    });
  }

  function renderLines() {
    clearG(linesG);
    clearG(aiLinesG);
    chart.series.forEach(function (s) {
      // Market price line (T2). R3 layers a gold/silver/bronze
      // accent when the runner placed 1/2/3 so the settled chart
      // still tells you which trajectory to follow.
      if (s.points.length) {
        // A price holds until the next is set, so the line steps: along
        // to the next time, then up or down to the new price.
        var d = '';
        s.points.forEach(function (p, idx) {
          var x = xFor(p.minute).toFixed(2), y = yFor(p.decimal).toFixed(2);
          d += idx === 0 ? 'M' + x + ',' + y : ' H' + x + ' V' + y;
        });
        var path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        var lineCls = 'fx-tchart__line';
        if (s.finish_position) {
          lineCls += ' fx-tchart__line--pos-' + s.finish_position;
        }
        if (backIds[s.runner_id]) lineCls += ' fx-tchart__line--back';
        if (s.runner_id === favId) lineCls += ' fx-tchart__line--fav';
        path.setAttribute('class', lineCls);
        path.setAttribute('data-runner-id', s.runner_id);
        path.setAttribute('style', '--hue: ' + s.hue);
        linesG.appendChild(path);
      }
      // AI confidence line (T4)
      if (s.ai_points && s.ai_points.length) {
        var aiD = '';
        s.ai_points.forEach(function (p, idx) {
          var cmd = idx === 0 ? 'M' : 'L';
          aiD += cmd + xFor(p.minute).toFixed(2) + ',' +
                       yForAI(p.pct).toFixed(2) + ' ';
        });
        var aiPath = document.createElementNS(SVG_NS, 'path');
        aiPath.setAttribute('d', aiD);
        aiPath.setAttribute('class', 'fx-tchart__ai-line');
        aiPath.setAttribute('data-runner-id', s.runner_id);
        aiPath.setAttribute('style', '--hue: ' + s.hue);
        aiLinesG.appendChild(aiPath);
      }
    });
  }

  function renderAiAxis() {
    clearG(aiAxisG);
    aiAxisEl.textContent = '';
    if (!hasAnyAI) {
      if (aiToggle) aiToggle.setAttribute('hidden', 'hidden');
      return;
    }
    if (aiToggle) aiToggle.removeAttribute('hidden');
    [0, 25, 50, 75, 100].forEach(function (pct) {
      var lab = document.createElement('span');
      lab.className = 'fx-tchart__ai-axislabel fx-num';
      lab.setAttribute('data-y', yForAI(pct).toFixed(2));
      lab.textContent = pct + '%';
      aiAxisEl.appendChild(lab);
    });
  }

  // A series by its horse's name: a marker names its runner.
  function seriesNamed(name) {
    if (!name) return null;
    for (var i = 0; i < chart.series.length; i++) {
      if (chart.series[i].horse_name === name) return chart.series[i];
    }
    return null;
  }

  // Signals that fired within a few pixels of each other on the same
  // line are one dot, which stands for all of them: a press on it names
  // them all. How many minutes a few pixels are depends on how wide the
  // chart is drawn.
  function markerGroups() {
    var width = svg.getBoundingClientRect().width || VB_W;
    var perMinute = width * (1 - (PAD_L + PAD_R) / VB_W) / minSpan;
    // Two flags closer than a press is wide would take each other's
    // presses, so they are one flag: a press is 14px wide with a
    // pointer, 30px under a finger (the stylesheet's hit lines).
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var within = Math.max(2, ((coarse ? 44 : 14) / 2 + 2) / perMinute);
    var groups = [];
    var open = {};
    chart.markers.map(function (m, idx) { return { m: m, idx: idx }; })
      .sort(function (a, b) { return a.m.minute - b.m.minute; })
      .forEach(function (it) {
        var s = seriesNamed(it.m.runner_name);
        var key = s ? String(s.runner_id) : 'race';
        var g = open[key];
        if (g && it.m.minute - g.last <= within) {
          g.items.push(it);
          g.last = it.m.minute;
        } else {
          g = { s: s, items: [it], first: it.m.minute, last: it.m.minute };
          open[key] = g;
          groups.push(g);
        }
      });
    return groups;
  }

  function groupTone(items) {
    var up = false, down = false;
    items.forEach(function (it) {
      if (it.m.tone === 'up') up = true;
      if (it.m.tone === 'down') down = true;
    });
    if (up && down) return 'mixed';
    return up ? 'up' : down ? 'down' : 'neutral';
  }

  function renderMarkers() {
    clearG(markersG);
    // The dot is drawn in the chart's units, so it is bigger where the
    // chart is drawn smaller (a phone).
    var base = (narrow && narrow.matches) ? 6 : 3.4;
    markerGroups().forEach(function (grp) {
      if (!flagged(grp.s)) return;
      var m = grp.items[0].m;
      var many = grp.items.length > 1;
      var r = many ? base + 1.5 : base;
      var x = xFor(m.minute);
      var g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'fx-tchart__marker fx-tchart__marker--' + groupTone(grp.items) +
        (many ? ' fx-tchart__marker--many' : ''));
      g.setAttribute('transform', 'translate(' + x.toFixed(2) + ',0)');
      g.setAttribute('data-minute', m.minute);
      g.setAttribute('data-until', grp.last);
      g.setAttribute('data-marker', grp.items.map(function (it) { return it.idx; }).join(' '));
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      // The signal's runner: the dot sits on its line, where it fired.
      // A signal about the whole race sits on the time axis.
      var s = grp.s;
      var pt = s ? priceAtMinute(s, m.minute) : null;
      var y = pt ? yFor(pt.decimal) : VB_H - PAD_B;
      if (s) g.setAttribute('data-runner-id', s.runner_id);
      // The press lands anywhere from the dot down to the time axis.
      var hit = document.createElementNS(SVG_NS, 'line');
      hit.setAttribute('x1', 0);
      hit.setAttribute('x2', 0);
      hit.setAttribute('y1', Math.min(y, VB_H - PAD_B) - r * 3.2 - 2);
      hit.setAttribute('y2', VB_H - PAD_B + r);
      hit.setAttribute('class', 'fx-tchart__marker-hit');
      g.appendChild(hit);
      // A course flag on the line where it fired: a pole and a pennant
      // (two pennants where several signals share the spot), and the
      // gold at its foot when the replay is on it.
      var ring = document.createElementNS(SVG_NS, 'circle');
      ring.setAttribute('cx', 0);
      ring.setAttribute('cy', y);
      ring.setAttribute('r', r * 2.2);
      ring.setAttribute('class', 'fx-tchart__marker-ring');
      g.appendChild(ring);
      var poleH = r * 3.2, flagW = r * 2.1, flagH = r * 1.4;
      var pole = document.createElementNS(SVG_NS, 'line');
      pole.setAttribute('x1', 0);
      pole.setAttribute('x2', 0);
      pole.setAttribute('y1', y);
      pole.setAttribute('y2', y - poleH);
      pole.setAttribute('class', 'fx-tchart__marker-pole');
      g.appendChild(pole);
      for (var k = 0; k < (many ? 2 : 1); k++) {
        var top = y - poleH + k * (flagH + 1.2);
        var flag = document.createElementNS(SVG_NS, 'path');
        flag.setAttribute('d', 'M0,' + top.toFixed(2) +
          ' L' + flagW.toFixed(2) + ',' + (top + flagH / 2).toFixed(2) +
          ' L0,' + (top + flagH).toFixed(2) + ' Z');
        flag.setAttribute('class', 'fx-tchart__marker-flag');
        g.appendChild(flag);
      }
      var dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('cx', 0);
      dot.setAttribute('cy', y);
      dot.setAttribute('r', r * 0.55);
      dot.setAttribute('class', 'fx-tchart__marker-dot');
      g.appendChild(dot);
      var title = document.createElementNS(SVG_NS, 'title');
      var who = m.runner_name ? ' · ' + m.runner_name : '';
      title.textContent = grp.items.map(function (it) {
        return it.m.label + ' — ' + it.m.detail;
      }).join(' · ') + who;
      g.appendChild(title);
      markersG.appendChild(g);
    });
  }

  function renderScrubber() {
    // If the user was parked at the far right (default: latest tick),
    // follow the new latest as span grows. Otherwise keep them where
    // they scrubbed to, in absolute minutes — feels like they anchored
    // an inspection point.
    if (!scrub) return;
    var wasAtMax = parseInt(scrub.value, 10) >= parseInt(scrub.max, 10);
    scrub.max = String(chart.span_min);
    if (wasAtMax) scrub.value = String(chart.span_min);
    if (parseInt(scrub.value, 10) > chart.span_min) {
      scrub.value = String(chart.span_min);
    }
  }

  // ── Readout under the chart (top-3 shortest at scrub time) ──────

  function priceAtMinute(series, minute) {
    // Walk the sorted points; return the last one at or before
    // the scrubbed minute (i.e. the market's known state at that
    // moment). Returns null if the runner hadn't been captured yet.
    var last = null;
    for (var i = 0; i < series.points.length; i++) {
      if (series.points[i].minute > minute) break;
      last = series.points[i];
    }
    return last;
  }

  // The clock is the course's: a time is written as it is in Britain,
  // as the page's own times are, whatever the reader's clock says.
  // (Without the zone data, the reader's clock.)
  var UK_CLOCK = null;
  try {
    UK_CLOCK = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', hourCycle: 'h23',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch (e) { UK_CLOCK = null; }

  function clockParts(d) {
    var out = { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds() };
    if (!UK_CLOCK) return out;
    UK_CLOCK.formatToParts(d).forEach(function (p) {
      if (p.type === 'hour') out.h = +p.value;
      else if (p.type === 'minute') out.m = +p.value;
      else if (p.type === 'second') out.s = +p.value;
    });
    return out;
  }

  function clockText(d) {
    var p = clockParts(d);
    return String(p.h).padStart(2, '0') + ':' + String(p.m).padStart(2, '0');
  }

  function fmtScrubTime(minute) {
    if (!chart.start_at) return '—';
    var start = new Date(chart.start_at);
    return clockText(new Date(start.getTime() + minute * 60 * 1000));
  }

  function aiAtMinute(series, minute) {
    // Same last-known-value walk as priceAtMinute but for AI %.
    if (!series.ai_points) return null;
    var last = null;
    for (var i = 0; i < series.ai_points.length; i++) {
      if (series.ai_points[i].minute > minute) break;
      last = series.ai_points[i];
    }
    return last;
  }

  function renderFocusedReadout(minute) {
    // T6 — focus mode. Show a single detailed card for the locked
    // runner at the scrubbed moment: number + name + market odds +
    // AI% + minutes-until-latest so the Cub can trace one horse
    // without the top-3 list flipping order under them.
    var focused = null;
    for (var i = 0; i < chart.series.length; i++) {
      if (chart.series[i].runner_id === focusedRunnerId) {
        focused = chart.series[i];
        break;
      }
    }
    if (!focused) {
      readList.innerHTML =
        '<span class="fx-tchart__readout-empty">Focused runner not on chart.</span>';
      return;
    }
    var pt = priceAtMinute(focused, minute);
    var ai = aiAtMinute(focused, minute);
    var oddsHtml = pt
      ? '<span class="fx-tchart__readout-odds fx-num">' + priceText(pt) + '</span>' +
        moveMark(moveOf(focused, pt))
      : '<span class="fx-tchart__readout-empty">no price</span>';
    var aiHtml = ai
      ? '<span class="fx-tchart__readout-ai fx-num">' +
        Math.round(ai.pct) + '%</span>'
      : '';
    var minsToLatest = Math.max(0, chart.span_min - minute);
    var fired = chart.markers.filter(function (m) {
      return m.runner_name === focused.horse_name && m.minute <= minute;
    }).length;
    var fromHtml = focused.points.length && pt && focused.points[0].minute < pt.minute
      ? '<span class="fx-tchart__readout-from fx-num">opened ' + priceText(focused.points[0]) + '</span>'
      : '';
    var firedHtml = fired
      ? '<span class="fx-tchart__readout-sig">' + fired + (fired === 1 ? ' signal' : ' signals') + '</span>'
      : '';
    readList.innerHTML = markerNote(minute) +
      '<span class="fx-tchart__readout-cell fx-tchart__readout-cell--focused ' +
        'fx-tchart__readout-cell--' + moveOf(focused, pt) + '" ' +
        'style="--hue: ' + focused.hue + '">' +
        '<span class="fx-tchart__readout-num fx-num">' + focused.number + '</span> ' +
        '<span class="fx-tchart__readout-name">' + focused.horse_name + '</span> ' +
        oddsHtml + ' ' + fromHtml + aiHtml + firedHtml +
        (minsToLatest
          ? '<span class="fx-tchart__readout-mins fx-num">' + spanText(minsToLatest) + ' before the latest</span>'
          : '') +
      '</span>';
  }

  function renderTopReadout(minute) {
    // Default mode: every runner with a price at this instant,
    // shortest first. It was the three shortest, which on a
    // four-runner race left one horse off for no reason a reader
    // could see; the list wraps for a big field.
    var snap = [];
    chart.series.forEach(function (s) {
      var pt = priceAtMinute(s, minute);
      if (pt) snap.push({ s: s, pt: pt });
    });
    snap.sort(function (a, b) { return a.pt.decimal - b.pt.decimal; });
    // A phone shows the front of the market and a button for the rest
    // (the stylesheet hides the others until the list is open).
    var more = snap.length > RING_SHOWN
      ? '<button type="button" class="fx-tchart__readout-more" data-readout-more>' +
        (readList.classList.contains('is-open') ? 'Show fewer' : 'Show all ' + snap.length) +
        '</button>'
      : '';
    readList.innerHTML = markerNote(minute) + snap.map(function (row, i) {
      var move = moveOf(row.s, row.pt);
      return '<span class="fx-tchart__readout-cell fx-tchart__readout-cell--' + move +
             (i === 0 ? ' fx-tchart__readout-cell--fav' : '') +
             '" style="--hue: ' + row.s.hue + '">' +
             '<span class="fx-tchart__readout-num fx-num">' + row.s.number + '</span> ' +
             '<span class="fx-tchart__readout-name">' + row.s.horse_name + '</span> ' +
             '<span class="fx-tchart__readout-odds fx-num">' + priceText(row.pt) + '</span>' +
             moveMark(move) +
             '</span>';
    }).join('') + more;
  }

  // The signals that fired at the scrubbed minute (within two), as a
  // note at the head of the ring. Not a span: a phone's stylesheet
  // counts the ring's spans to show the first three.
  var noteFor = null;   // the dot last pressed: { minute, idxs }
  function markerNote(minute) {
    var hits;
    if (noteFor && noteFor.minute === minute) {
      hits = noteFor.idxs.map(function (i) { return chart.markers[i]; }).filter(Boolean);
    } else {
      hits = chart.markers.filter(function (m) { return Math.abs(m.minute - minute) <= 2; });
    }
    if (!hits.length) return '';
    return '<small class="fx-tchart__readout-note">' + hits.map(function (m) {
      return '<span class="fx-tchart__readout-note-item fx-tchart__readout-note-item--' + m.tone + '">' +
        escapeHtml(m.detail) +
        (m.runner_name ? ' <span class="fx-tchart__readout-note-who">' + escapeHtml(m.runner_name) + '</span>' : '') +
        '</span>';
    }).join('') + '</small>';
  }

  function onScrub() {
    if (!scrub) return;
    var minute = parseInt(scrub.value, 10);
    if (isNaN(minute)) minute = chart.span_min;
    var x = xFor(minute);
    cursor.setAttribute('x1', x);
    cursor.setAttribute('x2', x);
    post.setAttribute('cx', x);
    figureEl.classList.toggle('fx-tchart--replaying', minute < chart.span_min);
    readTime.textContent = fmtScrubTime(minute);
    scrub.style.setProperty('--fxt-progress', (minute / Math.max(1, chart.span_min) * 100).toFixed(2) + '%');
    markersG.querySelectorAll('.fx-tchart__marker').forEach(function (g) {
      var from = parseInt(g.getAttribute('data-minute'), 10);
      var until = parseInt(g.getAttribute('data-until'), 10);
      if (isNaN(until)) until = from;
      g.classList.toggle('fx-tchart__marker--at', minute >= from - 2 && minute <= until + 2);
    });

    if (focusedRunnerId !== null) {
      renderFocusedReadout(minute);
    } else {
      renderTopReadout(minute);
    }
  }

  // ── The top-level render — idempotent, safe to call every poll ─

  // A redraw makes the ends, the facts and the flags anew: the one the
  // keyboard was on hands its focus to the one that replaces it.
  var REDRAWN = ['fx-tchart__end', 'fx-tchart__tile', 'fx-tchart__marker'];
  function heldFocus() {
    var el = document.activeElement;
    if (!el || !el.classList || !figureEl.contains(el)) return null;
    for (var i = 0; i < REDRAWN.length; i++) {
      if (el.classList.contains(REDRAWN[i])) {
        return { cls: REDRAWN[i], runner: el.getAttribute('data-runner-id'), minute: el.getAttribute('data-minute') };
      }
    }
    return null;
  }
  function giveFocusBack(held) {
    if (!held || figureEl.contains(document.activeElement)) return;
    var twin = Array.prototype.filter.call(figureEl.querySelectorAll('.' + held.cls), function (el) {
      return el.getAttribute('data-runner-id') === held.runner && el.getAttribute('data-minute') === held.minute;
    })[0];
    if (twin) twin.focus({ preventScroll: true });
  }

  function render(c) {
    chart = c;
    if (!chart || chart.empty || !chart.series || !chart.series.length) {
      return;
    }
    var held = heldFocus();
    recomputeBounds(chart);
    renderGrid();
    renderLines();
    renderAiAxis();
    renderMarkers();
    renderScrubber();
    renderTimes();
    renderEnds();
    renderStory();
    renderCaption();
    paintRunnerHues();
    paintRunnerPrices();
    paintSignalKinds();
    paintEdges();
    if (scrub && scrub.parentNode) {
      scrub.parentNode.setAttribute('data-start', fmtScrubTime(0));
      scrub.parentNode.setAttribute('data-end', fmtScrubTime(chart.span_min));
    }
    // T5 live-refresh replaces the SVG paths; if the user had a
    // runner locked (T6), re-apply the dim + highlight against the
    // freshly-drawn <path>s so their focus survives the redraw.
    if (focusedRunnerId !== null) {
      // If the focused runner has dropped off the chart (e.g.
      // scratched between polls), clear the lock so we don't leave
      // an empty spotlight.
      var stillHere = chart.series.some(function (s) {
        return s.runner_id === focusedRunnerId;
      });
      if (!stillHere) {
        focusedRunnerId = null;
        if (typeof syncLegendPressed === 'function') syncLegendPressed();
        if (typeof updateFocusHint === 'function') updateFocusHint();
      } else {
        applyDimTo(focusedRunnerId);
      }
    }
    onScrub();
    giveFocusBack(held);
  }

  // ── Wire up interactions (once — they read live `chart`) ────────

  if (scrub) scrub.addEventListener('input', onScrub);

  // A press on a marker takes the replay to its moment: the cursor,
  // the ring under the chart and the note of what fired there.
  function goToMinute(minute) {
    if (!scrub || isNaN(minute)) return;
    scrub.value = String(Math.max(0, Math.min(chart.span_min, minute)));
    scrub.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function pressMarker(g) {
    var minute = parseInt(g.getAttribute('data-minute'), 10);
    noteFor = {
      minute: minute,
      idxs: (g.getAttribute('data-marker') || '').split(' ').map(Number),
    };
    goToMinute(minute);
  }
  markersG.addEventListener('click', function (e) {
    var g = e.target.closest && e.target.closest('.fx-tchart__marker');
    if (!g) return;
    e.stopPropagation();
    pressMarker(g);
  });
  markersG.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var g = e.target.closest && e.target.closest('.fx-tchart__marker');
    if (!g) return;
    e.preventDefault();
    pressMarker(g);
  });

  // The signals rail on a phone: "Show all 13 signals". The button is
  // inside the rail, which the live refresh replaces, so the press is
  // caught on the document and the state kept on the rail's own box.
  function paintSignalsMore() {
    var rail = document.getElementById('fx-signal-rail');
    var btn = rail && rail.querySelector('[data-signals-more]');
    if (!btn) return;
    btn.textContent = btn.getAttribute(
      rail.classList.contains('is-open') ? 'data-hide' : 'data-show');
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('[data-signals-more]')) return;
    var rail = document.getElementById('fx-signal-rail');
    if (!rail) return;
    rail.classList.toggle('is-open');
    paintSignalsMore();
  });

  if (readList) {
    readList.addEventListener('click', function (e) {
      if (!e.target.closest || !e.target.closest('[data-readout-more]')) return;
      readList.classList.toggle('is-open');
      onScrub();
    });
  }

  if (aiToggle) {
    var showAI = false;
    aiToggle.addEventListener('click', function () {
      if (!hasAnyAI) return;
      showAI = !showAI;
      svg.classList.toggle('fx-tchart__svg--show-ai', showAI);
      stageEl.classList.toggle('fx-tchart__stage--ai', showAI);
      aiToggle.classList.toggle('fx-tchart__ai-toggle--on', showAI);
      aiToggle.setAttribute('aria-pressed', showAI ? 'true' : 'false');
    });
  }

  if (oddsToggle) {
    var paintOddsToggle = function () {
      oddsToggle.classList.toggle('fx-tchart__ai-toggle--on', showDecimal);
      oddsToggle.setAttribute('aria-pressed', showDecimal ? 'true' : 'false');
    };
    paintOddsToggle();
    oddsToggle.addEventListener('click', function () {
      showDecimal = !showDecimal;
      try { window.localStorage.setItem(ODDS_KEY, showDecimal ? 'decimal' : 'fractional'); }
      catch (e) { /* storage blocked: the choice lasts for this page */ }
      var held = heldFocus();
      paintOddsToggle();
      renderGrid();
      renderEnds();
      renderStory();
      onScrub();
      paintRunnerPrices();
      giveFocusBack(held);
    });
  }
  if (showDecimal) paintRunnerPrices();

  // ── Point at a line: that runner's price there ────────────────
  //
  // The tip and its dot are HTML over the stage, not SVG: the chart is
  // stretched to its box (preserveAspectRatio="none"), which would
  // squash a circle drawn inside it. They are placed by measuring the
  // chart's box, as the words beside it are.
  var stage = svg.parentNode;
  var tip = document.createElement('div');
  tip.className = 'fx-tchart__tip';
  tip.hidden = true;
  tip.setAttribute('role', 'status');
  var tipDot = document.createElement('span');
  tipDot.className = 'fx-tchart__tip-dot';
  tipDot.hidden = true;
  stage.appendChild(tipDot);
  stage.appendChild(tip);

  // How near the pointer must be to a line, in the chart's own units
  // (it is 260 tall), to count as pointing at it.
  var TIP_REACH = 26;
  var tipTimer = null;

  function hideTip() {
    tip.hidden = true;
    tipDot.hidden = true;
    stage.classList.remove('fx-tchart__stage--tip');
  }

  function span(cls, text) {
    var el = document.createElement('span');
    el.className = cls;
    el.textContent = text;
    return el;
  }

  // Where a runner's drawn line is at a minute: the line steps, so it
  // is at the last price set.
  function lineYAt(series, minute) {
    var pt = priceAtMinute(series, minute);
    return pt ? yFor(pt.decimal) : null;
  }

  function showTipAt(clientX, clientY) {
    if (!chart || !chart.series || !chart.series.length) return hideTip();
    var box = svg.getBoundingClientRect();
    if (!box.width || !box.height) return hideTip();
    var vx = (clientX - box.left) / box.width * VB_W;
    var vy = (clientY - box.top) / box.height * VB_H;
    var minute = (vx - PAD_L) / (VB_W - PAD_L - PAD_R) * minSpan;
    if (minute < 0 || minute > minSpan) return hideTip();

    // The nearest line under the pointer. With one runner in focus,
    // only that runner's line answers.
    var best = null;
    chart.series.forEach(function (s) {
      if (focusedRunnerId !== null && s.runner_id !== focusedRunnerId) return;
      var pt = priceAtMinute(s, minute);
      if (!pt) return;
      var y = lineYAt(s, minute);
      var gap = Math.abs(y - vy);
      if (!best || gap < best.gap) best = { s: s, pt: pt, y: y, gap: gap };
    });
    if (!best || best.gap > TIP_REACH) return hideTip();

    var leftPct = vx / VB_W * 100;
    var topPct = best.y / VB_H * 100;
    var hue = 'var(--mfr-gold)';

    tip.textContent = '';
    var head = span('fx-tchart__tip-name', best.s.number + ' ' + best.s.horse_name);
    head.style.borderLeftColor = hue;
    tip.appendChild(head);
    tip.appendChild(span('fx-tchart__tip-price', priceText(best.pt)));
    tip.appendChild(span('fx-tchart__tip-when',
      'at ' + fmtScrubTime(Math.round(minute)) +
      ' · since ' + fmtScrubTime(best.pt.minute)));

    // Placed in pixels of the chart's box (the stage holds more than
    // the chart), so the dot sits on the line.
    var stageBox = stageEl.getBoundingClientRect();
    var leftPx = (box.left - stageBox.left + vx / VB_W * box.width).toFixed(1) + 'px';
    var topPx = (box.top - stageBox.top + best.y / VB_H * box.height).toFixed(1) + 'px';
    tip.style.left = leftPx;
    tip.style.top = topPx;
    // Beside the pointer, on whichever side has the room; under the
    // line when the line is near the top.
    tip.classList.toggle('fx-tchart__tip--left', leftPct > 62);
    tip.classList.toggle('fx-tchart__tip--below', topPct < 34);
    tipDot.style.left = leftPx;
    tipDot.style.top = topPx;
    tipDot.style.background = hue;
    tip.hidden = false;
    tipDot.hidden = false;
    stage.classList.add('fx-tchart__stage--tip');
  }

  stage.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;      // a finger taps (below)
    showTipAt(e.clientX, e.clientY);
  });
  stage.addEventListener('pointerleave', function (e) {
    if (e.pointerType !== 'touch') hideTip();
  });
  // A finger cannot hover: a tap shows the tip, and it goes by itself.
  stage.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'touch') return;
    showTipAt(e.clientX, e.clientY);
    if (tipTimer) clearTimeout(tipTimer);
    tipTimer = setTimeout(hideTip, 3500);
  });

  // Legend interactions — delegated so a future slice that re-bakes
  // the legend on poll wouldn't lose bindings.
  //
  //   * Hover  → soft preview (dim others) IF nothing is locked
  //   * Click  → lock focus on this runner (or unlock if same)
  //   * Escape → unlock
  //
  // The dim class isn't just for hover any more: it's applied
  // whenever there's a lock, so the highlight persists after
  // pointer moves away.
  var legend = document.querySelector('.fx-tchart__legend');
  var focusHint = document.getElementById('fx-tchart-focus-hint');
  var focusHintName = document.getElementById('fx-tchart-focus-hint-name');

  function applyDimTo(id) {
    // ``id`` may be a number (from state) or a string (from DOM
    // attribute) — normalise for comparison.
    var target = id == null ? null : String(id);
    svg.classList.toggle('fx-tchart__svg--dim', target !== null);
    svg.querySelectorAll('.fx-tchart__line, .fx-tchart__ai-line')
       .forEach(function (p) {
         var mine = target !== null && p.getAttribute('data-runner-id') === target;
         p.classList.toggle('fx-tchart__line--hi', mine);
         // The followed line is drawn last, over the rest.
         if (mine && p.parentNode) p.parentNode.appendChild(p);
       });
    // T9 — carry the focus over to the sidebar. Value Edge rows and
    // signal items that carry a data-runner-id get the match/dim
    // treatment; race-level signals (no attribute) stay full-
    // brightness because they apply to every runner.
    applySidebarFocus('.fx-vedge__row',   target);
    applySidebarFocus('.fx-trace__signal', target);
    applySidebarFocus('.fx-trace__runner', target);
    endsEl.querySelectorAll('.fx-tchart__end').forEach(function (b) {
      var mine = target !== null && b.getAttribute('data-runner-id') === target;
      b.classList.toggle('fx-tchart__end--hi', mine);
      b.classList.toggle('fx-tchart__end--dim', target !== null && !mine);
    });
    endsG.querySelectorAll('.fx-tchart__end-line').forEach(function (p) {
      p.classList.toggle('fx-tchart__line--hi',
        target !== null && p.getAttribute('data-runner-id') === target);
    });
  }

  function applySidebarFocus(selector, target) {
    document.querySelectorAll(selector).forEach(function (el) {
      var attr = el.getAttribute('data-runner-id');
      if (target === null || attr == null) {
        // No focus, or race-level item — clear both modifiers so
        // nothing stays highlighted when the lock clears or a
        // race-level signal renders normally under any focus.
        el.classList.remove('fx-focus-match', 'fx-focus-dim');
        return;
      }
      var isMatch = attr === target;
      el.classList.toggle('fx-focus-match', isMatch);
      el.classList.toggle('fx-focus-dim',   !isMatch);
    });
  }

  function syncLegendPressed() {
    var target = focusedRunnerId === null ? null : String(focusedRunnerId);
    if (legend) {
      legend.querySelectorAll('.fx-tchart__legend-btn').forEach(function (b) {
        var isLocked = target !== null &&
          target === b.getAttribute('data-runner-id');
        b.setAttribute('aria-pressed', isLocked ? 'true' : 'false');
        var li = b.closest('.fx-tchart__legend-item');
        if (li) li.classList.toggle('fx-tchart__legend-item--locked', isLocked);
      });
    }
    endsEl.querySelectorAll('.fx-tchart__end').forEach(function (b) {
      b.setAttribute('aria-pressed',
        String(target !== null && target === b.getAttribute('data-runner-id')));
    });
    storyEl.querySelectorAll('.fx-tchart__tile[data-runner-id]').forEach(function (b) {
      b.setAttribute('aria-pressed',
        String(target !== null && target === b.getAttribute('data-runner-id')));
    });
    // R3 — podium chips share the T6 lock; mirror the pressed
    // state so clicking either chip lights both up.
    document.querySelectorAll('.fx-tchart__podium-chip').forEach(function (b) {
      var isLocked = target !== null &&
        target === b.getAttribute('data-runner-id');
      b.classList.toggle('fx-tchart__podium-chip--locked', isLocked);
    });
  }

  function updateFocusHint() {
    if (!focusHint) return;
    if (focusedRunnerId === null) {
      focusHint.setAttribute('hidden', 'hidden');
      return;
    }
    var focused = chart.series.find(function (s) {
      return s.runner_id === focusedRunnerId;
    });
    focusHint.removeAttribute('hidden');
    if (focusHintName && focused) {
      focusHintName.textContent =
        '#' + focused.number + ' ' + focused.horse_name;
    }
  }

  function setFocus(id) {
    focusedRunnerId = id;
    figureEl.classList.toggle('fx-tchart--following', id !== null);
    render(chart);   // a followed outsider joins the chart, and the scale
    applyDimTo(id);
    syncLegendPressed();
    updateFocusHint();
  }

  if (legend) {
    legend.addEventListener('click', function (ev) {
      var btn = ev.target.closest && ev.target.closest('.fx-tchart__legend-btn');
      if (!btn) return;
      var raw = btn.getAttribute('data-runner-id');
      var id = raw ? parseInt(raw, 10) : null;
      if (id === null || isNaN(id)) return;
      // Toggle — a second click on the same chip unlocks.
      setFocus(focusedRunnerId === id ? null : id);
    });
    legend.addEventListener('mouseover', function (ev) {
      if (focusedRunnerId !== null) return;   // lock wins over hover
      var btn = ev.target.closest && ev.target.closest('.fx-tchart__legend-btn');
      if (!btn) return;
      applyDimTo(btn.getAttribute('data-runner-id'));
    });
    legend.addEventListener('mouseout', function (ev) {
      if (focusedRunnerId !== null) return;
      var btn = ev.target.closest && ev.target.closest('.fx-tchart__legend-btn');
      if (!btn) return;
      applyDimTo(null);
    });
  }

  // A tile follows its runner, or replays its signal's moment.
  storyEl.addEventListener('click', function (ev) {
    var t = ev.target.closest && ev.target.closest('.fx-tchart__tile');
    if (!t) return;
    if (t.hasAttribute('data-minute')) { pressMarker(t); return; }
    var id = parseInt(t.getAttribute('data-runner-id'), 10);
    if (!isNaN(id)) setFocus(focusedRunnerId === id ? null : id);
  });

  // The ends follow a runner as the legend's chips do.
  endsEl.addEventListener('click', function (ev) {
    var btn = ev.target.closest && ev.target.closest('.fx-tchart__end');
    if (!btn) return;
    var id = parseInt(btn.getAttribute('data-runner-id'), 10);
    if (isNaN(id)) return;
    setFocus(focusedRunnerId === id ? null : id);
  });
  endsEl.addEventListener('mouseover', function (ev) {
    if (focusedRunnerId !== null) return;
    var btn = ev.target.closest && ev.target.closest('.fx-tchart__end');
    if (btn) applyDimTo(btn.getAttribute('data-runner-id'));
  });
  endsEl.addEventListener('mouseout', function (ev) {
    if (focusedRunnerId !== null) return;
    var btn = ev.target.closest && ev.target.closest('.fx-tchart__end');
    if (btn) applyDimTo(null);
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && focusedRunnerId !== null) {
      setFocus(null);
    }
  });

  // ── R3 podium chip strip — click-to-focus for placed runners ────
  //
  // Only rendered on replay pages. Reuses T6 setFocus so the
  // podium chip and the legend chip behave identically — click
  // once to lock, again to unlock.
  var podium = document.querySelector('.fx-tchart__podium');
  if (podium) {
    podium.addEventListener('click', function (ev) {
      var chip = ev.target.closest &&
                 ev.target.closest('.fx-tchart__podium-chip');
      if (!chip) return;
      var raw = chip.getAttribute('data-runner-id');
      var id = raw ? parseInt(raw, 10) : null;
      if (id === null || isNaN(id)) return;
      setFocus(focusedRunnerId === id ? null : id);
    });
  }

  // ── Initial paint ───────────────────────────────────────────────

  render(initial);

  // The box changes (the window, a turned phone): the words beside
  // the chart move with it.
  if (window.ResizeObserver) {
    new ResizeObserver(function () { placeOverlays(); }).observe(svg);
  } else {
    window.addEventListener('resize', placeOverlays);
  }

  // ── T13 permalink — apply ?at= scrub position + URL sync ───────

  // Two-way sync between scrubber and URL:
  //   * On init, the server (or an existing bookmarked URL) may
  //     have set data-initial-scrub. Apply it, then trigger
  //     onScrub() so cursor + readout follow.
  //   * On every scrub input, replaceState with ?at=HH:MM so the
  //     current URL always represents the current view — no
  //     history spam (each drag lands as one entry).
  function fmtAtParam(minute) {
    if (!chart.start_at) return null;
    var start = new Date(chart.start_at);
    return clockText(new Date(start.getTime() + minute * 60 * 1000));
  }

  function syncUrlToScrub() {
    if (!scrub || !window.history || !window.history.replaceState) return;
    var minute = parseInt(scrub.value, 10);
    if (isNaN(minute)) return;
    // If we're back at the latest tick, drop the param entirely —
    // the canonical "live view" URL has no ?at=.
    var atMax = minute >= chart.span_min;
    var url = new URL(window.location.href);
    if (atMax) {
      url.searchParams.delete('at');
    } else {
      var stamp = fmtAtParam(minute);
      if (!stamp) return;
      url.searchParams.set('at', stamp);
    }
    window.history.replaceState({}, '', url.toString());
  }

  if (scrub && initialScrubAttr !== null) {
    var initMin = parseInt(initialScrubAttr, 10);
    if (!isNaN(initMin)) {
      // Clamp to the current bounds — the server already validated
      // but the timeline could have grown between page render and
      // client-side hydration.
      if (initMin < 0) initMin = 0;
      if (initMin > chart.span_min) initMin = chart.span_min;
      scrub.value = String(initMin);
      onScrub();
    }
  }

  if (scrub) {
    scrub.addEventListener('input', syncUrlToScrub);
  }

  // Copy-link chip — copy the current URL (which reflects the
  // scrubbed moment) and flash a brief "Copied" acknowledgement.
  if (copyBtn) {
    var copyLabel = copyBtn.querySelector('.fx-tchart__copy-label');
    var originalLabel = copyLabel ? copyLabel.textContent : 'Copy link';
    var copiedLabel = copyBtn.getAttribute('data-copied-label') || 'Copied';
    copyBtn.addEventListener('click', function () {
      // Ensure the URL is up-to-date with the current scrub value
      // before we snapshot it — the user might have clicked Copy
      // without moving the slider since page load.
      syncUrlToScrub();
      var href = window.location.href;
      var done = function () {
        copyBtn.classList.add('fx-tchart__copy--copied');
        if (copyLabel) copyLabel.textContent = copiedLabel;
        setTimeout(function () {
          copyBtn.classList.remove('fx-tchart__copy--copied');
          if (copyLabel) copyLabel.textContent = originalLabel;
        }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(href).then(done, done);
      } else {
        // Fallback for older browsers: temp textarea + execCommand.
        var ta = document.createElement('textarea');
        ta.value = href;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
        done();
      }
    });
  }

  // ── T5 live-refresh loop ────────────────────────────────────────

  function setPill(status) {
    if (livePill) livePill.setAttribute('data-status', status);
  }

  function updateAgeLabel() {
    if (!liveAge) return;
    var seconds = Math.floor((Date.now() - lastFetchAt) / 1000);
    if (seconds < 60) {
      liveAge.textContent = seconds + 's';
    } else {
      liveAge.textContent = Math.floor(seconds / 60) + 'm';
    }
  }

  var pollIntervalId = null;

  function stopPollingForReplay() {
    // R1 — kill the poll loop and freeze the freshness pill into a
    // "settled" state. Called when the server tells us the race is
    // done (either on first render via data-is-replay, or when a
    // live race settles mid-session and the next poll flips it).
    if (pollIntervalId !== null) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
    isReplay = true;
    setPill('settled');
    if (liveAge) liveAge.textContent = 'done';
  }

  function poll() {
    if (paused || !liveUrl || isReplay) return;
    fetch(liveUrl, {
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin',
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.timeline) {
          setPill('stale');
          return;
        }
        lastFetchAt = Date.now();
        setPill(paused ? 'paused' : 'live');
        render(data.timeline);
        // T10 — runners table refresh (odds cell, sparkline, tick
        // count). Payload may be absent on older endpoints, so
        // guard against undefined.
        if (data.runners) renderRunnersTable(data.runners);
        // T11 — Value Edge + signals rail refresh via HTML
        // fragments. Same partials as the initial page render,
        // so no drift. `applyDimTo` reruns after each swap to
        // re-apply the T9 focus lock to the freshly-inserted DOM.
        // T12 adds the events rail on the same primitive.
        if (typeof data.value_edges_html === 'string') {
          swapSidebar('fx-vedge-container', data.value_edges_html);
        }
        if (typeof data.signals_html === 'string') {
          swapSidebar('fx-signal-rail', data.signals_html);
          paintSignalsMore();
        }
        if (typeof data.events_html === 'string') {
          swapSidebar('fx-event-rail', data.events_html);
        }
        if (data.value_edges_html || data.signals_html ||
            data.events_html) {
          paintRunnerHues();
          paintSignalKinds();
          paintEdges();
          applyDimTo(focusedRunnerId);   // preserve T9 lock
        }
        // R1 — race just settled? Freeze the poll loop.
        if (data.is_replay) stopPollingForReplay();
      })
      .catch(function () {
        setPill('stale');
      });
  }

  // T11 — swap an ID-anchored container's inner HTML in place.
  // Kept out of the poll body so both call sites read cleanly and
  // future slices can hang more sidebar refreshes off the same
  // primitive without duplicating the boilerplate.
  function swapSidebar(containerId, html) {
    var el = document.getElementById(containerId);
    if (!el) return;
    // Only touch the DOM when the content actually changed —
    // otherwise every 60s the sidebar re-renders identical markup
    // and any :hover state or open <details> disclosure resets.
    if (el.innerHTML === html) return;
    el.innerHTML = html;
  }

  // ── T10 runners table in-place refresh ──────────────────────────

  // A tiny sparkline path builder mirroring the server-side
  // _spark_path helper. Kept here so the poll can rebuild the
  // sparkline SVG without pulling more markup off the wire.
  var SPARK_W = 100;
  var SPARK_H = 24;
  var SPARK_PAD = 2;

  // The latest price, and the first one if the runner had no price
  // when the page was drawn. Both keep the fractional price on the
  // cell (data-frac) and are printed in the chosen format.
  function updateOddsCell(row, newOdds, openingOdds) {
    var cell = row.querySelector('[data-cell="odds"]');
    if (!cell) return false;
    var opened = row.querySelector('[data-cell="opened"]');
    if (opened && openingOdds && !opened.getAttribute('data-frac')) {
      opened.setAttribute('data-frac', openingOdds);
    }
    var next = newOdds || '';
    var changed = (cell.getAttribute('data-frac') || '') !== next;
    cell.setAttribute('data-frac', next);
    paintRunnerPrices(row.parentNode);
    return changed;
  }

  function updateTicksCell(row, newCount) {
    var cell = row.querySelector('[data-cell="ticks"]');
    if (!cell) return false;
    var current = (cell.textContent || '').trim();
    var next = newCount ? String(newCount) : '—';
    if (current === next) return false;
    cell.textContent = next;
    return true;
  }

  function updateSparkCell(row, path, trend) {
    var cell = row.querySelector('[data-cell="spark"]');
    if (!cell) return false;
    var existing = cell.querySelector('svg');
    var existingPath = existing
      ? existing.querySelector('polyline').getAttribute('points')
      : '';
    var newPath = path || '';
    var newTrend = trend || 'flat';
    // Same path + same trend → nothing to touch.
    if (existing && existingPath === newPath &&
        existing.classList.contains('fx-trace__spark--' + newTrend)) {
      return false;
    }
    // Rebuild the cell: clear + insert either an SVG or the empty
    // dot fallback (mirrors _runner_sparkline.html partial).
    while (cell.firstChild) cell.removeChild(cell.firstChild);
    if (!newPath) {
      var dot = document.createElement('span');
      dot.className = 'fx-trace__spark-empty';
      dot.setAttribute('aria-hidden', 'true');
      dot.textContent = '·';
      cell.appendChild(dot);
      return true;
    }
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'fx-trace__spark fx-trace__spark--' + newTrend);
    svg.setAttribute('viewBox', '0 0 ' + SPARK_W + ' ' + SPARK_H);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Price sparkline, trend ' + newTrend);
    var line = document.createElementNS(SVG_NS, 'polyline');
    line.setAttribute('class', 'fx-trace__spark-line');
    line.setAttribute('points', newPath);
    svg.appendChild(line);
    cell.appendChild(svg);
    return true;
  }

  function flashRow(row) {
    row.classList.remove('fx-trace__runner--flashed');
    // Force reflow so the animation re-triggers on repeated updates.
    void row.offsetWidth;
    row.classList.add('fx-trace__runner--flashed');
  }

  function renderRunnersTable(runners) {
    if (!runners || !runners.length) return;
    var rowsById = {};
    document.querySelectorAll('.fx-trace__runner').forEach(function (row) {
      var id = row.getAttribute('data-runner-id');
      if (id) rowsById[id] = row;
    });
    runners.forEach(function (r) {
      var row = rowsById[String(r.runner_id)];
      if (!row) return;
      var changed = false;
      if (updateOddsCell(row, r.latest_odds, r.opening_odds))                     changed = true;
      if (updateTicksCell(row, r.snapshot_count))                 changed = true;
      if (updateSparkCell(row, r.sparkline_path, r.trend))        changed = true;
      if (changed) flashRow(row);
    });
  }

  if (livePause) {
    livePause.addEventListener('click', function () {
      paused = !paused;
      setPill(paused ? 'paused' : 'live');
      livePause.textContent = paused ? '►' : '‖';
      livePause.setAttribute('aria-label',
        paused ? 'Resume live updates' : 'Pause live updates');
    });
  }

  // Kick off. AGE_TICK_MS keeps the "Xs ago" number honest between
  // polls; poll() itself is on POLL_MS.
  if (liveUrl) {
    setInterval(updateAgeLabel, AGE_TICK_MS);
    if (isReplay) {
      // R1 — server told us the race is already settled on first
      // render. Skip starting the poll loop entirely; freeze the
      // pill into its settled state.
      setPill('settled');
      if (liveAge) liveAge.textContent = 'done';
    } else {
      pollIntervalId = setInterval(poll, POLL_MS);
      setPill('live');
      updateAgeLabel();
    }
  }
})();
