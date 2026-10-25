/*
 * The Enclosure — Steward briefing form (E13).
 *
 * Async form submit for the Post-to-the-room briefing writer.
 * Progressive enhancement: without JS the form still works as a
 * plain POST (redirect back to /steward/ on success), but with JS
 * it stays on the page, clears the input, updates the "Briefings"
 * counter and shows a short confirmation without a reload.
 *
 * Nonce is generated per submit so double-taps dedupe cleanly.
 * The submit button is disabled while a request is in flight to
 * kill the "why didn't it fire" second tap that guarantees a
 * duplicate.
 */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function csrfToken() {
    var m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function nonce() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  ready(function () {
    var form = document.querySelector('.enc-steward-briefing[data-endpoint]');
    if (!form) return;

    var endpoint = form.getAttribute('data-endpoint');
    var headline = form.querySelector('[name="headline"]');
    var body     = form.querySelector('[name="body"]');
    var status   = form.querySelector('[data-role="status"]');
    var submit   = form.querySelector('button[type="submit"]');
    var counter  = document.querySelector('[data-role="briefings-total"]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submit.disabled) return;

      var payload = new FormData();
      payload.append('headline', headline.value);
      payload.append('body', body ? body.value : '');
      payload.append('client_nonce', nonce());

      submit.disabled = true;
      status.textContent = 'Posting…';
      status.classList.remove('is-error');

      fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRFToken': csrfToken() },
        body: payload,
      })
        .then(function (r) {
          return r.json().then(function (j) { return { ok: r.ok, data: j }; });
        })
        .then(function (result) {
          if (!result.ok || !result.data.ok) {
            var msg = (result.data && result.data.error) || 'Something went wrong.';
            status.textContent = msg;
            status.classList.add('is-error');
            return;
          }
          headline.value = '';
          if (body) body.value = '';
          status.textContent = 'Posted to the room.';
          if (counter && typeof result.data.briefings_total === 'number') {
            counter.textContent = String(result.data.briefings_total);
          }
        })
        .catch(function () {
          status.textContent = 'Network hiccup — try again.';
          status.classList.add('is-error');
        })
        .then(function () {
          submit.disabled = false;
        });
    });
  });
})();
