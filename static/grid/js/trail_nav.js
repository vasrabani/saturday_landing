/* trail_nav.js — mobile drawer for the legend/filter sidebar.
 *
 * Desktop (>=1080px): sidebar is a persistent left rail via CSS.
 * The trigger button and backdrop are display:none, so this file
 * effectively no-ops there. Mobile: tap the trigger to slide the
 * panel in from the left; tap backdrop, close chevron, or Escape
 * to dismiss.
 */
(function () {
  'use strict';

  var panel    = document.querySelector('[data-role="nav-panel"]');
  var trigger  = document.querySelector('[data-role="nav-open"]');
  var backdrop = document.querySelector('[data-role="nav-backdrop"]');
  if (!panel || !trigger || !backdrop) return;

  var closeBtn = panel.querySelector('[data-role="nav-close"]');

  function open() {
    panel.classList.add('is-open');
    backdrop.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('trail-nav-lock');
  }

  function close() {
    panel.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('trail-nav-lock');
  }

  trigger.addEventListener('click', open);
  backdrop.addEventListener('click', close);
  if (closeBtn) closeBtn.addEventListener('click', close);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.classList.contains('is-open')) close();
  });
}());
