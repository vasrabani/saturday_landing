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

  function here() {
    const chips = Array.from(document.querySelectorAll('[data-jump-target]'));
    const races = chips.map((chip) => document.getElementById(chip.getAttribute('data-jump-target')));
    if (!chips.length || races.some((race) => !race)) return;

    function current() {
      /* The line is a little over a third of the way down the window. */
      const line = window.innerHeight * 0.35;
      let at = -1;
      races.forEach((race, i) => {
        if (race.getBoundingClientRect().top <= line) at = i;
      });
      /* Past the end of the last race: nowhere. */
      if (at === races.length - 1 && races[at].getBoundingClientRect().bottom < line) at = -1;
      return at;
    }

    function mark() {
      const at = current();
      chips.forEach((chip, i) => {
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
    const watch = new MutationObserver(soon);
    chips.forEach((chip) => watch.observe(chip, { attributes: true, attributeFilter: ['class'] }));
    mark();
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
     in the tabs should read as turning to that part of the card, not as
     leaving the page. Each meeting is still a page of its own (its
     address can be kept, sent and gone back to), and all seven scripts
     start cleanly on it. What makes the move feel in place:

       - where the reader stood. The tabs' distance from the top of the
         window is noted on the way out and given back on the way in,
         by the two lines of script the template puts straight after
         the tabs, before the races under them are even parsed. Nothing
         jumps to the top of a new masthead;
       - the slip, which bet_slip.js keeps on the device for the day;
       - the turn itself: where the browser can, the two pages
         cross-fade with the tabs and the slip held still (the
         stylesheet's @view-transition), and the next meeting is
         fetched as soon as a tab is pointed at.

     A staff preview's ?design= goes along, so the preview is not left
     by its own tabs. */
  function meetings() {
    const tabs = document.querySelector('[data-mf-switcher]');
    if (!tabs) return;
    const KEY = 'mfr-meeting-turn';
    const links = Array.from(document.querySelectorAll('a.mf-switcher__chip[href], .mf-paddles a[href]'));
    const isMeeting = (url) => url.origin === window.location.origin && /\/full\/?$/.test(url.pathname);

    const design = new URLSearchParams(window.location.search).get('design');
    links.forEach((link) => {
      let url;
      try {
        url = new URL(link.href);
      } catch (e) {
        return;
      }
      if (!isMeeting(url)) return;
      link.setAttribute('data-mfr-meeting', '');
      if (design && !url.searchParams.has('design')) {
        url.searchParams.set('design', design);
        link.href = url.pathname + url.search + url.hash;
      }
    });

    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target.closest && e.target.closest('a[data-mfr-meeting]');
      if (!link) return;
      /* The tabs' place in the window, for the page that is coming. A
         paddle at the foot of the page is a different thing to have
         pressed: from there the next meeting starts at its tabs. */
      const fromTabs = tabs.contains(link);
      try {
        window.sessionStorage.setItem(KEY, JSON.stringify({
          at: Date.now(),
          offset: fromTabs ? Math.round(tabs.getBoundingClientRect().top) : null,
        }));
      } catch (err) {
        /* private mode: the next meeting opens at its top, as before */
      }
      /* Pressed, and it shows at once: the tab takes the current one's
         look while the next meeting comes. */
      if (fromTabs) {
        tabs.setAttribute('data-mfr-turning', '');
        link.setAttribute('data-mfr-going', '');
        link.setAttribute('aria-busy', 'true');
      }
    });

    /* A page restored from the back/forward cache comes back as it was
       left, mid-turn. Put its tabs right. */
    window.addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      tabs.removeAttribute('data-mfr-turning');
      links.forEach((link) => {
        link.removeAttribute('data-mfr-going');
        link.removeAttribute('aria-busy');
      });
    });

    /* Fetch a meeting when its tab is pointed at or pressed, where the
       browser has speculation rules; elsewhere the tab is a link like
       any other. */
    if (window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
      const rules = document.createElement('script');
      rules.type = 'speculationrules';
      rules.textContent = JSON.stringify({
        prefetch: [{ where: { selector_matches: 'a[data-mfr-meeting]' }, eagerness: 'moderate' }],
      });
      document.head.appendChild(rules);
    }
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
