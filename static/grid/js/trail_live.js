/* GRID-3c · Fox Trail live poller.
 *
 * Only runs when the current view is today (`data-is-today="1"` on
 * `<main class="trail">`). Polls `/trail/live.json` on an interval,
 * patches each cell's state class + counter numbers in place, and
 * updates the freshness pill. Stops when the JSON returns
 * `is_final=true` (nothing left to resolve) or the tab is hidden.
 *
 * Zero-dep vanilla JS. Progressive-enhancement — if any hook is
 * missing the page still shows the initial server-rendered state.
 */
(function () {
  'use strict';

  var main = document.querySelector('main.trail');
  if (!main) return;
  if (main.getAttribute('data-is-today') !== '1') return;

  var liveUrl = main.getAttribute('data-live-url');
  if (!liveUrl) return;

  var pill      = document.getElementById('trailFreshness');
  var grid      = document.getElementById('trailGrid');
  var countGold = document.querySelector('[data-role="gold-count"]');
  var countLive = document.querySelector('[data-role="live-count"]');
  var countPend = document.querySelector('[data-role="pending-count"]');
  var freshAge  = pill ? pill.querySelector('[data-role="freshness-age"]') : null;
  var todayRec  = document.querySelector('[data-role="today-record"]');

  if (!grid) return;

  // Fox pill markup — kept in sync with _cell.html so a live-injected
  // marker matches the server-rendered one visually. Entity refs are
  // spelled out to avoid HTML entity resolution surprises.
  var FOX_PILL_HTML =
    '<span class="cell__now" aria-label="You are here">' +
      '<span class="cell__now-glyph" aria-hidden="true">\u{1F98A}</span>' +
      '<span class="cell__now-label">YOU ARE HERE</span>' +
    '</span>';

  // 45s between polls — Racing API syncs every ~30s. data-live-poll-ms
  // overrides it, which is how the sandbox replays a day in a couple of
  // minutes instead of a couple of hours; production sets no attribute.
  var POLL_MS     = parseInt(main.getAttribute('data-live-poll-ms'), 10) || 45000;
  var STALE_AFTER = 90000;   // pill flips to "stale" if we haven't heard back
  var timer       = null;
  var lastFetchAt = Date.now();
  var stopped     = false;
  var STATES      = ['pending', 'live', 'won', 'placed', 'lost', 'void', 'no_fancy'];

  /* ── Ordinal helper — mirrors TrailCell.finish_position_ord ── */
  function ordinal(n) {
    if (!n) return '';
    var mod100 = n % 100;
    if (mod100 >= 10 && mod100 <= 20) return n + 'th';
    var mod10 = n % 10;
    var suffix = mod10 === 1 ? 'st'
               : mod10 === 2 ? 'nd'
               : mod10 === 3 ? 'rd' : 'th';
    return n + suffix;
  }

  /* ── Podium medal helper ─────────────────────────────────── */

  function _insertMedal(article, tone, text, ariaLabel) {
    var el = document.createElement('span');
    el.className = 'cell__medal cell__medal--' + tone;
    el.textContent = text;
    el.setAttribute('aria-label', ariaLabel);
    // Insert just after the numbered badge so it lands at the
    // top-right corner (mirroring the server-rendered order).
    var badge = article.querySelector('.cell__badge');
    if (badge && badge.nextSibling) {
      article.insertBefore(el, badge.nextSibling);
    } else {
      article.insertBefore(el, article.firstChild);
    }
  }

  /* ── State patch on one cell ─────────────────────────────── */

  function patchCell(article, newState, finishPos, winningHorse) {
    // Swap the `cell--*` state class + placed-position subclass.
    var current;
    for (var i = 0; i < STATES.length; i++) {
      var cls = 'cell--' + STATES[i];
      if (article.classList.contains(cls)) current = STATES[i];
    }
    if (current === newState) return false;

    // Detect a settle transition (unresolved → resolved) so we can
    // choose the loud celebration on WON vs the softer just-updated
    // flash on LOST/PLACED/VOID.
    var wasUnsettled = (current === 'pending' || current === 'live');
    var justWon      = wasUnsettled && newState === 'won';

    if (current) article.classList.remove('cell--' + current);
    article.classList.add('cell--' + newState);
    article.classList.remove('cell--placed-2', 'cell--placed-3');
    if (newState === 'placed' && (finishPos === 2 || finishPos === 3)) {
      article.classList.add('cell--placed-' + finishPos);
    }

    // Rewrite the state glyph so the cell face matches its new state.
    var slot = article.querySelector('.cell__state');
    if (slot) {
      var html = '';
      if (newState === 'won') {
        html = '<span class="cell__crown">&#9812;</span>';
        if (finishPos) html += '<span class="cell__finish">' + finishPos + '</span>';
      } else if (newState === 'placed') {
        html = '<span class="cell__glyph cell__glyph--placed">' + (finishPos || '') + '</span>';
      } else if (newState === 'lost') {
        // LOST outcome now sits in the top-right medal (mirroring
        // WON/PLACED); the state slot stays empty so the layout
        // doesn't double up on the same information.
        html = '';
      } else if (newState === 'live') {
        html = '<span class="cell__glyph cell__glyph--live"></span>';
      } else if (newState === 'void') {
        html = '<span class="cell__glyph cell__glyph--void">V</span>';
      } else {
        html = '<span class="cell__glyph cell__glyph--pending"></span>';
      }
      slot.innerHTML = html;
    }

    // Podium medal chip at top-right — add on flip, remove on regression.
    var existing = article.querySelector('.cell__medal');
    if (existing) existing.remove();
    if (newState === 'won') {
      _insertMedal(article, 'gold', 'WON', 'Won');
    } else if (newState === 'placed' && finishPos === 2) {
      _insertMedal(article, 'silver', '2ND', 'Placed 2nd');
    } else if (newState === 'placed' && finishPos === 3) {
      _insertMedal(article, 'bronze', '3RD', 'Placed 3rd');
    } else if (newState === 'lost') {
      var lostOrd = ordinal(finishPos);
      _insertMedal(article, 'lost',
        lostOrd ? lostOrd.toUpperCase() : 'LOST',
        lostOrd ? 'Finished ' + lostOrd : 'Lost');
    }

    // Cell just flipped — give it a soft flash so the page tells the
    // reader "something changed here" without needing a full reload.
    article.classList.add('cell--just-updated');
    setTimeout(function () { article.classList.remove('cell--just-updated'); }, 1400);

    // GRID slice 4 — WON gets a louder celebration on top of the
    // baseline flash. Timed to overlap with the medal insert above
    // so the ribbon appears to drop in as the gold ripple fires.
    if (justWon) {
      article.classList.add('cell--just-won');
      setTimeout(function () { article.classList.remove('cell--just-won'); }, 1500);
    }

    return true;   // caller uses this to decide whether to bump #trailCellData
  }

  /* ── is_now marker (fox pill) ────────────────────────────────
   * Server owns the "you are here" priority rule (LIVE > earliest
   * PENDING); JS just mirrors what the payload says. On a fresh
   * arrival we also fire a soft slide-in so the marker's move
   * through the day reads as a walk, not a jump. */

  function patchIsNow(article, isNow) {
    var hadClass = article.classList.contains('cell--now');
    if (isNow === hadClass) return false;

    if (isNow) {
      article.classList.add('cell--now');
      article.setAttribute('aria-label',
        (article.getAttribute('aria-label') || '') + ' — you are here');
      if (!article.querySelector('.cell__now')) {
        // Insert just after the badge (or the featured ribbon if
        // present) so it lands top-left where the server puts it.
        var anchor = article.querySelector('.cell__ribbon') ||
                     article.querySelector('.cell__badge');
        if (anchor && anchor.parentNode) {
          var wrap = document.createElement('div');
          wrap.innerHTML = FOX_PILL_HTML;
          anchor.parentNode.insertBefore(wrap.firstChild, anchor.nextSibling);
        }
      }
      article.classList.add('cell--fox-arriving');
      setTimeout(function () {
        article.classList.remove('cell--fox-arriving');
      }, 900);
    } else {
      article.classList.remove('cell--now');
      var pill = article.querySelector('.cell__now');
      if (pill && pill.parentNode) pill.parentNode.removeChild(pill);
      var lbl = article.getAttribute('aria-label') || '';
      article.setAttribute('aria-label', lbl.replace(/ — you are here$/, ''));
    }
    return true;
  }

  /* ── Today track record pulse ────────────────────────────────
   * Small in-place replace on the tier row's numbers when the
   * server-computed stat changes. Pulse animation on the changed
   * bits so the reader's eye catches the increment. Absent tiers
   * on the client (server may add/remove has_sample) are skipped
   * rather than injected — layout stays server-driven. */

  function patchTodayRecord(record) {
    if (!todayRec || !record || !Array.isArray(record.tiers)) return;
    record.tiers.forEach(function (tier) {
      var row = todayRec.querySelector('[data-tier-slug="' + tier.tier_slug + '"]');
      if (!row) return;
      var changed = false;

      function bump(el, next) {
        if (!el) return;
        var cur = (el.textContent || '').trim();
        var nxt = String(next);
        if (cur === nxt) return;
        el.textContent = nxt;
        changed = true;
      }

      if (tier.has_sample) {
        var rate = row.querySelector('[data-role="tier-rate"]');
        if (rate) {
          // rate has a trailing <span>%</span>; write only the numeric prefix
          var unit = rate.querySelector('.record__tier-unit');
          var want = String(tier.hit_rate_pct != null ? tier.hit_rate_pct : '—');
          var curTxt = (rate.firstChild && rate.firstChild.nodeType === 3)
                        ? rate.firstChild.nodeValue.trim() : '';
          if (curTxt !== want) {
            if (rate.firstChild && rate.firstChild.nodeType === 3) {
              rate.firstChild.nodeValue = want;
            } else {
              rate.insertBefore(document.createTextNode(want), unit || null);
            }
            changed = true;
          }
        }
        bump(row.querySelector('[data-role="tier-won"]'),     tier.won);
        bump(row.querySelector('[data-role="tier-settled"]'), tier.settled);

        var pl = row.querySelector('[data-role="tier-pl"]');
        if (pl && tier.pl_units != null) {
          var want2 = tier.pl_units.toFixed(2) + 'u';
          if ((pl.textContent || '').trim() !== want2) {
            pl.textContent = want2;
            pl.classList.toggle('is-up',   tier.pl_units >= 0);
            pl.classList.toggle('is-down', tier.pl_units < 0);
            changed = true;
          }
        }
      }

      if (changed) {
        row.classList.add('record__tier--just-updated');
        setTimeout(function () {
          row.classList.remove('record__tier--just-updated');
        }, 1400);
      }
    });
  }

  /* ── Freshness pill ──────────────────────────────────────── */

  function fmtAgo(ms) {
    var s = Math.max(1, Math.round(ms / 1000));
    if (s < 60) return s + 's ago';
    var m = Math.round(s / 60);
    if (m < 60) return m + 'm ago';
    return Math.round(m / 60) + 'h ago';
  }

  function updatePill(now) {
    if (!pill || !freshAge) return;
    var age = now - lastFetchAt;
    var stale = age > STALE_AFTER;
    pill.classList.toggle('is-stale', stale);
    freshAge.textContent = stale ? fmtAgo(age) + ' — stale' : fmtAgo(age);
  }

  function markFinal() {
    if (!pill) return;
    pill.classList.remove('is-stale');
    pill.classList.add('is-final');
    pill.setAttribute('data-final', 'true');
    var lbl = pill.querySelector('.trail__freshness-label');
    if (lbl) lbl.innerHTML = 'Final &middot; all races settled';
  }

  /* ── Counter numbers ─────────────────────────────────────── */

  function _setCount(el, value) {
    if (!el || value === undefined) return;
    var next = String(value);
    if ((el.textContent || '').trim() === next) return;
    el.textContent = next;
    // GRID slice 4 — bump animation on the numeric that just changed.
    el.classList.add('is-just-bumped');
    setTimeout(function () { el.classList.remove('is-just-bumped'); }, 900);
  }

  function patchCounter(counter) {
    if (!counter) return;
    _setCount(countGold, counter.gold);
    _setCount(countLive, counter.live);
    _setCount(countPend, counter.pending);
  }

  /* ── The poll loop ───────────────────────────────────────── */

  function poll() {
    if (stopped) return;
    fetch(liveUrl, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        lastFetchAt = Date.now();

        var byRace = {};
        (data.cells || []).forEach(function (c) { byRace[c.race_id] = c; });

        var articles = grid.querySelectorAll('.cell[data-race-id]');
        for (var i = 0; i < articles.length; i++) {
          var a = articles[i];
          var rid = a.getAttribute('data-race-id');
          var next = byRace[rid];
          if (!next) continue;
          patchCell(a, next.state, next.finish_position, next.winning_horse);
          patchIsNow(a, Boolean(next.is_now));
        }

        patchCounter(data.counter);
        patchTodayRecord(data.today_record);
        updatePill(Date.now());

        if (data.is_final) {
          markFinal();
          stop();   // nothing left to poll for
        }
      })
      .catch(function () {
        // Silent fail — pill will drift into "stale" and the next
        // tick may recover on its own.
      });
  }

  function tick() {
    updatePill(Date.now());
    poll();
    timer = setTimeout(tick, POLL_MS);
  }

  function stop() {
    stopped = true;
    if (timer) { clearTimeout(timer); timer = null; }
  }

  /* Pause when tab is hidden — cheap for the server, kind on batteries. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (timer) { clearTimeout(timer); timer = null; }
    } else if (!stopped) {
      poll();
      if (!timer) timer = setTimeout(tick, POLL_MS);
    }
  });

  /* First tick after a short delay so the initial page paint isn't
     racing a network hit. */
  timer = setTimeout(tick, Math.min(8000, POLL_MS));
  updatePill(Date.now());
})();
