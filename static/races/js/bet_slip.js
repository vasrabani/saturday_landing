/**
 * Saturday Racing — Bet Slip (accumulator)
 *
 * State model:
 *   selections = [
 *     {
 *       runnerId, raceId, raceTime, raceName, course,
 *       horseName, oddsFractional, oddsDecimal
 *     },
 *     ...
 *   ]
 *
 *   stake     — numeric, currency-agnostic (we just multiply odds × stake)
 *   currency  — 'GBP' (£) or 'EUR' (€) — display only
 *
 * Persistence:
 *   localStorage under the date-scoped key the server passes in
 *   data-storage-key on .mf-wrap. State is shared across all meetings
 *   on the same race-date — open Chester, pick three; open Newmarket
 *   in a new tab, pick two; the slip rehydrates with all five.
 *
 * Constraints:
 *   • Win-only (no E/W maths)
 *   • One horse per race — selecting a second runner in the same race
 *     replaces the first (with a brief toast)
 *   • Resulted races + unpriced runners cannot be added (button disabled
 *     server-side; this script defends in depth too)
 *
 * The cumulative-odds calculation mirrors races/services/odds.py exactly
 * so anything the user sees here matches what the server would compute.
 */
(function () {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const wrap = document.querySelector('.mf-wrap');
    if (!wrap) return;

    const storageKey = wrap.dataset.storageKey || 'saturday:slip:default';
    const STAKE_KEY  = 'saturday:slip:stake';
    const CUR_KEY    = 'saturday:slip:currency';

    // ── DOM refs ────────────────────────────────────────────────
    const slip          = document.getElementById('betSlip');
    const handle        = document.getElementById('slipHandle');
    const handleCount   = document.getElementById('slipHandleCount');
    const slipBody      = document.getElementById('slipBody');
    const slipLegs      = document.getElementById('slipLegs');
    const slipType      = document.getElementById('slipType');
    const slipHint      = document.getElementById('slipHint');
    const slipTotals    = document.getElementById('slipTotals');
    const slipCum       = document.getElementById('slipCumulative');
    const slipStake     = document.getElementById('slipStake');
    const slipStakeSym  = document.getElementById('slipStakeSym');
    const slipReturns   = document.getElementById('slipReturns');
    const slipProfit    = document.getElementById('slipProfit');
    const slipCopy      = document.getElementById('slipCopy');
    const slipClear     = document.getElementById('slipClear');
    const slipCopied    = document.getElementById('slipCopied');
    // Submit button is only present for logged-in cubs.
    const slipSubmit      = document.getElementById('slipSubmit');
    const slipSubmitCount = document.getElementById('slipSubmitCount');
    const slipSubmitFb    = document.getElementById('slipSubmitFeedback');
    const curButtons    = slip.querySelectorAll('.mf-slip__cur');

    // Inline undo banner — created lazily on first clear-all.
    let undoBanner = null;
    let undoTimer  = null;
    let undoSnapshot = null;
    const UNDO_WINDOW_MS = 6000;

    // ── State ───────────────────────────────────────────────────
    let selections = loadSelections();
    let stake      = loadStake();
    let currency   = loadCurrency();

    slipStake.value = stake;

    // ── Persistence ─────────────────────────────────────────────
    function loadSelections() {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    function saveSelections() {
      try { localStorage.setItem(storageKey, JSON.stringify(selections)); }
      catch (e) { /* localStorage full / disabled — ignore, runtime state still works */ }
    }
    function loadStake() {
      // Guarded like the writes: storage that throws (blocked, private
      // mode) must not stop init before a single listener is bound.
      let raw = NaN;
      try { raw = parseFloat(localStorage.getItem(STAKE_KEY)); } catch (e) {}
      return Number.isFinite(raw) && raw > 0 ? raw : 10;
    }
    function saveStake() {
      try { localStorage.setItem(STAKE_KEY, String(stake)); } catch (e) {}
    }
    function loadCurrency() {
      let v = null;
      try { v = localStorage.getItem(CUR_KEY); } catch (e) {}
      return v === 'EUR' ? 'EUR' : 'GBP';
    }
    function saveCurrency() {
      try { localStorage.setItem(CUR_KEY, currency); } catch (e) {}
    }

    // ── Pure helpers ────────────────────────────────────────────
    // Naming conventions match races/services/odds.py exactly so the
    // server and client compute the same numbers.
    function fractionalToDecimal(odds) {
      if (odds == null) return null;
      const s = String(odds).trim().toLowerCase();
      if (!s) return null;
      if (s === 'sp' || s === 'np' || s === 'n/o' || s === '-') return null;
      if (s === 'evs' || s === 'evens' || s === 'even' || s === '1/1') return 2.0;
      if (s.indexOf('/') === -1) {
        const v = parseFloat(s);
        return Number.isFinite(v) && v >= 1 ? v : null;
      }
      const [n, d] = s.split('/');
      const num = parseFloat(n);
      const den = parseFloat(d);
      if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0 || num < 0) return null;
      return (num / den) + 1;
    }
    function decimalToFractional(dec) {
      if (dec == null || !Number.isFinite(dec) || dec < 1) return '—';
      const fractional = dec - 1;
      if (Math.abs(fractional - 1) < 0.001) return 'Evs';
      let best = null;
      for (let den = 1; den <= 20; den++) {
        const num = Math.round(fractional * den);
        if (num <= 0) continue;
        const err = Math.abs((num / den) - fractional);
        if (best === null || err < best.err) best = { num, den, err };
      }
      if (best && best.err < 0.01) {
        const g = gcd(best.num, best.den);
        return `${best.num / g}/${best.den / g}`;
      }
      return `${fractional.toFixed(2)}/1`;
    }
    function gcd(a, b) { return b ? gcd(b, a % b) : a; }
    function formatMoney(n) {
      if (!Number.isFinite(n)) return '—';
      const sym = currency === 'EUR' ? '€' : '£';
      return sym + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function accaTypeLabel(n) {
      // Standard UK acca naming.
      switch (n) {
        case 0: return 'Empty';
        case 1: return 'Single';
        case 2: return 'Double';
        case 3: return 'Treble';
        default: return `${n}-fold`;
      }
    }

    // ── Render ──────────────────────────────────────────────────
    function render() {
      // 1. Update each + button on the page so it reflects "in slip" state.
      const inSlip = new Set(selections.map(s => String(s.runnerId)));
      const runnersInSlipByRace = new Map();   // raceId → runnerId
      selections.forEach(s => runnersInSlipByRace.set(String(s.raceId), String(s.runnerId)));

      // Migrated from `.mf-runner` to the new `.racecard__runner` BEM
      // class shipped with the racecard component. Both names accepted
      // during transition so any cached old templates keep working.
      document.querySelectorAll('.racecard__runner, .mf-runner').forEach(li => {
        const runnerId = li.dataset.runnerId;
        const raceId   = li.dataset.raceId;
        const isSelected = inSlip.has(runnerId);
        // Toggle both the legacy .is-selected (mf-runner) and the new
        // .racecard__runner--in-slip classes so the highlight works
        // regardless of which template rendered the runner.
        li.classList.toggle('is-selected', isSelected);
        li.classList.toggle('racecard__runner--in-slip', isSelected);

        // Highlight the parent race when it has a selection — gives
        // the eye an instant "I've picked from this race" anchor.
        const raceEl = document.getElementById('race-' + raceId);
        if (raceEl) {
          raceEl.classList.toggle('mf-race--has-selection', runnersInSlipByRace.has(raceId));
        }
      });

      // 2. Render the legs list. Unpriced legs show "—" so the slip
      //    visually distinguishes "awaiting price" from real prices.
      slipLegs.innerHTML = '';
      selections.forEach((s, idx) => {
        const isUnpriced = !Number.isFinite(s.oddsDecimal) || s.oddsDecimal < 1;
        const oddsLabel = isUnpriced
          ? '—'
          : (s.oddsFractional || decimalToFractional(s.oddsDecimal));
        const li = document.createElement('li');
        li.className = 'mf-slip__leg' + (isUnpriced ? ' mf-slip__leg--unpriced' : '');
        li.innerHTML = `
          <div class="mf-slip__leg-info">
            <div class="mf-slip__leg-where">${escape(s.course)} <span class="mf-slip__leg-time">${escape(s.raceTime)}</span></div>
            <div class="mf-slip__leg-horse">${escape(s.horseName)}</div>
            ${isUnpriced ? '<div class="mf-slip__leg-note">Awaiting price</div>' : ''}
          </div>
          <div class="mf-slip__leg-odds">${escape(oddsLabel)}</div>
          <button type="button" class="mf-slip__leg-remove" aria-label="Remove ${escape(s.horseName)}" data-idx="${idx}">×</button>
        `;
        slipLegs.appendChild(li);
      });

      // 3. Update counts / type / totals.
      const n = selections.length;
      handleCount.textContent = n;
      handleCount.classList.toggle('is-positive', n > 0);
      slipType.textContent = accaTypeLabel(n);
      slip.classList.toggle('is-empty', n === 0);

      if (n === 0) {
        slipTotals.hidden = true;
        slipHint.hidden = false;
        slipCopy.disabled = true;
        slipClear.disabled = true;
        if (slipSubmit) {
          slipSubmit.disabled = true;
          if (slipSubmitCount) slipSubmitCount.hidden = true;
        }
        return;
      }

      slipHint.hidden = true;
      slipTotals.hidden = false;
      slipCopy.disabled = false;
      slipClear.disabled = false;
      if (slipSubmit) {
        slipSubmit.disabled = false;
        if (slipSubmitCount) {
          slipSubmitCount.hidden = false;
          slipSubmitCount.textContent = String(n);
        }
      }

      // Cumulative defers when ANY leg is unpriced — show "—" and a
      // tiny note so the punter knows the totals will fill in once
      // every selection has a real price.
      const unpricedCount = selections.filter(
        s => !Number.isFinite(s.oddsDecimal) || s.oddsDecimal < 1
      ).length;
      const allPriced = unpricedCount === 0;

      if (allPriced) {
        const cumulative = selections.reduce((acc, s) => acc * s.oddsDecimal, 1);
        slipCum.textContent = `${decimalToFractional(cumulative)}  (${cumulative.toFixed(2)})`;
        const returns = stake * cumulative;
        const profit  = returns - stake;
        slipReturns.textContent = formatMoney(returns);
        slipProfit.textContent  = formatMoney(profit);
      } else {
        slipCum.innerHTML = `<span class="mf-slip__totals-pending">— · ${unpricedCount} leg${unpricedCount === 1 ? '' : 's'} awaiting price</span>`;
        slipReturns.textContent = '—';
        slipProfit.textContent  = '—';
      }
      slipStakeSym.textContent = currency === 'EUR' ? '€' : '£';

      curButtons.forEach(b => {
        const active = b.dataset.cur === currency;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    function escape(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // ── State mutators ──────────────────────────────────────────
    function addOrReplace(payload) {
      // Unpriced legs are accepted as "awaiting price" — slip renders
      // them with a "—" placeholder and defers cumulative until every
      // leg has a real decimal. Lets punters build their slip ahead
      // of the morning's market opening.
      if (!Number.isFinite(payload.oddsDecimal) || payload.oddsDecimal < 1) {
        payload.oddsDecimal = null;
      }
      // Adding a fresh leg invalidates any pending undo — the snapshot
      // we'd restore is now stale relative to the user's intent.
      if (undoSnapshot) dismissUndo();
      const existingIdxSameRace = selections.findIndex(
        s => String(s.raceId) === String(payload.raceId)
      );
      if (existingIdxSameRace !== -1) {
        // Same race already has a selection.
        if (String(selections[existingIdxSameRace].runnerId) === String(payload.runnerId)) {
          // Tapped the same horse — toggle off.
          selections.splice(existingIdxSameRace, 1);
          toast(`Removed ${payload.horseName}.`);
        } else {
          const oldName = selections[existingIdxSameRace].horseName;
          selections[existingIdxSameRace] = payload;
          toast(`Replaced ${oldName} with ${payload.horseName}.`);
        }
      } else {
        selections.push(payload);
        toast(`Added ${payload.horseName}.`);
      }
      saveSelections();
      render();
    }

    function removeAt(idx) {
      if (idx < 0 || idx >= selections.length) return;
      const removed = selections.splice(idx, 1)[0];
      saveSelections();
      render();
      if (removed) toast(`Removed ${removed.horseName}.`);
    }

    function clearAll() {
      if (!selections.length) return;
      // Snapshot current state, clear immediately, then offer undo.
      // Same pattern as Gmail's archive/delete — no confirm dialog,
      // recoverable for ~6 seconds.
      undoSnapshot = selections.slice();
      const count = undoSnapshot.length;
      selections = [];
      saveSelections();
      render();
      showUndoBanner(count);
    }

    function showUndoBanner(legsRemoved) {
      // Build banner once and reuse it. Keeping it in the DOM lets
      // CSS transitions handle the fade-in/out cleanly.
      if (!undoBanner) {
        undoBanner = document.createElement('div');
        undoBanner.className = 'mf-slip__undo';
        undoBanner.setAttribute('role', 'status');
        undoBanner.innerHTML = `
          <span class="mf-slip__undo-text"></span>
          <button type="button" class="mf-slip__undo-btn" data-action="undo-clear">Undo</button>
          <span class="mf-slip__undo-bar" aria-hidden="true"></span>
        `;
        slipBody.insertBefore(undoBanner, slipBody.firstChild);
      }
      undoBanner.querySelector('.mf-slip__undo-text').textContent =
        `Cleared ${legsRemoved} leg${legsRemoved === 1 ? '' : 's'}.`;
      // Re-trigger the countdown bar animation by toggling the class off/on.
      undoBanner.classList.remove('is-visible');
      // Force reflow so the next class addition restarts the CSS transition.
      void undoBanner.offsetWidth;
      undoBanner.classList.add('is-visible');

      clearTimeout(undoTimer);
      undoTimer = setTimeout(dismissUndo, UNDO_WINDOW_MS);
    }

    function dismissUndo() {
      if (!undoBanner) return;
      undoBanner.classList.remove('is-visible');
      undoSnapshot = null;
      clearTimeout(undoTimer);
    }

    function undoClear() {
      if (!undoSnapshot) return;
      selections = undoSnapshot.slice();
      undoSnapshot = null;
      saveSelections();
      render();
      dismissUndo();
    }

    // ── Toast (lightweight, ephemeral) ──────────────────────────
    let toastEl = null;
    let toastTimer = null;
    function toast(msg) {
      if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.className = 'mf-toast';
        document.body.appendChild(toastEl);
      }
      toastEl.textContent = msg;
      toastEl.classList.add('is-visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 1800);
    }

    // ── Copy slip as plain text ─────────────────────────────────
    function buildPlainText() {
      const lines = [];
      lines.push(`Saturday Racing — Bet slip (${accaTypeLabel(selections.length)})`);
      selections.forEach(s => {
        const isUnpriced = !Number.isFinite(s.oddsDecimal) || s.oddsDecimal < 1;
        const oddsText = isUnpriced
          ? 'awaiting price'
          : (s.oddsFractional || decimalToFractional(s.oddsDecimal));
        lines.push(`  ${s.raceTime}  ${s.course}  —  ${s.horseName}  @ ${oddsText}`);
      });
      lines.push('');
      const unpricedCount = selections.filter(
        s => !Number.isFinite(s.oddsDecimal) || s.oddsDecimal < 1
      ).length;
      if (unpricedCount === 0) {
        const cumulative = selections.reduce((acc, s) => acc * s.oddsDecimal, 1);
        lines.push(`Cumulative odds: ${decimalToFractional(cumulative)} (${cumulative.toFixed(2)})`);
        lines.push(`Stake: ${formatMoney(stake)}`);
        lines.push(`Returns: ${formatMoney(stake * cumulative)}`);
      } else {
        lines.push(`Cumulative: pending (${unpricedCount} leg${unpricedCount === 1 ? '' : 's'} awaiting price)`);
        lines.push(`Stake: ${formatMoney(stake)}`);
      }
      return lines.join('\n');
    }

    function copySlip() {
      const text = buildPlainText();
      const done = () => {
        slipCopied.hidden = false;
        setTimeout(() => { slipCopied.hidden = true; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, () => fallback(text, done));
      } else {
        fallback(text, done);
      }
    }
    function fallback(text, done) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      done();
    }

    // ── Event wiring ────────────────────────────────────────────
    document.addEventListener('click', (e) => {
      const addBtn = e.target.closest('[data-action="add-to-slip"]');
      if (addBtn) {
        if (addBtn.disabled) return;
        const li = addBtn.closest('.racecard__runner, .mf-runner');
        if (!li) return;
        const decimal = parseFloat(li.dataset.oddsDecimal);
        if (!Number.isFinite(decimal)) {
          toast('No priced market for this runner yet.');
          return;
        }
        addOrReplace({
          runnerId:        li.dataset.runnerId,
          raceId:          li.dataset.raceId,
          raceTime:        li.dataset.raceTime,
          raceName:        li.dataset.raceName,
          course:          li.dataset.course,
          horseName:       li.dataset.horseName,
          oddsFractional:  li.dataset.oddsFractional,
          oddsDecimal:     decimal,
        });
        return;
      }

      const removeBtn = e.target.closest('.mf-slip__leg-remove');
      if (removeBtn) {
        removeAt(parseInt(removeBtn.dataset.idx, 10));
        return;
      }

      const undoBtn = e.target.closest('[data-action="undo-clear"]');
      if (undoBtn) {
        undoClear();
        return;
      }

      const curBtn = e.target.closest('.mf-slip__cur');
      if (curBtn) {
        currency = curBtn.dataset.cur === 'EUR' ? 'EUR' : 'GBP';
        saveCurrency();
        render();
        return;
      }
    });

    slipStake.addEventListener('input', () => {
      const v = parseFloat(slipStake.value);
      stake = Number.isFinite(v) && v >= 0 ? v : 0;
      saveStake();
      render();
    });

    slipCopy.addEventListener('click', copySlip);
    slipClear.addEventListener('click', clearAll);

    // ── Submit picks — turns the slip into real Vote rows. ──
    // Available only when the page rendered a #slipSubmit button
    // (i.e. the cub is logged in). POST the legs in one request;
    // the server validates each against the daily-cap rules and
    // returns saved/rejected lists. We surface that breakdown in the
    // small feedback paragraph + a toast.
    if (slipSubmit) {
      slipSubmit.addEventListener('click', submitSlip);
    }

    function csrfToken() {
      var m = document.cookie.match(/csrftoken=([^;]+)/);
      return m ? m[1] : '';
    }

    function showSubmitFeedback(msg, tone) {
      if (!slipSubmitFb) return;
      slipSubmitFb.hidden = false;
      slipSubmitFb.textContent = msg;
      slipSubmitFb.classList.remove('is-success', 'is-error', 'is-partial');
      if (tone) slipSubmitFb.classList.add('is-' + tone);
    }

    function submitSlip() {
      if (!slipSubmit || !selections.length) return;
      var url = slipSubmit.dataset.submitUrl;
      if (!url) return;

      // Build the request body from the current selections.
      var picks = selections.map(function (s) {
        return { race_id: Number(s.raceId), runner_id: Number(s.runnerId) };
      });

      slipSubmit.disabled = true;
      slipSubmit.classList.add('is-loading');
      showSubmitFeedback('Submitting…', null);

      fetch(url, {
        method:      'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken':  csrfToken(),
        },
        body: JSON.stringify({ picks: picks }),
      })
        .then(function (res) {
          // 401 happens if the session expired mid-flow — bounce to login.
          if (res.status === 401) {
            window.location.href = '/members/login/?next=' + encodeURIComponent(window.location.pathname);
            return null;
          }
          return res.json().then(function (data) {
            return { status: res.status, data: data };
          });
        })
        .then(function (result) {
          if (!result) return;
          var saved    = (result.data.saved || []).length;
          var rejected = (result.data.rejected || []).length;

          if (saved && !rejected) {
            showSubmitFeedback('Saved ' + saved + ' pick' + (saved === 1 ? '' : 's') + ' ✓', 'success');
            toast('Picks submitted ✓');
            // Clear the slip on full success so the cub can see the
            // page reflect their new picks (the +/− buttons are wired
            // by the racecard component to update from server state).
            selections = [];
            saveSelections();
            render();
          } else if (saved && rejected) {
            showSubmitFeedback(
              saved + ' saved · ' + rejected + ' rejected (' + reasonOf(result.data.rejected) + ')',
              'partial'
            );
            toast(saved + ' picks saved, ' + rejected + ' rejected');
            // Trim the slip to just the rejected legs so the cub can fix them.
            var rejectedIds = new Set((result.data.rejected || []).map(function (r) {
              return String(r.race_id);
            }));
            selections = selections.filter(function (s) {
              return rejectedIds.has(String(s.raceId));
            });
            saveSelections();
            render();
          } else {
            showSubmitFeedback(reasonOf(result.data.rejected || []), 'error');
            toast('No picks saved');
          }
        })
        .catch(function () {
          showSubmitFeedback('Could not reach the server — try again in a moment.', 'error');
          toast('Submit failed');
        })
        .then(function () {
          slipSubmit.classList.remove('is-loading');
          // Re-enable handled by next render() — only if items remain.
          if (selections.length) slipSubmit.disabled = false;
        });
    }

    function reasonOf(rejectedList) {
      if (!rejectedList || !rejectedList.length) return 'no picks';
      // Group identical reasons so we don't repeat ourselves.
      var first = rejectedList[0].reason || 'rejected';
      var same  = rejectedList.every(function (r) { return r.reason === first; });
      return same
        ? first
        : (first + ' (and ' + (rejectedList.length - 1) + ' others)');
    }

    // Mobile drawer toggle.
    handle.addEventListener('click', () => {
      const open = slip.classList.toggle('is-open');
      handle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // Cross-tab sync: if the user opens another meeting on the same
    // date in another tab and updates the slip, this tab follows.
    window.addEventListener('storage', (e) => {
      if (e.key === storageKey) {
        selections = loadSelections();
        render();
      } else if (e.key === STAKE_KEY) {
        stake = loadStake();
        slipStake.value = stake;
        render();
      } else if (e.key === CUR_KEY) {
        currency = loadCurrency();
        render();
      }
    });

    // First paint.
    render();
  }
})();
