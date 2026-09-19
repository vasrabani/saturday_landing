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
        var match = name === 'all' || flags.indexOf(name) !== -1;
        tile.hidden = !match;
        if (match) shownTotal += 1;
      });
      // Pass 2 — hide meetings that ended up with zero visible tiles.
      var withRaces = [];
      meetings.forEach(function (m) {
        var visible = m.querySelectorAll('[data-flags]:not([hidden])').length;
        m.classList.toggle('is-hidden', visible === 0);
        if (visible) withRaces.push(m);
      });
      // The course sidebar shows one meeting at a time, so a filter that
      // empties the selected course would leave the panel blank with its
      // course button still lit. Move to the first course that has races;
      // if none do, the empty message covers it.
      var selected = hub.querySelector('[data-day-hub-meeting].is-active');
      if (withRaces.length && selected && selected.classList.contains('is-hidden')) {
        selectMeeting(withRaces[0].getAttribute('data-meeting-slug'));
      }
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

  // Set by initCourseSwitcher so the filters can move the sidebar's
  // selection when a filter empties the course being shown.
  var selectMeeting = function () {};

  // White-card course sidebar: show one meeting's races at a time.
  function initCourseSwitcher() {
    var hub = document.querySelector('.day-hub');
    if (!hub) return;
    var courses = hub.querySelectorAll('[data-day-course]');
    var meetings = hub.querySelectorAll('[data-day-hub-meeting]');
    if (!courses.length || !meetings.length) return;

    selectMeeting = selectCourse;

    function selectCourse(slug) {
      courses.forEach(function (btn) {
        var on = btn.getAttribute('data-day-course') === slug;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      meetings.forEach(function (m) {
        var on = m.getAttribute('data-meeting-slug') === slug;
        m.classList.toggle('is-active', on);
      });
    }

    courses.forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectCourse(btn.getAttribute('data-day-course'));
      });
    });

    // Prefer meeting that already has .is-active, else next-off, else first.
    var active = hub.querySelector('[data-day-hub-meeting].is-active');
    if (active) {
      selectCourse(active.getAttribute('data-meeting-slug'));
    } else {
      var next = findNextOffMeeting();
      selectCourse((next && next.getAttribute('data-meeting-slug')) || meetings[0].getAttribute('data-meeting-slug'));
    }
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

  function initMarketIntelTabs() {
    var board = document.querySelector('.mi-board');
    if (!board) return;
    window.SaturdayTabs(board.querySelectorAll('[data-mi-tab]'), function (tab) {
      board.setAttribute('data-mi-mode', tab.getAttribute('data-mi-tab') || 'steamers');
    });
  }

  // Each model has its own panel in the markup, so switching a tab shows
  // one and hides the others. The picks and confidence scores used to live
  // in a constant here, which meant the page could never show real data.
  function initAiChamberTabs() {
    var root = document.querySelector('.ai-section--chamber');
    if (!root) return;
    var tabs = root.querySelectorAll('[data-ac-tab]');
    if (!tabs.length) return;

    window.SaturdayTabs(tabs, function (tab) {
      var panelId = tab.getAttribute('aria-controls');
      Array.prototype.forEach.call(root.querySelectorAll('[role="tabpanel"]'), function (panel) {
        panel.hidden = panel.id !== panelId;
      });
    });
  }

  // Race titles are clipped to two lines on narrow screens. Above the
  // breakpoint they are restored, so rotating a phone or widening a window
  // no longer leaves them truncated.
  var CLAMP_MAX_WIDTH = 767;

  function clampDayHubRaceTitles() {
    var names = document.querySelectorAll('.day-hub__card .day-hub__rp-race .rp-race__name');
    var clamping = window.innerWidth <= CLAMP_MAX_WIDTH;
    Array.prototype.forEach.call(names, function (el) {
      var full = el.getAttribute('data-full-title') || (el.textContent || '').trim();
      if (!full) return;
      el.setAttribute('data-full-title', full);
      el.textContent = full;
      if (!clamping) return;
      var lh = parseFloat(window.getComputedStyle(el).lineHeight) || 17;
      var maxH = lh * 2 + 1;
      if (el.offsetHeight <= maxH) return;
      var lo = 0;
      var hi = full.length;
      while (lo < hi) {
        var mid = Math.ceil((lo + hi) / 2);
        el.textContent = full.slice(0, mid).replace(/\s+$/, '') + '…';
        if (el.offsetHeight <= maxH) lo = mid;
        else hi = mid - 1;
      }
      el.textContent = full.slice(0, lo).replace(/\s+$/, '') + '…';
    });
  }

  function balanceHeroTitleWidths() {
    var lead = document.querySelector('.hf-title__lead');
    var fox = document.querySelector('.hf-title__fox');
    if (!lead || !fox) return;
    lead.style.letterSpacing = '';
    if (window.innerWidth > 719) return;
    var leadW0 = lead.getBoundingClientRect().width;
    var foxW = fox.getBoundingClientRect().width;
    var text = (lead.textContent || '').replace(/\s+/g, ' ').trim();
    var gaps = Math.max(text.length - 1, 1);
    if (foxW > leadW0 + 0.5) {
      lead.style.letterSpacing = ((foxW - leadW0) / gaps) + 'px';
    }
  }

  function boot() {
    initCountdown();
    initFilters();
    initCourseSwitcher();
    initMeetingAccordion();
    initNextOffHighlight();
    initMobileAutoExpand();
    initMarketIntelTabs();
    initAiChamberTabs();
    clampDayHubRaceTitles();
    balanceHeroTitleWidths();
    // Both of these measure and rewrite text, which forces layout. Run
    // them once per frame rather than once per event.
    var pending = false;
    function remeasure() {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(function () {
        pending = false;
        clampDayHubRaceTitles();
        balanceHeroTitleWidths();
      });
    }
    window.addEventListener('resize', remeasure);
    // Both of these measure text, so they have to run again once the web
    // fonts are in: measured against the fallback font, the clamp cuts
    // titles at the wrong point and the hero's lead line is spaced to the
    // wrong width. fonts.ready only covers fonts already loading when it is
    // read, and a face first used further down the page can start later,
    // so measure again whenever any font finishes loading.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(remeasure).catch(function () {});
    }
    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener('loadingdone', remeasure);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
