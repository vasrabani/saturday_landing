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

  // ── Layout constants ────────────────────────────────────────────

  // The chart's own grid. A phone draws it 500 wide: the same height
  // then stands twice as tall on the screen, and the axis labels are
  // twice the size.
  var VB_W = 1000;
  var VB_H = 260;
  var narrow = window.matchMedia ? window.matchMedia('(max-width: 720px)') : null;
  function sizeGrid() {
    VB_W = (narrow && narrow.matches) ? 500 : 1000;
    svg.setAttribute('viewBox', '0 0 ' + VB_W + ' ' + VB_H);
  }
  sizeGrid();
  if (narrow && narrow.addEventListener) {
    // Turned, or the window dragged across the width: draw it again.
    narrow.addEventListener('change', function () {
      sizeGrid();
      if (chart) { render(chart); onScrub(); }
    });
  }
  var PAD_L = 44;
  var PAD_R = 40;    // room for the right-side AI% axis
  var PAD_T = 12;
  var PAD_B = 32;

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
    pMin = c.price_min;
    pMax = c.price_max;
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
    gridTicks().forEach(function (tick) {
      var yv = yFor(tick.dec);

      var line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', PAD_L);
      line.setAttribute('x2', VB_W - PAD_R);
      line.setAttribute('y1', yv);
      line.setAttribute('y2', yv);
      line.setAttribute('class', 'fx-tchart__gridline');
      gridG.appendChild(line);

      var lab = document.createElementNS(SVG_NS, 'text');
      lab.setAttribute('x', PAD_L - 6);
      lab.setAttribute('y', yv + 4);
      lab.setAttribute('class', 'fx-tchart__gridlabel');
      lab.setAttribute('text-anchor', 'end');
      lab.textContent = tick.text;
      gridG.appendChild(lab);
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
        var d = '';
        s.points.forEach(function (p, idx) {
          var cmd = idx === 0 ? 'M' : 'L';
          d += cmd + xFor(p.minute).toFixed(2) + ',' +
                     yFor(p.decimal).toFixed(2) + ' ';
        });
        var path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        var lineCls = 'fx-tchart__line';
        if (s.finish_position) {
          lineCls += ' fx-tchart__line--pos-' + s.finish_position;
        }
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
    if (!hasAnyAI) {
      if (aiToggle) aiToggle.setAttribute('hidden', 'hidden');
      return;
    }
    if (aiToggle) aiToggle.removeAttribute('hidden');
    [0, 25, 50, 75, 100].forEach(function (pct) {
      var yv = yForAI(pct);
      var lab = document.createElementNS(SVG_NS, 'text');
      lab.setAttribute('x', VB_W - PAD_R + 6);
      lab.setAttribute('y', yv + 4);
      lab.setAttribute('class', 'fx-tchart__ai-axislabel');
      lab.setAttribute('text-anchor', 'start');
      lab.textContent = pct + '%';
      aiAxisG.appendChild(lab);
    });
  }

  function renderMarkers() {
    clearG(markersG);
    chart.markers.forEach(function (m) {
      var x = xFor(m.minute);
      var g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'fx-tchart__marker fx-tchart__marker--' + m.tone);
      g.setAttribute('transform', 'translate(' + x.toFixed(2) + ',0)');
      var line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', 0);
      line.setAttribute('x2', 0);
      line.setAttribute('y1', PAD_T);
      line.setAttribute('y2', VB_H - PAD_B);
      line.setAttribute('class', 'fx-tchart__marker-line');
      g.appendChild(line);
      var dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('cx', 0);
      dot.setAttribute('cy', VB_H - PAD_B);
      dot.setAttribute('r', 4);
      dot.setAttribute('class', 'fx-tchart__marker-dot');
      g.appendChild(dot);
      var title = document.createElementNS(SVG_NS, 'title');
      var who = m.runner_name ? ' · ' + m.runner_name : '';
      title.textContent = m.label + who + ' — ' + m.detail;
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

  function fmtScrubTime(minute) {
    if (!chart.start_at) return '—';
    var start = new Date(chart.start_at);
    var d = new Date(start.getTime() + minute * 60 * 1000);
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
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
      ? '<span class="fx-tchart__readout-odds fx-num">' + priceText(pt) + '</span>'
      : '<span class="fx-tchart__readout-empty">no price</span>';
    var aiHtml = ai
      ? '<span class="fx-tchart__readout-ai fx-num">' +
        Math.round(ai.pct) + '%</span>'
      : '';
    var minsToLatest = Math.max(0, chart.span_min - minute);
    readList.innerHTML =
      '<span class="fx-tchart__readout-cell fx-tchart__readout-cell--focused" ' +
        'style="--hue: ' + focused.hue + '">' +
        '<span class="fx-tchart__readout-num fx-num">' + focused.number + '</span> ' +
        '<span class="fx-tchart__readout-name">' + focused.horse_name + '</span> ' +
        oddsHtml + ' ' + aiHtml +
        '<span class="fx-tchart__readout-mins fx-num">' +
          '-' + minsToLatest + 'm' +
        '</span>' +
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
    // A phone shows the three shortest and a button for the rest
    // (the stylesheet hides the others until the list is open).
    var more = snap.length > 3
      ? '<button type="button" class="fx-tchart__readout-more" data-readout-more>' +
        (readList.classList.contains('is-open') ? 'Show fewer' : 'Show all ' + snap.length) +
        '</button>'
      : '';
    readList.innerHTML = snap.map(function (row) {
      return '<span class="fx-tchart__readout-cell" style="--hue: ' + row.s.hue + '">' +
             '<span class="fx-tchart__readout-num fx-num">' + row.s.number + '</span> ' +
             '<span class="fx-tchart__readout-name">' + row.s.horse_name + '</span> ' +
             '<span class="fx-tchart__readout-odds fx-num">' + priceText(row.pt) + '</span>' +
             '</span>';
    }).join('') + more;
  }

  function onScrub() {
    if (!scrub) return;
    var minute = parseInt(scrub.value, 10);
    if (isNaN(minute)) minute = chart.span_min;
    var x = xFor(minute);
    cursor.setAttribute('x1', x);
    cursor.setAttribute('x2', x);
    readTime.textContent = fmtScrubTime(minute);

    if (focusedRunnerId !== null) {
      renderFocusedReadout(minute);
    } else {
      renderTopReadout(minute);
    }
  }

  // ── The top-level render — idempotent, safe to call every poll ─

  function render(c) {
    chart = c;
    if (!chart || chart.empty || !chart.series || !chart.series.length) {
      return;
    }
    recomputeBounds(chart);
    renderGrid();
    renderLines();
    renderAiAxis();
    renderMarkers();
    renderScrubber();
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
  }

  // ── Wire up interactions (once — they read live `chart`) ────────

  if (scrub) scrub.addEventListener('input', onScrub);

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
      paintOddsToggle();
      renderGrid();
      onScrub();
      paintRunnerPrices();
    });
  }
  if (showDecimal) paintRunnerPrices();

  // ── Point at a line: that runner's price there ────────────────
  //
  // The tip and its dot are HTML over the stage, not SVG: the chart is
  // stretched to its box (preserveAspectRatio="none"), which would
  // squash a circle drawn inside it. They are placed in percentages of
  // the stage, so they stay on the line when the chart resizes.
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

  // Where a runner's drawn line is at a minute. The line runs
  // straight from one captured price to the next, so between two
  // captures it is on neither price: the dot follows the line, and
  // the tip gives the last price captured.
  function lineYAt(series, minute) {
    var before = null, after = null;
    for (var i = 0; i < series.points.length; i++) {
      if (series.points[i].minute > minute) { after = series.points[i]; break; }
      before = series.points[i];
    }
    if (!before) return null;
    var y0 = yFor(before.decimal);
    if (!after || after.minute === before.minute) return y0;
    var t = (minute - before.minute) / (after.minute - before.minute);
    return y0 + t * (yFor(after.decimal) - y0);
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
    var hue = 'hsl(' + best.s.hue + ' 72% 40%)';

    tip.textContent = '';
    var head = span('fx-tchart__tip-name', best.s.number + ' ' + best.s.horse_name);
    head.style.borderLeftColor = hue;
    tip.appendChild(head);
    tip.appendChild(span('fx-tchart__tip-price', priceText(best.pt)));
    tip.appendChild(span('fx-tchart__tip-when',
      'at ' + fmtScrubTime(Math.round(minute)) +
      ' · since ' + fmtScrubTime(best.pt.minute)));

    tip.style.left = leftPct + '%';
    tip.style.top = topPct + '%';
    // Beside the pointer, on whichever side has the room; under the
    // line when the line is near the top.
    tip.classList.toggle('fx-tchart__tip--left', leftPct > 62);
    tip.classList.toggle('fx-tchart__tip--below', topPct < 34);
    tipDot.style.left = leftPct + '%';
    tipDot.style.top = topPct + '%';
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
         p.classList.toggle('fx-tchart__line--hi',
           target !== null && p.getAttribute('data-runner-id') === target);
       });
    // T9 — carry the focus over to the sidebar. Value Edge rows and
    // signal items that carry a data-runner-id get the match/dim
    // treatment; race-level signals (no attribute) stay full-
    // brightness because they apply to every runner.
    applySidebarFocus('.fx-vedge__row',   target);
    applySidebarFocus('.fx-trace__signal', target);
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
    applyDimTo(id);
    syncLegendPressed();
    updateFocusHint();
    onScrub();  // switch readout mode
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
    var d = new Date(start.getTime() + minute * 60 * 1000);
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
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
