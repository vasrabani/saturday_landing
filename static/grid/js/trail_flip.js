/* GRID-FLIP · Magic flip toggle for the Fox Trail.
 *
 * A chip above the grid flips every settled cell (won/placed/lost/void)
 * to reveal a big finish position. Non-settled cells stay put — nothing
 * to reveal. Toggle state persists per-viewer in localStorage.
 *
 * Live-poll integration: the poller patches classes in place when a race
 * settles. A MutationObserver watches for `.cell--won/placed/lost/void`
 * transitions and, if the toggle is on, applies `.is-flipped` to the
 * newly-settled cell so it flips too. No cross-file coupling.
 *
 * Zero deps, progressive enhancement — if any hook is missing the grid
 * still renders and the front face stays visible.
 */
(function () {
  'use strict';

  var STORE_KEY  = 'trail_flip_revealed';
  var STAGGER_MS = 32;
  var SETTLED    = ['won', 'placed', 'lost', 'void'];

  var grid   = document.getElementById('trailGrid');
  var toggle = document.querySelector('[data-role="reveal-toggle"]');
  if (!grid || !toggle) return;

  /* ── State ─────────────────────────────────────────────────── */

  function readStored() {
    try { return window.localStorage.getItem(STORE_KEY) === '1'; }
    catch (_e) { return false; }
  }
  function writeStored(on) {
    try { window.localStorage.setItem(STORE_KEY, on ? '1' : '0'); }
    catch (_e) { /* private-window fallback: in-memory only */ }
  }

  var isRevealed = readStored();

  /* ── Apply / clear ─────────────────────────────────────────── */

  function settledCells() {
    return grid.querySelectorAll('.cell[data-settled="1"]');
  }

  function isSettledArticle(article) {
    for (var i = 0; i < SETTLED.length; i++) {
      if (article.classList.contains('cell--' + SETTLED[i])) return true;
    }
    return false;
  }

  function reveal(withStagger) {
    var cells = settledCells();
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (withStagger) {
        (function (c, delay) {
          setTimeout(function () { c.classList.add('is-flipped'); }, delay);
        })(cell, i * STAGGER_MS);
      } else {
        cell.classList.add('is-flipped');
      }
    }
  }

  function conceal() {
    var cells = grid.querySelectorAll('.cell.is-flipped');
    for (var i = 0; i < cells.length; i++) cells[i].classList.remove('is-flipped');
  }

  function paintToggle(on) {
    toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    var label = toggle.querySelector('.trail__reveal-text');
    if (label) {
      label.textContent = on
        ? (label.getAttribute('data-on')  || 'Show picks')
        : (label.getAttribute('data-off') || 'Reveal results');
    }
  }

  /* ── First paint — apply the persisted state without stagger.
   *    Stagger only on user interaction so return visits don't
   *    feel like a slow reveal every time. */
  paintToggle(isRevealed);
  if (isRevealed) reveal(false);

  /* ── User toggle ───────────────────────────────────────────── */

  toggle.addEventListener('click', function () {
    isRevealed = !isRevealed;
    writeStored(isRevealed);
    paintToggle(isRevealed);
    if (isRevealed) reveal(true);
    else            conceal();
  });

  /* ── Live-poll bridge — MutationObserver on the grid.
   *    When trail_live.js patches a cell to a settled state, catch
   *    the class change and (if toggle is on) mirror `.is-flipped`
   *    so the newly-settled result reveals without a page reload.
   *    Also promotes `[data-settled="1"]` so the front-face medal
   *    fade works on freshly-settled cells too. */

  var mo = new MutationObserver(function (records) {
    if (!isRevealed) return;
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.type !== 'attributes' || r.attributeName !== 'class') continue;
      var article = r.target;
      if (!article || !article.classList || !article.classList.contains('cell')) continue;
      if (!isSettledArticle(article)) continue;
      if (article.getAttribute('data-settled') !== '1') {
        article.setAttribute('data-settled', '1');
      }
      if (!article.classList.contains('is-flipped')) {
        article.classList.add('is-flipped');
      }
    }
  });
  mo.observe(grid, {
    attributes:       true,
    attributeFilter:  ['class'],
    subtree:          true,
  });
})();
