/**
 * landing.js — Public landing page JS
 * Relies on window.SaturdayCountdown from /static/js/site.js
 */
document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Hero picks duel — ambient glow + VS when in view ───────
  const picksDuel = document.querySelector('[data-picks-duel]');
  if (picksDuel) {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      picksDuel.classList.add('picks-duel--visible');
    } else {
      const duelIo = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (!en.isIntersecting) return;
            en.target.classList.add('picks-duel--visible');
            duelIo.unobserve(en.target);
          });
        },
        { threshold: 0.06, rootMargin: '0px 0px 14% 0px' }
      );
      duelIo.observe(picksDuel);
    }
  }

  const picksInner = picksDuel?.querySelector('.picks-duel__inner');
  if (picksInner) {
    picksInner.addEventListener('click', (e) => {
      const cell = e.target.closest('[data-picks-half-href]');
      if (!cell || !picksInner.contains(cell)) return;
      if (e.target.closest('a[href]')) return;
      const href = cell.getAttribute('data-picks-half-href');
      if (href) window.location.href = href;
    });
    picksInner.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const cell = e.target.closest('[data-picks-half-href]');
      if (!cell || !picksInner.contains(cell)) return;
      if (e.target.closest('a[href]')) return;
      e.preventDefault();
      const href = cell.getAttribute('data-picks-half-href');
      if (href) window.location.href = href;
    });
  }

  // ── Countdown — supports the tabbed hero (two .hf-countdown blocks). ──
  // Each .hf-countdown carries its own data-race-iso; we look up the
  // digit elements relative to its own root (no IDs needed — they'd
  // collide between the two hero variants).
  if (window.SaturdayCountdown) {
    document.querySelectorAll('.hf-countdown[data-race-iso]').forEach((root) => {
      const iso = root.dataset.raceIso;
      if (!iso) return;
      window.SaturdayCountdown(iso, {
        Days:  root.querySelector('.hf-cd-days'),
        Hours: root.querySelector('.hf-cd-hours'),
        Mins:  root.querySelector('.hf-cd-mins'),
        Secs:  root.querySelector('.hf-cd-secs'),
      }, {
        prefersReducedMotion,
        onTick({ diff }) {
          if (diff <= 0) {
            root.classList.add('hf-countdown--race-day');
            root.classList.remove('hf-countdown--urgent');
          } else {
            root.classList.remove('hf-countdown--race-day');
            if (diff < 86400000) root.classList.add('hf-countdown--urgent');
            else root.classList.remove('hf-countdown--urgent');
          }
        },
      });
    });
  }

  // ── Animate H2H bar on scroll ─────────────────────────────
  const bars = document.querySelectorAll('.h2h-bar__fox, .h2h-bar__cub');
  if (!prefersReducedMotion) {
    const barObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const w = e.target.style.width;
        e.target.style.width = '0';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          e.target.style.transition = 'width 1.5s cubic-bezier(0.4,0,0.2,1)';
          e.target.style.width = w;
        }));
        barObs.unobserve(e.target);
      });
    }, { threshold: 0.3 });
    bars.forEach(b => barObs.observe(b));
  }

  // ── Confidence bars ───────────────────────────────────────
  const confBars = document.querySelectorAll('.conf-bar__fill');
  if (!prefersReducedMotion) {
    const confObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const w = e.target.style.width;
        e.target.style.width = '0';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          e.target.style.transition = 'width 1.2s cubic-bezier(0.4,0,0.2,1)';
          e.target.style.width = w;
        }));
        confObs.unobserve(e.target);
      });
    }, { threshold: 0.5 });
    confBars.forEach(b => confObs.observe(b));
  }

});

/* ── Hero countdown card — subtle 3D tilt (desktop, fine pointer) ── */
(function () {
  const card = document.querySelector('.hf-countdown');
  if (!card) return;
  if (window.matchMedia('(pointer: coarse)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const onMove = (e) => {
    const r = card.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const mx = (e.clientX - cx) / (r.width / 2);
    const my = (e.clientY - cy) / (r.height / 2);
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    const rx = (-clamp(my) * 3.5).toFixed(2);
    const ry = (clamp(mx) * 4.5).toFixed(2);
    card.style.transform = `perspective(760px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  };

  const reset = () => {
    card.style.transform = '';
  };

  card.addEventListener('pointermove', onMove);
  card.addEventListener('pointerleave', reset);
})();


/* ─────────────────────────────────────────────────────────────
   RACE NAME — Mouse parallax 3D tilt
───────────────────────────────────────────────────────────── */
(function () {
  const stage = document.querySelector('.race-reveal__stage');
  const name  = document.getElementById('raceRevealName');
  if (!stage || !name) return;

  // Only on non-touch devices and when motion is allowed
  if (window.matchMedia('(pointer: coarse)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let animating = false;

  document.addEventListener('mousemove', (e) => {
    if (animating) return;
    animating = true;
    requestAnimationFrame(() => {
      const rect = stage.getBoundingClientRect();
      // Normalise mouse position relative to the whole viewport
      const mx = (e.clientX / window.innerWidth  - 0.5) * 2; // -1 to 1
      const my = (e.clientY / window.innerHeight - 0.5) * 2; // -1 to 1

      // Subtle tilt — max ±6° horizontal, ±3° vertical
      const rotY =  mx * 6;
      const rotX = -my * 3;

      name.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      name.style.transition = 'transform 0.12s ease-out';
      animating = false;
    });
  });

  // Reset on mouse leave
  document.addEventListener('mouseleave', () => {
    name.style.transform = 'rotateX(0deg) rotateY(0deg)';
    name.style.transition = 'transform 0.6s ease-out';
  });
})();

/* ═════════════════════════════════════════════════════════════
   THE SATURDAY DRAW — Cinematic slow reveal
═════════════════════════════════════════════════════════════ */
(function () {
  const horseEl    = document.getElementById('drawHorse');
  const oddsEl     = document.getElementById('drawOdds');
  const preLabel   = document.getElementById('drawPreLabel');
  const btn        = document.getElementById('drawBtn');
  const btnText    = document.getElementById('drawBtnText');
  const glowInner  = document.querySelector('.draw-machine__glow-inner');
  if (!horseEl || !btn) return;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Declared field for the active featured race (injected via json_script on landing.html). */
  let RUNNERS = [];
  const drawDataEl = document.getElementById('saturday-draw-runners');
  if (drawDataEl) {
    try {
      const parsed = JSON.parse(drawDataEl.textContent);
      if (Array.isArray(parsed)) RUNNERS = parsed;
    } catch (e) {
      RUNNERS = [];
    }
  }
  if (!RUNNERS.length) {
    btn.disabled = true;
    btnText.textContent = 'NO FIELD LOADED';
    if (preLabel) {
      preLabel.textContent = 'ADD RUNNERS FOR THE FEATURED RACE';
      preLabel.style.opacity = '1';
    }
    horseEl.textContent = '—';
    return;
  }

  // Idle state: ghost-like cycling, very slow, low opacity
  let idleInterval = null;
  let idleIdx = 0;

  function startIdle() {
    horseEl.style.opacity = '0.18';
    horseEl.style.filter  = 'none';
    horseEl.textContent = RUNNERS[0].name;
    preLabel.style.opacity = '1';
    preLabel.textContent   = 'THE FIELD IS OPEN';

    idleInterval = setInterval(() => {
      idleIdx = (idleIdx + 1) % RUNNERS.length;
      horseEl.style.opacity = (0.12 + Math.random() * 0.1).toFixed(2);
      horseEl.textContent = RUNNERS[idleIdx].name;
    }, 1600);
  }

  function stopIdle() {
    clearInterval(idleInterval);
    horseEl.style.opacity = '1';
  }

  startIdle();

  function triggerDraw() {
    if (btn.classList.contains('drawing')) return;
    stopIdle();

    // Lock button
    btn.classList.add('drawing');
    btnText.textContent = 'DRAWING…';
    glowInner && glowInner.classList.add('active');

    preLabel.style.opacity = '0';
    oddsEl.textContent = '';
    oddsEl.classList.remove('live');

    horseEl.classList.remove('reveal');
    horseEl.classList.add('spinning');

    // Choose the winner now but don't reveal yet
    const winner = RUNNERS[Math.floor(Math.random() * RUNNERS.length)];

    // Spin phases:
    // Phase 1 (0–1.8s): fast — 65ms per frame
    // Phase 2 (1.8–3.2s): slowing — each frame extends
    // Phase 3 (3.2–4s): very slow last few frames — dramatic pause
    // Then reveal

    const PHASE1_END = 1800;
    const PHASE2_END = 3400;
    const REVEAL_AT  = 4200;

    let start = null;
    let frameDelay = 65;
    let lastFrame = 0;

    function spinFrame(ts) {
      if (!start) start = ts;
      const elapsed = ts - start;

      if (elapsed - lastFrame >= frameDelay) {
        lastFrame = elapsed;

        if (elapsed < PHASE1_END) {
          // Fast
          frameDelay = 65;
          horseEl.textContent = RUNNERS[Math.floor(Math.random() * RUNNERS.length)].name;
        } else if (elapsed < PHASE2_END) {
          // Decelerate exponentially
          const progress = (elapsed - PHASE1_END) / (PHASE2_END - PHASE1_END);
          frameDelay = 65 + Math.pow(progress, 1.8) * 320;
          horseEl.textContent = RUNNERS[Math.floor(Math.random() * RUNNERS.length)].name;
        } else if (elapsed < REVEAL_AT) {
          // Last two/three frames — almost stopped, show near-winner names
          frameDelay = 380;
          horseEl.textContent = RUNNERS[Math.floor(Math.random() * RUNNERS.length)].name;
        }
      }

      if (elapsed < REVEAL_AT) {
        requestAnimationFrame(spinFrame);
      } else {
        // ── THE REVEAL ──
        horseEl.classList.remove('spinning');

        // Brief blackout pause before reveal
        horseEl.style.opacity = '0';
        setTimeout(() => {
          horseEl.textContent = winner.name;
          horseEl.classList.add('reveal');
          horseEl.style.opacity = '1';

          // Celebratory burst — picked up by landing-anim.js confetti module.
          window.dispatchEvent(new CustomEvent('saturday:draw-reveal', {
            detail: { winner },
          }));

          // Odds appear 400ms after horse name
          setTimeout(() => {
            const o = winner.odds && String(winner.odds).trim() && winner.odds !== '—'
              ? `${winner.odds}  ·  `
              : '';
            oddsEl.textContent = o + 'The Saturday Draw has spoken.';
            oddsEl.classList.add('live');
          }, 420);

          // Unlock button
          setTimeout(() => {
            btn.classList.remove('drawing');
            btnText.textContent = 'DRAW AGAIN';
            preLabel.style.opacity = '1';
            preLabel.textContent = 'YOUR DRAW';
          }, 700);

        }, 180);
      }
    }

    if (prefersReducedMotion) {
      const winner = RUNNERS[Math.floor(Math.random() * RUNNERS.length)];
      horseEl.classList.remove('spinning');
      horseEl.classList.add('reveal');
      horseEl.style.opacity = '1';
      horseEl.textContent = winner.name;
      const o = winner.odds && String(winner.odds).trim() && winner.odds !== '—'
        ? `${winner.odds}  ·  `
        : '';
      oddsEl.textContent = o + 'The Saturday Draw has spoken.';
      oddsEl.classList.add('live');
      btn.classList.remove('drawing');
      btnText.textContent = 'DRAW AGAIN';
      preLabel.style.opacity = '1';
      preLabel.textContent = 'YOUR DRAW';
      return;
    }

    requestAnimationFrame(spinFrame);
  }

  btn.addEventListener('click', triggerDraw);
  window.triggerDraw = triggerDraw;
})();

/* ════════════════════════════════════════════════════════════
   HERO RESULTED-STATE — winner spoiler reveal.

   Mirrors the meeting_full / racecard implementation: shares the
   `sr_revealed_races` localStorage key so a reveal here stays
   revealed on the racecard and vice versa.
════════════════════════════════════════════════════════════ */
(function initHeroResultSpoiler() {
  var STORAGE_KEY = 'sr_revealed_races';

  function readRevealed() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      var parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch (e) { return new Set(); }
  }
  function writeRevealed(set) {
    try {
      window.localStorage.setItem(
        STORAGE_KEY, JSON.stringify(Array.from(set))
      );
    } catch (e) { /* private mode / quota — fail silent */ }
  }

  function boot() {
    var root = document.querySelector('[data-hero-result]');
    if (!root) return;
    var pill = root.querySelector('[data-spoiler][data-action="reveal-result"]');
    if (!pill) return;

    var revealed = readRevealed();
    if (revealed.has(String(pill.dataset.raceId))) {
      pill.setAttribute('aria-pressed', 'true');
    }

    pill.addEventListener('click', function (e) {
      e.preventDefault();
      var id = String(pill.dataset.raceId);
      var now = pill.getAttribute('aria-pressed') !== 'true';
      pill.setAttribute('aria-pressed', now ? 'true' : 'false');
      if (now) { revealed.add(id); } else { revealed.delete(id); }
      writeRevealed(revealed);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
