/**
 * landing-anim.js — Cinematic enrichments for the Saturday Racing landing page.
 *
 * Modules (each runs only if target elements exist, each respects
 * prefers-reduced-motion, each is independent of the others):
 *
 *   1. Animated stat counters        — digits roll up on scroll-in
 *   2. Scroll progress bar           — thin gold bar at top of viewport
 *   3. Magnetic CTAs                 — primary buttons lean toward cursor
 *   4. Battle card 3D tilt           — perspective lift on hover
 *   5. AI Lab typewriter             — terminal lines type themselves
 *   6. Section-entry parallax        — hero background drifts on scroll
 *   7. Confetti burst on draw reveal — canvas particles (dep-free)
 *
 * Design notes
 * ────────────
 * - All listeners use `{ passive: true }` where appropriate.
 * - IntersectionObserver thresholds chosen for strong triggers
 *   (users should feel the reveal, not wonder if it fired).
 * - prefers-reduced-motion short-circuits each module to a static state.
 * - No external dependencies — CSP-safe, self-hosted.
 */
(() => {
  'use strict';

  const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarsePointer = () =>
    window.matchMedia('(pointer: coarse)').matches;

  // ══════════════════════════════════════════════════════════════
  // 1) ANIMATED STAT COUNTERS
  // ══════════════════════════════════════════════════════════════
  // Looks for elements with data-count-up. Parses the existing
  // textContent to extract an integer/float (ignoring prefixes like
  // "£" and suffixes like "%"). Rolls from 0 → target over ~1500ms
  // with easeOutCubic.
  function initCounters() {
    const targets = document.querySelectorAll('[data-count-up]');
    if (!targets.length) return;
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;

    const parseTarget = (raw) => {
      // Keep a prefix/suffix so we can re-render the formatted string.
      const match = raw.match(/^([^\d-]*)(-?\d[\d,]*(?:\.\d+)?)(.*)$/);
      if (!match) return null;
      const [, prefix, numStr, suffix] = match;
      const num = parseFloat(numStr.replace(/,/g, ''));
      if (isNaN(num)) return null;
      const hasDecimal = numStr.includes('.');
      const hasComma = numStr.includes(',');
      return { prefix, num, suffix, hasDecimal, hasComma };
    };

    const format = (value, spec) => {
      let s = spec.hasDecimal ? value.toFixed(1) : String(Math.round(value));
      if (spec.hasComma && !spec.hasDecimal) {
        s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      }
      return `${spec.prefix}${s}${spec.suffix}`;
    };

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const animate = (el, spec) => {
      const duration = 1500;
      const start = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = easeOutCubic(p);
        el.textContent = format(spec.num * eased, spec);
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = format(spec.num, spec);
      };
      requestAnimationFrame(step);
    };

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        obs.unobserve(el);
        const spec = parseTarget(el.textContent.trim());
        if (!spec) return;
        // Hold final position at 0 for the first paint, then roll up.
        el.textContent = format(0, spec);
        animate(el, spec);
      });
    }, { threshold: 0.4 });

    targets.forEach((el) => obs.observe(el));
  }

  // ══════════════════════════════════════════════════════════════
  // 2) SCROLL PROGRESS BAR
  // ══════════════════════════════════════════════════════════════
  // Fills a fixed 2px gold bar at the top of the viewport based on
  // document scroll ratio. Uses scroll-timeline where supported,
  // otherwise a scroll listener on rAF.
  function initScrollProgress() {
    const bar = document.querySelector('.scroll-progress__bar');
    if (!bar) return;
    if (prefersReducedMotion()) { bar.style.display = 'none'; return; }

    // Prefer CSS scroll-driven animations (Chrome 115+). The
    // presence of the CSS var is determined by the stylesheet via
    // @supports. If JS is active we fall back to rAF-driven width.
    let ticking = false;
    const update = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
      bar.style.transform = `scaleX(${pct / 100})`;
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
  }

  // ══════════════════════════════════════════════════════════════
  // 3) MAGNETIC CTAs
  // ══════════════════════════════════════════════════════════════
  // Primary call-to-action buttons lean gently toward the cursor
  // while it's inside a radius. Max displacement ±7px so it reads
  // as "alive" without slapstick.
  function initMagneticButtons() {
    if (prefersReducedMotion() || isCoarsePointer()) return;

    const selector = '[data-magnetic], .btn-primary, .draw-machine__btn';
    const buttons = document.querySelectorAll(selector);
    if (!buttons.length) return;

    const MAX_PX = 7;
    const RADIUS = 80;

    buttons.forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > r.width / 2 + RADIUS) return;
        const pull = Math.min(1, 1 - dist / (r.width / 2 + RADIUS));
        btn.style.transform =
          `translate(${(dx / r.width) * MAX_PX * pull}px, ${(dy / r.height) * MAX_PX * pull}px)`;
      }, { passive: true });
      btn.addEventListener('pointerleave', () => {
        btn.style.transform = '';
      }, { passive: true });
    });
  }

  // ══════════════════════════════════════════════════════════════
  // 4) BATTLE CARD 3D TILT
  // ══════════════════════════════════════════════════════════════
  function initBattleCardTilt() {
    if (prefersReducedMotion() || isCoarsePointer()) return;

    const cards = document.querySelectorAll('.battle-card');
    if (!cards.length) return;

    cards.forEach((card) => {
      const inner = card.querySelector('.battle-card__inner') || card;
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const mx = (e.clientX - r.left) / r.width;   // 0..1
        const my = (e.clientY - r.top) / r.height;   // 0..1
        const rx = (0.5 - my) * 6;  // ±3°
        const ry = (mx - 0.5) * 8;  // ±4°
        inner.style.transform =
          `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateZ(0)`;
      }, { passive: true });
      card.addEventListener('pointerleave', () => {
        inner.style.transform = '';
      }, { passive: true });
    });
  }

  // ══════════════════════════════════════════════════════════════
  // 5) AI LAB TYPEWRITER
  // ══════════════════════════════════════════════════════════════
  // When the AI Lab terminal scrolls into view, clear each line
  // and re-type it. Lines with --dim type at 12ms/char (fast,
  // ambient); emphasised lines at 26ms/char (you hear it).
  function initTypewriter() {
    const terminal = document.querySelector('.ai-lab__terminal-body');
    if (!terminal) return;
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;

    const lines = Array.from(terminal.querySelectorAll('.ai-lab__terminal-line'));
    if (!lines.length) return;

    // Snapshot original text — preserve child elements by cloning first.
    const originals = lines.map((line) => ({
      node: line,
      html: line.innerHTML,
      isDim: line.classList.contains('ai-lab__terminal-line--dim'),
      isBlink: line.classList.contains('ai-lab__terminal-line--blink'),
    }));

    // Pre-hide everything below the first line.
    originals.forEach((o) => { o.node.innerHTML = ''; o.node.style.minHeight = '1.4em'; });

    const typeOne = (original, done) => {
      // Use a temporary parser to extract plain text for timing,
      // then swap to the formatted HTML at the end for fidelity.
      const tmp = document.createElement('div');
      tmp.innerHTML = original.html;
      const text = tmp.textContent || '';
      const speed = original.isDim ? 12 : 26;
      let i = 0;
      const tick = () => {
        i += 1;
        original.node.textContent = text.slice(0, i);
        if (i < text.length) {
          setTimeout(tick, speed);
        } else {
          // Swap to HTML so inner spans (values, colours) render correctly.
          original.node.innerHTML = original.html;
          done();
        }
      };
      tick();
    };

    const runSequence = () => {
      let idx = 0;
      const next = () => {
        if (idx >= originals.length) return;
        typeOne(originals[idx++], () => setTimeout(next, 90));
      };
      next();
    };

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        obs.disconnect();
        runSequence();
      });
    }, { threshold: 0.35 });
    obs.observe(terminal);
  }

  // ══════════════════════════════════════════════════════════════
  // 6) SECTION-ENTRY PARALLAX (hero background only)
  // ══════════════════════════════════════════════════════════════
  function initHeroParallax() {
    if (prefersReducedMotion()) return;
    const bg = document.querySelector('.hero-fold__bg');
    if (!bg) return;

    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      // Drift the hero bg at 15% of scroll — feels deep but not swimmy.
      bg.style.transform = `translate3d(0, ${y * -0.15}px, 0)`;
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  // ══════════════════════════════════════════════════════════════
  // 7) CONFETTI ON DRAW REVEAL
  // ══════════════════════════════════════════════════════════════
  // Canvas-based particle burst. Dep-free. Triggered by a custom
  // event dispatched from landing.js after the draw spinner reveals.
  //
  // Reduced motion → no-op (silent skip).
  // One canvas is lazy-created and reused across draws.
  function initConfetti() {
    let canvas, ctx, particles = [], rafId = null;

    const ensureCanvas = () => {
      if (canvas) return canvas;
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText =
        'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999';
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d');
      const resize = () => {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      resize();
      window.addEventListener('resize', resize, { passive: true });
      return canvas;
    };

    const COLORS = ['#D4AF37', '#F5D76E', '#C0392B', '#ECEEF5', '#C8A020'];
    const GRAVITY = 0.25;
    const DRAG = 0.992;

    const spawn = (originX, originY) => {
      const count = 72;
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
        const speed = 6 + Math.random() * 9;
        particles.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 2,
          vy: Math.sin(angle) * speed,
          size: 4 + Math.random() * 6,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.3,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          life: 0,
          ttl: 120 + Math.random() * 60,
          shape: Math.random() > 0.5 ? 'rect' : 'circle',
        });
      }
    };

    const step = () => {
      if (!particles.length) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        rafId = null;
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles = particles.filter((p) => {
        p.vx *= DRAG;
        p.vy = p.vy * DRAG + GRAVITY;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life += 1;
        if (p.life > p.ttl || p.y > window.innerHeight + 40) return false;
        const alpha = 1 - Math.pow(p.life / p.ttl, 3);
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        return true;
      });
      rafId = requestAnimationFrame(step);
    };

    const burst = () => {
      if (prefersReducedMotion()) return;
      ensureCanvas();
      const drawMachine = document.querySelector('.draw-machine__window');
      let ox = window.innerWidth / 2;
      let oy = window.innerHeight / 2;
      if (drawMachine) {
        const r = drawMachine.getBoundingClientRect();
        ox = r.left + r.width / 2;
        oy = r.top + r.height / 2;
      }
      spawn(ox, oy);
      if (!rafId) rafId = requestAnimationFrame(step);
    };

    window.addEventListener('saturday:draw-reveal', burst);
    // Expose for manual triggering if needed.
    window.SaturdayConfetti = { burst };
  }

  // ══════════════════════════════════════════════════════════════
  // 8) TRACK TIMELINE — rail fills + "pace" dot + marker activation
  // ══════════════════════════════════════════════════════════════
  // Scroll-driven animation for the "How It Works" section.
  //
  // Progress model: the fill runs from 0 → 1 as the section scrolls
  // from "entering bottom of viewport" to "roughly centred". Markers
  // activate (is-active) when the fill passes their midpoint. On
  // mobile the rail is vertical — scaleY instead of scaleX, and the
  // pace dot is hidden (too busy in a narrow column).
  // initTrackTimeline removed: the "How it works" section was
  // re-built as a three-tier card layout (no rail, no pace runner),
  // so there's nothing to drive. Kept the call site as a no-op below.
  function initTrackTimeline() { /* no-op — markup retired */ }

  // ══════════════════════════════════════════════════════════════
  // 9) PICKS DUEL 3D TILT — depth pass on the hero focal card
  // ══════════════════════════════════════════════════════════════
  // The .picks-duel card gets the same pointer-driven tilt as the
  // battle cards, but with a wider perspective so it reads as one
  // big slab (not two small ones). translateZ on the VS badge
  // (set in CSS) makes the badge visibly lift off the plane when
  // the card tilts — that's the "3D pop" the user asked for.
  function initPicksDuelTilt() {
    // Gentler than the battle cards — this is the hero focal,
    // too much tilt reads as gimmick. SaturdayTilt (site.js) owns the
    // maths and the touch / reduced-motion guards.
    window.SaturdayTilt(document.querySelectorAll('.picks-duel'), {
      maxTiltX: 3,
      maxTiltY: 4,
      perspective: 1400,
    });
  }

  // ══════════════════════════════════════════════════════════════
  // BOOT
  // ══════════════════════════════════════════════════════════════
  const boot = () => {
    // PR2 restraint pass — disabled the "look at me" effects so the
    // landing reads as editorial rather than video-game UI. What's
    // gated below stays available in the source for easy revert.
    //   initCounters       // count-up rolls — gamey on a £1m media surface
    //   initMagneticButtons // CTAs leaning to the cursor — slapstick
    //   initBattleCardTilt // pointermove tilts the battle cards — busy
    //   initHeroParallax   // hero bg parallax — visual noise
    //   initPicksDuelTilt  // 3D tilt on the picks duel — competes with content
    // Kept (these are moments that matter, not ambient chrome):
    initScrollProgress();   // subtle gold bar at viewport top
    initTypewriter();       // AI Lab terminal typewriter (signature feature)
    initConfetti();         // Saturday Draw reveal celebration
    initTrackTimeline();    // Mr Fox's record timeline scroll-in
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
