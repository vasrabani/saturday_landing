/**
 * SATURDAY RACING — deferred section backgrounds (landing page)
 * static/public/js/defer-bg.js
 *
 * Pairs with static/public/css/defer-bg.css. Each [data-defer-bg] section, and the
 * footer, keeps its CSS backgrounds switched off until it comes within
 * LOOKAHEAD of the screen; then .is-bg-ready lets them load. The margin
 * is generous so a background has arrived before the section scrolls
 * into view at normal speed.
 *
 * Fails open: without IntersectionObserver every section is marked
 * ready at once, which is simply the page as it was.
 */
(function () {
  'use strict';

  var LOOKAHEAD = '1200px 0px';
  var READY = 'is-bg-ready';
  var sections = Array.prototype.slice.call(
    document.querySelectorAll('[data-defer-bg], footer.sf')
  );
  if (!sections.length) return;

  function ready(el) {
    el.classList.add(READY);
  }

  if (!('IntersectionObserver' in window)) {
    sections.forEach(ready);
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      ready(entry.target);
      observer.unobserve(entry.target);
    });
  }, { rootMargin: LOOKAHEAD });

  sections.forEach(function (el) {
    observer.observe(el);
  });
})();
