/* Compare Us — Cinematic "Tale of the Tape" JS.
 *
 * PR-A: infrastructure shell.
 * PR-B: scenes 1-4 wired (ring walk, tape, round1, round2).
 * PR-C: scenes 5-8 + Fight Club picker.
 *
 * Pattern mirrors pinsticker + methodology cinematic:
 *   · gsap.context() scoped to the .cus-cine root — destroy() reverts
 *     every tween + ScrollTrigger from one call.
 *   · gsap.matchMedia() for desktop / mobile forks (mobile skips the
 *     spotlight sweep + tightens durations).
 *   · Honours prefers-reduced-motion — static end-state, no GSAP.
 *
 * Public surface:
 *   window.CompareUsCinematic.init()     — auto-called on DOM ready
 *   window.CompareUsCinematic.destroy()  — SPA-style teardown
 *   window.CompareUsCinematic.registerScene(name, fn)
 *                                        — PR-C hooks scenes 5-8 here
 */
(function () {
  'use strict';

  var ROOT_SEL = '.cus-cine';
  var _context = null;
  var _ready = false;
  var _scenes = Object.create(null);

  // ── Public API ────────────────────────────────────────────

  function init() {
    if (_ready) return;
    var root = document.querySelector(ROOT_SEL);
    if (!root) return;

    var reduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      applyStaticEndStates(root);
      _ready = true;
      return;
    }

    if (typeof window.gsap === 'undefined') {
      applyStaticEndStates(root);
      _ready = true;
      return;
    }
    if (window.ScrollTrigger &&
        typeof window.gsap.registerPlugin === 'function') {
      window.gsap.registerPlugin(window.ScrollTrigger);
    }

    _context = window.gsap.context(function () {
      // Every scene runs in its own function inside the context so
      // ScrollTriggers get scoped to `root` and destroy() cleans them
      // all in one revert() call.
      wireRingWalk(root);
      wireTape(root);
      wireRound1(root);
      wireRound2(root);
      wireForecast(root);
      wireDecision(root);
      wireYourCard(root);
      wireOutro(root);

      // External scene registrations (e.g. an A/B experiment or a
      // future scene 9) — registered via registerScene().
      Object.keys(_scenes).forEach(function (name) {
        try { _scenes[name](root); }
        catch (e) { /* one bad scene doesn't take down the rest */ }
      });
    }, root);

    _ready = true;
  }

  function destroy() {
    if (_context && typeof _context.revert === 'function') {
      _context.revert();
    }
    _context = null;
    _ready = false;
  }

  function registerScene(name, fn) {
    if (typeof fn === 'function') _scenes[name] = fn;
  }

  function applyStaticEndStates(root) {
    // Set every element the animated scenes would hide/reveal to its
    // final state, so a reduced-motion or no-GSAP reader still sees
    // a complete page rather than a half-built one.
    root.setAttribute('data-cinematic-mode', 'static');

    // Scene 3 bar heights — the JS scaling logic runs even in static
    // mode so the reader sees proportional bars.
    scaleRound1Bars(root);
  }

  // ── Scene 1 · Ring walk — the face-off ───────────────────

  function wireRingWalk(root) {
    var scene = root.querySelector('[data-scene="ring-walk"]');
    if (!scene) return;

    var eyebrow = scene.querySelector('.cus-scene__eyebrow');
    var prompt  = scene.querySelector('.cus-scene__prompt');
    var left    = scene.querySelector('.cus-faceoff__fighter--left');
    var right   = scene.querySelector('.cus-faceoff__fighter--right');
    var centre  = scene.querySelector('.cus-faceoff__centre');
    var vs      = scene.querySelector('.cus-faceoff__vs');
    var stats   = scene.querySelector('.cus-faceoff__stats');
    var statRows = scene.querySelectorAll('.cus-faceoff__stat');
    var undercard = scene.querySelectorAll('.cus-undercard__fighter');
    var undercardEyebrow = scene.querySelector('.cus-undercard__eyebrow');

    // Eyebrow lands first, quiet.
    if (eyebrow) {
      window.gsap.fromTo(eyebrow,
        { y: 12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out',
          scrollTrigger: { trigger: scene, start: 'top 80%', once: true }}
      );
    }

    // Fighters fly in from opposite viewport edges — the drama of
    // the boxing announcer. Ease decelerates so they slam then settle.
    if (left) {
      window.gsap.fromTo(left,
        { x: '-110vw', opacity: 0, scale: 0.9 },
        {
          x: 0, opacity: 1, scale: 1,
          duration: 1.05, delay: 0.2, ease: 'power3.out',
          scrollTrigger: { trigger: scene, start: 'top 70%', once: true },
        }
      );
    }
    if (right) {
      window.gsap.fromTo(right,
        { x: '110vw', opacity: 0, scale: 0.9 },
        {
          x: 0, opacity: 1, scale: 1,
          duration: 1.05, delay: 0.2, ease: 'power3.out',
          scrollTrigger: { trigger: scene, start: 'top 70%', once: true },
        }
      );
    }

    // Centre stack settles in with a small scale bounce as the
    // fighters converge on it.
    if (centre) {
      window.gsap.fromTo(centre,
        { y: 20, opacity: 0, scale: 0.85 },
        {
          y: 0, opacity: 1, scale: 1,
          duration: 0.9, delay: 0.6, ease: 'back.out(1.6)',
          scrollTrigger: { trigger: scene, start: 'top 70%', once: true },
        }
      );
    }

    // VS badge gets a spinning drop — the "bell" moment of the intro.
    if (vs) {
      window.gsap.fromTo(vs,
        { scale: 0, rotate: -180, opacity: 0 },
        {
          scale: 1, rotate: 0, opacity: 1,
          duration: 0.9, delay: 0.9, ease: 'back.out(2.2)',
          scrollTrigger: { trigger: scene, start: 'top 70%', once: true },
        }
      );
      // Slow gold pulse after it lands.
      window.gsap.to(vs, {
        boxShadow: '0 0 60px -4px rgba(184, 134, 11, 0.75), inset 0 0 30px rgba(184, 134, 11, 0.30)',
        duration: 1.2, delay: 1.9,
        yoyo: true, repeat: -1, ease: 'sine.inOut',
        scrollTrigger: { trigger: scene, start: 'top 70%', once: true },
      });
    }

    // Stat rows cascade in below the VS.
    statRows.forEach(function (row, i) {
      window.gsap.fromTo(row,
        { y: 12, opacity: 0 },
        {
          y: 0, opacity: 1,
          duration: 0.45, ease: 'power2.out',
          delay: 1.2 + 0.10 * i,
          scrollTrigger: { trigger: scene, start: 'top 70%', once: true },
        }
      );
    });

    // Undercard reveals last — fade + tiny lift, staggered.
    if (undercardEyebrow) {
      window.gsap.fromTo(undercardEyebrow,
        { y: 8, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out',
          delay: 1.2 + 0.10 * statRows.length + 0.10,
          scrollTrigger: { trigger: scene, start: 'top 70%', once: true }}
      );
    }
    undercard.forEach(function (fig, i) {
      window.gsap.fromTo(fig,
        { y: 16, opacity: 0 },
        {
          y: 0, opacity: 1,
          duration: 0.5, ease: 'power2.out',
          delay: 1.2 + 0.10 * statRows.length + 0.25 + 0.08 * i,
          scrollTrigger: { trigger: scene, start: 'top 70%', once: true },
        }
      );
    });

    // Scroll prompt pulses at the bottom — same pattern as before.
    if (prompt) {
      window.gsap.fromTo(prompt,
        { opacity: 0 },
        { opacity: 1, duration: 1.2, delay: 2.2, ease: 'power1.out',
          repeat: -1, yoyo: true,
          scrollTrigger: { trigger: scene, start: 'top 90%', once: true }}
      );
    }
  }

  // ── Scene 2 · Tale of the tape (count-up + AHEAD flash) ──

  function wireTape(root) {
    var scene = root.querySelector('[data-scene="tape"]');
    if (!scene) return;
    var rows = scene.querySelectorAll('tr[data-metric]');
    if (!rows.length) return;

    rows.forEach(function (row, rowIndex) {
      var numbers = row.querySelectorAll('.cus-tape__number');
      var winnerAhead = row.querySelectorAll('.cus-tape__ahead');
      var winnerCells = row.querySelectorAll('.cus-tape__value--winner');

      numbers.forEach(function (numberEl) {
        var target  = parseFloat(numberEl.getAttribute('data-target')) || 0;
        var display = numberEl.getAttribute('data-display') || String(target);
        // Sniff whether the display is a currency (£) or percent (%)
        // so the count-up formats to match the settled value.
        var currency = display.trim().charAt(0) === '£';
        var percent  = display.trim().slice(-1) === '%';
        var counter  = { v: 0 };

        // Start at zero so the count-up reads as a fresh weigh-in.
        numberEl.textContent = currency ? '£0' : (percent ? '0.0%' : '0');

        window.gsap.to(counter, {
          v: target,
          duration: 1.1,
          delay: 0.15 * rowIndex,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: row,
            start: 'top 85%',
            once: true,
          },
          onUpdate: function () {
            var v = counter.v;
            if (currency) {
              numberEl.textContent = '£' + Math.round(v).toLocaleString();
            } else if (percent) {
              numberEl.textContent = v.toFixed(1) + '%';
            } else {
              numberEl.textContent = String(Math.round(v));
            }
          },
          onComplete: function () {
            // Snap to the exact server-rendered display so nothing
            // drifts (integer rounding, comma formatting, £/%).
            numberEl.textContent = display;
          },
        });
      });

      // AHEAD pill + winner-cell tint fire once the count settles.
      if (winnerAhead.length) {
        window.gsap.fromTo(winnerAhead,
          { scale: 0.6, opacity: 0 },
          {
            scale: 1, opacity: 1,
            duration: 0.4,
            delay: 0.15 * rowIndex + 1.15,
            ease: 'back.out(2)',
            scrollTrigger: {
              trigger: row,
              start: 'top 85%',
              once: true,
            },
          }
        );
      }
      if (winnerCells.length) {
        // Subtle background pulse on the winning cell for a beat.
        window.gsap.fromTo(winnerCells,
          { backgroundColor: 'rgba(184, 134, 11, 0.0)' },
          {
            backgroundColor: 'rgba(184, 134, 11, 0.18)',
            duration: 0.35,
            delay: 0.15 * rowIndex + 1.15,
            yoyo: true, repeat: 1,
            scrollTrigger: {
              trigger: row,
              start: 'top 85%',
              once: true,
            },
          }
        );
      }
    });
  }

  // ── Scene 3 · Round 1 (season, round by round) ───────────

  function wireRound1(root) {
    var scene = root.querySelector('[data-scene="round1"]');
    if (!scene) return;

    // Precompute the % width for every horizontal bar. Runs even in
    // static/no-GSAP mode so non-animated readers see correct scale.
    scaleRound1Bars(root);

    var panels = scene.querySelectorAll('.cus-round-panel');
    if (!panels.length) return;

    panels.forEach(function (panel, panelIndex) {
      // Panel entry — slide up + fade in as the round enters view.
      window.gsap.fromTo(panel,
        { y: 40, opacity: 0 },
        {
          y: 0, opacity: 1,
          duration: 0.7, ease: 'power3.out',
          scrollTrigger: {
            trigger: panel,
            start: 'top 82%',
            once: true,
          },
        }
      );

      // Bars grow left-to-right, each one staggered so the reader sees
      // the round build up rather than snap.
      var bars = panel.querySelectorAll('.cus-hbar');
      bars.forEach(function (bar, barIndex) {
        var fill  = bar.querySelector('.cus-hbar__fill');
        var value = bar.querySelector('.cus-hbar__value');
        var targetPct = parseFloat(bar.style.getPropertyValue('--bar-pct')) || 0;
        var target    = parseFloat(value.getAttribute('data-target')) || 0;

        // Fill grows to its % of the track (0 → targetPct).
        window.gsap.fromTo(fill,
          { width: '0%' },
          {
            width: targetPct + '%',
            duration: 0.75,
            delay: 0.10 + 0.10 * barIndex,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: panel,
              start: 'top 82%',
              once: true,
            },
          }
        );

        // Counter ticks up in lockstep with the fill.
        var counter = { v: 0 };
        window.gsap.to(counter, {
          v: target,
          duration: 0.75,
          delay: 0.10 + 0.10 * barIndex,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: panel,
            start: 'top 82%',
            once: true,
          },
          onUpdate: function () {
            value.textContent = String(Math.round(counter.v));
          },
          onComplete: function () {
            value.textContent = String(target);
          },
        });
      });

      // Winner chip pop-in after the bars settle.
      var chip = panel.querySelector('.cus-round-panel__chip');
      if (chip) {
        window.gsap.fromTo(chip,
          { scale: 0.7, opacity: 0 },
          {
            scale: 1, opacity: 1,
            duration: 0.45, ease: 'back.out(2)',
            delay: 0.10 + 0.10 * bars.length + 0.05,
            scrollTrigger: {
              trigger: panel,
              start: 'top 82%',
              once: true,
            },
          }
        );
      }

      // Notable-race pill slides in from the right.
      var notable = panel.querySelector('.cus-round-panel__notable');
      if (notable) {
        window.gsap.fromTo(notable,
          { x: 24, opacity: 0 },
          {
            x: 0, opacity: 1,
            duration: 0.5, ease: 'power2.out',
            delay: 0.10 + 0.10 * bars.length + 0.15,
            scrollTrigger: {
              trigger: panel,
              start: 'top 82%',
              once: true,
            },
          }
        );
      }

      // Season ticker rows cascade in.
      var tickerRows = panel.querySelectorAll('.cus-round-panel__ticker-row');
      tickerRows.forEach(function (row, i) {
        window.gsap.fromTo(row,
          { y: 8, opacity: 0 },
          {
            y: 0, opacity: 1,
            duration: 0.35, ease: 'power2.out',
            delay: 0.10 + 0.10 * bars.length + 0.30 + 0.06 * i,
            scrollTrigger: {
              trigger: panel,
              start: 'top 82%',
              once: true,
            },
          }
        );
      });
    });
  }

  function scaleRound1Bars(root) {
    // Compute proportional widths (percent of the track) for every
    // horizontal bar. Uses the global max across all rounds so the
    // reader can compare months at a glance.
    var wrap = root.querySelector('[data-rounds-max]');
    if (!wrap) return;
    var maxValue = parseFloat(wrap.getAttribute('data-rounds-max')) || 0;
    if (!maxValue) return;
    var MAX_PCT = 96;   // leave a tail so the biggest bar doesn't hit the edge
    var MIN_PCT = 3;    // a zero-value bar still hints presence
    wrap.querySelectorAll('.cus-hbar').forEach(function (bar) {
      var v = parseFloat(bar.getAttribute('data-value')) || 0;
      var pct = v > 0
        ? Math.max(MIN_PCT, Math.round((v / maxValue) * MAX_PCT))
        : MIN_PCT;
      bar.style.setProperty('--bar-pct', pct);
      // In static / no-GSAP mode the CSS default `width: 0` on the
      // fill would render an invisible chart — overwrite directly.
      if (root.getAttribute('data-cinematic-mode') === 'static') {
        var fill = bar.querySelector('.cus-hbar__fill');
        if (fill) fill.style.width = pct + '%';
        var value = bar.querySelector('.cus-hbar__value');
        if (value) value.textContent = String(v);
      }
    });
  }

  // ── Scene 4 · Round 2 (rate — gauge + momentum + caption) ─

  function wireRound2(root) {
    var scene = root.querySelector('[data-scene="round2"]');
    if (!scene) return;

    // Deck copy fades in first.
    var deck = scene.querySelector('.cus-scene__deck');
    if (deck) {
      window.gsap.fromTo(deck,
        { y: 12, opacity: 0 },
        {
          y: 0, opacity: 1,
          duration: 0.6, ease: 'power2.out',
          scrollTrigger: { trigger: scene, start: 'top 80%', once: true },
        }
      );
    }

    var meters = scene.querySelectorAll('.cus-meter');
    meters.forEach(function (meter, i) {
      var valueEl    = meter.querySelector('.cus-meter__value');
      var gaugeFill  = meter.querySelector('.cus-meter__gauge-fill');
      var momentum   = meter.querySelector('.cus-meter__momentum');
      var gapEl      = meter.querySelector('.cus-meter__gap');
      var target     = valueEl
        ? parseFloat(valueEl.getAttribute('data-target')) || 0
        : 0;
      var gaugePct   = parseFloat(meter.getAttribute('data-gauge-pct')) || 0;

      // Card entry.
      window.gsap.fromTo(meter,
        { y: 30, opacity: 0, scale: 0.96 },
        {
          y: 0, opacity: 1, scale: 1,
          duration: 0.6,
          delay: 0.10 * i,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: scene,
            start: 'top 75%',
            once: true,
          },
        }
      );

      // Gauge arc fill — stroke-dashoffset drives the reveal.
      // At pathLength=100, offset=100 is empty, offset=(100-pct) is full.
      if (gaugeFill) {
        window.gsap.fromTo(gaugeFill,
          { strokeDashoffset: 100 },
          {
            strokeDashoffset: 100 - gaugePct,
            duration: 1.0,
            delay: 0.10 * i + 0.30,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: scene,
              start: 'top 75%',
              once: true,
            },
          }
        );
      }

      // Counter ticks up.
      if (valueEl) {
        var counter = { v: 0 };
        valueEl.textContent = '0.000';
        window.gsap.to(counter, {
          v: target,
          duration: 1.0,
          delay: 0.10 * i + 0.30,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: scene,
            start: 'top 75%',
            once: true,
          },
          onUpdate: function () {
            valueEl.textContent = counter.v.toFixed(3);
          },
          onComplete: function () {
            valueEl.textContent = target.toFixed(3);
          },
        });
      }

      // Momentum chip pops in after the count settles.
      if (momentum) {
        window.gsap.fromTo(momentum,
          { scale: 0.5, opacity: 0 },
          {
            scale: 1, opacity: 1,
            duration: 0.4, ease: 'back.out(2.2)',
            delay: 0.10 * i + 1.35,
            scrollTrigger: {
              trigger: scene,
              start: 'top 75%',
              once: true,
            },
          }
        );
      }

      // Gap line fades in last.
      if (gapEl) {
        window.gsap.fromTo(gapEl,
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.4,
            delay: 0.10 * i + 1.5,
            scrollTrigger: {
              trigger: scene,
              start: 'top 75%',
              once: true,
            },
          }
        );
      }

      // Leader meter gets a slow gold pulse after everything settles.
      if (meter.classList.contains('cus-meter--leader')) {
        var startShadow = '0 0 24px -6px color-mix(in srgb, ' +
                          'var(--fighter-accent, #b8860b) 55%, transparent)';
        window.gsap.fromTo(meter,
          { boxShadow: startShadow },
          {
            boxShadow: startShadow.replace('24px -6px', '40px 0'),
            duration: 1.0,
            delay: 0.10 * i + 1.9,
            yoyo: true, repeat: 1,
            scrollTrigger: {
              trigger: scene,
              start: 'top 75%',
              once: true,
            },
          }
        );
      }
    });

    // Caption fades in after all meters settle.
    var caption = scene.querySelector('.cus-meters__caption');
    if (caption) {
      window.gsap.fromTo(caption,
        { y: 12, opacity: 0 },
        {
          y: 0, opacity: 1,
          duration: 0.7, ease: 'power2.out',
          delay: 0.10 * meters.length + 1.6,
          scrollTrigger: {
            trigger: scene,
            start: 'top 60%',
            once: true,
          },
        }
      );
    }

    // Chase clock (only present when a challenger is meaningfully faster).
    var chase = scene.querySelector('.cus-meters__chase');
    if (chase) {
      window.gsap.fromTo(chase,
        { y: 20, opacity: 0, scale: 0.96 },
        {
          y: 0, opacity: 1, scale: 1,
          duration: 0.7, ease: 'back.out(1.6)',
          delay: 0.10 * meters.length + 2.0,
          scrollTrigger: {
            trigger: scene,
            start: 'top 60%',
            once: true,
          },
        }
      );
    }
  }

  // ── Scene 5 · Forecast — the centrepiece reveal ──────────

  function wireForecast(root) {
    var scene = root.querySelector('[data-scene="forecast"]');
    if (!scene) return;
    var chart = scene.querySelector('.cus-chart__svg');
    if (!chart) return;

    var head      = scene.querySelector('.cus-forecast__head');
    var eyebrow   = scene.querySelector('.cus-scene__eyebrow');
    var title     = scene.querySelector('.cus-forecast__title');
    var deck      = scene.querySelector('.cus-forecast__deck');
    var chartWrap = scene.querySelector('.cus-forecast__chart-wrap');
    var verdict   = scene.querySelector('.cus-forecast__verdict');
    var verdictStats = scene.querySelectorAll('.cus-forecast__verdict-stats > div');
    var milestones = scene.querySelectorAll('.cus-forecast__milestone');

    // ── Beat 0: header stack — eyebrow, title, deck cascade in. ──
    if (eyebrow) {
      window.gsap.fromTo(eyebrow,
        { y: 14, opacity: 0 },
        {
          y: 0, opacity: 1,
          duration: 0.55, ease: 'power2.out',
          scrollTrigger: { trigger: scene, start: 'top 82%', once: true },
        }
      );
    }
    if (title) {
      // Title gets a subtle scale + upward drift — the marquee lands.
      window.gsap.fromTo(title,
        { y: 30, opacity: 0, scale: 0.94 },
        {
          y: 0, opacity: 1, scale: 1,
          duration: 0.9, delay: 0.15, ease: 'power3.out',
          scrollTrigger: { trigger: scene, start: 'top 82%', once: true },
        }
      );
    }
    if (deck) {
      window.gsap.fromTo(deck,
        { y: 12, opacity: 0 },
        {
          y: 0, opacity: 1,
          duration: 0.7, delay: 0.35, ease: 'power2.out',
          scrollTrigger: { trigger: scene, start: 'top 82%', once: true },
        }
      );
    }

    // ── Beat 1: chart frame drops in with a bit of scale + glow. ──
    if (chartWrap) {
      window.gsap.fromTo(chartWrap,
        { y: 40, opacity: 0, scale: 0.96 },
        {
          y: 0, opacity: 1, scale: 1,
          duration: 1.0, delay: 0.55, ease: 'power3.out',
          scrollTrigger: { trigger: scene, start: 'top 75%', once: true },
        }
      );
    }

    // ── Beat 2: y-axis + gridlines fade in first (recessive). ──
    var gridlines = chart.querySelectorAll(
      '.cus-chart__gridline, .cus-chart__ytick, .cus-chart__yaxis-title'
    );
    gridlines.forEach(function (el, i) {
      window.gsap.fromTo(el,
        { opacity: 0 },
        {
          opacity: null,   // let CSS decide the settled opacity
          duration: 0.5, ease: 'power1.out',
          delay: 0.75 + 0.015 * i,
          scrollTrigger: { trigger: scene, start: 'top 75%', once: true },
        }
      );
    });
    var xticks = chart.querySelectorAll('.cus-chart__xtick');
    xticks.forEach(function (el, i) {
      window.gsap.fromTo(el,
        { y: 8, opacity: 0 },
        {
          y: 0, opacity: null,
          duration: 0.4, ease: 'power2.out',
          delay: 0.95 + 0.06 * i,
          scrollTrigger: { trigger: scene, start: 'top 75%', once: true },
        }
      );
    });

    // ── Beat 3: actual lines draw left-to-right (staggered per fighter). ──
    var actuals = chart.querySelectorAll('.cus-chart__actual');
    actuals.forEach(function (path, i) {
      try {
        var len = path.getTotalLength();
        path.style.strokeDasharray  = len;
        path.style.strokeDashoffset = len;
        window.gsap.to(path, {
          strokeDashoffset: 0,
          duration: 1.4,
          delay: 1.15 + 0.18 * i,
          ease: 'power2.inOut',
          scrollTrigger: { trigger: scene, start: 'top 75%', once: true },
        });
      } catch (e) { /* getTotalLength can throw — skip cleanly */ }
    });

    // ── Beat 4: TODAY marker + divider drop in as actuals settle. ──
    var todayGroup = chart.querySelector('.cus-chart__today-chip');
    var todayLine  = chart.querySelector('.cus-chart__today-line');
    if (todayLine) {
      window.gsap.fromTo(todayLine,
        { scaleY: 0, transformOrigin: '50% 100%' },
        {
          scaleY: 1,
          duration: 0.6, delay: 2.4, ease: 'power3.out',
          scrollTrigger: { trigger: scene, start: 'top 75%', once: true },
        }
      );
    }
    if (todayGroup) {
      window.gsap.fromTo(todayGroup,
        { y: -20, opacity: 0, scale: 0.6 },
        {
          y: 0, opacity: 1, scale: 1,
          duration: 0.6, delay: 2.6, ease: 'back.out(2.4)',
          scrollTrigger: { trigger: scene, start: 'top 75%', once: true },
        }
      );
    }

    // ── Beat 5: forecast dashed lines extend outward from today. ──
    var forecasts = chart.querySelectorAll('.cus-chart__forecast');
    forecasts.forEach(function (path, i) {
      try {
        var len = path.getTotalLength();
        path.style.strokeDasharray  = len;
        path.style.strokeDashoffset = len;
        window.gsap.to(path, {
          strokeDashoffset: 0,
          duration: 1.1,
          delay: 2.95 + 0.10 * i,
          ease: 'power2.out',
          scrollTrigger: { trigger: scene, start: 'top 75%', once: true },
          onStart: function () {
            // Re-apply the dashed pattern once the reveal completes,
            // otherwise strokeDashoffset:0 makes the line solid.
          },
          onComplete: function () {
            path.style.strokeDasharray = '6 5';
            path.style.strokeDashoffset = '';
          },
        });
      } catch (e) {}
    });

    // ── Beat 6: confidence band inflates around the leader. ──
    var band = chart.querySelector('.cus-chart__band');
    if (band) {
      window.gsap.fromTo(band,
        { opacity: 0, transformOrigin: 'left center', scaleY: 0.3 },
        {
          opacity: 1, scaleY: 1,
          duration: 1.2, delay: 3.4, ease: 'power2.out',
          scrollTrigger: { trigger: scene, start: 'top 75%', once: true },
        }
      );
    }

    // ── Beat 7: end-of-line labels + dots pop in. ──
    var endLabels = chart.querySelectorAll('.cus-chart__end-label');
    endLabels.forEach(function (el, i) {
      window.gsap.fromTo(el,
        { scale: 0.5, opacity: 0, transformOrigin: '0% 50%' },
        {
          scale: 1, opacity: 1,
          duration: 0.5, delay: 3.6 + 0.08 * i, ease: 'back.out(2)',
          scrollTrigger: { trigger: scene, start: 'top 75%', once: true },
        }
      );
    });

    // ── Beat 8: milestone pins fade in on their pulse. ──
    milestones.forEach(function (m, i) {
      window.gsap.fromTo(m,
        { scale: 0, opacity: 0 },
        {
          scale: 1, opacity: 1,
          duration: 0.55, ease: 'back.out(2)',
          delay: 4.1 + 0.15 * i,
          scrollTrigger: { trigger: scene, start: 'top 75%', once: true },
        }
      );
    });

    // ── Beat 9: verdict overlay lands — the read. ──
    if (verdict) {
      window.gsap.fromTo(verdict,
        { y: 40, opacity: 0, scale: 0.96 },
        {
          y: 0, opacity: 1, scale: 1,
          duration: 0.9, ease: 'back.out(1.6)',
          delay: 4.6,
          scrollTrigger: { trigger: scene, start: 'top 75%', once: true },
        }
      );
    }
    verdictStats.forEach(function (row, i) {
      window.gsap.fromTo(row,
        { y: 12, opacity: 0 },
        {
          y: 0, opacity: 1,
          duration: 0.5, ease: 'power2.out',
          delay: 5.0 + 0.10 * i,
          scrollTrigger: { trigger: scene, start: 'top 75%', once: true },
        }
      );
    });
  }

  // ── Scene 6 · Decision — championship celebration ────────

  function wireDecision(root) {
    var scene = root.querySelector('[data-scene="decision"]');
    if (!scene) return;

    var announcer   = scene.querySelector('.cus-champ__announcer');
    var spotlight   = scene.querySelector('.cus-champ__spotlight');
    var belt        = scene.querySelector('.cus-champ__belt');
    var beltLine    = scene.querySelector('.cus-champ__belt-line');
    var beltGems    = scene.querySelectorAll('.cus-champ__belt-gem');
    var portraitWrap = scene.querySelector('.cus-champ__portrait-wrap');
    var confetti    = scene.querySelectorAll('.cus-champ__confetto');
    var name        = scene.querySelector('.cus-champ__name');
    var marginBox   = scene.querySelector('.cus-champ__margin');
    var marginNum   = scene.querySelector('.cus-champ__margin-number');
    var subhead     = scene.querySelector('.cus-champ__subhead');
    var closing     = scene.querySelector('.cus-champ__closing');
    var statBoxes   = scene.querySelectorAll('.cus-champ__stat');
    var statValues  = scene.querySelectorAll('.cus-champ__stat dd');
    var runnerUp    = scene.querySelector('.cus-champ__runner-up');

    // Common ScrollTrigger — every beat fires when the scene enters view.
    var st = { trigger: scene, start: 'top 70%', once: true };

    // ── Beat 1: house lights — spotlight fades in. ──
    if (spotlight) {
      window.gsap.fromTo(spotlight,
        { opacity: 0, scale: 0.6 },
        { opacity: 1, scale: 1,
          duration: 1.2, ease: 'power2.out',
          scrollTrigger: st }
      );
    }

    // ── Beat 2: announcer lands. ──
    if (announcer) {
      window.gsap.fromTo(announcer,
        { y: -16, opacity: 0, letterSpacing: '0.5em' },
        { y: 0, opacity: 1, letterSpacing: '0.28em',
          duration: 0.7, delay: 0.3, ease: 'power3.out',
          scrollTrigger: st }
      );
    }

    // ── Beat 3: belt raises — line strokes in, gems pop, then floats. ──
    if (belt) {
      window.gsap.fromTo(belt,
        { y: -40, opacity: 0, scale: 0.7 },
        { y: 0, opacity: 1, scale: 1,
          duration: 0.9, delay: 0.9, ease: 'back.out(1.6)',
          scrollTrigger: st }
      );
    }
    if (beltLine) {
      window.gsap.to(beltLine,
        { strokeDashoffset: 0,
          duration: 1.0, delay: 1.1, ease: 'power2.inOut',
          scrollTrigger: st }
      );
    }
    beltGems.forEach(function (gem, i) {
      window.gsap.fromTo(gem,
        { opacity: 0, scale: 0, transformOrigin: 'center' },
        { opacity: 1, scale: 1,
          duration: 0.4, delay: 1.9 + 0.10 * i, ease: 'back.out(2.2)',
          scrollTrigger: st }
      );
    });
    // Belt gets a slow bob-up-and-down after settling.
    if (belt) {
      window.gsap.to(belt,
        { y: -6,
          duration: 1.4, delay: 2.4,
          yoyo: true, repeat: -1, ease: 'sine.inOut',
          scrollTrigger: st }
      );
    }

    // ── Beat 4: portrait bursts in from below. ──
    if (portraitWrap) {
      window.gsap.fromTo(portraitWrap,
        { y: 80, opacity: 0, scale: 0.4, rotate: -6 },
        { y: 0, opacity: 1, scale: 1, rotate: 0,
          duration: 1.0, delay: 1.6, ease: 'back.out(1.4)',
          scrollTrigger: st }
      );
    }

    // ── Beat 5: confetti explodes outward. ──
    // Each dot picks a random angle + distance + colour on the fly.
    if (confetti.length) {
      var CONFETTI_COLOURS = [
        '#b8860b', '#f0c14b', '#ffffff', '#f5efe3',
        '#2563eb', '#dc2626',
      ];
      confetti.forEach(function (dot, i) {
        var angle    = (i / confetti.length) * Math.PI * 2 +
                       (Math.random() * 0.4 - 0.2);
        var distance = 180 + Math.random() * 160;
        var xEnd     = Math.cos(angle) * distance;
        var yEnd     = Math.sin(angle) * distance;
        var colour   = CONFETTI_COLOURS[i % CONFETTI_COLOURS.length];
        dot.style.background = colour;
        window.gsap.fromTo(dot,
          { opacity: 0, x: 0, y: 0, scale: 0.5, rotate: 0 },
          { opacity: 1, x: xEnd, y: yEnd, scale: 1 + Math.random() * 0.6,
            rotate: 180 + Math.random() * 360,
            duration: 1.4, delay: 2.0 + Math.random() * 0.4,
            ease: 'power2.out',
            scrollTrigger: st,
            onComplete: function () {
              window.gsap.to(dot, {
                opacity: 0,
                duration: 0.8,
                ease: 'power1.in',
              });
            },
          }
        );
      });
    }

    // ── Beat 6: champion name reveals with a scale + fade. ──
    if (name) {
      window.gsap.fromTo(name,
        { y: 30, opacity: 0, scale: 0.9 },
        { y: 0, opacity: 1, scale: 1,
          duration: 1.0, delay: 2.4, ease: 'back.out(1.4)',
          scrollTrigger: st }
      );
    }

    // ── Beat 7: forecast margin — big number counts up. ──
    if (marginBox) {
      window.gsap.fromTo(marginBox,
        { y: 20, opacity: 0, scale: 0.85 },
        { y: 0, opacity: 1, scale: 1,
          duration: 0.7, delay: 3.0, ease: 'back.out(2)',
          scrollTrigger: st }
      );
    }
    if (marginNum) {
      var target = parseInt(marginBox.getAttribute('data-target'), 10) || 0;
      var counter = { v: 0 };
      window.gsap.to(counter, {
        v: target,
        duration: 1.2, delay: 3.2, ease: 'power2.out',
        scrollTrigger: st,
        onUpdate: function () {
          marginNum.textContent = String(Math.round(counter.v));
        },
        onComplete: function () {
          marginNum.textContent = String(target);
        },
      });
    }

    // ── Beat 8: subhead + closing line fade in. ──
    [subhead, closing].forEach(function (el, i) {
      if (!el) return;
      window.gsap.fromTo(el,
        { y: 12, opacity: 0 },
        { y: 0, opacity: 1,
          duration: 0.6, delay: 3.6 + 0.15 * i, ease: 'power2.out',
          scrollTrigger: st }
      );
    });

    // ── Beat 9: stat boxes cascade in with count-up. ──
    statBoxes.forEach(function (box, i) {
      window.gsap.fromTo(box,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1,
          duration: 0.5, delay: 4.0 + 0.12 * i, ease: 'power2.out',
          scrollTrigger: st }
      );
    });
    statValues.forEach(function (dd, i) {
      var target = parseFloat(dd.getAttribute('data-target')) || 0;
      var isCurrency = dd.classList.contains('cus-champ__stat-currency');
      var isPct      = dd.classList.contains('cus-champ__stat-pct');
      var counter    = { v: 0 };
      window.gsap.to(counter, {
        v: target,
        duration: 1.0, delay: 4.15 + 0.12 * i, ease: 'power2.out',
        scrollTrigger: st,
        onUpdate: function () {
          if (isCurrency) {
            dd.textContent = '£' + Math.round(counter.v).toLocaleString();
          } else if (isPct) {
            dd.textContent = counter.v.toFixed(1) + '%';
          } else {
            dd.textContent = String(Math.round(counter.v));
          }
        },
        onComplete: function () {
          if (isCurrency) {
            dd.textContent = '£' + target.toLocaleString();
          } else if (isPct) {
            dd.textContent = target.toFixed(1) + '%';
          } else {
            dd.textContent = String(Math.round(target));
          }
        },
      });
    });

    // ── Beat 10: runner-up slides in from the side. ──
    if (runnerUp) {
      window.gsap.fromTo(runnerUp,
        { x: 40, opacity: 0 },
        { x: 0, opacity: 1,
          duration: 0.8, delay: 4.8, ease: 'power3.out',
          scrollTrigger: st }
      );
    }
  }

  // ── Scene 7 · Your Card (Fight Club) ──────────────────────

  function wireYourCard(root) {
    var scene = root.querySelector('[data-scene="your-card"]');
    if (!scene) return;
    var block = scene.querySelector('.cus-fightclub');
    if (!block) return;

    window.gsap.fromTo(block,
      { y: 24, opacity: 0 },
      {
        y: 0, opacity: 1,
        duration: 0.7, ease: 'power2.out',
        scrollTrigger: { trigger: scene, start: 'top 75%', once: true },
      }
    );

    // Picker option cards cascade in one-by-one so the reader's eye
    // parses the fighters as a choice.
    var options = block.querySelectorAll('.cus-picker__option');
    options.forEach(function (opt, i) {
      window.gsap.fromTo(opt,
        { y: 14, opacity: 0 },
        {
          y: 0, opacity: 1,
          duration: 0.5, ease: 'power2.out',
          delay: 0.3 + 0.08 * i,
          scrollTrigger: { trigger: scene, start: 'top 75%', once: true },
        }
      );
    });

    // Saved-state card gets a subtle flash on load — reinforces the
    // "you're in" moment for readers returning after their pick lands.
    var saved = block.querySelector('.cus-fightclub__saved');
    if (saved) {
      window.gsap.fromTo(saved,
        { scale: 0.98 },
        {
          scale: 1,
          duration: 0.5, ease: 'back.out(2)',
          scrollTrigger: { trigger: scene, start: 'top 75%', once: true },
        }
      );
    }

    // Django messages fade + shrink out after 4s — they served their
    // "we saved your pick" purpose and shouldn't linger.
    var messages = scene.querySelector('.cus-fightclub__messages');
    if (messages) {
      window.gsap.to(messages, {
        opacity: 0,
        height: 0, margin: 0, padding: 0,
        duration: 0.6, delay: 4.5, ease: 'power2.in',
      });
    }
  }

  // ── Scene 8 · Outro (CTA row) ─────────────────────────────

  function wireOutro(root) {
    var scene = root.querySelector('[data-scene="outro"]');
    if (!scene) return;
    var links = scene.querySelectorAll('.cus-outro__link');
    if (!links.length) return;

    links.forEach(function (link, i) {
      window.gsap.fromTo(link,
        { y: 20, opacity: 0 },
        {
          y: 0, opacity: 1,
          duration: 0.55, ease: 'power2.out',
          delay: 0.15 * i,
          scrollTrigger: {
            trigger: scene,
            start: 'top 85%',
            once: true,
          },
        }
      );
    });
  }

  // ── Bootstrap ─────────────────────────────────────────────

  window.CompareUsCinematic = {
    init: init,
    destroy: destroy,
    registerScene: registerScene,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once: true});
  } else {
    init();
  }
})();
