/**
 * racecard.js — single-file behaviour for the Racecard component.
 *
 * Replaces gn_sort.js, gn_votes.js, and the racecard-specific parts
 * of grand_national.js. Vanilla, one IIFE, ~500 lines.
 *
 * Responsibilities:
 *   1. Sort   — click a sortable column header, rows reorder client-side
 *   2. Filter — chip click toggles .is-hidden on rows
 *   3. Votes  — initial render + 20s poll of /members/api/votes/<id>/
 *   4. Pick   — auth users POST a vote, guest users stash + show bar
 *
 * Per-card scoping — every behaviour finds its closest [data-racecard]
 * ancestor and stays inside it. Multiple racecards on the same page
 * coexist without bleed.
 *
 * Globals expected (read once if present):
 *   GN_RACE_ID, GN_CSRF_TOKEN, GN_VOTE_COUNTS, GN_TOTAL_VOTES,
 *   GN_LEADER_ID, GN_USER_VOTE, VOTE_API_URL
 * (kept under their existing names so the page-level <script> blocks
 * that set them keep working.)
 */
(function () {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const cards = document.querySelectorAll('[data-racecard]');
    if (!cards.length) return;

    cards.forEach(initCard);

    // Vote polling + guest-pick bar are page-scoped (single race), so
    // they bind once and use the first racecard they find.
    initVotes(cards[0]);
    initGuestBar(cards[0]);
  }

  // One card's own wiring, once. The meeting page brings another
  // meeting's races into the page without a reload, and calls
  // SaturdayRacecard.initCards() for the cards that have just arrived.
  function initCard(card) {
    if (card._rcWired) return;
    card._rcWired = true;
    initSort(card);
    initFilter(card);
    initPick(card);
  }
  window.SaturdayRacecard = {
    initCards: function (root) {
      (root || document).querySelectorAll('[data-racecard]').forEach(initCard);
    },
  };

  /* ── Helpers ────────────────────────────────────────────────── */
  function $(card, sel)         { return card.querySelector(sel); }
  function $$(card, sel)        { return card.querySelectorAll(sel); }
  function setAriaSort(th, dir) { th.setAttribute('aria-sort', dir); }

  /* ════════════════════════════════════════════════════════════
     1. SORT
     Each column header carries data-col + data-sortable ("num"|"str").
     Cycle: click → asc → click → desc → click → none (reset).
  ════════════════════════════════════════════════════════════ */
  function initSort(card) {
    const headers = $$(card, '.racecard__col[data-sortable]');
    if (!headers.length) return;

    let activeCol = null;
    let activeDir = null;
    let clickCount = 0;

    headers.forEach(th => {
      th.addEventListener('click', (e) => {
        // Inline help affordances (e.g. the SR header's "?" link to
        // /sr-rating/) bubble click events up to the sortable column.
        // Skip sorting when the click started on a flagged child so
        // the navigation can complete cleanly.
        if (e.target.closest('[data-noclickthrough]')) return;
        onClick(th);
      });
    });

    function onClick(th) {
      const col = th.dataset.col;
      const type = th.dataset.sortable;          // 'num' | 'str'
      const defaultDir = (col === 'sr' || col === 'rpr' || col === 'stars' || col === 'votes') ? 'desc' : 'asc';

      if (activeCol !== col) {
        activeCol = col;
        activeDir = defaultDir;
        clickCount = 1;
      } else {
        clickCount++;
        if (clickCount === 3) {
          resetSort();
          return;
        }
        activeDir = activeDir === 'asc' ? 'desc' : 'asc';
      }

      sortBy(col, activeDir, type);
      paintHeaders();
    }

    function sortBy(col, dir, type) {
      const wrap = $(card, '.racecard__runners');
      if (!wrap) return;
      const rows = Array.from(wrap.children);
      const isQuality = (col === 'sr' || col === 'rpr' || col === 'stars' || col === 'votes');

      // Vote counts read live from the DOM each sort.
      const voteCounts = {};
      if (col === 'votes') {
        $$(card, '.racecard__vote-count[data-runner]').forEach(el => {
          voteCounts[el.dataset.runner] = parseInt(el.textContent.trim(), 10) || 0;
        });
      }

      rows.sort((a, b) => {
        const aNr = a.dataset.nr === '1';
        const bNr = b.dataset.nr === '1';
        if (isQuality) {
          if (aNr && !bNr) return 1;
          if (!aNr && bNr) return -1;
        }
        let aVal = readValue(a, col, voteCounts);
        let bVal = readValue(b, col, voteCounts);
        let cmp = (type === 'num') ? aVal - bVal
                                   : (aVal < bVal ? -1 : aVal > bVal ? 1 : 0);
        return dir === 'asc' ? cmp : -cmp;
      });

      const frag = document.createDocumentFragment();
      rows.forEach(r => frag.appendChild(r));
      wrap.appendChild(frag);
    }

    function readValue(row, col, voteCounts) {
      if (col === 'votes') {
        const span = row.querySelector('.racecard__vote-count[data-runner]');
        return span ? (voteCounts[span.dataset.runner] || 0) : 0;
      }
      const raw = row.dataset[col] || '';
      // 'or' with the rest: the row carries data-or now. Read as text, an
      // absent rating compared as NaN and the column sorted nothing.
      if (col === 'number' || col === 'sr' || col === 'rpr' || col === 'or' || col === 'stars') return parseFloat(raw) || 0;
      return raw.toLowerCase();
    }

    function resetSort() {
      const wrap = $(card, '.racecard__runners');
      if (!wrap) return;
      const rows = Array.from(wrap.children);
      rows.sort((a, b) => (parseFloat(a.dataset.number) || 0) - (parseFloat(b.dataset.number) || 0));
      const frag = document.createDocumentFragment();
      rows.forEach(r => frag.appendChild(r));
      wrap.appendChild(frag);
      activeCol = null;
      activeDir = null;
      clickCount = 0;
      paintHeaders();
    }

    function paintHeaders() {
      headers.forEach(th => {
        if (th.dataset.col === activeCol) setAriaSort(th, activeDir === 'asc' ? 'ascending' : 'descending');
        else setAriaSort(th, 'none');
      });
    }
  }

  /* ════════════════════════════════════════════════════════════
     2. FILTER — chip toggle
  ════════════════════════════════════════════════════════════ */
  function initFilter(card) {
    const chips = $$(card, '.racecard__filter');
    const rows = $$(card, '.racecard__runner');
    if (!chips.length) return;

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => {
          c.classList.remove('is-active');
          c.setAttribute('aria-selected', 'false');
        });
        chip.classList.add('is-active');
        chip.setAttribute('aria-selected', 'true');
        applyFilter(chip.dataset.filter);
      });
    });

    function applyFilter(filter) {
      // 'prices' is a tab swap, not a row filter — toggle the
      // racecard-level state class so CSS hides the grid + shows
      // the prices table. Other filters always run in grid mode.
      const pricesActive = filter === 'prices';
      card.classList.toggle('racecard--prices-active', pricesActive);
      if (pricesActive) return;   // no row-level toggling needed

      rows.forEach(row => {
        const odds = row.dataset.odds || '';
        const stars = parseFloat(row.dataset.stars || '0');
        let show = true;
        if (filter === 'short') show = isShortOdds(odds, 25);
        else if (filter === 'starred') show = stars > 0;
        row.classList.toggle('is-hidden', !show);
      });
    }
  }

  function isShortOdds(s, max) {
    if (!s) return false;
    if (s.indexOf('/') !== -1) {
      const [n, d] = s.split('/').map(Number);
      return Number.isFinite(n) && Number.isFinite(d) && d > 0 && n <= max;
    }
    return s.toLowerCase() === 'evs' || s.toLowerCase() === 'evens';
  }

  /* ════════════════════════════════════════════════════════════
     3. VOTES — initial render + 20s poll
  ════════════════════════════════════════════════════════════ */
  function initVotes(card) {
    if (!card) return;
    let counts   = (typeof GN_VOTE_COUNTS !== 'undefined') ? (GN_VOTE_COUNTS || {}) : {};
    let total    = (typeof GN_TOTAL_VOTES !== 'undefined') ? (GN_TOTAL_VOTES || 0)  : 0;
    let leaderId = (typeof GN_LEADER_ID   !== 'undefined' && GN_LEADER_ID) ? String(GN_LEADER_ID) : null;
    let userVote = (typeof GN_USER_VOTE   !== 'undefined' && GN_USER_VOTE) ? String(GN_USER_VOTE) : null;

    function render() {
      $$(card, '.racecard__vote-count[data-runner]').forEach(el => {
        const rid = String(el.dataset.runner);
        const n = counts.hasOwnProperty(rid) ? counts[rid] : null;
        el.textContent = n !== null ? n : (Object.keys(counts).length > 0 ? '0' : '—');
      });
      $$(card, '.racecard__runner').forEach(row => {
        const span = row.querySelector('.racecard__vote-count[data-runner]');
        if (!span) return;
        const rid = String(span.dataset.runner);
        row.classList.toggle('racecard__runner--leader', rid === leaderId && total > 0);
        row.classList.toggle('racecard__runner--voted',  userVote && rid === userVote);
      });
      const totalEl = document.getElementById('rcTotalVotes');
      if (totalEl) totalEl.textContent = total;
    }

    function poll() {
      const url = (typeof VOTE_API_URL !== 'undefined') ? VOTE_API_URL : null;
      if (!url || typeof GN_RACE_ID === 'undefined' || !GN_RACE_ID) return;
      fetch(url)
        .then(r => r.json())
        .then(data => {
          counts   = data.vote_counts || {};
          total    = data.total_votes || 0;
          leaderId = data.leader_id ? String(data.leader_id) : null;
          render();
        })
        .catch(() => {});
    }

    render();
    if (typeof GN_RACE_ID !== 'undefined' && GN_RACE_ID) {
      if (Object.keys(counts).length === 0 && total > 0) poll();
      setInterval(poll, 20000);
    }

    // Expose for the pick handler to update vote state on cast.
    card._rcVotes = {
      apply(data) {
        if (!data) return;
        counts   = data.vote_counts || counts;
        total    = data.total_votes !== undefined ? data.total_votes : total;
        leaderId = data.leader_id ? String(data.leader_id) : leaderId;
        if (data.runner_id !== undefined) userVote = String(data.runner_id);
        render();
      },
    };
  }

  /* ════════════════════════════════════════════════════════════
     4. PICK — auth path (POST a vote) + guest path (stash + bar)
  ════════════════════════════════════════════════════════════ */
  function initPick(card) {
    card.addEventListener('click', (e) => {
      const cast = e.target.closest('[data-action="cast-vote"]');
      if (cast) { castVote(cast, card); return; }
      const guest = e.target.closest('[data-action="guest-pick"]');
      if (guest) { e.preventDefault(); handleGuestPick(guest, card); return; }
    });
  }

  function castVote(btn, card) {
    if (typeof GN_RACE_ID === 'undefined' || !GN_RACE_ID) return;
    const runnerId  = parseInt(btn.dataset.runnerId, 10);
    const horseName = btn.dataset.horseName || '';
    if (!Number.isFinite(runnerId)) return;

    // SCOPE THIS TO BUTTONS ONLY — the runner row <div> also carries
    // data-runner-id, and writing textContent to a row blows away its
    // horse name, jockey, odds, and the pick button itself, leaving a
    // bare "✓ Picked" green bar that can no longer be reset by the next
    // click. Has to be `button[data-action="cast-vote"]…` not just
    // `.racecard__pick` so we ignore the slip-mode `+/✓` toggle.
    const buttons = $$(
      card,
      `button[data-action="cast-vote"][data-runner-id="${runnerId}"]`,
    );
    buttons.forEach(b => { b.disabled = true; b.textContent = '…'; });

    const csrf = (typeof GN_CSRF_TOKEN !== 'undefined' && GN_CSRF_TOKEN)
      ? GN_CSRF_TOKEN
      : ((document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || '');

    // The cast_vote view reads runner_id from request.POST and gates
    // JSON output on X-Requested-With — we MUST match that contract or
    // we get a 302 redirect to /cub/login and a "Connection error" toast.
    const body = new URLSearchParams({
      runner_id:           String(runnerId),
      race_id:             String(GN_RACE_ID),
      csrfmiddlewaretoken: csrf,
    });

    fetch('/members/vote/', {
      method:  'POST',
      headers: {
        'Content-Type':     'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken':      csrf,
      },
      body: body.toString(),
      credentials: 'same-origin',
    })
      .then(r => {
        if (r.status === 401 || r.status === 403) {
          // Not logged in / session expired — bounce to login.
          window.location.href = '/members/login/?next=' + encodeURIComponent(window.location.pathname);
          return null;
        }
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          throw new Error('Unexpected response from server');
        }
        return r.json();
      })
      .then(data => {
        if (data === null) return;     // already redirected
        if (data.success) {
          // Reset all pick buttons
          $$(card, '.racecard__pick').forEach(b => {
            b.classList.remove('racecard__pick--active');
            const isBlock = b.classList.contains('racecard__pick--block');
            b.textContent = isBlock ? 'Pick this horse' : 'Pick';
            b.disabled = false;
            b.removeAttribute('aria-pressed');
          });
          $$(card, '.racecard__runner--voted').forEach(r => r.classList.remove('racecard__runner--voted'));
          // Mark this runner's buttons active
          buttons.forEach(b => {
            b.classList.add('racecard__pick--active');
            b.textContent = '✓ Picked';
            b.disabled = false;
            b.setAttribute('aria-pressed', 'true');
            const row = b.closest('.racecard__runner');
            if (row) row.classList.add('racecard__runner--voted');
          });
          if (card._rcVotes) card._rcVotes.apply(data);
          updatePicksBudgetUI(data);
          toast(`🐾 ${horseName} — your pick is in`);
        } else {
          buttons.forEach(b => {
            const isBlock = b.classList.contains('racecard__pick--block');
            b.textContent = isBlock ? 'Pick this horse' : 'Pick';
            b.disabled = false;
          });
          toast(data.error || data.message || 'Could not save vote');
        }
      })
      .catch(() => {
        buttons.forEach(b => {
          const isBlock = b.classList.contains('racecard__pick--block');
          b.textContent = isBlock ? 'Pick this horse' : 'Pick';
          b.disabled = false;
        });
        toast('Connection error — try again');
      });
  }

  /* ── Picks-budget UI sync ─────────────────────────────────────
     The cast_vote response carries picks_used / picks_remaining /
     picks_state. Reflect them in any picks-pill / picks-card on the
     page so the navbar updates without a reload. */
  function updatePicksBudgetUI(data) {
    if (typeof data.picks_used !== 'number') return;

    document.querySelectorAll('[data-picks-used]').forEach(el => {
      el.textContent = String(data.picks_used);
    });
    if (typeof data.picks_max === 'number') {
      document.querySelectorAll('[data-picks-max]').forEach(el => {
        el.textContent = String(data.picks_max);
      });
    }

    const newState = data.picks_state || 'fresh';
    const stateClasses = ['picks-pill--fresh', 'picks-pill--mid',
                          'picks-pill--low',   'picks-pill--full'];
    document.querySelectorAll('[data-picks-pill]').forEach(pill => {
      stateClasses.forEach(c => pill.classList.remove(c));
      pill.classList.add(`picks-pill--${newState}`);
    });

    const cardStateClasses = ['picks-card--fresh', 'picks-card--mid',
                              'picks-card--low',   'picks-card--full'];
    document.querySelectorAll('[data-picks-card]').forEach(card => {
      cardStateClasses.forEach(c => card.classList.remove(c));
      card.classList.add(`picks-card--${newState}`);

      // Refresh the meter fill width.
      const fill = card.querySelector('[data-picks-meter-fill]');
      const meter = card.querySelector('[data-picks-meter]');
      if (fill && data.picks_max) {
        const pct = Math.min(100, (data.picks_used / data.picks_max) * 100);
        fill.style.width = pct + '%';
      }
      if (meter && typeof data.picks_max === 'number') {
        meter.setAttribute('aria-valuemax', String(data.picks_max));
        meter.setAttribute('aria-valuenow', String(data.picks_used));
      }
    });
  }

  /* ── Toast (paper theme) ────────────────────────────────────── */
  function toast(msg) {
    const t = document.getElementById('rcToast');
    const live = document.getElementById('rcLiveRegion');
    if (live) live.textContent = msg;
    if (!t) return;
    t.textContent = msg;
    t.classList.add('is-visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => t.classList.remove('is-visible'), 3000);
  }

  /* ════════════════════════════════════════════════════════════
     5. GUEST PICK BAR — sessionStorage-backed sticky bottom bar
  ════════════════════════════════════════════════════════════ */
  const GUEST_KEY = 'sr_guest_pick';

  function initGuestBar(card) {
    const bar = document.getElementById('rcGuestBar');
    if (!bar) return;
    const horseEl = document.getElementById('rcGuestHorse');
    const oddsEl  = document.getElementById('rcGuestOdds');
    const silkEl  = document.getElementById('rcGuestSilk');
    const ctaEl   = document.getElementById('rcGuestCta');
    const clearEl = document.getElementById('rcGuestClear');

    if (clearEl) clearEl.addEventListener('click', () => {
      removeStored();
      paintSelection(null, card);
      hide();
    });

    const stored = readStored();
    if (stored) {
      paintSelection(stored.runnerId, card);
      show(stored);
    }

    function show(pick) {
      horseEl.textContent = pick.horseName;
      oddsEl.textContent  = pick.odds || '';
      if (silkEl) {
        silkEl.textContent = pick.number || '?';
        silkEl.style.background = pick.silkColor || '#1a3a6b';
      }
      if (ctaEl) {
        const base = ctaEl.dataset.base || ctaEl.href.split('?')[0];
        ctaEl.dataset.base = base;
        ctaEl.href = base
          + '?pick=' + encodeURIComponent(pick.runnerId)
          + '&horse=' + encodeURIComponent(pick.horseName);
      }
      bar.classList.add('is-visible');
      document.body.classList.add('rc-guest-bar-open');
    }
    function hide() {
      bar.classList.remove('is-visible');
      document.body.classList.remove('rc-guest-bar-open');
    }
    card._rcGuestBar = { show, hide };
  }

  function handleGuestPick(btn, card) {
    const runnerId  = btn.dataset.runnerId;
    const horseName = btn.dataset.horseName;
    const odds      = btn.dataset.odds || '';

    let silkColor = '#1a3a6b';
    let number = '';
    const row = btn.closest('.racecard__runner');
    if (row) {
      const silk = row.querySelector('.racecard__silk');
      if (silk) {
        const path = silk.querySelector('path[fill]');
        if (path) silkColor = path.getAttribute('fill') || silkColor;
        const numText = silk.querySelector('text');
        if (numText) number = numText.textContent.trim();
      }
    }

    const existing = readStored();
    if (existing && String(existing.runnerId) === String(runnerId)) {
      removeStored();
      paintSelection(null, card);
      if (card._rcGuestBar) card._rcGuestBar.hide();
      return;
    }

    const pick = { runnerId, horseName, odds, silkColor, number };
    writeStored(pick);
    paintSelection(runnerId, card);
    if (card._rcGuestBar) card._rcGuestBar.show(pick);
  }

  function paintSelection(runnerId, card) {
    const rid = runnerId === null ? null : String(runnerId);
    $$(card, '.racecard__pick--guest').forEach(b => {
      const active = rid && String(b.dataset.runnerId) === rid;
      b.classList.toggle('is-selected', active);
      const isBlock = b.classList.contains('racecard__pick--block');
      b.textContent = active ? 'Picked' : (isBlock ? 'Pick this horse' : 'Pick');
      if (active) b.setAttribute('aria-pressed', 'true');
      else b.removeAttribute('aria-pressed');
    });
    $$(card, '.racecard__runner').forEach(row => {
      const span = row.querySelector('.racecard__vote-count[data-runner]');
      if (!span) return;
      row.classList.toggle('racecard__runner--guest-pick', rid && String(span.dataset.runner) === rid);
    });
  }

  function readStored() {
    try { return JSON.parse(sessionStorage.getItem(GUEST_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function writeStored(d) {
    try { sessionStorage.setItem(GUEST_KEY, JSON.stringify(d)); } catch (e) {}
  }
  function removeStored() {
    try { sessionStorage.removeItem(GUEST_KEY); } catch (e) {}
  }

})();
