/* browse_nav.js — the meeting tabs on the day's races page.
 *
 *   1. The tab of the meeting in view is marked current
 *      (aria-current="true"), and kept in sight inside the tab bar when
 *      there are more tabs than the bar can show.
 *   2. A tab lands its meeting below the pinned navigation and tabs,
 *      where the meeting's scroll-margin says, and takes the keyboard
 *      to the meeting's name. (site.js scrolls every in-page link to
 *      76px from the top of the window, which here is under the tabs.)
 *   3. The tabs' real height is published as --rbr-nav on <body>, which
 *      that scroll-margin is made of.
 *
 * It reads the template's markup (.meeting-nav, its .meeting-tab links
 * to "#meeting-n", the .meeting-block with that id) and writes only
 * aria-current on a tab, tabindex="-1" on a meeting's name when the
 * keyboard is taken there, and --rbr-nav. The page's spoiler script is
 * untouched.
 */
(function () {
  'use strict';

  const nav = document.querySelector('.meeting-nav');
  if (!nav) return;

  const meetings = Array.from(nav.querySelectorAll('a.meeting-tab[href^="#"]'))
    .map((tab) => ({ tab, block: document.getElementById(tab.getAttribute('href').slice(1)) }))
    .filter((meeting) => meeting.block);
  if (!meetings.length) return;

  const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 3. The tabs' height ─────────────────────────────────────── */

  function measure() {
    document.body.style.setProperty('--rbr-nav', `${Math.round(nav.getBoundingClientRect().height)}px`);
  }

  /* ── 1. The meeting in view ──────────────────────────────────── */

  /* The meeting is the last one whose top has passed a line a quarter
     of the way down what the pinned bars leave of the window. At the
     foot of the page it is the last meeting, which may be too short
     ever to reach the line. Above the first meeting no tab is marked. */
  function inView() {
    const below = nav.getBoundingClientRect().bottom;
    const line = below + (window.innerHeight - below) / 4;
    let found = null;
    for (const meeting of meetings) {
      if (meeting.block.getBoundingClientRect().top <= line) found = meeting;
    }
    const last = meetings[meetings.length - 1];
    const atFoot = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (found && atFoot && last.block.getBoundingClientRect().top < window.innerHeight) found = last;
    return found;
  }

  /* The bar scrolls to bring the tab to its middle; the page does not move. */
  function keepInSight(tab) {
    if (nav.scrollWidth <= nav.clientWidth) return;
    const left = tab.offsetLeft - (nav.clientWidth - tab.offsetWidth) / 2;
    nav.scrollTo({ left: Math.max(0, left), behavior: calm() ? 'auto' : 'smooth' });
  }

  let current = null;

  function mark() {
    const found = inView();
    if (found === current) return;
    if (current) current.tab.removeAttribute('aria-current');
    current = found;
    if (current) {
      current.tab.setAttribute('aria-current', 'true');
      keepInSight(current.tab);
    }
  }

  let queued = false;
  function soon() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;
      mark();
    });
  }

  /* ── 2. A tab lands its meeting ──────────────────────────────── */

  /* Runs after site.js's own handler (the same click, later in the
     bubble), and takes over its scroll. */
  nav.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const meeting = meetings.find(({ tab }) => tab.contains(e.target));
    if (!meeting) return;
    e.preventDefault();
    meeting.block.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
    /* The keyboard goes to the meeting too, or the next Tab would carry
       on from the tab bar, a screen away from what is now on it. The
       name is made focusable for this and nothing else. */
    const name = meeting.block.querySelector('.meeting-block__name') || meeting.block;
    if (!name.hasAttribute('tabindex')) name.setAttribute('tabindex', '-1');
    name.focus({ preventScroll: true });
    if (window.history.replaceState) window.history.replaceState(null, '', meeting.tab.getAttribute('href'));
  });

  window.addEventListener('scroll', soon, { passive: true });
  window.addEventListener('resize', soon);
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      measure();
      soon();
    }).observe(nav);
  } else {
    window.addEventListener('resize', measure);
  }
  measure();
  mark();
})();
