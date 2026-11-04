/* wire_nav.js — the site's menus on the news pages.
 *
 * On these pages the nav's links scroll sideways on a narrow screen
 * instead of folding into the menu button (wire.css). A menu placed
 * where chrome.css puts it, centred under its item inside that row,
 * would be clipped by it, so wire.css fixes each menu under the bar and
 * this script sets its left edge: under its own item, and never off the
 * screen. It runs when a menu is about to show (pointer over its item,
 * a click, the keyboard) and again if the row or the window moves while
 * one is open.
 *
 * It reads the nav's markup (.site-nav__dropdown, with its
 * .site-nav__dropdown-trigger and .site-nav__dropdown-menu) and writes
 * only the --wire-menu-left custom property on a menu. site.js still
 * opens and closes the menus; nothing here does.
 */
(function () {
  'use strict';

  const drops = Array.from(document.querySelectorAll('.page-wire .site-nav__dropdown'))
    .map((drop) => ({
      drop,
      trigger: drop.querySelector('.site-nav__dropdown-trigger'),
      menu: drop.querySelector('.site-nav__dropdown-menu'),
    }))
    .filter((item) => item.trigger && item.menu);
  if (!drops.length) return;

  const EDGE = 8;

  /* Under its item's left edge; pulled back in if it would run past the
     right edge of the screen. */
  function place({ trigger, menu }) {
    const screen = document.documentElement.clientWidth;
    const width = menu.offsetWidth;
    const left = Math.min(trigger.getBoundingClientRect().left, screen - width - EDGE);
    menu.style.setProperty('--wire-menu-left', `${Math.round(Math.max(left, EDGE))}px`);
  }

  drops.forEach((item) => {
    item.drop.addEventListener('pointerenter', () => place(item));
    item.drop.addEventListener('focusin', () => place(item));
    // Capture, so the menu is in place before site.js shows it.
    item.trigger.addEventListener('click', () => place(item), true);
  });

  function placeOpen() {
    drops.filter((item) => item.drop.classList.contains('open')).forEach(place);
  }
  const row = document.querySelector('.page-wire .site-nav__links');
  if (row) row.addEventListener('scroll', placeOpen, { passive: true });
  window.addEventListener('resize', placeOpen);
})();
