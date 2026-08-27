/**
 * Fox battle card: lazy-load portrait art + light binary decoration.
 * - Portrait SVG is deferred until the hero nears the viewport (saves bandwidth on initial load).
 * - Binary ticks are skipped while the tab is hidden.
 * - Respects prefers-reduced-motion (static binary, still loads art when visible).
 */
(function () {
  'use strict';

  function cssUrl(u) {
    return 'url(' + JSON.stringify(String(u)) + ')';
  }

  function attachFoxArt(center) {
    if (!center || !center.hasAttribute('data-fox-art')) return;
    var url = center.getAttribute('data-fox-art');
    if (!url) return;
    center.style.setProperty('--fox-battle-art', cssUrl(url));
    center.removeAttribute('data-fox-art');
  }

  function initDeferredPortrait() {
    var hero = document.querySelector('.battle-card__fox-hero');
    if (!hero) return;
    var center = hero.querySelector('.battle-card__fox-center');
    if (!center || !center.hasAttribute('data-fox-art')) return;

    function loadArt() {
      attachFoxArt(center);
    }

    if (typeof IntersectionObserver !== 'undefined') {
      var io = new IntersectionObserver(
        function (entries) {
          for (var i = 0; i < entries.length; i += 1) {
            if (!entries[i].isIntersecting) continue;
            loadArt();
            io.disconnect();
            return;
          }
        },
        { root: null, rootMargin: '200px 0px 200px 0px', threshold: 0.01 }
      );
      io.observe(hero);
    } else {
      loadArt();
    }
  }

  function randomBits(len) {
    var s = '';
    for (var i = 0; i < len; i += 1) {
      s += Math.random() < 0.5 ? '0' : '1';
    }
    return s;
  }

  function tick(el) {
    if (document.hidden) return;
    var rows = 12;
    var cols = 96;
    var out = [];
    for (var r = 0; r < rows; r += 1) {
      out.push(randomBits(cols));
    }
    el.textContent = out.join('\n');
  }

  function initBinary() {
    var hero = document.querySelector('.battle-card__fox-hero');
    if (!hero) return;

    var el = hero.querySelector('.battle-card__fox-binary');
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = '01001101 01010010 01000110 01001111 01011000';
      return;
    }

    tick(el);
    window.setInterval(function () {
      tick(el);
    }, 800);
  }

  function init() {
    initDeferredPortrait();
    initBinary();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
