/* wire_card.js — signing up for the 10:00 Card.
 *
 * The form ([data-wire-card]) is a normal POST to its action, with the
 * CSRF token Django checks, so it works without this script. With it,
 * the form is sent in the background: the button waits while it goes,
 * and the status line under the form ([data-wire-card-status], a polite
 * live region) shows the server's answer, its message or the reason it
 * said no. The address is checked by the browser first (type="email",
 * required). The wording for a server that does not answer lives on the
 * status line (data-wire-offline).
 *
 * It writes the status line's text and data-state, and the button's
 * `disabled` while the form is on its way.
 */
(function () {
  'use strict';

  const form = document.querySelector('[data-wire-card]');
  if (!form) return;

  const status = form.parentElement.querySelector('[data-wire-card-status]');
  const button = form.querySelector('button[type="submit"]');
  if (!status || !button) return;

  function say(text, state) {
    status.textContent = text;
    status.setAttribute('data-state', state);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    button.disabled = true;
    fetch(form.action, {
      method: 'POST',
      body: new URLSearchParams(new FormData(form)),
      headers: { Accept: 'application/json' },
    })
      .then((response) => response.json())
      .then((answer) => {
        if (answer.ok) {
          say(answer.message, 'ok');
          form.reset();
        } else {
          say(answer.error, 'error');
        }
      })
      .catch(() => say(status.getAttribute('data-wire-offline'), 'error'))
      .finally(() => { button.disabled = false; });
  });
})();
