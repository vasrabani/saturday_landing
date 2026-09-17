/**
 * SATURDAY RACING — SITE-WIDE JS
 * /static/js/site.js
 *
 * Handles:
 *   - Nav scroll state
 *   - Mobile drawer (open / close / overlay / focus trap / keyboard)
 *   - Smooth scroll for anchor links
 *   - Intersection observer scroll reveals
 *   - Active nav highlight
 *   - Countdown utility
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── 1. NAV SCROLL STATE ────────────────────────────────────
  const nav = document.getElementById('siteNav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── 2. MOBILE DRAWER ───────────────────────────────────────
  const hamburger  = document.getElementById('navHamburger');
  const drawer     = document.getElementById('mobileDrawer');
  const overlay    = document.getElementById('mobOverlay');
  const closeBtn   = document.getElementById('drawerClose');

  if (hamburger && drawer && overlay) {

    /**
     * openDrawer — slide drawer in, show overlay, lock body scroll
     */
    function openDrawer() {
      drawer.classList.add('open');
      overlay.classList.add('open');
      document.body.classList.add('drawer-open');

      hamburger.setAttribute('aria-expanded', 'true');
      drawer.setAttribute('aria-hidden', 'false');
      overlay.setAttribute('aria-hidden', 'false');

      // Move focus into drawer for accessibility
      const firstFocusable = drawer.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusable) {
        // Small delay so the CSS transform has started
        setTimeout(() => firstFocusable.focus(), 50);
      }
    }

    /**
     * closeDrawer — reverse all open state
     */
    function closeDrawer() {
      drawer.classList.remove('open');
      overlay.classList.remove('open');
      document.body.classList.remove('drawer-open');

      hamburger.setAttribute('aria-expanded', 'false');
      drawer.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('aria-hidden', 'true');

      // Return focus to hamburger
      hamburger.focus();
    }

    // Open on hamburger click
    hamburger.addEventListener('click', () => {
      const isOpen = drawer.classList.contains('open');
      isOpen ? closeDrawer() : openDrawer();
    });

    // Close on overlay click
    overlay.addEventListener('click', closeDrawer);

    // Close on close button
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

    // Close on Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) {
        closeDrawer();
      }
    });

    // Close when a drawer link is clicked (navigating away)
    drawer.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        // If it's a same-page anchor, close immediately
        // For page navigations the browser handles it, but we still clean up
        closeDrawer();
      });
    });

    // Focus trap inside drawer while open
    drawer.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const focusables = Array.from(
        drawer.querySelectorAll(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last  = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    // If screen resizes above mobile breakpoint, close drawer cleanly
    const mq = window.matchMedia('(min-width: 901px)');
    const onResize = e => { if (e.matches && drawer.classList.contains('open')) closeDrawer(); };
    if (mq.addEventListener) mq.addEventListener('change', onResize);
    else mq.addListener(onResize); // Safari < 14 fallback
  }

  // ── 3. MOBILE ACCORDIONS — handled by the generic
  //       initDrawerAccordion() loop further down. We used to
  //       bind a specific handler to #mobVirtualAccordion here,
  //       which meant Virtual ended up with TWO click handlers
  //       once the generic auto-init was added — each click ran
  //       acc.classList.toggle('open') twice, the two toggles
  //       cancelled out, and the accordion stayed closed. The
  //       generic loop now handles every .mob-drawer__accordion
  //       in one place; no per-ID wiring needed.

  // ── 4. SMOOTH SCROLL FOR ANCHOR LINKS ────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      window.scrollTo({
        top: target.getBoundingClientRect().top + window.scrollY - 76,
        behavior: 'smooth',
      });
    });
  });

  // ── 4. SCROLL-TRIGGERED REVEALS ──────────────────────────
  // data-reveal — subtle fade + lift. Optional data-reveal-delay="0..12" (stepped stagger).
  if ('IntersectionObserver' in window) {
    const revealReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.getElementById('site-reveal-styles')) {
      document.head.insertAdjacentHTML(
        'beforeend',
        '<style id="site-reveal-styles">[data-reveal]:not(.revealed){will-change:opacity,transform}' +
        '.revealed{opacity:1!important;transform:none!important;will-change:auto}</style>'
      );
    }

    const revealEls = document.querySelectorAll('[data-reveal]');
    const revealObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('revealed');
          revealObs.unobserve(e.target);
        });
      },
      { threshold: 0.04, rootMargin: '0px 0px 14% 0px' }
    );

    revealEls.forEach((el, i) => {
      if (revealReduced) {
        el.classList.add('revealed');
        return;
      }
      const raw = el.dataset.revealDelay;
      const step =
        raw !== undefined && raw !== '' && !Number.isNaN(parseInt(raw, 10))
          ? Math.max(0, parseInt(raw, 10))
          : i % 7;
      const delaySec = Math.min(step * 0.052, 0.42);
      el.style.opacity = '0';
      el.style.transform = 'translateY(11px)';
      el.style.transitionProperty = 'opacity, transform';
      el.style.transitionDuration = '0.62s';
      el.style.transitionDelay = `${delaySec}s`;
      el.style.transitionTimingFunction = 'cubic-bezier(0.22, 1, 0.36, 1)';
      revealObs.observe(el);
    });
  }

  // ── 5. ACTIVE NAV LINK ON SCROLL ────────────────────────
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.site-nav__link[href^="#"]');

  if (navLinks.length && sections.length) {
    const secObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        navLinks.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.site-nav__link[href="#${e.target.id}"]`);
        if (active) active.classList.add('active');
      });
    }, { rootMargin: '-40% 0px -50% 0px' });
    sections.forEach(s => secObs.observe(s));
  }

});

// ── COUNTDOWN UTILITY ────────────────────────────────────────
// Usage: SaturdayCountdown(iso, { Days:'cdDays' | Element, ... }, { onTick, prefersReducedMotion })
// `targets` values may be element IDs (string) OR direct Element instances —
// the latter is required when the page renders more than one countdown
// (e.g. tabbed hero) because IDs must be unique.
window.SaturdayCountdown = function (targetISO, targets, options) {
  options = options || {};
  const onTick = typeof options.onTick === 'function' ? options.onTick : null;
  const motionOk = !options.prefersReducedMotion;
  const target = new Date(targetISO);
  const pad    = n => String(n).padStart(2, '0');
  let prevSnap = null;

  // Resolve once — supports both string IDs and Element instances.
  const resolve = (v) => {
    if (!v) return null;
    if (typeof v === 'string') return document.getElementById(v);
    if (v instanceof Element) return v;
    return null;
  };

  function tick() {
    const diff = target - new Date();

    if (diff <= 0) {
      Object.keys(targets).forEach((key) => {
        const el = resolve(targets[key]);
        if (el) el.textContent = '00';
      });
      const snap = { d: 0, h: 0, m: 0, s: 0 };
      if (onTick) onTick({ ...snap, diff, prev: prevSnap });
      prevSnap = snap;
      return;
    }

    const d = Math.floor(diff / 864e5);
    const h = Math.floor((diff % 864e5) / 36e5);
    const m = Math.floor((diff % 36e5)  / 6e4);
    const s = Math.floor((diff % 6e4)   / 1e3);
    const snap = { d, h, m, s };

    const set = (key, val) => {
      const el = resolve(targets[key]);
      if (el) el.textContent = pad(val);
    };
    set('Days', d); set('Hours', h); set('Mins', m); set('Secs', s);

    if (motionOk && prevSnap) {
      [['Days', 'd'], ['Hours', 'h'], ['Mins', 'm'], ['Secs', 's']].forEach(([idKey, sk]) => {
        if (prevSnap[sk] !== snap[sk]) {
          const el = resolve(targets[idKey]);
          if (!el) return;
          el.classList.remove('hf-cd-num--flip');
          void el.offsetWidth;
          el.classList.add('hf-cd-num--flip');
          const onEnd = (e) => {
            if (e.animationName !== 'hfCdDigitFlip') return;
            el.classList.remove('hf-cd-num--flip');
            el.removeEventListener('animationend', onEnd);
          };
          el.addEventListener('animationend', onEnd);
        }
      });
    }

    if (onTick) onTick({ ...snap, diff, prev: prevSnap });
    prevSnap = snap;
  }

  tick();
  return setInterval(tick, 1000);
};

/* ── Generic desktop dropdown initialiser ─────────────────────────
 *
 * Registry of all initialised dropdowns. Used so opening one
 * dropdown closes every other — only one menu is ever visible at
 * a time. (Without this the trigger's `stopPropagation` blocks the
 * document-level "click outside" handler from closing siblings,
 * leaving multiple menus stacked on top of each other.)
 */
const __navDropdowns = [];

function __closeNavDropdown(drop) {
  drop.classList.remove('open');
  const t = drop.querySelector('.site-nav__dropdown-trigger');
  if (t) t.setAttribute('aria-expanded', 'false');
}

function initNavDropdown(drop) {
  // Backwards compat — older call sites passed an ID string.
  if (typeof drop === 'string') drop = document.getElementById(drop);
  if (!drop) return;

  const trigger = drop.querySelector('.site-nav__dropdown-trigger');
  const menu    = drop.querySelector('.site-nav__dropdown-menu');
  // Defensive bail-out — an element with the dropdown class but
  // no trigger / no menu isn't a toggling dropdown (e.g. could be
  // a static menu that just happens to share visual styling).
  if (!trigger || !menu) return;

  function openDrop() {
    // Close every other open dropdown so only one is ever showing.
    __navDropdowns.forEach(other => {
      if (other !== drop) __closeNavDropdown(other);
    });
    drop.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
  }
  function closeDrop() {
    __closeNavDropdown(drop);
  }

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    drop.classList.contains('open') ? closeDrop() : openDrop();
  });

  document.addEventListener('click', e => {
    if (!drop.contains(e.target)) closeDrop();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDrop();
  });

  menu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => closeDrop());
  });

  __navDropdowns.push(drop);
}

/* ── Auto-init every desktop nav dropdown ───────────────────────
   Every element matching .site-nav__dropdown gets its toggle
   wired automatically. Adding a new dropdown is therefore a
   one-step (markup-only) operation — the previous explicit-list
   pattern repeatedly went stale when authors added markup but
   forgot to register the ID here. The init function bails out
   safely on any element missing a trigger/menu so a stray
   class on a non-dropdown won't break.
─────────────────────────────────────────────────────────────── */
document.querySelectorAll('.site-nav__dropdown').forEach(initNavDropdown);

/* ── Generic mobile-drawer accordion initialiser ──────────────── */
function initDrawerAccordion(acc) {
  // Backwards compat — older call sites passed an ID string.
  if (typeof acc === 'string') acc = document.getElementById(acc);
  if (!acc) return;

  const drawer = document.getElementById('mobileDrawer');
  const accTrigger = acc.querySelector('.mob-drawer__accordion-trigger');
  const accBody    = acc.querySelector('.mob-drawer__accordion-body');
  // Defensive bail-out — same reasoning as initNavDropdown.
  if (!accTrigger) return;

  accTrigger.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = acc.classList.toggle('open');
    accTrigger.setAttribute('aria-expanded', String(isOpen));
    if (accBody) {
      accBody.style.maxHeight = isOpen ? accBody.scrollHeight + 'px' : '0';
    }
  });

  if (drawer) {
    const observer = new MutationObserver(() => {
      if (!drawer.classList.contains('open')) {
        acc.classList.remove('open');
        accTrigger.setAttribute('aria-expanded', 'false');
        if (accBody) accBody.style.maxHeight = '0';
      }
    });
    observer.observe(drawer, { attributes: true, attributeFilter: ['class'] });
  }
}

/* ── Auto-init every mobile-drawer accordion ────────────────────
   Same auto-discovery pattern as the desktop nav dropdowns —
   any element with .mob-drawer__accordion gets its toggle wired.
   New mobile accordions are markup-only; no JS re-register step.
─────────────────────────────────────────────────────────────── */
document.querySelectorAll('.mob-drawer__accordion').forEach(initDrawerAccordion);



/* ── Notification banner — dismiss per session ───────────────── */
(function () {
  var banner = document.getElementById('notifBanner');
  if (!banner) return;

  /* Session key includes a signature so a new notification count
     (different from the one dismissed) will re-show the banner.
     The template encodes total count into data-sig.              */
  var KEY = 'notif_dismissed_' + (banner.dataset.sig || '0');

  /* Already dismissed this session — hide immediately (no flash).
     Body class drives the main-content padding via CSS
     (.has-notif-banner in base.css) — removing the class here lets
     main snap to the nav-only padding without a JS inline style. */
  if (sessionStorage.getItem(KEY)) {
    banner.style.display = 'none';
    document.body.classList.remove('has-notif-banner');
    return;
  }

  var btn = document.getElementById('notifDismiss');
  if (!btn) return;
  btn.addEventListener('click', function () {
    banner.classList.add('notif-banner--dismissed');
    document.body.classList.remove('has-notif-banner');
    sessionStorage.setItem(KEY, '1');
  });
})();


/* ════════════════════════════════════════════════════════════
   SHARED UI HELPERS
   Used by the landing page's tab strips and card tilts. Kept here
   with SaturdayCountdown so each surface wires behaviour rather
   than re-implementing it. Deferred landing scripts run after this
   file, so the helpers are always defined by the time they boot.
   ════════════════════════════════════════════════════════════ */

/**
 * Wire a tab strip: click and full keyboard support (arrow keys, Home,
 * End) with a roving tabindex, per the WAI-ARIA tabs pattern. Only the
 * selected tab is in the tab order; arrows move between tabs.
 *
 * onSelect(tab, index) does whatever the strip actually changes.
 */
window.SaturdayTabs = function (tabs, onSelect) {
  tabs = Array.prototype.slice.call(tabs || []);
  if (!tabs.length) return;

  function select(tab, moveFocus) {
    tabs.forEach(function (other) {
      var on = other === tab;
      other.classList.toggle('is-active', on);
      other.setAttribute('aria-selected', on ? 'true' : 'false');
      other.tabIndex = on ? 0 : -1;
    });
    if (moveFocus) tab.focus();
    if (onSelect) onSelect(tab, tabs.indexOf(tab));
  }

  var KEY_STEPS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

  tabs.forEach(function (tab, index) {
    tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
    tab.addEventListener('click', function () {
      select(tab, false);
    });
    tab.addEventListener('keydown', function (event) {
      var step = KEY_STEPS[event.key];
      var target =
        step !== undefined ? tabs[(index + step + tabs.length) % tabs.length]
        : event.key === 'Home' ? tabs[0]
        : event.key === 'End' ? tabs[tabs.length - 1]
        : null;
      if (!target) return;
      event.preventDefault();
      select(target, true);
    });
  });

  return { select: select };
};

/**
 * Mouse-parallax tilt for a card. Skipped on touch screens and when the
 * visitor prefers reduced motion, so behaviour matches everywhere it is
 * used instead of each caller remembering the guards.
 */
window.SaturdayTilt = function (elements, options) {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var settings = options || {};
  var maxTiltX = settings.maxTiltX || 3.5;
  var maxTiltY = settings.maxTiltY || 4.5;
  var perspective = settings.perspective || 760;
  var clamp = function (value) {
    return Math.max(-1, Math.min(1, value));
  };

  Array.prototype.forEach.call(elements || [], function (card) {
    card.addEventListener('pointermove', function (event) {
      var box = card.getBoundingClientRect();
      var fromCentreX = (event.clientX - (box.left + box.width / 2)) / (box.width / 2);
      var fromCentreY = (event.clientY - (box.top + box.height / 2)) / (box.height / 2);
      var rotateX = (-clamp(fromCentreY) * maxTiltX).toFixed(2);
      var rotateY = (clamp(fromCentreX) * maxTiltY).toFixed(2);
      card.style.transform =
        'perspective(' + perspective + 'px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg)';
      card.classList.add('is-tilting');
    }, { passive: true });

    card.addEventListener('pointerleave', function () {
      card.style.transform = '';
      card.classList.remove('is-tilting');
    }, { passive: true });
  });
};
