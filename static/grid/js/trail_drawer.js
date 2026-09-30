/* GRID-3b · Fox Trail cell drawer.
 *
 * Reads a per-cell payload map from #trailCellData (baked by the
 * view via Django's json_script filter), then handles click / keyboard
 * activation on each .cell and swaps content into #cellDrawer.
 *
 * Zero dependencies. All-vanilla DOM. Progressive-enhancement: if the
 * JSON blob is missing or the drawer chrome is absent, the trail still
 * renders and cells stay visually intact — nothing crashes.
 */
(function () {
  'use strict';

  var grid    = document.getElementById('trailGrid');
  var drawer  = document.getElementById('cellDrawer');
  var payload = document.getElementById('trailCellData');
  if (!grid || !drawer || !payload) return;

  var cells;
  try {
    cells = JSON.parse(payload.textContent || '[]');
  } catch (_e) {
    return;
  }
  if (!Array.isArray(cells) || cells.length === 0) return;

  var lastTrigger = null;   // element to restore focus to on close

  /* ── State copy — matches the cell-face glyph vocabulary ───── */
  var STATE_HEADLINE = {
    won:      { label: 'Won',        tone: 'is-won'    },
    placed:   { label: 'Placed',     tone: 'is-placed' },
    lost:     { label: 'Lost',       tone: 'is-lost'   },
    live:     { label: 'Running',    tone: 'is-live'   },
    pending:  { label: 'To come',    tone: 'is-pending'},
    void:     { label: 'Void',       tone: 'is-void'   },
    no_fancy: { label: 'No fancy',   tone: 'is-void'   },
  };

  function ordinal(n) {
    if (!n) return '';
    var s = ['th', 'st', 'nd', 'rd'];
    var v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /* ── Render helpers ────────────────────────────────────────── */

  function renderStateBlock(cell) {
    var meta = STATE_HEADLINE[cell.state] || STATE_HEADLINE.pending;
    var parts = ['<span class="cell-drawer__state-label ' + meta.tone + '">' + meta.label + '</span>'];
    if (cell.state === 'won' && cell.winning_horse) {
      parts.push('<span class="cell-drawer__state-detail">');
      parts.push(escape(cell.winning_horse));
      if (cell.finish_position === 1) parts.push(' &middot; 1st past the post');
      parts.push('</span>');
    } else if (cell.state === 'placed') {
      parts.push('<span class="cell-drawer__state-detail">');
      parts.push('Our pick finished ' + ordinal(cell.finish_position || 0));
      if (cell.winning_horse) parts.push(' &middot; winner: ' + escape(cell.winning_horse));
      parts.push('</span>');
    } else if (cell.state === 'lost' && cell.winning_horse) {
      parts.push('<span class="cell-drawer__state-detail">Winner: ' + escape(cell.winning_horse));
      if (cell.finish_position) parts.push(' &middot; our pick finished ' + ordinal(cell.finish_position));
      parts.push('</span>');
    } else if (cell.state === 'void') {
      parts.push('<span class="cell-drawer__state-detail">Race abandoned &mdash; stakes returned.</span>');
    } else if (cell.state === 'live') {
      parts.push('<span class="cell-drawer__state-detail">In running &mdash; result imminent.</span>');
    } else if (cell.state === 'pending') {
      parts.push('<span class="cell-drawer__state-detail">Off at ' + escape(cell.race_time) + '.</span>');
    }
    return parts.join('');
  }

  function renderSourceRow(row) {
    var cls = ['cell-drawer__source'];
    cls.push('cell-drawer__source--' + row.source);
    if (!row.backing) cls.push('is-off');
    if (row.is_consensus) cls.push('is-anchor');

    var head =
      '<span class="cell-drawer__source-mark" aria-hidden="true">' + escape(row.letter) + '</span>' +
      '<span class="cell-drawer__source-label">' + escape(row.label) + '</span>';

    var body;
    if (row.backing) {
      var oddsChip = row.odds
        ? '<span class="cell-drawer__source-odds">' + escape(row.odds) + '</span>'
        : '';
      var pill = row.is_consensus
        ? '<span class="cell-drawer__source-pill">anchors consensus</span>'
        : '<span class="cell-drawer__source-pill is-alt">alternative pick</span>';
      body =
        '<div class="cell-drawer__source-pick">' +
          '<span class="cell-drawer__source-horse">' + escape(row.horse_name) + '</span>' +
          oddsChip +
        '</div>' +
        (row.reasoning
          ? '<p class="cell-drawer__source-reasoning">' + escape(row.reasoning) + '</p>'
          : '') +
        pill;
    } else {
      body =
        '<div class="cell-drawer__source-pick">' +
          '<span class="cell-drawer__source-horse cell-drawer__source-horse--off">no pick</span>' +
        '</div>' +
        '<span class="cell-drawer__source-pill is-off">didn&rsquo;t fancy this race</span>';
    }

    return '<li class="' + cls.join(' ') + '">' +
      '<div class="cell-drawer__source-head">' + head + '</div>' +
      '<div class="cell-drawer__source-body">' + body + '</div>' +
    '</li>';
  }

  function populate(cell, spotNumber) {
    setText('drawer-spot',   'Spot ' + spotNumber);
    setText('drawer-time',   cell.race_time);
    setText('drawer-course', cell.course);

    var tier = drawer.querySelector('[data-role="drawer-tier"]');
    if (tier) {
      if (cell.tier >= 2) {
        tier.className = 'cell-drawer__tier cell-drawer__tier--' + cell.tier_slug;
        tier.textContent = cell.tier_name.toUpperCase() + ' · ' + cell.tier + '/4 sources agree';
      } else {
        tier.className = 'cell-drawer__tier cell-drawer__tier--whisper';
        tier.textContent = cell.tier === 1
          ? 'WHISPER · one source'
          : 'NO FANCY · no source backed a horse';
      }
    }

    var stateEl = drawer.querySelector('[data-role="drawer-state"]');
    if (stateEl) stateEl.innerHTML = renderStateBlock(cell);

    var listEl = drawer.querySelector('[data-role="drawer-sources"]');
    if (listEl) listEl.innerHTML = (cell.sources || []).map(renderSourceRow).join('');
  }

  /* ── Open / close ──────────────────────────────────────────── */

  function open(article) {
    var idxStr = article.getAttribute('data-cell-index');
    if (idxStr === null) return;
    var idx = parseInt(idxStr, 10);
    var cell = cells[idx];
    if (!cell) return;

    populate(cell, idx + 1);
    lastTrigger = article;
    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-cell-drawer-open');
    var closer = drawer.querySelector('.cell-drawer__close');
    if (closer) closer.focus();
  }

  function close() {
    drawer.hidden = true;
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('has-cell-drawer-open');
    if (lastTrigger && typeof lastTrigger.focus === 'function') {
      lastTrigger.focus();
    }
    lastTrigger = null;
  }

  /* ── Wire the cells ────────────────────────────────────────── */

  var articles = grid.querySelectorAll('.cell[data-cell-index]');
  for (var i = 0; i < articles.length; i++) {
    var a = articles[i];
    a.setAttribute('role', 'button');
    a.setAttribute('tabindex', '0');
    if (!a.getAttribute('aria-haspopup')) a.setAttribute('aria-haspopup', 'dialog');
  }

  grid.addEventListener('click', function (e) {
    var article = e.target.closest('.cell[data-cell-index]');
    if (!article) return;
    // Don't hijack clicks on links inside a cell (verify chips, etc.)
    if (e.target.closest('a, button')) return;
    open(article);
  });

  grid.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var article = e.target.closest('.cell[data-cell-index]');
    if (!article || article !== e.target) return;
    e.preventDefault();
    open(article);
  });

  drawer.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) close();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !drawer.hidden) close();
  });

  /* ── Utils ────────────────────────────────────────────────── */

  function setText(role, txt) {
    var el = drawer.querySelector('[data-role="' + role + '"]');
    if (el) el.textContent = txt || '';
  }

  function escape(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
