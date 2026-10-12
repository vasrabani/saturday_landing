/* trail_day.js — choosing another day's trail.
 *
 * The masthead has a link to the race day before this one, a link to
 * the one after (up to today), and a small form with a date field.
 * Without this file the form is a date field and a Go button. With it
 * the field is put out of sight behind a calendar button that opens
 * the browser's own date picker, and choosing a day goes there at
 * once.
 *
 * Markup: .trail__days in the masthead. Zero deps; if a hook is
 * missing the form stays as it was rendered.
 */
(function () {
  'use strict';

  var form = document.querySelector('[data-role="day-form"]');
  if (!form) return;

  var field  = form.querySelector('input[type="date"]');
  var button = form.querySelector('[data-role="day-pick"]');
  if (!field || !button) return;

  var shown = field.value;   // the day on the page

  function openPicker() {
    // showPicker is the only way to open the browser's calendar from
    // another control. Where it is missing, or refuses, the field takes
    // the focus instead and can be typed into.
    try {
      if (typeof field.showPicker === 'function') { field.showPicker(); return; }
    } catch (_e) { /* not allowed here: fall through */ }
    form.classList.remove('is-enhanced');
    field.focus();
  }

  function go() {
    var day = field.value;
    if (!day || day === shown) return;
    if ((field.min && day < field.min) || (field.max && day > field.max)) return;
    form.submit();
  }

  button.hidden = false;
  form.classList.add('is-enhanced');
  button.addEventListener('click', openPicker);
  // The date in the heading is the obvious thing to press as well. The
  // button stays the control a keyboard or a screen reader finds.
  var title = document.querySelector('.trail__date');
  if (title) {
    title.classList.add('is-pickable');
    title.addEventListener('click', openPicker);
  }
  // A picker fires `change` when a day is chosen. Typing fires it part
  // way through a date in some browsers, which go() ignores.
  field.addEventListener('change', go);
})();
