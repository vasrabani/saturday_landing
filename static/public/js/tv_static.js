/*
 * tv_static.js — reusable animated CRT "snow" effect for any <canvas>.
 *
 * Public API:
 *   const inst = TvStatic.attach(canvas, {opts});
 *   inst.pause();
 *   inst.play();
 *   inst.destroy();
 *
 * Or auto-init via data attributes:
 *   <canvas data-tv-static
 *           data-tv-static-cell="2"
 *           data-tv-static-fps="24"
 *           data-tv-static-opacity="0.55"
 *           data-tv-static-tint="cool"
 *           data-tv-static-scroll-pause></canvas>
 *
 * Options (all optional):
 *   cell      Snow grain size in CSS px (default 2). Higher = chunkier.
 *   fps       Repaint cap. 24 looks authentically broken; default 24.
 *   opacity   Per-pixel alpha (0–1, default 0.55).
 *   tint      'mono' (default) | 'cool' (slight blue) | 'warm' (cream).
 *   pauseOff  Pause when the canvas leaves the viewport (default true).
 *   reducedMotion 'static' (default — single frame), 'off' (no paint),
 *                 or 'force' (animate anyway).
 *
 * Implementation notes:
 *   - We render to a LOW-RES offscreen buffer (one pixel per grain),
 *     then up-scale via canvas drawImage so the GPU does the resampling.
 *     This is dramatically cheaper than per-CSS-pixel random fills.
 *   - The visible canvas's CSS size drives the buffer size; we listen
 *     to ResizeObserver so a window resize reseeds the buffer.
 *   - Frame cap (fps) decouples paint from rAF — old CRTs ran 50/60Hz
 *     but the snow itself is perceptually identical at 24Hz with much
 *     lower CPU cost.
 *   - We hold a single typed-array view (Uint32) onto the ImageData
 *     and rewrite with bitwise alpha-masking, ~3× faster than the
 *     naive setUint8(i, x) loop.
 */
(function (global) {
  'use strict';

  // ── Tint LUTs ───────────────────────────────────────────────
  // Pre-baked per-channel offsets so the hot loop only does integer ops.
  const TINT = {
    mono: { rOff: 0,    gOff: 0,    bOff: 0    },
    cool: { rOff: -8,   gOff: -2,   bOff: 12   },   // slight blue cast
    warm: { rOff: 12,   gOff: 6,    bOff: -10  },   // amber/cream cast
  };

  const REDUCED_MOTION = (typeof matchMedia !== 'undefined') &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function attach(canvas, opts) {
    if (!canvas || canvas.tagName !== 'CANVAS') {
      throw new Error('TvStatic.attach: <canvas> element required.');
    }

    opts = opts || {};
    const cell       = Math.max(1, opts.cell      || 2);
    const fps        = Math.max(1, opts.fps       || 24);
    const opacity    = clamp(opts.opacity != null ? opts.opacity : 0.55, 0, 1);
    const tintKey    = (opts.tint || 'mono').toLowerCase();
    const tint       = TINT[tintKey] || TINT.mono;
    const pauseOff   = opts.pauseOff !== false;
    const reducedMot = opts.reducedMotion || 'static';

    const alpha255 = Math.round(opacity * 255) & 0xFF;
    const minFrameMs = 1000 / fps;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('TvStatic.attach: 2d context unavailable.');
    ctx.imageSmoothingEnabled = false;        // crisp scaled grain

    let bufW = 0;
    let bufH = 0;
    let imgData = null;
    let view32  = null;                       // Uint32Array view onto imgData.data

    function resizeBuffer() {
      // CSS size of the visible canvas dictates the back-buffer size.
      const rect = canvas.getBoundingClientRect();
      const wPx = Math.max(1, Math.floor(rect.width));
      const hPx = Math.max(1, Math.floor(rect.height));
      // Buffer is rect / cell — one buffer-pixel per snow grain.
      bufW = Math.max(1, Math.floor(wPx / cell));
      bufH = Math.max(1, Math.floor(hPx / cell));

      // Visible canvas drawing surface tracks the CSS box so drawImage
      // up-scales cleanly. We deliberately DON'T set devicePixelRatio
      // here — crisp DPR-snow defeats the chunky retro look.
      canvas.width  = wPx;
      canvas.height = hPx;

      imgData = ctx.createImageData(bufW, bufH);
      view32  = new Uint32Array(imgData.data.buffer);
    }

    function paintFrame() {
      if (!view32) return;
      // Build pixels in little-endian ABGR order (matches typical
      // browser canvas layout). We pick a single luminance value per
      // pixel, optionally tinted, with the global alpha255.
      const n = view32.length;
      const rOff = tint.rOff, gOff = tint.gOff, bOff = tint.bOff;
      for (let i = 0; i < n; i++) {
        const lum = (Math.random() * 256) | 0;       // 0..255 inclusive-ish
        const r = clamp(lum + rOff, 0, 255);
        const g = clamp(lum + gOff, 0, 255);
        const b = clamp(lum + bOff, 0, 255);
        // Pack as 0xAABBGGRR.
        view32[i] = (alpha255 << 24) | (b << 16) | (g << 8) | r;
      }
      ctx.putImageData(imgData, 0, 0);
      // Up-scale the low-res buffer back to the visible canvas size.
      ctx.drawImage(canvas, 0, 0, bufW, bufH, 0, 0, canvas.width, canvas.height);
    }

    // ── Animation loop ─────────────────────────────────────
    let rafId = 0;
    let last  = 0;
    let playing = false;
    let everPainted = false;

    function tick(now) {
      if (!playing) return;
      if (now - last >= minFrameMs) {
        paintFrame();
        last = now;
        everPainted = true;
      }
      rafId = global.requestAnimationFrame(tick);
    }

    function play() {
      if (playing) return;
      // If reduced motion is set, paint a single frame and stop.
      if (REDUCED_MOTION && reducedMot !== 'force') {
        if (reducedMot === 'off') return;        // honour fully
        paintFrame();                            // 'static' (default)
        everPainted = true;
        return;
      }
      playing = true;
      last = 0;
      rafId = global.requestAnimationFrame(tick);
    }

    function pause() {
      playing = false;
      if (rafId) { global.cancelAnimationFrame(rafId); rafId = 0; }
    }

    // ── Resize handling ───────────────────────────────────
    const ro = (typeof ResizeObserver !== 'undefined')
      ? new ResizeObserver(() => {
          resizeBuffer();
          if (playing || everPainted) paintFrame();
        })
      : null;
    if (ro) ro.observe(canvas);

    // ── Viewport pause (perf) ─────────────────────────────
    let io = null;
    if (pauseOff && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) play(); else pause();
        }
      }, { rootMargin: '64px' });
      io.observe(canvas);
    }

    // ── Document visibility pause ────────────────────────
    function onVis() {
      if (global.document.hidden) pause();
      else if (!pauseOff || isOnScreen()) play();
    }
    function isOnScreen() {
      const r = canvas.getBoundingClientRect();
      return r.bottom > 0 && r.top < global.innerHeight;
    }
    global.document.addEventListener('visibilitychange', onVis);

    // ── Boot ──────────────────────────────────────────────
    resizeBuffer();
    play();

    return {
      play,
      pause,
      destroy() {
        pause();
        if (ro) ro.disconnect();
        if (io) io.disconnect();
        global.document.removeEventListener('visibilitychange', onVis);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        imgData = null; view32 = null;
      },
    };
  }

  // ── Auto-init for [data-tv-static] elements ─────────────────
  function autoInit() {
    const nodes = global.document.querySelectorAll('canvas[data-tv-static]');
    nodes.forEach((c) => {
      // Skip if already wired.
      if (c._tvStatic) return;
      const ds = c.dataset;
      c._tvStatic = attach(c, {
        cell:    parseFloat(ds.tvStaticCell)    || undefined,
        fps:     parseFloat(ds.tvStaticFps)     || undefined,
        opacity: parseFloat(ds.tvStaticOpacity) || undefined,
        tint:    ds.tvStaticTint                || undefined,
        pauseOff: !('tvStaticAlways' in ds),
      });
    });
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', autoInit, { once: true });
  } else {
    autoInit();
  }

  global.TvStatic = { attach: attach };
})(window);
