/* wire_rail.js — the rail of silks under §1 The Lead.
 *
 * The rail ([data-wire-rail]) scrolls sideways on its own; its two
 * arrows step it by most of a screenful, and each hides at its end of
 * the rail (on a phone wire.css hides both, and the rail is swiped).
 * Where every horse fits, neither shows. The arrows are checked as the
 * rail scrolls and whenever its track changes size, measured after the
 * browser has laid it out.
 *
 * It reads the rail's .wire-rail__track and its two .wire-rail__arrow
 * buttons, and writes only `hidden` on the arrows.
 */
(function () {
  'use strict';

  const STEP = 0.8;
  const SLACK = 4;
  const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('[data-wire-rail]').forEach((rail) => {
    const track = rail.querySelector('.wire-rail__track');
    const prev = rail.querySelector('.wire-rail__arrow--prev');
    const next = rail.querySelector('.wire-rail__arrow--next');
    if (!track || !prev || !next) return;

    function update() {
      const end = track.scrollWidth - track.clientWidth;
      prev.hidden = track.scrollLeft <= SLACK;
      next.hidden = track.scrollLeft >= end - SLACK;
    }
    function step(direction) {
      track.scrollBy({ left: direction * track.clientWidth * STEP, behavior: calm() ? 'auto' : 'smooth' });
    }

    prev.addEventListener('click', () => step(-1));
    next.addEventListener('click', () => step(1));
    track.addEventListener('scroll', update, { passive: true });
    // Called once on observing, so the arrows start right.
    new ResizeObserver(update).observe(track);
  });
})();
