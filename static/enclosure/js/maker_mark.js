/*
 * The Enclosure — maker's mark strip → About Saturday Racing sheet.
 *
 * Progressive enhancement: the mark button always renders; if JS is
 * off the button does nothing (no About sheet), which is a fine
 * failure mode — the sage strip still carries the brand mark.
 */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var sheet = document.getElementById('enc-about-sheet');
    var openers = document.querySelectorAll('[data-role="mark-open"]');
    if (!sheet || !openers.length) return;

    var closeBtn = sheet.querySelector('[data-role="close"]');
    var lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      sheet.hidden = false;
      // Focus the close button so Esc / tab loops work.
      if (closeBtn) closeBtn.focus();
    }

    function close() {
      sheet.hidden = true;
      if (lastFocus && typeof lastFocus.focus === 'function') {
        try { lastFocus.focus(); } catch (e) { /* focused element gone */ }
      }
    }

    openers.forEach(function (btn) {
      btn.addEventListener('click', open);
    });
    if (closeBtn) closeBtn.addEventListener('click', close);

    // Tap-outside dismisses.
    document.addEventListener('click', function (e) {
      if (sheet.hidden) return;
      if (sheet.contains(e.target)) return;
      // Ignore clicks on the mark button — its own handler opens it.
      var opener = e.target.closest('[data-role="mark-open"]');
      if (opener) return;
      close();
    });

    // Escape closes.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !sheet.hidden) {
        e.preventDefault();
        close();
      }
    });
  });
}());
