/* meeting_form.js — the colours of a horse's form.
 *
 * Each run in a horse's form is one box (.rcf, from the form atom). This
 * marks every box with what the run was (data-mfr-run: its place, or x
 * for a run not finished), says so in its title, and marks the latest
 * (data-mfr-latest); meeting.css colours them from those attributes.
 *
 * It is a file of its own because two pages show form this way and
 * neither loads the other's script: the meeting page
 * (meeting_racecard.js) and the LLaMa Index (llama_index.js). Both call
 * window.mfrForm.colour(root).
 *
 * Zero deps. Safe to call again on markup already coloured.
 */
(function () {
  'use strict';

  var RUNS = {
    1: 'Won', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 8: '8th', 9: '9th', 0: '10th or worse',
    F: 'Fell', U: 'Unseated rider', P: 'Pulled up', B: 'Brought down', R: 'Refused', O: 'Ran out',
    S: 'Slipped up', C: 'Carried out', D: 'Disqualified', V: 'Void race', L: 'Left at the start',
  };

  function colour(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('.racecard__form'), function (strip) {
      var runs = [];
      Array.prototype.forEach.call(strip.querySelectorAll('.rcf'), function (box) {
        var mark = box.textContent.trim().toUpperCase();
        if (box.classList.contains('rcf--sep')) {
          box.title = mark === '/' ? 'A long break between runs' : 'A new season';
          return;
        }
        box.setAttribute('data-mfr-run', /^\d$/.test(mark) ? mark : 'x');
        box.title = RUNS[mark] || 'Did not finish';
        box.removeAttribute('data-mfr-latest');
        runs.push(box);
      });
      var latest = runs[runs.length - 1];
      if (latest) {
        latest.setAttribute('data-mfr-latest', '');
        latest.title += ' (latest run)';
      }
    });
  }

  window.mfrForm = { colour: colour, RUNS: RUNS };
})();
