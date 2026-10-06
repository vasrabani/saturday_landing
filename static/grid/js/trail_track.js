/* trail_track.js — the racecourse under the race cards.
 *
 * The stylesheet lays the cards out as a snake: along, back, and on,
 * at whatever column count the board has room for. This file draws the
 * course they stand on, from where the cards actually are:
 *
 *   - one band of turf per row, joined to the next at the bend, with
 *     the running rail around the whole of it;
 *   - a start line and the START sign at the first race, and the
 *     winning post after the last;
 *   - a trail of hoof prints along the running line, gold as far as
 *     the fox marker has come, so the day's progress shows on the
 *     course itself.
 *
 * Markup: the .trail__track block in trail.html, a layer behind the
 * grid. It carries the parts and their words; this file gives them
 * their geometry. Colours, textures and sizes are the stylesheet's.
 *
 * It reads the board and never touches it: nothing is added inside
 * #trailGrid. The live poller moves the fox marker and settles races
 * by swapping classes on the cells; a MutationObserver sees that and
 * the course is drawn again. No cross-file coupling.
 *
 * Zero deps, progressive enhancement: if a hook is missing the cards
 * simply sit on the lawn.
 */
(function () {
  'use strict';

  var grid  = document.getElementById('trailGrid');
  var track = document.querySelector('[data-role="track"]');
  if (!grid || !track) return;

  var part = function (role) { return track.querySelector('[data-role="track-' + role + '"]'); };
  var rails     = part('rails');
  var turf      = part('turf');
  var hoofs     = part('hoofs');
  var startLine = part('start-line');
  var startSign = part('start');
  var post      = part('post');
  var postLabel = part('post-label');
  if (!rails || !turf || !hoofs) return;

  var STATES = ['pending', 'live', 'won', 'placed', 'lost', 'void', 'no_fancy'];

  var SAME_ROW_PX   = 2;    // cards whose tops are this close share a row
  var STRIDE_PX     = 7;    // prints step either side of the running line...
  var GAIT_PX       = 9;    // ...and wider round a bend
  var LONG_BEND_PX  = 70;   // a bend this deep takes three prints, not two
  var MIN_BEND_PX   = 4;    // below this the gap between rows is too thin to round
  var LINE_INSET_PX = 2;    // the start line stops this short of each rail...
  var POST_INSET_PX = 5;    // ...and the winning post this short
  var REDRAW_MS     = 120;

  /* ── Reading the board ─────────────────────────────────────── */

  /* The cards that are races. A short row may be padded out with empty
   * seats (.cell--ghost), which the stylesheet hides: the track stops
   * at the last race. */
  function raceCards() {
    return Array.prototype.slice.call(grid.querySelectorAll('.cell[data-race-id]:not(.cell--ghost)'));
  }

  /* Where a card is laid out, in the track layer's own coordinates.
   * offset* is used rather than getBoundingClientRect because it
   * ignores transforms: a card lifted by the pointer, or still on its
   * way up onto the track, is drawn where it belongs. */
  function boxOf(card, origin) {
    var x = 0;
    var y = 0;
    for (var el = card; el && el !== origin.parent; el = el.offsetParent) {
      x += el.offsetLeft;
      y += el.offsetTop;
    }
    x -= origin.left;
    y -= origin.top;
    return { l: x, t: y, r: x + card.offsetWidth, b: y + card.offsetHeight };
  }

  /* Rows of the snake, each with the band of track that wraps it. */
  function rowsOf(boxes, band) {
    var rows = [];
    boxes.forEach(function (box) {
      var row = rows[rows.length - 1];
      if (!row || Math.abs(row.t - box.t) > SAME_ROW_PX) {
        row = { t: box.t, items: [] };
        rows.push(row);
      }
      row.items.push(box);
    });
    rows.forEach(function (row, k) {
      var first = row.items[0];
      var last  = row.items[row.items.length - 1];
      row.x1 = Math.min(first.l, last.l) - band;
      row.x2 = Math.max(first.r, last.r) + band;
      row.y1 = row.t - band;
      row.y2 = Math.max.apply(null, row.items.map(function (box) { return box.b; })) + band;
      // A single-file row has no direction of its own: it alternates.
      row.dir = row.items.length > 1 ? (first.l < last.l ? 1 : -1) : (k % 2 ? -1 : 1);
    });
    return rows;
  }

  /* How far the fox marker has come: the races before it are run; with
   * no marker on the board the day is over and all of them are. */
  function racesRun(cards) {
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].classList.contains('cell--now')) return i;
    }
    return cards.length;
  }

  /* ── Geometry ──────────────────────────────────────────────── */

  /* Every shape is one closed sub-path of a single path. The row bands
   * and the joins overlap each other, which a non-zero fill treats as
   * a union as long as they wind the same way; these all run clockwise. */
  function roundedRect(x1, y1, x2, y2, radius) {
    var r = Math.max(0, Math.min(radius, (x2 - x1) / 2, (y2 - y1) / 2));
    var arc = 'A' + r + ' ' + r + ' 0 0 1 ';
    return 'M' + (x1 + r) + ' ' + y1 +
      'H' + (x2 - r) + arc + x2 + ' ' + (y1 + r) +
      'V' + (y2 - r) + arc + (x2 - r) + ' ' + y2 +
      'H' + (x1 + r) + arc + x1 + ' ' + (y2 - r) +
      'V' + (y1 + r) + arc + (x1 + r) + ' ' + y1 + 'Z';
  }

  /* The inside of a bend. Where a join meets the strip of lawn between
   * two rows the corner would be square; this fills it so the rail
   * comes round in a curve. `corner` is the square corner, `towards`
   * the two unit directions the lawn lies in from there. It only
   * touches its neighbours, so its winding does not matter. */
  function fillet(corner, towards, r) {
    var along = corner.x + towards.x * r;
    var down  = corner.y + towards.y * r;
    var sweep = towards.x * towards.y > 0 ? 0 : 1;
    return 'M' + corner.x + ' ' + corner.y +
      'H' + along +
      'A' + r + ' ' + r + ' 0 0 ' + sweep + ' ' + corner.x + ' ' + down + 'Z';
  }

  /* The join from the end of one row down to the start of the next,
   * with the two fillets that round its inner corners. */
  function joinOf(above, below, band, radius) {
    var a = above.items[above.items.length - 1];
    var b = below.items[0];
    var x1 = Math.min(a.l, b.l) - band;
    var x2 = Math.max(a.r, b.r) + band;
    var d = roundedRect(x1, above.y1, x2, below.y2, radius);

    var gapTop = above.y2;
    var gapBottom = below.y1;
    var r = (gapBottom - gapTop) / 2;
    if (r < MIN_BEND_PX) return d;

    // The rows run on from the join towards `side`; the lawn between
    // them starts at the join's edge on that side.
    var side = above.dir > 0 ? -1 : 1;
    var edge = side < 0 ? x1 : x2;
    var reaches = function (row) { return side < 0 ? row.x1 < edge - r : row.x2 > edge + r; };
    if (reaches(above)) d += fillet({ x: edge, y: gapTop }, { x: side, y: 1 }, r);
    if (reaches(below)) d += fillet({ x: edge, y: gapBottom }, { x: side, y: -1 }, r);
    return d;
  }

  function courseOutline(rows, band, radius) {
    var d = '';
    rows.forEach(function (row, k) {
      d += roundedRect(row.x1, row.y1, row.x2, row.y2, radius);
      if (k < rows.length - 1) d += joinOf(row, rows[k + 1], band, radius);
    });
    return d;
  }

  /* ── Hoof prints ───────────────────────────────────────────── */

  /* One print in the gap between each race and the next, stepping
   * either side of the running line, and two or three round each bend. */
  function hoofPrints(rows, run) {
    var prints = [];
    var passed = 0;
    rows.forEach(function (row, k) {
      var items = row.items;
      for (var i = 0; i + 1 < items.length; i++) {
        var a = items[i];
        var b = items[i + 1];
        var race = passed + i;                         // the gap after this race
        prints.push({
          x: (Math.min(a.r, b.r) + Math.max(a.l, b.l)) / 2,
          y: (a.t + a.b) / 2 + (race % 2 ? STRIDE_PX : -STRIDE_PX),
          run: race < run,
        });
      }
      passed += items.length;
      if (k === rows.length - 1) return;

      var last = items[items.length - 1];
      var next = rows[k + 1].items[0];
      var centre = (Math.max(last.l, next.l) + Math.min(last.r, next.r)) / 2;
      var gap = next.t - last.b;
      var count = gap >= LONG_BEND_PX ? 3 : 2;
      for (var step = 0; step < count; step++) {
        prints.push({
          x: centre + (step % 2 ? GAIT_PX : -GAIT_PX),
          y: last.b + gap * (step + 0.5) / count,
          run: passed <= run,
        });
      }
    });
    return prints;
  }

  function paintHoofPrints(prints) {
    var fragment = document.createDocumentFragment();
    prints.forEach(function (print) {
      var el = document.createElement('i');
      el.className = 'track__hoof' + (print.run ? ' is-run' : '');
      el.style.left = print.x + 'px';
      el.style.top = print.y + 'px';
      fragment.appendChild(el);
    });
    hoofs.textContent = '';
    hoofs.appendChild(fragment);
  }

  /* ── Start and finish ──────────────────────────────────────── */

  function place(el, left, top) {
    if (!el) return;
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  function placeStart(rows, boxes, band) {
    var row = rows[0];
    var first = boxes[0];
    if (startLine) {
      place(startLine, row.dir > 0 ? first.l - band / 2 : first.r + band / 2, row.y1 + LINE_INSET_PX);
      startLine.style.height = (row.y2 - row.y1 - 2 * LINE_INSET_PX) + 'px';
    }
    // The sign hangs on the rail over the first card; the stylesheet
    // lifts it clear by its own height.
    place(startSign, first.l, first.t);
  }

  function placePost(rows, band, square) {
    var row = rows[rows.length - 1];
    var end = row.items[row.items.length - 1];
    if (post) {
      // A whole number of the chequer's squares, centred across the track.
      var across = row.y2 - row.y1 - 2 * POST_INSET_PX;
      var height = square ? Math.floor(across / square) * square : across;
      place(post, row.dir > 0 ? end.r + band / 2 : end.l - band / 2, (row.y1 + row.y2 - height) / 2);
      post.style.height = height + 'px';
    }
    if (postLabel) {
      place(postLabel, row.dir > 0 ? row.x2 : row.x1, row.y2);
      postLabel.classList.toggle('track__post-label--end', row.dir > 0);
    }
  }

  /* ── Drawing ───────────────────────────────────────────────── */

  function draw() {
    var cards = raceCards();
    if (!cards.length || !grid.offsetWidth) {
      track.classList.remove('is-drawn');
      return;
    }

    // Read everything first, then write: one layout, not one per card.
    var styles = getComputedStyle(track);
    var band = parseFloat(styles.getPropertyValue('--trail-track-band')) || 0;
    var radius = band + (parseFloat(getComputedStyle(cards[0]).borderTopLeftRadius) || 0);
    var origin = { parent: track.offsetParent, left: track.offsetLeft, top: track.offsetTop };
    var square = post ? post.offsetWidth / 2 : 0;   // the stylesheet makes the post two squares wide
    var boxes = cards.map(function (card) { return boxOf(card, origin); });
    var rows = rowsOf(boxes, band);
    var outline = courseOutline(rows, band, radius);
    var prints = hoofPrints(rows, racesRun(cards));

    Array.prototype.forEach.call(rails.querySelectorAll('path'), function (path) {
      path.setAttribute('d', outline);
    });
    turf.style.clipPath = 'path("' + outline + '")';
    paintHoofPrints(prints);
    placeStart(rows, boxes, band);
    placePost(rows, band, square);
    track.classList.add('is-drawn');
  }

  /* ── When to draw again ────────────────────────────────────── */

  function debounce(fn, ms) {
    var timer = null;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, ms);
    };
  }

  /* What the board says about the day: each race's state, and where the
   * fox marker is. A class changing for any other reason (a card
   * flipped, flashed, filtered) moves nothing, so draws nothing. */
  function daySignature() {
    return raceCards().map(function (card) {
      var state = '';
      for (var i = 0; i < STATES.length; i++) {
        if (card.classList.contains('cell--' + STATES[i])) state = STATES[i];
      }
      return state + (card.classList.contains('cell--now') ? '*' : '');
    }).join(',');
  }

  var redraw = debounce(draw, REDRAW_MS);
  var signature = daySignature();
  var redrawIfDayMoved = debounce(function () {
    var now = daySignature();
    if (now === signature) return;
    signature = now;
    draw();
  }, REDRAW_MS);

  draw();

  window.addEventListener('resize', redraw);
  window.addEventListener('load', redraw);
  if ('ResizeObserver' in window) new ResizeObserver(redraw).observe(grid);
  // Web fonts change the cards' heights when they arrive.
  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', redraw);
  }

  new MutationObserver(redrawIfDayMoved).observe(grid, {
    attributes:      true,
    attributeFilter: ['class'],
    subtree:         true,
  });
})();
