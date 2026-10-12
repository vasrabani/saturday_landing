/* meeting_masthead.js — the top of the page: the masthead, the meeting
 * tabs and the race strip.
 *
 *   1. Pick Six's stamp is lettered like a seal, with the link's own
 *      two words round the ring: the name over the top, "Challenge"
 *      under it.
 *   2. "8r" on a meeting tab reads "8 races" (the word in a span of its
 *      own, so a phone, where two courses share a row, can show the
 *      number alone).
 *   3. The race strip is one row when the races fit and more when they
 *      do not. Its real height is published for everything pinned or
 *      scrolled to beneath it, and a second row is split evenly (five
 *      and four, not eight and one).
 *   4. "You are here" in the strip. The page's script marks the race
 *      with the largest share of itself inside a band of the window,
 *      which a big field never has: next to a short race that is just
 *      leaving the band it loses, and the strip goes on marking the
 *      race above. Here the race is simply the one that the line a
 *      third of the way down the window falls in, and that answer is
 *      kept whatever the page's script writes.
 *   5. Jumps to a race land below the pinned bars, where the race's
 *      scroll-margin says, not under them. (site.js scrolls every
 *      in-page link to 76px from the top of the window; with the tour
 *      strip and the race strip pinned, that is under them.)
 *
 * Everything added is an element with an mfr- class ("meeting full,
 * revamp"), read by meeting.css and by nothing else; --mfr-strip on
 * <body> is the strip's measured height. The page's own scripts are
 * untouched.
 */
(function () {
  'use strict';

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /* Replace a label's text; returns the span that now holds it. */
  function reword(node, text) {
    node.textContent = '';
    return node.appendChild(make('span', 'mfr-text', text));
  }

  /* ── 1. Pick Six: the lettering round its stamp ──────────────── */

  /* The stamp is the six in a ring, lettered like a seal: the name over
     the top, "Challenge" under it, a dot at each side. Both words are
     the link's own ("Pick Six" and its "CHALLENGE" ribbon), and each
     has half the ring to itself, so a longer word still fits. */
  function ring() {
    const NS = 'http://www.w3.org/2000/svg';
    const draw = (tag, attrs, parent) => {
      const node = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach((name) => node.setAttribute(name, attrs[name]));
      return parent ? parent.appendChild(node) : node;
    };
    document.querySelectorAll('.pick6').forEach((link, n) => {
      const stamp = link.querySelector('.pick6__num');
      const over = link.querySelector('.pick6__lbl');
      const under = link.querySelector('.pick6__stamp');
      if (!stamp || !over || !under || stamp.querySelector('.mfr-ring')) return;

      const svg = draw('svg', { class: 'mfr-ring', viewBox: '0 0 100 100', 'aria-hidden': 'true', focusable: 'false' });
      const defs = draw('defs', {}, svg);
      /* Two half circles about the middle, both drawn left to right: the
         upper one carries its word on its outside, the lower one on its
         inside, so both words stand the right way up in the same band. */
      const arcs = [
        { id: 'mfr-ring-over-' + n, d: 'M13.2,50 A36.8,36.8 0 0 1 86.8,50', text: over.textContent },
        { id: 'mfr-ring-under-' + n, d: 'M5.8,50 A44.2,44.2 0 0 0 94.2,50', text: under.textContent },
      ];
      arcs.forEach((arc) => {
        draw('path', { id: arc.id, d: arc.d }, defs);
        const text = draw('text', {}, svg);
        const path = draw('textPath', { href: '#' + arc.id, startOffset: '50%' }, text);
        path.textContent = arc.text.trim().toUpperCase();
      });
      draw('circle', { cx: '9.5', cy: '50', r: '1.7' }, svg);
      draw('circle', { cx: '90.5', cy: '50', r: '1.7' }, svg);
      stamp.appendChild(svg);
    });
  }

  /* ── 2. "8r" → "8 races" ─────────────────────────────────────── */

  function counts() {
    document.querySelectorAll('.mf-switcher__count').forEach((span) => {
      const m = /^(\d+)r$/.exec(span.textContent.trim());
      if (!m) return;
      const fresh = reword(span, m[1]);
      fresh.appendChild(make('span', 'mfr-word', m[1] === '1' ? ' race' : ' races'));
    });
  }

  /* ── 3. The race strip's rows and height ─────────────────────── */

  function strip() {
    const bar = document.querySelector('[data-mf-jump]');
    if (!bar || !('ResizeObserver' in window)) return;
    const chips = Array.from(bar.querySelectorAll('.mf-jump__chip'));
    let width = -1;

    function balance() {
      bar.style.removeProperty('grid-template-columns');
      if (!chips.length) return;
      const rows = new Set(chips.map((chip) => chip.offsetTop)).size;
      if (rows > 1) {
        bar.style.gridTemplateColumns = 'repeat(' + Math.ceil(chips.length / rows) + ', minmax(0, 1fr))';
      }
    }

    new ResizeObserver(() => {
      if (bar.offsetWidth !== width) {
        width = bar.offsetWidth;
        balance();
      }
      if (bar.offsetHeight) document.body.style.setProperty('--mfr-strip', bar.offsetHeight + 'px');
    }).observe(bar);
  }

  /* ── 4. "You are here" ───────────────────────────────────────── */

  let hereChips = [];
  let hereRaces = [];
  let hereWatch = null;
  let hereMark = () => {};

  /* The strip's chips and the races they go to, as the page has them
     now: read at the start, and again when a turn to another meeting
     has replaced both. */
  function hereRead() {
    hereChips = Array.from(document.querySelectorAll('[data-jump-target]'));
    hereRaces = hereChips.map((chip) => document.getElementById(chip.getAttribute('data-jump-target')));
    if (hereRaces.some((race) => !race)) {
      hereChips = [];
      hereRaces = [];
    }
    if (hereWatch) {
      hereWatch.disconnect();
      hereChips.forEach((chip) => hereWatch.observe(chip, { attributes: true, attributeFilter: ['class'] }));
    }
    hereMark();
  }

  function here() {
    function current() {
      /* The line is a little over a third of the way down the window. */
      const line = window.innerHeight * 0.35;
      let at = -1;
      hereRaces.forEach((race, i) => {
        if (race.getBoundingClientRect().top <= line) at = i;
      });
      /* Past the end of the last race: nowhere. */
      if (at >= 0 && at === hereRaces.length - 1 && hereRaces[at].getBoundingClientRect().bottom < line) at = -1;
      return at;
    }

    function mark() {
      if (!hereChips.length) return;
      const at = current();
      hereChips.forEach((chip, i) => {
        if (chip.classList.contains('is-active') !== (i === at)) chip.classList.toggle('is-active', i === at);
      });
    }

    let queued = false;
    const soon = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        mark();
      });
    };
    window.addEventListener('scroll', soon, { passive: true });
    window.addEventListener('resize', soon);
    /* meeting_full.js writes its own answer at any time (from an
       IntersectionObserver), so every change of class is answered with
       this one. That settles rather than loops: mark() writes only where
       the class differs, and setting a class an element already has is
       not a mutation, so a correction fires no further callback. */
    hereWatch = new MutationObserver(soon);
    hereMark = mark;
    hereRead();
  }

  /* ── 5. Jumps to a race ──────────────────────────────────────── */

  /* Runs after site.js's own handler (same click, later in the bubble)
     and lands the race where its scroll-margin says. */
  function jumps() {
    document.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target.closest && e.target.closest('a[href^="#race-"]');
      const target = link && document.getElementById(link.getAttribute('href').slice(1));
      if (!target) return;
      e.preventDefault();
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
      /* The keyboard goes to the race too, or the next Tab would carry
         on from the strip, a screen away from what is now on it. The
         race is made focusable for this and nothing else. */
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      if (history.replaceState) history.replaceState(null, '', link.getAttribute('href'));
    });
  }

  /* ── 6. Another meeting, in place ────────────────────────────── */

  /* A slip is built across the day's meetings, so choosing another one
     in the tabs turns to that part of the day's card without leaving
     the page: the other meeting is fetched, and its masthead, tabs,
     strip, next-off bar and races take the place of this one's. The
     slip is not touched. The address and the title change with it, and
     Back turns back.

     Seven scripts have set this page up, and the races they set up have
     just gone. Each is asked to start again on what has arrived: the
     site's own three through the entry points they now publish
     (SaturdayRacecard, SaturdayRacecardCollapse, SaturdayMeetingFull),
     the revamp's through window.mfrMeeting, and bet_slip.js by the
     storage event it already listens for, which makes it draw the slip
     again and mark the runners that are in it.

     If anything about this is not as expected (no fetch, a page that is
     not a meeting, another day's slip, an error on the way), the tab
     does what it always did and the browser goes to the meeting's own
     page. On that road the tabs' place in the window is noted, and the
     template gives it back straight after the tabs, so even then
     nothing jumps.

     A staff preview's ?design= goes along. */
  function meetings() {
    const NOTE = 'mfr-meeting-turn';
    const wrap = document.querySelector('.mf-wrap');
    if (!wrap || !document.querySelector('[data-mf-switcher]')) return;

    /* A link to another meeting's page: on this site, a /full/ page (or,
       in the design sandbox, the other captured day). */
    const isMeeting = (url) =>
      url.origin === window.location.origin && (/\/full\/?$/.test(url.pathname) || /\/meeting[-\w]*\.html$/.test(url.pathname));
    const WHERE = '[data-mf-switcher] a[href], .mf-paddles a[href], .mfr-card a[href]';
    const design = new URLSearchParams(window.location.search).get('design');

    function prepare() {
      document.querySelectorAll(WHERE).forEach((link) => {
        let url;
        try {
          url = new URL(link.href);
        } catch (e) {
          return;
        }
        if (!isMeeting(url) || url.pathname === window.location.pathname) return;
        link.setAttribute('data-mfr-meeting', '');
        if (design && !url.searchParams.has('design')) {
          url.searchParams.set('design', design);
          link.href = url.pathname + url.search + url.hash;
        }
      });
    }

    /* ── fetching ── */
    const pages = new Map();          // address → { at, text: Promise<string> }
    const FRESH_MS = 60000;
    function fetchPage(address) {
      const kept = pages.get(address);
      if (kept && Date.now() - kept.at < FRESH_MS) return kept.text;
      const text = fetch(address, { credentials: 'same-origin', headers: { 'X-Requested-With': 'fetch' } }).then((response) => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.text();
      });
      pages.set(address, { at: Date.now(), text });
      text.catch(() => pages.delete(address));
      return text;
    }
    /* Pointed at, or touched: the page is on its way before the press. */
    /* One spelling of a meeting's address, for the fetch, its keeping
       and the history entry alike. */
    const addressOf = (link) => {
      const url = new URL(link.href);
      return url.pathname + url.search;
    };
    const eager = (e) => {
      const link = e.target.closest && e.target.closest('a[data-mfr-meeting]');
      if (link && window.fetch) fetchPage(addressOf(link)).catch(() => {});
    };
    document.addEventListener('pointerover', eager, { passive: true });
    document.addEventListener('touchstart', eager, { passive: true });
    document.addEventListener('focusin', eager);

    /* ── the old road: the browser goes to the page ── */
    function leaveFor(address, fromTabs) {
      const tabs = document.querySelector('[data-mf-switcher]');
      try {
        window.sessionStorage.setItem(NOTE, JSON.stringify({
          at: Date.now(),
          offset: fromTabs && tabs ? Math.round(tabs.getBoundingClientRect().top) : null,
        }));
      } catch (err) {
        /* private mode: the next meeting opens at its top */
      }
      window.location.assign(address);
    }

    /* ── the turn ── */
    const PARTS = ['.mf-hero', '.mf-subnav', '.mf-races'];

    function swap(doc, fromTabs) {
      const fresh = doc.querySelector('.mf-wrap');
      const tabs = document.querySelector('[data-mf-switcher]');
      const stood = tabs ? tabs.getBoundingClientRect().top : null;

      PARTS.forEach((selector) => wrap.querySelector(selector).replaceWith(fresh.querySelector(selector)));
      const oldBar = wrap.querySelector('.mf-next-off');
      if (oldBar) oldBar.remove();
      const bar = fresh.querySelector('.mf-next-off');
      if (bar) wrap.insertBefore(bar, wrap.querySelector('.mf-grid'));
      Array.from(fresh.attributes).forEach((attr) => {
        if (attr.name !== 'class' && attr.name !== 'style') wrap.setAttribute(attr.name, attr.value);
      });
      if (doc.title) document.title = doc.title;

      /* Everyone starts again on what has arrived, in the order they
         load in. */
      const again = (name, call) => {
        try {
          call();
        } catch (err) {
          if (window.console) console.error('meeting turn: ' + name, err);
        }
      };
      again('racecard', () => window.SaturdayRacecard.initCards(wrap));
      again('collapse', () => window.SaturdayRacecardCollapse.init());
      again('meeting_full', () => window.SaturdayMeetingFull.init());
      again('races', () => window.mfrMeeting.races());
      again('masthead', () => {
        ring();
        counts();
        strip();
        hereRead();
        prepare();
      });
      /* bet_slip.js draws the slip again and marks this meeting's
         runners that are in it; then the ticket's side is brought up to
         date against the new rows, tabs and buttons. */
      again('bet_slip', () => window.dispatchEvent(new StorageEvent('storage', { key: wrap.dataset.storageKey })));
      again('slip', () => window.mfrMeeting.slip());

      /* Stand where the reader stood. From the tabs, they stay put;
         from a paddle at the foot of the page, the next meeting starts
         at its tabs. */
      const now = document.querySelector('[data-mf-switcher]');
      if (now) {
        const top = now.getBoundingClientRect().top;
        const pinned = parseFloat(getComputedStyle(document.body).getPropertyValue('--nav-h')) || 64;
        const want = fromTabs && stood != null ? stood : pinned + 16;
        if (Math.abs(top - want) > 1) window.scrollBy({ top: top - want, behavior: 'instant' });
        /* The keyboard stays on the tabs, on the meeting now shown. */
        const current = now.querySelector('.mf-switcher__chip--current');
        if (current && fromTabs) {
          current.setAttribute('tabindex', '-1');
          current.focus({ preventScroll: true });
        }
      }
    }

    const ready = () =>
      window.fetch && window.DOMParser && window.SaturdayRacecard && window.SaturdayRacecardCollapse
      && window.SaturdayMeetingFull && window.mfrMeeting && window.mfrMeeting.races && window.mfrMeeting.slip;

    let turning = 0;
    function turnTo(address, { push, fromTabs }) {
      const turn = ++turning;
      const races = wrap.querySelector('.mf-races');
      if (races) races.setAttribute('aria-busy', 'true');
      return fetchPage(address)
        .then((html) => {
          if (turn !== turning) return;      // another tab was pressed meanwhile
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const fresh = doc.querySelector('.mf-wrap');
          const whole = fresh && PARTS.every((selector) => fresh.querySelector(selector) && wrap.querySelector(selector));
          /* Another day's meeting has another day's slip: that is a
             different page, and is gone to as one. */
          if (!whole || fresh.dataset.storageKey !== wrap.dataset.storageKey) throw new Error('not a meeting of this day');
          const go = () => swap(doc, fromTabs);
          const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (document.startViewTransition && !calm) {
            const moving = document.startViewTransition(go);
            /* swap() throwing rejects this; the catch below then takes
               the old road. */
            return moving.updateCallbackDone;
          }
          go();
        })
        .then(() => {
          if (turn !== turning) return;
          if (push) window.history.pushState({ mfrMeeting: true }, '', address);
          if (typeof window.gtag === 'function') {
            window.gtag('event', 'page_view', { page_location: window.location.href, page_title: document.title });
          }
        })
        .catch(() => {
          if (turn === turning) leaveFor(address, fromTabs);
        });
    }

    prepare();
    /* So that Back, after a turn, has somewhere of this page's to come
       back to. */
    if (window.history.replaceState) {
      window.history.replaceState(Object.assign({}, window.history.state, { mfrMeeting: true }), '');
    }

    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target.closest && e.target.closest('a[data-mfr-meeting]');
      if (!link || link.target === '_blank') return;
      const tabs = document.querySelector('[data-mf-switcher]');
      const fromTabs = !!tabs && tabs.contains(link);
      e.preventDefault();
      /* Pressed, and it shows at once: the tab takes the current one's
         look while the meeting comes. */
      if (fromTabs) {
        tabs.setAttribute('data-mfr-turning', '');
        tabs.querySelectorAll('[data-mfr-going]').forEach((other) => other.removeAttribute('data-mfr-going'));
        link.setAttribute('data-mfr-going', '');
        link.setAttribute('aria-busy', 'true');
      }
      const address = addressOf(link);
      if (!ready()) {
        leaveFor(address, fromTabs);
        return;
      }
      turnTo(address, { push: true, fromTabs });
    });

    /* Back and Forward between meetings turned to in place. */
    window.addEventListener('popstate', (e) => {
      if (!e.state || !e.state.mfrMeeting) return;
      const address = window.location.pathname + window.location.search;
      if (ready()) turnTo(address, { push: false, fromTabs: true });
      else window.location.reload();
    });

    /* A page restored from the back/forward cache comes back as it was
       left, perhaps mid-turn on the old road. Put its tabs right. */
    window.addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      document.querySelectorAll('[data-mfr-turning]').forEach((node) => node.removeAttribute('data-mfr-turning'));
      document.querySelectorAll('[data-mfr-going]').forEach((node) => {
        node.removeAttribute('data-mfr-going');
        node.removeAttribute('aria-busy');
      });
    });
  }

  function init() {
    ring();
    counts();
    strip();
    here();
    jumps();
    meetings();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
