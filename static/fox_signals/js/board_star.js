/* Fox Signals — B5 star-toggle handler.
 *
 * Intercepts clicks on any <button data-fx-star> under the Board,
 * posts to the toggle endpoint, and flips the visual state in
 * place. Row's <a> navigation is prevented so the star click
 * doesn't also open the race page.
 *
 * Progressive enhancement: without JS, the button is inert (still
 * renders with the initial state baked server-side). We ship the
 * proper Stable page separately for the no-JS path.
 */
(function () {
  'use strict';

  var ENDPOINT_META = 'fx-toggle-pin-url';
  var CSRF_COOKIE   = 'csrftoken';

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  function endpoint() {
    var meta = document.querySelector('meta[name="' + ENDPOINT_META + '"]');
    return meta ? meta.getAttribute('content') : null;
  }

  function paintButton(btn, pinned) {
    var glyph = btn.querySelector('.fx-board__star-glyph');
    btn.classList.toggle('fx-board__star--on', pinned);
    btn.setAttribute('aria-pressed', pinned ? 'true' : 'false');
    btn.setAttribute(
      'aria-label',
      pinned ? 'Remove from Stable' : 'Star to Stable'
    );
    if (glyph && glyph.classList.contains('mfr-i')) {
      // v2 Board: the star is an icon, not a character.
      glyph.classList.toggle('mfr-i--star-fill', pinned);
      glyph.classList.toggle('mfr-i--star', !pinned);
    } else if (glyph) {
      glyph.textContent = pinned ? '★' : '☆';
    }
    // Mirror on the row so CSS can tint / accent the whole strip.
    var row = btn.closest('.fx-board__row, .fxv-row');
    if (row) row.classList.toggle('fx-board__row--pinned', pinned);
  }

  function handleClick(evt) {
    var btn = evt.target.closest('[data-fx-star]');
    if (!btn) return;
    // Star lives inside the row's anchor — stop the click from
    // navigating to the race page.
    evt.preventDefault();
    evt.stopPropagation();

    var url = endpoint();
    if (!url) return;

    var raceId = btn.getAttribute('data-fx-star');
    var body   = new URLSearchParams({ race_id: raceId });

    // Optimistic paint — flip immediately, roll back on server error.
    var wasPinned = btn.classList.contains('fx-board__star--on');
    paintButton(btn, !wasPinned);
    btn.disabled = true;

    fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'X-CSRFToken': getCookie(CSRF_COOKIE),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    })
      .then(function (resp) { return resp.ok ? resp.json() : Promise.reject(resp); })
      .then(function (data) {
        // Server is truth — reconcile in case optimistic guess was wrong.
        if (data && typeof data.pinned === 'boolean') {
          paintButton(btn, data.pinned);
        }
      })
      .catch(function () {
        // Roll back the optimistic paint.
        paintButton(btn, wasPinned);
      })
      .then(function () { btn.disabled = false; });
  }

  document.addEventListener('click', handleClick);
})();
