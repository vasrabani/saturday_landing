/**
 * experiences/pick-hero/js/particles.js
 * ───────────────────────────────────────
 * Atmospheric particle canvas for the pick hero experience.
 * Renders drifting dust/fog particles on a <canvas> layer behind the stage.
 *
 * Public API:
 *   const p = new PickHeroParticles(canvas, options);
 *   p.start()          — begin RAF loop
 *   p.stop()           — cancel RAF loop
 *   p.surge(factor, ms)— temporarily multiply speed (on dramatic beats)
 *   p.resize()         — call on window resize
 */

'use strict';

class PickHeroParticles {

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} opts
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');

    // Config with sensible defaults
    this.cfg = {
      count:       opts.count       ?? 70,
      speedMin:    opts.speedMin    ?? 0.15,
      speedMax:    opts.speedMax    ?? 0.55,
      sizeMin:     opts.sizeMin     ?? 1,
      sizeMax:     opts.sizeMax     ?? 3.5,
      blurMin:     opts.blurMin     ?? 8,
      blurMax:     opts.blurMax     ?? 28,
      colours:     opts.colours     ?? [
        'rgba(212,175,55,0.07)',   // gold dust
        'rgba(212,175,55,0.04)',
        'rgba(236,238,245,0.05)', // white mist
        'rgba(236,238,245,0.03)',
        'rgba(192, 57, 43,0.04)', // fox red
      ],
    };

    this._raf       = null;
    this._particles = [];
    this._surge     = 1;    // speed multiplier (reset after surge)
    this._surgeEnd  = 0;    // timestamp when surge expires

    this.resize();
    this._init();
  }

  // ── Public ────────────────────────────────────────────────────

  start() {
    if (this._raf) return;
    this._tick = this._tick.bind(this);
    this._raf  = requestAnimationFrame(this._tick);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  /** Multiply all speeds for `ms` milliseconds then ease back */
  surge(factor, ms) {
    this._surge    = factor;
    this._surgeEnd = performance.now() + ms;
  }

  resize() {
    this.canvas.width  = this.canvas.offsetWidth  || window.innerWidth;
    this.canvas.height = this.canvas.offsetHeight || window.innerHeight;
  }

  // ── Private ───────────────────────────────────────────────────

  _init() {
    const { count } = this.cfg;
    this._particles = [];
    for (let i = 0; i < count; i++) {
      this._particles.push(this._spawn(true));
    }
  }

  _rand(min, max) { return min + Math.random() * (max - min); }

  _spawn(randomY = false) {
    const { speedMin, speedMax, sizeMin, sizeMax, blurMin, blurMax, colours } = this.cfg;
    const w = this.canvas.width;
    const h = this.canvas.height;
    return {
      x:     this._rand(0, w),
      y:     randomY ? this._rand(0, h) : h + this._rand(0, 20),
      vx:    this._rand(-0.3, 0.3),
      vy:   -this._rand(speedMin, speedMax), // drift upwards
      size:  this._rand(sizeMin, sizeMax),
      blur:  this._rand(blurMin, blurMax),
      alpha: this._rand(0.3, 1),
      colour: colours[Math.floor(Math.random() * colours.length)],
      life:  0,
      maxLife: this._rand(300, 600), // frames before respawn
    };
  }

  _tick(ts) {
    this._raf = requestAnimationFrame(this._tick);

    // Determine speed multiplier
    let speed = 1;
    if (ts < this._surgeEnd) {
      const progress = 1 - (this._surgeEnd - ts) / 800;
      // ease back: surge is full for first half, eases in second half
      speed = progress < 0.5
        ? this._surge
        : 1 + (this._surge - 1) * (1 - (progress - 0.5) * 2);
    }

    const ctx = this.ctx;
    const w   = this.canvas.width;
    const h   = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];

      p.x   += p.vx * speed;
      p.y   += p.vy * speed;
      p.life++;

      // Fade in / out
      const lifeFrac = p.life / p.maxLife;
      const alpha    = lifeFrac < 0.15
        ? (lifeFrac / 0.15)          // fade in
        : lifeFrac > 0.75
          ? (1 - (lifeFrac - 0.75) / 0.25) // fade out
          : 1;

      // Respawn when off-screen or life expired
      if (p.y < -20 || p.x < -20 || p.x > w + 20 || p.life >= p.maxLife) {
        this._particles[i] = this._spawn(false);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = alpha * p.alpha;
      ctx.shadowBlur  = p.blur;
      ctx.shadowColor = p.colour;
      ctx.fillStyle   = p.colour;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// Export for use by pick-hero.js
window.PickHeroParticles = PickHeroParticles;
