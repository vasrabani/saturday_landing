/*
 * The Enclosure — Card detail (E16).
 *
 * Three jobs:
 *   1. Tap a runner tile → arm the pick bar (hidden input + enable
 *      Confirm/Update). No network round-trip yet — the guest chooses
 *      a stake, then hits Confirm.
 *   2. Confirm/Update — POST as JSON, swap the pick bar + field HTML
 *      in place so the guest sees their pick reflected without a full
 *      page reload.
 *   3. Live poll — 30s heartbeat that swaps head + pick bar + field.
 *      Stops when the server flags the race as locked or settled.
 *
 * Visibility API pauses the interval when the tab is hidden — the
 * same pattern the cup / home / feed polls use. Progressive
 * enhancement: without JS, tapping a runner just does nothing and
 * the form still submits as a classic POST that 302s back.
 */
(function () {
  'use strict';

  var TICK_MS = 30000;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function csrfToken() {
    var m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  ready(function () {
    var root = document.querySelector('.enc-card-detail');
    if (!root) return;

    var canPost = root.getAttribute('data-can-post') === '1';
    var liveEndpoint = root.getAttribute('data-live-endpoint');
    var pickEndpoint = root.getAttribute('data-pick-endpoint');

    var headSlot   = root.querySelector('[data-role="head"]');
    var pickSlot   = root.querySelector('[data-role="pick"]');
    var letterSlot = root.querySelector('[data-role="letter"]');
    var fieldSlot  = root.querySelector('[data-role="field"]');

    function wireRunners() {
      if (!canPost) return;
      var tiles = fieldSlot.querySelectorAll('[data-role="runner"]');
      tiles.forEach(function (tile) {
        tile.addEventListener('click', function () {
          if (tile.disabled) return;
          armPickFrom(tile);
        });
      });
    }

    function armPickFrom(tile) {
      var form = pickSlot.querySelector('[data-role="pick-form"]');
      if (!form) return;
      var horseInput = form.querySelector('[data-role="horse-input"]');
      var submit     = form.querySelector('[data-role="submit"]');
      var stake      = form.querySelector('[data-role="stake"]');
      var title      = form.querySelector('.enc-cd-pick__title');
      var emptyLine  = form.querySelector('[data-role="empty-title"]');
      var name = tile.getAttribute('data-horse-name') || '';
      var num  = tile.getAttribute('data-runner-number') || '';
      if (!name || !horseInput) return;

      horseInput.value = name;

      if (title) {
        title.classList.remove('enc-cd-pick__title--muted');
        title.innerHTML = '#' + escapeHtml(num) + ' ' + escapeHtml(name);
      }
      if (emptyLine) emptyLine.hidden = true;

      if (stake) stake.disabled = false;
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Confirm pick';
      }

      /* Reflect selection on tiles right away — the poll will
       * reconcile if the server disagrees. */
      fieldSlot.querySelectorAll('[data-role="runner"]').forEach(function (t) {
        var picked = t === tile;
        t.classList.toggle('enc-runner--picked', picked);
        t.setAttribute('aria-pressed', picked ? 'true' : 'false');
      });
    }

    function submitPick(e) {
      var form = e.target.closest('[data-role="pick-form"]');
      if (!form || !canPost) return;
      e.preventDefault();

      var status = form.querySelector('[data-role="status"]');
      var submit = form.querySelector('[data-role="submit"]');
      if (submit.disabled) return;

      var payload = new FormData(form);
      submit.disabled = true;
      if (status) {
        status.textContent = 'Saving…';
        status.classList.remove('is-error');
      }

      fetch(pickEndpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'X-CSRFToken': csrfToken(),
          'Accept': 'application/json',
        },
        body: payload,
      })
        .then(function (r) {
          return r.json().then(function (j) { return { ok: r.ok, data: j }; });
        })
        .then(function (res) {
          if (!res.ok || !res.data.ok) {
            var msg = (res.data && res.data.error) || 'Could not save pick.';
            if (status) {
              status.textContent = msg;
              status.classList.add('is-error');
            }
            submit.disabled = false;
            return;
          }
          if (res.data.pick_html)  pickSlot.innerHTML  = res.data.pick_html;
          if (res.data.field_html) fieldSlot.innerHTML = res.data.field_html;
          wireRunners();
        })
        .catch(function () {
          if (status) {
            status.textContent = 'Network hiccup — try again.';
            status.classList.add('is-error');
          }
          submit.disabled = false;
        });
    }

    /* Delegated so a swapped-in form still submits. */
    pickSlot.addEventListener('submit', submitPick);

    /* ── Live poll ────────────────────────────────────────────── */
    var timer = null;
    var stopped = root.getAttribute('data-stop-flag') === '1';

    function tick() {
      if (stopped) { stop(); return; }
      fetch(liveEndpoint, {
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' },
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j) return;
          if (j.head_html)  headSlot.innerHTML  = j.head_html;
          if (j.pick_html)  pickSlot.innerHTML  = j.pick_html;
          /* Letter panel: may be published mid-day, or hidden if the
           * editor unpublishes it — always overwrite (empty string
           * collapses the slot). */
          if (letterSlot && typeof j.letter_html === 'string') {
            letterSlot.innerHTML = j.letter_html;
          }
          if (j.field_html) fieldSlot.innerHTML = j.field_html;
          wireRunners();
          if (j.stop_flag) { stopped = true; stop(); }
        })
        .catch(function () { /* keep the interval — transient errors are fine */ });
    }

    function start() {
      if (timer || stopped) return;
      timer = setInterval(tick, TICK_MS);
    }
    function stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else start();
    });

    /* Keyboard prev/next — desktop / keyboard-only guests get free
     * race navigation via ← / → arrows on the header chevrons. No
     * effect on mobile touch guests; ignored when a text field is
     * focused so it can't hijack typing. */
    document.addEventListener('keydown', function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.target && e.target.isContentEditable) return;
      var role = e.key === 'ArrowLeft' ? 'race-prev' : 'race-next';
      var link = headSlot && headSlot.querySelector('[data-role="' + role + '"]');
      if (link && link.href) {
        e.preventDefault();
        window.location.href = link.href;
      }
    });

    wireRunners();
    if (!document.hidden) start();
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;',
        '"': '&quot;', "'": '&#39;',
      })[c];
    });
  }
})();
