/*
 * The Enclosure — avatar → identity sheet.
 *
 * Same open/close pattern the maker_mark About sheet uses. Progressive
 * enhancement: if JS is off, the avatar button does nothing on click
 * — a tolerable failure mode since the sheet content (sign-in link,
 * sign-out form) also lives at their own URLs.
 */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var sheet = document.getElementById('enc-avatar-sheet');
    var openers = document.querySelectorAll('[data-role="avatar-open"]');
    if (!sheet || !openers.length) return;

    var closeBtn = sheet.querySelector('[data-role="close"]');
    var lastFocus = null;

    function setExpanded(state) {
      openers.forEach(function (btn) {
        btn.setAttribute('aria-expanded', state ? 'true' : 'false');
      });
    }

    function open() {
      lastFocus = document.activeElement;
      sheet.hidden = false;
      setExpanded(true);
      if (closeBtn) closeBtn.focus();
    }

    function close() {
      sheet.hidden = true;
      setExpanded(false);
      if (lastFocus && typeof lastFocus.focus === 'function') {
        try { lastFocus.focus(); } catch (e) { /* focused element gone */ }
      }
    }

    openers.forEach(function (btn) {
      btn.addEventListener('click', open);
    });
    if (closeBtn) closeBtn.addEventListener('click', close);

    document.addEventListener('click', function (e) {
      if (sheet.hidden) return;
      if (sheet.contains(e.target)) return;
      if (e.target.closest('[data-role="avatar-open"]')) return;
      close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !sheet.hidden) {
        e.preventDefault();
        close();
      }
    });
  });
}());
