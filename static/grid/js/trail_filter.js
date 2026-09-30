/* trail_filter.js — legend as control panel (GRID slice 2).
 *
 * Clicking a tier row (Whisper/Nod/Chorus/Smoker) or a signal chip
 * (B/T/W/S/L/F) in the legend sets a single filter on the trail grid;
 * cells that don't match dim to 0.28 opacity via CSS. Clicking the
 * same filter again clears it. Clicking a different filter replaces
 * the current one — only one active filter at a time.
 *
 * All visual state is driven by data-filter-tier / data-filter-source
 * attributes on the grid element; CSS does the rest. This file just
 * wires the buttons and updates the status pill above the grid.
 */
(function () {
  'use strict';

  var grid = document.getElementById('trailGrid');
  if (!grid) return;

  var legend = document.querySelector('.trail__legend');
  if (!legend) return;

  var statusEl = document.querySelector('[data-role="filter-status"]');
  var nameEl   = document.querySelector('[data-role="filter-name"]');
  var clearBtn = document.querySelector('[data-role="filter-clear"]');

  var LABELS = {
    tier: { '1': 'Whisper', '2': 'Nod', '3': 'Chorus', '4': 'Smoker' },
    source: {
      bod: 'Bet of the Day',
      top_rated: 'Top Rated',
      htw: 'Horses to Watch',
      steamer: 'Top Steamer',
      letters: 'Letters',
      featured: 'Featured Tip'
    }
  };

  function currentFilter() {
    if (grid.dataset.filterTier)   return { kind: 'tier',   value: grid.dataset.filterTier };
    if (grid.dataset.filterSource) return { kind: 'source', value: grid.dataset.filterSource };
    return null;
  }

  function setFilter(kind, value) {
    delete grid.dataset.filterTier;
    delete grid.dataset.filterSource;
    if (kind === 'tier')   grid.dataset.filterTier   = value;
    if (kind === 'source') grid.dataset.filterSource = value;
    grid.classList.toggle('trail__grid--filtered', Boolean(kind));
    syncButtons();
    syncStatus();
  }

  function clearFilter() { setFilter(null); }

  function syncButtons() {
    var cur = currentFilter();
    legend.querySelectorAll('[data-filter-tier]').forEach(function (btn) {
      var on = cur && cur.kind === 'tier' && cur.value === btn.dataset.filterTier;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('is-active', on);
    });
    legend.querySelectorAll('[data-filter-source]').forEach(function (btn) {
      var on = cur && cur.kind === 'source' && cur.value === btn.dataset.filterSource;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('is-active', on);
    });
  }

  function syncStatus() {
    if (!statusEl) return;
    var cur = currentFilter();
    if (!cur) { statusEl.hidden = true; return; }
    var label = (LABELS[cur.kind] || {})[cur.value] || cur.value;
    if (nameEl) nameEl.textContent = label;
    statusEl.hidden = false;
  }

  legend.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-filter-tier], [data-filter-source]');
    if (!btn) return;
    e.preventDefault();
    var cur = currentFilter();
    if (btn.dataset.filterTier) {
      var t = btn.dataset.filterTier;
      if (cur && cur.kind === 'tier' && cur.value === t) return clearFilter();
      return setFilter('tier', t);
    }
    if (btn.dataset.filterSource) {
      var s = btn.dataset.filterSource;
      if (cur && cur.kind === 'source' && cur.value === s) return clearFilter();
      return setFilter('source', s);
    }
  });

  if (clearBtn) clearBtn.addEventListener('click', clearFilter);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && currentFilter()) clearFilter();
  });

  /* ── Hover cross-highlight ─────────────────────────────────
   * Hovering a backing chip inside a cell — or a legend row —
   * temporarily previews the same filter without committing. If
   * a click-filter is already active the hover is ignored (the
   * committed choice always wins). Uses data-hover-* on the
   * grid; CSS mirrors the click-filter dim rules. */

  function setHoverSource(value) {
    if (currentFilter()) return;
    grid.dataset.hoverSource = value;
    grid.classList.add('trail__grid--hovered');
  }
  function clearHover() {
    delete grid.dataset.hoverSource;
    grid.classList.remove('trail__grid--hovered');
  }

  // Cell chips — hover a lit chip highlights matching cells.
  grid.addEventListener('mouseover', function (e) {
    var chip = e.target.closest('.cell__chip[data-source]');
    if (!chip || chip.classList.contains('is-ghost')) return;
    setHoverSource(chip.dataset.source);
  });
  grid.addEventListener('mouseout', function (e) {
    var chip = e.target.closest('.cell__chip[data-source]');
    if (!chip) return;
    // Only clear when leaving to something outside the chip.
    if (!e.relatedTarget || !e.relatedTarget.closest ||
        !e.relatedTarget.closest('.cell__chip[data-source="' + chip.dataset.source + '"]')) {
      clearHover();
    }
  });

  // Legend rows — hover previews the same filter their click commits.
  legend.addEventListener('mouseover', function (e) {
    var row = e.target.closest('[data-filter-source]');
    if (row) setHoverSource(row.dataset.filterSource);
  });
  legend.addEventListener('mouseout', function (e) {
    var row = e.target.closest('[data-filter-source]');
    if (!row) return;
    if (!e.relatedTarget || !e.relatedTarget.closest ||
        e.relatedTarget.closest('[data-filter-source="' + row.dataset.filterSource + '"]') !== row) {
      clearHover();
    }
  });
}());
