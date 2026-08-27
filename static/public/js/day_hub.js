// Day Hub — countdown for the "Next Off" card + filter chips for the race grid.
// Self-contained. Reuses window.SaturdayCountdown from site.js for the timer.
(function () {
  'use strict';

  function initCountdown() {
    if (!window.SaturdayCountdown) return;
    document.querySelectorAll('.day-hub-countdown[data-race-iso]').forEach(function (root) {
      var iso = root.dataset.raceIso;
      if (!iso) return;
      window.SaturdayCountdown(iso, {
        Days:  root.querySelector('.hf-cd-days'),
        Hours: root.querySelector('.hf-cd-hours'),
        Mins:  root.querySelector('.hf-cd-mins'),
        Secs:  root.querySelector('.hf-cd-secs'),
      }, {
        prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        onTick: function (state) {
          // When the race is off, switch the countdown into "at the post" mode.
          if (state && state.diff <= 0) {
            root.classList.add('day-hub-countdown--off');
          }
        },
      });
    });
  }

  function initFilters() {
    var hub = document.querySelector('.day-hub');
    if (!hub) return;
    var filters  = hub.querySelectorAll('[data-day-filter]');
    var tiles    = hub.querySelectorAll('[data-day-races] [data-flags]');
    var meetings = hub.querySelectorAll('[data-meeting-slug]');
    var empty    = hub.querySelector('[data-day-empty]');
    if (!filters.length || !tiles.length) return;

    function applyFilter(name) {
      var shownTotal = 0;
      // Pass 1 — show/hide individual race tiles.
      tiles.forEach(function (tile) {
        var flags = (tile.getAttribute('data-flags') || '').split(/\s+/);
        var match = (name === 'all') || flags.indexOf(name) !== -1;
        tile.hidden = !match;
        if (match) shownTotal += 1;
      });
      // Pass 2 — hide meetings that ended up with zero visible tiles.
      meetings.forEach(function (m) {
        var visible = m.querySelectorAll('[data-flags]:not([hidden])').length;
        m.classList.toggle('is-hidden', visible === 0);
      });
      if (empty) empty.hidden = shownTotal !== 0;
      filters.forEach(function (b) {
        var on = b.getAttribute('data-day-filter') === name;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }

    filters.forEach(function (b) {
      b.addEventListener('click', function () {
        applyFilter(b.getAttribute('data-day-filter'));
      });
    });
  }

  // Mobile-only accordion: tapping the chevron — OR anywhere on the
  // meeting header except the course-name link — toggles whether
  // that meeting's races list is shown. CSS gates the toggle's
  // visibility to ≤720px viewports; this JS owns the open/closed
  // state. Click-event delegation so we don't bind one listener
  // per meeting.
  function initMeetingAccordion() {
    var hub = document.querySelector('.day-hub');
    if (!hub) return;
    var mobileQuery = window.matchMedia('(max-width: 720px)');

    hub.addEventListener('click', function (e) {
      // Direct chevron-button tap — always toggles (mobile only).
      var btn = e.target.closest('[data-day-hub-toggle]');
      // Header-area tap (the whole .rp-meeting__head) — also toggles,
      // BUT skip when the user actually meant to follow the course
      // link to /meeting_full/, or tapped the chevron (handled above).
      var headerArea = null;
      if (!btn) {
        var head = e.target.closest('.rp-meeting__head');
        if (!head) return;
        if (e.target.closest('.day-hub__meeting-link')) return;
        headerArea = head;
      }
      if (!mobileQuery.matches) return;     // desktop ignores both

      var meeting = (btn || headerArea).closest('[data-day-hub-meeting]');
      if (!meeting) return;
      var nowOpen = !meeting.classList.contains('is-open');
      meeting.classList.toggle('is-open', nowOpen);
      var tBtn = meeting.querySelector('[data-day-hub-toggle]');
      if (tBtn) {
        tBtn.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
        tBtn.setAttribute(
          'aria-label',
          (nowOpen ? 'Hide ' : 'Show ') +
          (meeting.querySelector('.day-hub__meeting-link, .rp-meeting__name')?.textContent.trim() || 'meeting') +
          ' races'
        );
      }
    });
  }

  // Tag the meeting whose next race is closest to off with .has-next.
  // CSS uses that to apply a gold-glow accent so the eye lands there
  // first. Also drives the mobile auto-expand below.
  //
  // Resolution order:
  //   1. First meeting that contains a .rp-race--next tile
  //   2. Else the meeting that contains the earliest non-resulted race
  function findNextOffMeeting() {
    var meetings = document.querySelectorAll('[data-day-hub-meeting]');
    if (!meetings.length) return null;
    for (var i = 0; i < meetings.length; i++) {
      if (meetings[i].querySelector('.rp-race--next')) return meetings[i];
    }
    for (var j = 0; j < meetings.length; j++) {
      if (meetings[j].querySelector('.rp-race:not(.rp-race--result)')) {
        return meetings[j];
      }
    }
    return null;
  }

  function initNextOffHighlight() {
    var m = findNextOffMeeting();
    if (m) m.classList.add('has-next');
  }

  // Mobile only: auto-expand the next-off meeting on first paint.
  // Saves users from having to tap every venue to see what's running.
  // Other meetings stay collapsed with their preview line visible.
  function initMobileAutoExpand() {
    if (!window.matchMedia('(max-width: 720px)').matches) return;
    var m = findNextOffMeeting();
    if (!m) return;
    m.classList.add('is-open');
    var btn = m.querySelector('[data-day-hub-toggle]');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }

  function boot() {
    initCountdown();
    initFilters();
    initMeetingAccordion();
    initNextOffHighlight();
    initMobileAutoExpand();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
