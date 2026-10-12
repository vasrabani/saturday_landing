/* meeting_racecard.js — the race cards and their runners, from data
 * that is already on the page. Nothing here is fetched.
 *
 *   1. Labels. The trip is spelt out ("0m5f0y" → "5f", "2m16y" →
 *      "2m 16y") and drawn beside its name as a ruler, a mark a
 *      furlong; "Open →" on a race says what it opens ("Race card");
 *      a tag's glyph ("✓ Result", "★ Big race") becomes a line icon.
 *   2. Form. Each run in a horse's form is one box; the page marks a
 *      win, a second and a third and lumps the rest together. Here
 *      every box is told its own place, so the stylesheet can colour
 *      each, the latest run is marked, and each says what it is when
 *      pointed at.
 *   3. Numbers. The evening before, runners have no numbers and the
 *      page prints "?" for each. A race in which none has a number is
 *      marked, and the stylesheet leaves the number column out of it.
 *   4. A comment said once. Where a runner has no comment the page
 *      prints the AI verdict in its place, and again under it; such a
 *      row is marked and the verdict shown once.
 *   5. Under a runner's name: the AI tier in stars and words (the same
 *      four tiers, from the same data-stars, as the page's phone-only
 *      ribbon), and the age and weight where they have no column.
 *   6. Details, on the phone card: a button that opens the comment and
 *      the AI verdict; a tap anywhere on the card opens it too.
 *   7. Filters above every race, at every width: All, Top AI,
 *      Steamers, Sort by SR, Form up — the five the page's phone script
 *      offers on phones — and a Comments switch that folds every
 *      comment and verdict away for a card of figures only (remembered
 *      on the device).
 *   8. The favourite and the top Saturday Rating of each race, marked.
 *   9. The sortable column heads can be used from the keyboard.
 *
 * The page's own scripts (racecard.js, racecard_collapse.js,
 * bet_slip.js, meeting_full.js) are untouched and keep every hook: the
 * runner rows' data-* attributes are read, never written, and rows are
 * only ever hidden with an attribute or re-ordered within their list.
 * Everything added is an element with an mfr- class ("meeting full,
 * revamp") or a data-mfr-* attribute, read by meeting.css and by nothing
 * else. Each part checks for what it works on and does nothing if it
 * is missing.
 */
(function () {
  'use strict';

  const shown = (node) => !!node && node.offsetParent !== null;

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /* A line icon, drawn by the stylesheet from static/meeting/img/icons/. */
  function icon(name) {
    const node = make('span', 'mfr-i mfr-i--' + name);
    node.setAttribute('aria-hidden', 'true');
    return node;
  }

  /* Replace a label's text; returns the span that now holds it. */
  function reword(node, text) {
    node.textContent = '';
    return node.appendChild(make('span', 'mfr-text', text));
  }

  /* ── 1. Labels ───────────────────────────────────────────────── */

  /* A trip as the page writes it — miles, furlongs, yards, any of them
     left out ("0m5f0y", "2m16y", "7f14y", "1m") — as three numbers, or
     null for anything that is not a trip. */
  function trip(raw) {
    const m = /^\s*(?:(\d+)m)?(?:(\d+)f)?(?:(\d+)y)?\s*$/.exec(raw);
    return m && (m[1] || m[2] || m[3]) ? [+m[1] || 0, +m[2] || 0, +m[3] || 0] : null;
  }

  /* "0m5f0y" → "5f", "1m4f0y" → "1m 4f", "2m16y" → "2m 16y". Null when
     the page's own wording needs nothing done to it ("7f", "1m"). */
  function distance(raw) {
    const t = trip(raw);
    if (!t) return null;
    const text = ['m', 'f', 'y'].map((unit, i) => (t[i] ? t[i] + unit : '')).filter(Boolean).join(' ');
    return text && text !== raw.trim() ? text : null;
  }

  /* The trip in furlongs: "0m5f0y" → 5, "1m4f0y" → 12, "7f" → 7, "1m" → 8
     (eight furlongs to the mile, 220 yards to the furlong). */
  function furlongs(raw) {
    const t = trip(raw);
    return t ? Math.round(t[0] * 8 + t[1] + t[2] / 220) : 0;
  }

  function labels() {
    /* The trip is the first plain fact under a race's name: after the
       class where there is one (there is none on an Irish card). */
    document.querySelectorAll('.mf-race__meta').forEach((meta) => {
      const span = Array.from(meta.children).find((el) => el.tagName === 'SPAN' && !el.className && trip(el.textContent));
      if (!span) return;
      const raw = span.textContent;
      const text = distance(raw);
      const home = text ? reword(span, text) : span;

      /* And the trip drawn beside it: a mark a furlong. */
      const n = furlongs(raw);
      if (n > 0 && n <= 40) {
        const ruler = make('span', 'mfr-furlongs');
        ruler.style.setProperty('--mfr-f', String(n));
        ruler.setAttribute('aria-hidden', 'true');
        ruler.title = n + (n === 1 ? ' furlong' : ' furlongs');
        home.appendChild(ruler);
      }
    });

    /* "Open →" on each race: say what it opens. Only the word is
       replaced; the arrow beside it stays where it is. */
    document.querySelectorAll('.mf-race__cta').forEach((link) => {
      const word = link.firstChild;
      if (!word || word.nodeType !== Node.TEXT_NODE || !/^\s*Open\s*$/.test(word.nodeValue)) return;
      link.replaceChild(make('span', 'mfr-text', 'Race card'), word);
    });

    /* "✓ Result", "★ Big race": the glyph becomes a line icon. */
    const glyphs = { '✓': 'check', '★': 'star-fill' };
    document.querySelectorAll('.mf-race__tag').forEach((tag) => {
      const text = tag.textContent.trim();
      const name = glyphs[text.charAt(0)];
      if (!name) return;
      const fresh = reword(tag, text.slice(1).trim());
      fresh.insertBefore(icon(name), fresh.firstChild);
    });
  }

  /* ── 2. Form ─────────────────────────────────────────────────── */

  const RUNS = {
    1: 'Won', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 8: '8th', 9: '9th', 0: '10th or worse',
    F: 'Fell', U: 'Unseated rider', P: 'Pulled up', B: 'Brought down', R: 'Refused', O: 'Ran out',
    S: 'Slipped up', C: 'Carried out', D: 'Disqualified', V: 'Void race', L: 'Left at the start',
  };

  function form() {
    document.querySelectorAll('.racecard__form').forEach((strip) => {
      const runs = [];
      strip.querySelectorAll('.rcf').forEach((box) => {
        const mark = box.textContent.trim().toUpperCase();
        if (box.classList.contains('rcf--sep')) {
          box.title = mark === '/' ? 'A long break between runs' : 'A new season';
          return;
        }
        box.setAttribute('data-mfr-run', /^\d$/.test(mark) ? mark : 'x');
        box.title = RUNS[mark] || 'Did not finish';
        runs.push(box);
      });
      const latest = runs[runs.length - 1];
      if (latest) {
        latest.setAttribute('data-mfr-latest', '');
        latest.title += ' (latest run)';
      }
    });
  }

  /* ── 3. Numbers ──────────────────────────────────────────────── */

  function numbers() {
    document.querySelectorAll('[data-racecard]').forEach((card) => {
      const rows = Array.from(card.querySelectorAll('.racecard__runner'));
      if (rows.length && rows.every((row) => !(+row.dataset.number > 0))) card.setAttribute('data-mfr-numbers', 'none');
    });
  }

  /* ── 4. A comment said once ──────────────────────────────────── */

  function once() {
    const plain = (el) => el.textContent.replace(/\s+/g, ' ').trim();
    document.querySelectorAll('.racecard__runner').forEach((row) => {
      const comment = row.querySelector('.racecard__comment--ai');
      const verdict = row.querySelector('.rc-spotlight__body');
      if (comment && verdict && plain(comment) === plain(verdict)) row.setAttribute('data-mfr-once', '');
    });
  }

  /* The live table shows two lines of each comment and the rest in a
     tooltip; here the comment is in full, so the tooltip would only
     repeat it. */
  function untip() {
    document.querySelectorAll('.racecard__cell--comment[title]').forEach((cell) => cell.removeAttribute('title'));
  }

  /* ── 5. The line under a runner's name ───────────────────────── */

  const TIERS = { 4: 'Strong AI', 3: 'Solid AI', 2: 'Watch AI', 1: 'Outsider' };
  const TIER_KEYS = { 4: 'strong', 3: 'solid', 2: 'watch', 1: 'outsider' };

  function underName(row) {
    const cell = row.querySelector('.racecard__cell--horse');
    if (!cell || cell.querySelector('.mfr-sub')) return;
    const line = make('div', 'mfr-sub');

    const stars = Math.min(parseInt(row.dataset.stars || '0', 10) || 0, 5);
    if (stars >= 1) {
      const tier = make('span', 'mfr-ai');
      tier.dataset.tier = TIER_KEYS[Math.min(stars, 4)];
      const rating = make('span', 'mfr-ai__stars');
      rating.setAttribute('role', 'img');
      rating.setAttribute('aria-label', 'AI rating ' + stars + ' out of 5');
      for (let i = 0; i < 5; i++) rating.appendChild(icon(i < stars ? 'star-fill' : 'star'));
      tier.appendChild(rating);
      tier.appendChild(make('span', 'mfr-ai__tier', TIERS[Math.min(stars, 4)]));
      line.appendChild(tier);
    }

    /* "Age 3 · —" (no weight declared yet) reads better as "Age 3". */
    const meta = cell.querySelector('.racecard__name-meta');
    const text = meta ? meta.textContent.trim().replace(/\s*·\s*—$/, '') : '';
    if (text) {
      /* For the eye only: age and weight are already in the row's own
         cells, which a screen reader reads at every width. */
      const copy = make('span', 'mfr-meta', text);
      copy.setAttribute('aria-hidden', 'true');
      line.appendChild(copy);
    }

    if (line.firstChild) cell.appendChild(line);
  }

  /* ── 6. Details (the phone card) ─────────────────────────────── */

  function details(row) {
    const comment = row.querySelector('.racecard__cell--comment .racecard__comment:not(.racecard__comment--empty)');
    const verdict = row.querySelector(':scope > .rc-spotlight');
    if ((!comment && !verdict) || row.querySelector(':scope > .mfr-more-cell')) return;

    const button = make('button', 'mfr-more');
    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'Details: ' + (row.dataset.horseName || 'runner'));
    button.appendChild(make('span', '', 'Details'));
    button.appendChild(icon('chevron-down'));
    /* The row is an ARIA row, so the button goes in a cell of its own. */
    const cell = make('div', 'mfr-more-cell');
    cell.setAttribute('role', 'cell');
    cell.appendChild(button);
    row.appendChild(cell);

    const toggle = () => {
      const open = row.getAttribute('data-mfr-open') !== 'true';
      row.setAttribute('data-mfr-open', String(open));
      button.setAttribute('aria-expanded', String(open));
    };
    button.addEventListener('click', toggle);

    /* A tap anywhere on the card opens it too, as on the live phone
       page — but only while the button is showing (so, the card
       layout), and never from a link, a button or a text selection. */
    row.addEventListener('click', (e) => {
      if (!shown(button)) return;
      if (e.target.closest('a, button, input, select, textarea, label')) return;
      if (window.getSelection && String(window.getSelection())) return;
      toggle();
    });
  }

  /* ── 7. Filters, and the Comments switch ─────────────────────── */

  /* Improving form: the last three runs against the three before, as
     the page's phone script works it out. Letters (P, F, U…) count 9. */
  function formTrend(row) {
    const cell = row.querySelector('.racecard__cell--form');
    if (!cell) return 0;
    const raw = (cell.textContent || '').replace(/[^0-9PFURS]/gi, '');
    if (raw.length < 4) return 0;
    const score = (ch) => (/[0-9]/.test(ch) ? parseInt(ch, 10) || 9 : 9);
    const tail = raw.slice(-6);
    const last = tail.slice(-3).split('').map(score);
    const prior = tail.slice(-6, -3).split('').map(score);
    if (!last.length || !prior.length) return 0;
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    return mean(prior) - mean(last);
  }

  function filters(card) {
    const list = card.querySelector('.racecard__runners');
    const race = card.closest('.mf-race');
    if (!list || !race || race.querySelector(':scope > .mfr-tools')) return;
    const rows = Array.from(list.querySelectorAll(':scope > .racecard__runner'));
    if (!rows.length) return;

    const cardOrder = rows.slice();
    const stars = (r) => parseInt(r.dataset.stars || '0', 10) || 0;
    const rating = (r) => parseInt(r.dataset.sr || '0', 10) || 0;
    const steaming = (r) => !!r.querySelector('.runner-market-chip--in');
    const count = (test) => rows.filter(test).length;

    const options = [
      { key: 'all', label: 'All', count: count((r) => r.dataset.nr !== '1') },
      { key: 'top-ai', label: 'Top AI', icon: 'star', count: count((r) => stars(r) >= 3) },
      { key: 'steamers', label: 'Steamers', icon: 'trend-down', count: count(steaming) },
      { key: 'sr-sort', label: 'Sort by SR', icon: 'arrow-down', off: !rows.some((r) => rating(r) > 0) },
      { key: 'form-up', label: 'Form up', icon: 'trend-up', count: count((r) => formTrend(r) > 0.5) },
    ];

    const bar = make('div', 'mfr-tools');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Filter runners');

    options.forEach((option, i) => {
      const button = make('button', 'mfr-filter');
      button.type = 'button';
      button.dataset.filter = option.key;
      button.setAttribute('aria-pressed', String(i === 0));
      if (option.icon) button.appendChild(icon(option.icon));
      button.appendChild(make('span', '', option.label));
      if (option.count != null) button.appendChild(make('span', 'mfr-filter__n', String(option.count)));
      if (option.off || option.count === 0) button.disabled = true;
      bar.appendChild(button);
    });

    const press = (key) => bar.querySelectorAll('.mfr-filter').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === key)));
    let applying = false;

    function apply(key) {
      /* The order is the filter's now. racecard.js counts its own clicks
         on each column head (ascending, descending, back to the card's
         order), so a sorted head is clicked back to rest first: its
         arrow and its count then both agree with what is shown. */
      applying = true;
      card.querySelectorAll('.racecard__col[aria-sort]:not([aria-sort="none"])').forEach((th) => {
        for (let i = 0; i < 2 && th.getAttribute('aria-sort') !== 'none'; i++) th.click();
      });
      applying = false;

      /* A hidden row carries an attribute: the page's own scripts keep
         finding it by its class. */
      const hide = (r, off) => r.toggleAttribute('data-mfr-hidden', off);
      rows.forEach((r) => hide(r, false));
      cardOrder.forEach((r) => list.appendChild(r));

      if (key === 'top-ai') {
        rows.forEach((r) => hide(r, stars(r) < 3));
        rows.slice().sort((a, b) => stars(b) - stars(a)).forEach((r) => list.appendChild(r));
      } else if (key === 'steamers') {
        rows.forEach((r) => hide(r, !steaming(r)));
      } else if (key === 'sr-sort') {
        rows.slice().sort((a, b) => rating(b) - rating(a)).forEach((r) => list.appendChild(r));
      } else if (key === 'form-up') {
        rows.forEach((r) => hide(r, formTrend(r) <= 0.5));
      }
    }

    bar.addEventListener('click', (e) => {
      const button = e.target.closest('.mfr-filter');
      if (!button || button.disabled) return;
      press(button.dataset.filter);
      apply(button.dataset.filter);
    });

    /* And the other way round: "Sort by SR" is an order, not a filter,
       so once a column head sorts the race (racecard.js, on a click of
       the head) it is no longer what is shown, and the bar goes back to
       All. A filter that hides runners stays pressed: the head sorts
       what is left. */
    card.addEventListener('click', (e) => {
      if (applying || !e.target.closest('.racecard__col[data-sortable]')) return;
      const pressed = bar.querySelector('.mfr-filter[aria-pressed="true"]');
      if (pressed && pressed.dataset.filter === 'sr-sort') press('all');
    });

    /* Comments on / off, where this race has any (see comments()). */
    if (card.querySelector('.racecard__comment:not(.racecard__comment--empty), .rc-spotlight')) {
      const toggle = make('button', 'mfr-switch');
      toggle.type = 'button';
      toggle.setAttribute('role', 'switch');
      toggle.setAttribute('aria-checked', 'true');
      toggle.appendChild(make('span', 'mfr-switch__label', 'Comments'));
      toggle.appendChild(make('span', 'mfr-switch__track'));
      bar.appendChild(toggle);
    }

    race.insertBefore(bar, card);
  }

  /* Every runner's comment and AI verdict can be shown in full, which
     makes a long page. One switch (repeated on every race, all in step)
     folds them away for a compact card of figures only; the choice is
     remembered on the device. The phone card is not affected: there the
     comment already opens from each runner's Details.

     Until a reader has chosen, the comments start shown where a runner
     is a row of a table, and folded where the race list is only wide
     enough for two lines a runner (a laptop, beside the docked slip):
     there a comment under every runner made a 13-runner race some
     3,500px long. The widths are the stylesheet's own two steps. */
  function comments() {
    const KEY = 'mfr-comments';
    const TWO_LINES = [660, 1000];
    const switches = () => document.querySelectorAll('.mfr-switch');
    const list = document.querySelector('.mf-races');
    function set(on) {
      document.documentElement.toggleAttribute('data-mfr-compact', !on);
      switches().forEach((button) => button.setAttribute('aria-checked', String(on)));
    }
    const byRoom = () => {
      const width = list ? list.clientWidth : 0;
      return !(width >= TWO_LINES[0] && width < TWO_LINES[1]);
    };
    let chosen = null;
    try {
      chosen = localStorage.getItem(KEY);
    } catch (e) {
      /* private mode: the default, and the choice lasts for this visit */
    }
    let on = chosen === 'on' ? true : chosen === 'off' ? false : byRoom();
    set(on);
    /* With no choice made, the default follows the room as it changes
       (a window resized, a tablet turned). */
    if (chosen == null && list && 'ResizeObserver' in window) {
      const follow = new ResizeObserver(() => {
        if (chosen != null) return;
        const next = byRoom();
        if (next !== on) { on = next; set(on); }
      });
      follow.observe(list);
    }
    document.addEventListener('click', (e) => {
      if (!e.target.closest || !e.target.closest('.mfr-switch')) return;
      on = !on;
      chosen = on ? 'on' : 'off';
      set(on);
      try {
        localStorage.setItem(KEY, on ? 'on' : 'off');
      } catch (err) {
        /* as above */
      }
    });
  }

  /* ── 8. The favourite and the top rating ─────────────────────── */

  /* Two runners in each race are picked out in gold: the favourite (the
     shortest price) and the top Saturday Rating. Both are read from the
     rows' own data; ties are all marked; a race with fewer than two
     priced or rated runners is left alone. The mark is an attribute on
     the row, for the stylesheet, with the meaning as a tooltip. */
  function marks(card) {
    const rows = Array.from(card.querySelectorAll('.racecard__runner')).filter((r) => r.dataset.nr !== '1');

    const best = (value, pick) => {
      const scored = rows.map((r) => [r, value(r)]).filter(([, v]) => Number.isFinite(v) && v > 0);
      if (scored.length < 2) return [];
      const target = pick(...scored.map(([, v]) => v));
      return scored.filter(([, v]) => Math.abs(v - target) < 1e-9).map(([r]) => r);
    };

    best((r) => parseFloat(r.dataset.oddsDecimal), Math.min).forEach((row) => {
      row.setAttribute('data-mfr-fav', '');
      const price = row.querySelector('.racecard__odds');
      if (price && !price.title) price.title = 'Favourite';
    });
    best((r) => parseFloat(r.dataset.sr), Math.max).forEach((row) => {
      row.setAttribute('data-mfr-top', '');
      const rating = row.querySelector('.racecard__cell--sr .racecard__sr');
      if (rating && !rating.title) rating.title = 'Top Saturday Rating in this race';
    });
  }

  /* ── 8b. The phone script's tab stops ────────────────────────── */

  /* On a phone racecard_collapse.js makes every runner row a tab stop
     that opens its own compact view on Enter or Space. That view is
     not shown here (Details is the way in, a button in the tab order),
     so the stops would be a hundred or more dead ones. They are taken
     off, and taken off again whenever the script puts them back (it
     sets itself up afresh each time the window crosses 640px). Its
     tap-to-expand is left alone: it toggles an attribute nothing reads. */
  function untab() {
    const strip = (row) => {
      if (row.matches && row.matches('.racecard__runner') && row.getAttribute('tabindex') === '0') row.removeAttribute('tabindex');
    };
    document.querySelectorAll('.racecard__runner').forEach(strip);
    new MutationObserver((records) => records.forEach((r) => strip(r.target))).observe(document.body, {
      attributes: true,
      attributeFilter: ['tabindex'],
      subtree: true,
    });
  }

  /* ── 9. Sorting from the keyboard ────────────────────────────── */

  /* The page's script sorts a column on a click of its head. The heads
     are given a place in the tab order, and Enter or Space sorts. */
  function sortKeys() {
    document.querySelectorAll('.racecard__col[data-sortable]').forEach((th) => th.setAttribute('tabindex', '0'));
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const th = e.target.closest && e.target.closest('.racecard__col[data-sortable]');
      if (!th || e.target !== th) return;
      e.preventDefault();
      th.click();
    });
  }

  function init() {
    labels();
    form();
    numbers();
    once();
    untip();
    document.querySelectorAll('.racecard__runner').forEach((row) => {
      underName(row);
      details(row);
    });
    document.querySelectorAll('[data-racecard]').forEach(filters);
    document.querySelectorAll('[data-racecard]').forEach(marks);
    comments();
    untab();
    sortKeys();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
