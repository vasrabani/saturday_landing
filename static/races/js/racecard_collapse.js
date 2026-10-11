/*
 * Mobile racecard compact-card toggle.
 *
 * On mobile (≤ 640 CSS px) every runner row is hidden down to a
 * three-row compact card. This script:
 *   1. On DOM ready, injects the compact chip row (AI / SR / FCST)
 *      into each runner — the data was already in data-* attributes,
 *      we just surface it as a chip row at the bottom of the card.
 *   2. Wires a click handler on each runner row that toggles
 *      [data-rc-expanded] — driving the CSS to show or hide the
 *      existing rc-mob / rc-spotlight / pick-button blocks.
 *   3. Persists expanded state in sessionStorage per race so the
 *      back button + page reload don't collapse the user's selection.
 *
 * Click handler is careful:
 *   • Ignores clicks on <a>, <button>, [role="button"] so existing
 *     links (horse profile, racecard, etc.) still navigate.
 *   • Distinguishes tap from drag/scroll via pointerdown/pointerup
 *     position delta — a swipe doesn't accidentally expand.
 *
 * Pure additive — does nothing on desktop, and a failure to load
 * leaves the card behaving like the old design (no broken state).
 */
(function () {
  'use strict';

  const MOBILE_BREAKPOINT = 640;
  const TAP_THRESHOLD_PX  = 8;
  const STORAGE_PREFIX    = 'sr:rc:exp:';

  function isMobile() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  }

  // Read the race id from the URL — /races/<id>/ or
  // /races/<id>/<slug>/. Used as the sessionStorage key so each race
  // remembers its own expanded set.
  function raceIdFromPath() {
    const m = window.location.pathname.match(/\/races\/(\d+)/);
    return m ? m[1] : '';
  }

  function loadExpandedSet(raceId) {
    if (!raceId) return new Set();
    try {
      const raw = sessionStorage.getItem(STORAGE_PREFIX + raceId);
      return new Set(raw ? raw.split(',').filter(Boolean) : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveExpandedSet(raceId, set) {
    if (!raceId) return;
    try {
      sessionStorage.setItem(
        STORAGE_PREFIX + raceId,
        Array.from(set).join(','),
      );
    } catch (e) { /* QuotaExceeded etc — silently degrade */ }
  }

  // Build the compact chip row that lives inside every runner card.
  // Reads from data-* attributes already on the row (no DB queries,
  // no API calls). Returns the HTML string to inject.
  // Extract the runner's form line from the existing .racecard__cell--form
  // element. The cell is rendered via _form.html with one position badge per
  // run; textContent flattens it into the raw "4P232" style string. We take
  // the last 6 chars and dash-join for readability ("4-P-2-3-2").
  function readFormText(row) {
    const cell = row.querySelector('.racecard__cell--form');
    if (!cell) return '';
    const raw = (cell.textContent || '').replace(/\s+/g, '');
    if (!raw || raw === '—') return '';
    const tail = raw.slice(-6);
    return tail.split('').join('-');
  }

  // Look for an existing market-mover chip rendered by the server-side
  // {% runner_market_chip runner %} template tag (lives in the .--odds
  // cell). When present we promote it to a compact chip — steamer
  // (▼ price shortened) gets the green pill, drifter (▲ price drifted)
  // gets the red pill.
  function readMarketMover(row) {
    const chip = row.querySelector(
      '.racecard__cell--odds .runner-market-chip',
    );
    if (!chip) return null;
    const isIn = chip.classList.contains('runner-market-chip--in');
    return {
      direction: isIn ? 'in' : 'out',   // in = steamer, out = drifter
      arrow:     isIn ? '▼'  : '▲',
      label:     isIn ? 'Steamer' : 'Drifter',
    };
  }

  // v9 — Confidence ribbon. A small AI-tier pill that sits ABOVE the
  // horse name in the collapsed card, so a user scrolling 15 runners
  // can see "Strong AI" / "Solid AI" / "Watch AI" / "Outsider" at a
  // glance without expanding. Tier driven by data-stars on the row:
  //   ≥4 → strong (green)
  //    3 → solid  (gold)
  //    2 → watch  (amber)
  //    1 → outsider (gray)
  //    0 → no ribbon (don't pretend confidence we don't have).
  function injectConfidenceRibbon(row) {
    const stars = parseInt(row.dataset.stars || '0', 10);
    if (!stars || stars < 1) return;

    const horseCell = row.querySelector('.racecard__cell--horse');
    if (!horseCell || horseCell.querySelector('.rc-ribbon')) return;

    let tier, label;
    if (stars >= 4)       { tier = 'strong';   label = 'Strong AI'; }
    else if (stars === 3) { tier = 'solid';    label = 'Solid AI'; }
    else if (stars === 2) { tier = 'watch';    label = 'Watch AI'; }
    else                  { tier = 'outsider'; label = 'Outsider'; }

    const ribbon = document.createElement('span');
    ribbon.className = 'rc-ribbon rc-ribbon--' + tier;
    ribbon.innerHTML =
      '<span class="rc-ribbon__star" aria-hidden="true">★</span> ' + label;
    horseCell.prepend(ribbon);
  }

  function buildCompactRow(row) {
    const stars  = parseInt(row.dataset.stars || '0', 10);
    const sr     = parseInt(row.dataset.sr || '0', 10);
    const form   = readFormText(row);
    const mover  = readMarketMover(row);

    const chips = [];
    if (stars > 0) {
      const filled = '★'.repeat(Math.min(stars, 5));
      const empty  = '☆'.repeat(Math.max(0, 5 - stars));
      chips.push(
        '<span class="rc-mob-compact__chip rc-mob-compact__chip--ai" title="AI rating">' +
          '<span aria-hidden="true">' + filled + empty + '</span>' +
        '</span>'
      );
    }
    if (sr > 0) {
      chips.push(
        '<span class="rc-mob-compact__chip rc-mob-compact__chip--sr" title="Saturday Rating">' +
          'SR ' + sr +
        '</span>'
      );
    }

    // Third chip: prefer market mover when present (it's a tactical
    // signal — what's happening NOW), fall back to form (long-term).
    if (mover) {
      const cls = mover.direction === 'in'
        ? 'rc-mob-compact__chip--mover'
        : 'rc-mob-compact__chip--drifter';
      chips.push(
        '<span class="rc-mob-compact__chip ' + cls + '" title="' +
          mover.label + '">' +
          mover.arrow + ' ' + mover.label +
        '</span>'
      );
    } else if (form) {
      chips.push(
        '<span class="rc-mob-compact__chip rc-mob-compact__chip--form" title="Recent form">' +
          'Form ' + form +
        '</span>'
      );
    }

    // "More" / "Less" affordance — CSS swaps the text via ::before/::after.
    chips.push(
      '<span class="rc-mob-compact__more" aria-label="Toggle detail"></span>'
    );

    return (
      '<div class="rc-mob-compact" role="button" tabindex="-1">' +
        chips.join('') +
      '</div>'
    );
  }

  function setExpanded(row, expanded) {
    row.setAttribute('data-rc-expanded', expanded ? 'true' : 'false');
  }

  function toggle(row, expandedSet, raceId) {
    const id = row.dataset.runnerId;
    const isExpanded = row.getAttribute('data-rc-expanded') === 'true';
    const next = !isExpanded;
    setExpanded(row, next);
    if (id) {
      if (next) expandedSet.add(id);
      else      expandedSet.delete(id);
      saveExpandedSet(raceId, expandedSet);
    }
  }

  /* ════════════════════════════════════════════════════════════
     v10a — Smart filter / sort pills above the runners list.
     Pure DOM re-order. Original order is captured once on init
     so [All] always restores the as-rendered card. Filters hide
     rows via .rc-mob-hidden; sorts re-append rows in new order.
  ════════════════════════════════════════════════════════════ */
  const FILTER_PILLS = [
    { key: 'all',      label: 'All',         render: (n) => 'All ' + n },
    { key: 'top-ai',   label: '★ Top AI'   },
    { key: 'steamers', label: '▼ Steamers' },
    { key: 'sr-sort',  label: 'SR ↓'       },
    { key: 'form-up',  label: '↗ Form Up'  },
  ];

  function getFormTrend(row) {
    // Parse the form cell text (e.g. "4-P-2-3-2") into numeric finishes,
    // compare last 3 vs prior 3. Letters (P, F, U, R) score 9 (bad).
    const cell = row.querySelector('.racecard__cell--form');
    if (!cell) return 0;
    const raw = (cell.textContent || '').replace(/[^0-9PFURS]/gi, '');
    if (raw.length < 4) return 0;
    const score = (ch) => /[0-9]/.test(ch) ? parseInt(ch, 10) || 9 : 9;
    const tail = raw.slice(-6);
    const last3  = tail.slice(-3).split('').map(score);
    const prior3 = tail.slice(-6, -3).split('').map(score);
    if (!last3.length || !prior3.length) return 0;
    const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    return avg(prior3) - avg(last3);  // positive = improving
  }

  function injectFilterBar(container, rows) {
    if (container.querySelector('.rc-mob-filterbar')) return;
    const visibleCount = rows.filter(r => r.dataset.nr !== '1').length;

    const bar = document.createElement('div');
    bar.className = 'rc-mob-filterbar';
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', 'Filter runners');
    bar.innerHTML = FILTER_PILLS.map((p, i) => {
      const label = p.render ? p.render(visibleCount) : p.label;
      return '<button type="button" class="rc-mob-filterbar__pill' +
        (i === 0 ? ' is-active' : '') + '" data-filter="' + p.key + '"' +
        ' role="tab" aria-selected="' + (i === 0) + '">' + label + '</button>';
    }).join('');
    container.parentNode.insertBefore(bar, container);

    // Snapshot original order — used by [All] reset.
    const originalOrder = rows.slice();

    bar.addEventListener('click', (e) => {
      const pill = e.target.closest('.rc-mob-filterbar__pill');
      if (!pill) return;
      bar.querySelectorAll('.rc-mob-filterbar__pill').forEach(p => {
        p.classList.remove('is-active');
        p.setAttribute('aria-selected', 'false');
      });
      pill.classList.add('is-active');
      pill.setAttribute('aria-selected', 'true');
      applyMobFilter(pill.dataset.filter, container, rows, originalOrder);
    });
  }

  function applyMobFilter(key, container, rows, originalOrder) {
    // 1. Reset visibility + restore original DOM order.
    rows.forEach(r => r.classList.remove('rc-mob-hidden'));
    originalOrder.forEach(r => container.appendChild(r));
    if (key === 'all') return;

    // 2. Score / filter per pill.
    if (key === 'top-ai') {
      rows.forEach(r => {
        const s = parseInt(r.dataset.stars || '0', 10);
        if (s < 3) r.classList.add('rc-mob-hidden');
      });
      const sorted = rows.slice().sort((a, b) =>
        (parseInt(b.dataset.stars || '0', 10)) -
        (parseInt(a.dataset.stars || '0', 10))
      );
      sorted.forEach(r => container.appendChild(r));
    } else if (key === 'steamers') {
      rows.forEach(r => {
        if (!r.querySelector('.runner-market-chip--in')) {
          r.classList.add('rc-mob-hidden');
        }
      });
    } else if (key === 'sr-sort') {
      const sorted = rows.slice().sort((a, b) =>
        (parseInt(b.dataset.sr || '0', 10)) -
        (parseInt(a.dataset.sr || '0', 10))
      );
      sorted.forEach(r => container.appendChild(r));
    } else if (key === 'form-up') {
      rows.forEach(r => {
        if (getFormTrend(r) <= 0.5) r.classList.add('rc-mob-hidden');
      });
    }
  }

  /* ════════════════════════════════════════════════════════════
     v10b — Pick snackbar + sticky picks counter.
     We don't own the pick state (other code persists it server-
     side via the existing pickbtn handler). We OBSERVE clicks on
     .racecard__pick, wait a tick for existing handlers to flip
     the --active class, then surface a snackbar + counter.
  ════════════════════════════════════════════════════════════ */
  const SNACKBAR_MS = 4000;
  let snackbarTimer = null;

  function ensureSnackbar() {
    let el = document.getElementById('rcMobSnackbar');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'rcMobSnackbar';
    el.className = 'rc-mob-snackbar';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
    return el;
  }

  function showSnackbar(message, undoBtn) {
    const el = ensureSnackbar();
    el.innerHTML =
      '<span class="rc-mob-snackbar__msg">' + message + '</span>' +
      (undoBtn
        ? '<button type="button" class="rc-mob-snackbar__undo">Undo</button>'
        : '');
    el.classList.add('is-visible');
    if (snackbarTimer) clearTimeout(snackbarTimer);
    snackbarTimer = setTimeout(() => {
      el.classList.remove('is-visible');
    }, SNACKBAR_MS);
    const undo = el.querySelector('.rc-mob-snackbar__undo');
    if (undo && undoBtn) {
      undo.addEventListener('click', () => {
        el.classList.remove('is-visible');
        undoBtn.click();   // re-trigger the pick button = unpick
      }, { once: true });
    }
  }

  function ensureStickyCounter() {
    let el = document.getElementById('rcMobPicksCounter');
    if (el) return el;
    el = document.createElement('a');
    el.id = 'rcMobPicksCounter';
    el.className = 'rc-mob-picks-counter';
    el.href = '#vote-section';
    el.setAttribute('aria-label', 'View your picks');
    el.innerHTML =
      '<span class="rc-mob-picks-counter__count">0</span>' +
      '<span class="rc-mob-picks-counter__label">picks · View ↑</span>';
    document.body.appendChild(el);
    return el;
  }

  function updatePicksCounter() {
    const n = document.querySelectorAll(
      '.racecard__runner .racecard__pick--active'
    ).length;
    const el = ensureStickyCounter();
    el.querySelector('.rc-mob-picks-counter__count').textContent = n;
    el.classList.toggle('is-visible', n > 0);
  }

  function wirePicksUI() {
    // Delegated click — fires AFTER existing pickbtn handlers because
    // we listen during the bubble phase. setTimeout(0) gives the
    // existing handler a chance to flip the --active class.
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.racecard__pick');
      if (!btn) return;
      const row = btn.closest('.racecard__runner');
      if (!row) return;
      setTimeout(() => {
        const isActive = btn.classList.contains('racecard__pick--active');
        const horse = (row.querySelector('.racecard__name') || {}).textContent || 'Pick';
        if (isActive) {
          showSnackbar(horse.trim() + ' added', btn);
        } else {
          showSnackbar(horse.trim() + ' removed', null);
        }
        updatePicksCounter();
      }, 0);
    });

    // Initial paint — in case picks survived a reload.
    updatePicksCounter();
  }

  function init() {
    // Only on mobile — desktop layout stays untouched.
    if (!isMobile()) return;

    const raceId = raceIdFromPath();
    const expandedSet = loadExpandedSet(raceId);

    // v10a — filter pills per race. /races/<id>/ has ONE
    // .racecard__runners container; /full/ has N (one per race
    // on the meeting). We iterate so each race-section gets its
    // own filter bar that operates only on its own runners.
    const containers = document.querySelectorAll('.racecard__runners');
    containers.forEach(container => {
      const containerRows = Array.from(
        container.querySelectorAll('.racecard__runner')
      );
      if (containerRows.length) {
        injectFilterBar(container, containerRows);
      }
    });

    // Row-level wiring (compact card, ribbon, tap-to-expand) operates
    // on ALL runners across the page — no need to scope per-container.
    const rows = Array.from(document.querySelectorAll('.racecard__runner'));

    // v10b — wire snackbar + sticky counter (delegated, runs once).
    // Naturally no-ops on /full/ because that page uses .racecard__slip-btn
    // for picks (bet slip), not .racecard__pick.
    if (!window.__rcMobPicksWired) {
      wirePicksUI();
      window.__rcMobPicksWired = true;
    }

    rows.forEach(row => {
      // Inject the compact chip row once.
      if (!row.querySelector('.rc-mob-compact')) {
        row.insertAdjacentHTML('beforeend', buildCompactRow(row));
      }

      // Inject the confidence ribbon above the horse name (v9).
      injectConfidenceRibbon(row);

      // Restore saved expanded state.
      if (expandedSet.has(row.dataset.runnerId)) {
        setExpanded(row, true);
      } else {
        setExpanded(row, false);
      }

      // Track pointer position so we can distinguish tap from drag.
      let startX = 0, startY = 0;
      row.addEventListener('pointerdown', (e) => {
        startX = e.clientX; startY = e.clientY;
      }, { passive: true });

      row.addEventListener('pointerup', (e) => {
        const dx = Math.abs(e.clientX - startX);
        const dy = Math.abs(e.clientY - startY);
        if (dx > TAP_THRESHOLD_PX || dy > TAP_THRESHOLD_PX) return;

        // Ignore taps on links / buttons / form controls.
        const t = e.target;
        if (t.closest('a, button, input, select, textarea, [role="button"]:not(.rc-mob-compact)')) {
          return;
        }
        toggle(row, expandedSet, raceId);
      });

      // Keyboard: Space/Enter when row has focus also toggles.
      row.setAttribute('tabindex', '0');
      row.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          const t = e.target;
          if (t !== row) return;   // let inner controls handle their own keys
          e.preventDefault();
          toggle(row, expandedSet, raceId);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // Re-init on viewport resize across the breakpoint.
  let lastIsMobile = isMobile();
  window.addEventListener('resize', () => {
    const nowMobile = isMobile();
    if (nowMobile && !lastIsMobile) init();
    lastIsMobile = nowMobile;
  });
})();
