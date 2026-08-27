(function () {
  const page = document.getElementById('simPage');
  const seedEl = document.getElementById('simulation-seed');
  const launchBtn = document.getElementById('launchSimulationBtn');
  const rerunBtn = document.getElementById('rerunSimulationBtn');
  const stagePanel = document.getElementById('simStagePanel');
  const lensButtons = Array.from(document.querySelectorAll('.sim-lens-tab'));
  const overlay = document.getElementById('simOverlay');
  const overlayBar = document.getElementById('simOverlayBar');
  const overlayTitle = document.getElementById('simOverlayTitle');
  const overlayText = document.getElementById('simOverlayText');
  const overlayLens = document.getElementById('simOverlayLens');
  const overlayRace = document.getElementById('simOverlayRace');
  const personaMemory = document.getElementById('simPersonaMemory');
  const memoryTitle = document.getElementById('simMemoryTitle');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const overlayContent = document.getElementById('simOverlayContent');

  /* ── Kaleidoscope engine ─────────────────────────────────── */
  const kaleidoCanvas = document.getElementById('simKaleido');
  const kaleidoSignal = document.getElementById('simKaleidoSignal');

  const KALEIDO_MS   = 4500;  // total thinking phase duration
  const SIGNAL_MS    = 600;   // "signal acquired" flash duration

  // Data fragments that flicker through the segments
  const FRAGMENTS = [
    '8/1','14/1','25/1','SR172','SR165','W1','W4',
    '82%','67%','4111','2931','PACE','FORM',
    '◈','⚡','★','◆','72%','88%',
  ];

  function runKaleidoscope() {
    if (prefersReducedMotion || !kaleidoCanvas) return Promise.resolve();

    return new Promise((resolve) => {
      const ctx    = kaleidoCanvas.getContext('2d');
      const panel  = kaleidoCanvas.closest('.sim-overlay__panel');
      let   W, H, cx, cy, rafId;
      let   startTime = null;
      let   signalShown = false;

      // Size canvas to panel
      function resize() {
        W = kaleidoCanvas.width  = panel.offsetWidth;
        H = kaleidoCanvas.height = panel.offsetHeight;
        cx = W / 2;
        cy = H / 2;
      }
      resize();

      // Particles state
      const SEGMENTS = 8;           // rotational symmetry
      const PARTICLES = 28;         // per-segment source particles
      const particles = [];

      function mkParticle(i) {
        return {
          // angle within one segment (0..2π/SEGMENTS)
          angle:  Math.random() * (Math.PI * 2 / SEGMENTS),
          radius: Math.random() * (Math.min(W, H) * 0.44),
          speed:  (Math.random() * 0.012 + 0.006) * (Math.random() < 0.5 ? 1 : -1),
          radialV: (Math.random() - 0.5) * 0.7,
          size:   Math.random() * 2.2 + 0.5,
          life:   Math.random(),
          hue:    Math.random() < 0.55
                    ? Math.random() * 30 + 38   // gold family
                    : Math.random() < 0.5
                      ? Math.random() * 30 + 210 // blue family
                      : Math.random() * 20 + 340, // deep red
          alpha:  0,
          trail:  [],
          fragIdx: Math.random() < 0.18 ? Math.floor(Math.random() * FRAGMENTS.length) : -1,
          fragAlpha: 0,
          fragTimer: Math.random() * 180,
        };
      }

      for (let i = 0; i < PARTICLES; i++) particles.push(mkParticle(i));

      // Draw one frame
      function draw(ts) {
        if (!startTime) startTime = ts;
        const elapsed  = ts - startTime;
        const progress = Math.min(1, elapsed / KALEIDO_MS);

        // Fade canvas in quickly, then out in last 0.4s
        const fadeIn  = Math.min(1, elapsed / 400);
        const fadeOut = elapsed > KALEIDO_MS - 400
                          ? 1 - Math.min(1, (elapsed - (KALEIDO_MS - 400)) / 400)
                          : 1;
        kaleidoCanvas.style.opacity = (fadeIn * fadeOut).toFixed(3);

        // Rotation speed increases over the run, then snaps at end
        const spin = (elapsed / 18000) * Math.PI * 2 * (1 + progress * 1.6);

        ctx.clearRect(0, 0, W, H);

        // Dark radial background
        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.55);
        bg.addColorStop(0,   'rgba(12,18,36,0.92)');
        bg.addColorStop(0.7, 'rgba(5,8,16,0.96)');
        bg.addColorStop(1,   'rgba(3,5,10,0.99)');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // Draw each segment mirrored SEGMENTS times
        for (let seg = 0; seg < SEGMENTS; seg++) {
          const segAngle = (Math.PI * 2 / SEGMENTS) * seg + spin;

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(segAngle);
          // Mirror every other segment for true kaleidoscope symmetry
          if (seg % 2 === 1) ctx.scale(1, -1);

          particles.forEach((p) => {
            // Update particle
            p.angle  += p.speed * (1 + progress * 0.8);
            p.radius += p.radialV;
            p.life   += 0.007;
            p.alpha   = 0.15 + Math.abs(Math.sin(p.life * Math.PI)) * 0.75;

            // Bounce radius
            const maxR = Math.min(W, H) * 0.46;
            if (p.radius > maxR || p.radius < 4) p.radialV *= -1;

            // Tail
            const px = Math.cos(p.angle) * p.radius;
            const py = Math.sin(p.angle) * p.radius;
            p.trail.push({ x: px, y: py });
            if (p.trail.length > 7) p.trail.shift();

            // Draw tail
            if (p.trail.length > 1) {
              for (let t = 1; t < p.trail.length; t++) {
                const tt = t / p.trail.length;
                ctx.beginPath();
                ctx.moveTo(p.trail[t-1].x, p.trail[t-1].y);
                ctx.lineTo(p.trail[t].x,   p.trail[t].y);
                ctx.strokeStyle = `hsla(${p.hue},75%,65%,${(p.alpha * tt * 0.45).toFixed(3)})`;
                ctx.lineWidth   = p.size * tt * 0.7;
                ctx.stroke();
              }
            }

            // Draw dot
            ctx.beginPath();
            ctx.arc(px, py, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${p.hue},80%,70%,${p.alpha.toFixed(3)})`;
            ctx.fill();

            // Data fragment flicker
            if (p.fragIdx >= 0) {
              p.fragTimer--;
              if (p.fragTimer <= 0) {
                p.fragAlpha = 0.9;
                p.fragTimer = 80 + Math.random() * 120;
                p.fragIdx   = Math.floor(Math.random() * FRAGMENTS.length);
              }
              if (p.fragAlpha > 0) {
                ctx.font      = `700 ${Math.round(p.size * 4 + 7)}px monospace`;
                ctx.fillStyle = `hsla(${p.hue},90%,80%,${p.fragAlpha.toFixed(3)})`;
                ctx.fillText(FRAGMENTS[p.fragIdx], px + 4, py - 4);
                p.fragAlpha  -= 0.018;
              }
            }
          });

          ctx.restore();
        }

        // Gold geometric lines radiating from centre (kaleidoscope spokes)
        for (let s = 0; s < SEGMENTS; s++) {
          const a = (Math.PI * 2 / SEGMENTS) * s + spin;
          const spokeLen = Math.min(W, H) * 0.47;
          const grd = ctx.createLinearGradient(cx, cy,
            cx + Math.cos(a) * spokeLen,
            cy + Math.sin(a) * spokeLen);
          grd.addColorStop(0,   `rgba(212,175,55,${(0.28 * fadeIn).toFixed(3)})`);
          grd.addColorStop(0.6, `rgba(212,175,55,${(0.08 * fadeIn).toFixed(3)})`);
          grd.addColorStop(1,   'transparent');
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a) * spokeLen, cy + Math.sin(a) * spokeLen);
          ctx.strokeStyle = grd;
          ctx.lineWidth   = 0.8;
          ctx.stroke();
        }

        // Central core glow
        const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
        core.addColorStop(0,   `rgba(242,215,114,${(0.55 * fadeIn).toFixed(3)})`);
        core.addColorStop(0.5, `rgba(212,175,55,${(0.18 * fadeIn).toFixed(3)})`);
        core.addColorStop(1,   'transparent');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(cx, cy, 28, 0, Math.PI * 2);
        ctx.fill();

        // Still within thinking phase — keep looping
        if (elapsed < KALEIDO_MS) {
          rafId = requestAnimationFrame(draw);
          return;
        }

        // Phase complete — show "Signal acquired" flash
        cancelAnimationFrame(rafId);
        kaleidoCanvas.style.opacity = '0';
        if (kaleidoSignal && !signalShown) {
          signalShown = true;
          kaleidoSignal.classList.add('is-active');
          setTimeout(() => {
            kaleidoSignal.classList.remove('is-active');
            resolve(); // hand back to runSimulation
          }, SIGNAL_MS);
        } else {
          resolve();
        }
      }

      kaleidoCanvas.classList.add('is-active');
      rafId = requestAnimationFrame(draw);

      // Safety: always resolve after max time + signal
      setTimeout(resolve, KALEIDO_MS + SIGNAL_MS + 200);
    });
  }

  /* ── End kaleidoscope engine ─────────────────────────────── */

  let currentLens = lensButtons.find((btn) => btn.classList.contains('is-active'))?.dataset.lens || 'balanced';
  let initialPayload = {};
  let isRunning = false;

  try {
    initialPayload = seedEl ? JSON.parse(seedEl.textContent || '{}') : {};
  } catch (err) {
    initialPayload = {};
  }

  function sleep(ms) {
    if (prefersReducedMotion) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function lensLabel(lensKey) {
    return lensButtons.find((btn) => btn.dataset.lens === lensKey)?.querySelector('.sim-lens-tab__name')?.textContent || 'Balanced';
  }

  function setActiveLens(lens) {
    currentLens = lens;
    lensButtons.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.lens === lens));
    try {
      localStorage.setItem(STORAGE_LENS, lens);
    } catch (err) {
      // noop
    }
    updateMemoryText();
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '—';
  }

  function setSequenceState(state) {
    if (!page) return;
    page.classList.remove('is-entering', 'is-running', 'is-reveal', 'has-result');
    if (state === 'entering') page.classList.add('is-entering');
    if (state === 'running') page.classList.add('is-running');
    if (state === 'reveal') page.classList.add('is-running', 'is-reveal');
    if (state === 'done') page.classList.add('has-result');
  }

  function nudgeToStage() {
    if (!stagePanel) return;
    const top = stagePanel.getBoundingClientRect().top + window.scrollY - (window.innerWidth < 821 ? 18 : 30);
    window.scrollTo({ top, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }

  function animateValue(id, target, suffix = '') {
    const el = document.getElementById(id);
    if (!el) return;
    if (prefersReducedMotion) {
      el.textContent = `${target}${suffix}`;
      // Also update SVG arc instantly
      if (id === 'simConfidenceValue') updateConfidenceArc(target);
      return;
    }

    const start = performance.now();
    const duration = 760;
    const from = Number.parseInt(el.textContent, 10) || 0;

    function frame(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(from + (target - from) * eased);
      el.textContent = `${value}${suffix}`;
      // Keep SVG arc in sync
      if (id === 'simConfidenceValue') updateConfidenceArc(value);
      if (progress < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  function updateConfidenceArc(pct) {
    const arc = document.getElementById('simConfidenceArc');
    if (!arc) return;
    const circumference = 264;
    arc.style.strokeDashoffset = circumference - (circumference * Math.min(100, Math.max(0, pct))) / 100;
  }

  function renderNodes(nodes, winnerId) {
    const field = document.getElementById('simNodeField');
    if (!field) return;
    field.innerHTML = '';

    if (!nodes || !nodes.length) {
      field.innerHTML = '<div class="sim-empty">No runners available.</div>';
      return;
    }

    nodes.forEach((node, index) => {
      const article = document.createElement('article');
      const isWinner = String(node.id) === String(winnerId);
      article.className = `sim-node is-entering${isWinner ? ' is-selected is-highlight' : ''}`;
      article.dataset.runnerId = node.id;
      article.style.setProperty('--signal', node.signal || 40);
      article.style.setProperty('--node-primary', node.silk || '#1b3f92');
      article.style.setProperty('--node-secondary', node.silk2 || '#ffffff');
      article.style.setProperty('--index', index);
      article.style.setProperty('--pct', `${node.pct || 52}%`);
      article.innerHTML = `
        <span class="sim-node__number">${node.number}</span>
        <span class="sim-node__name">${node.name}</span>
        <span class="sim-node__odds">${node.odds}</span>
      `;
      field.appendChild(article);
      setTimeout(() => article.classList.remove('is-entering'), prefersReducedMotion ? 0 : 680 + (index * 45));
    });
  }

  function renderShortlist(shortlist) {
    const list = document.getElementById('simShortlist');
    if (!list) return;
    list.innerHTML = '';
    (shortlist || []).forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'sim-matrix__row';
      row.style.setProperty('--index', index);
      row.innerHTML = `
        <div class="sim-matrix__rank">${index + 1}</div>
        <div class="sim-matrix__name">${item.number}. ${item.name}</div>
        <div class="sim-matrix__bar"><span style="width:${item.pct}%"></span></div>
        <div class="sim-matrix__score">${item.score}</div>
        <div class="sim-matrix__odds">${item.odds || '—'}</div>
      `;
      list.appendChild(row);
    });
  }

  function renderExplainers(items) {
    const wrap = document.getElementById('simExplainGrid');
    if (!wrap) return;
    wrap.innerHTML = '';
    (items || []).forEach((item, index) => {
      const card = document.createElement('article');
      card.className = 'sim-explainer-card';
      card.dataset.band = item.band || '';
      card.dataset.key  = item.key  || '';
      card.style.setProperty('--index', index);
      const pct = Number.parseInt(item.pct, 10) || 0;
      card.innerHTML = `
        <div class="sim-explainer-card__header">
          <span class="sim-explainer-card__label">${item.label}</span>
          <span class="sim-explainer-card__band">${item.band || '—'}</span>
        </div>
        <div class="sim-explainer-card__value">${item.value}</div>
        <div class="sim-explainer-card__bar-wrap">
          <div class="sim-explainer-card__bar">
            <span style="width:${pct}%"></span>
          </div>
          <div class="sim-explainer-card__bar-meta">
            <span>⚖ Weight ${item.weight || '—'}</span>
            <span>＋${item.contribution ?? '—'} pts</span>
          </div>
        </div>
        <p>${item.text}</p>
      `;
      wrap.appendChild(card);
    });
  }

  function renderTelemetry(items) {
    const wrap = document.getElementById('simTelemetry');
    if (!wrap) return;
    wrap.innerHTML = '';
    (items || []).forEach((item) => {
      const card = document.createElement('article');
      card.className = 'sim-telem-card';
      card.innerHTML = `
        <span class="sim-telem-card__label">${item.label}</span>
        <strong class="sim-telem-card__value">${item.value}</strong>
        <p>${item.text}</p>
      `;
      wrap.appendChild(card);
    });
  }

  function updateMemoryText(payload) {
    let runs = 0;
    try {
      runs = Number.parseInt(localStorage.getItem(STORAGE_RUNS), 10) || 0;
    } catch (err) {
      runs = 0;
    }
    const preferred = lensLabel(currentLens);
    if (personaMemory) {
      personaMemory.textContent = `${preferred} lens restored · ${runs} chamber ${runs === 1 ? 'run' : 'runs'} on this device.`;
    }
    if (memoryTitle) {
      const profile = payload?.lens_memory?.profile || `${preferred} lens active · chamber memory is learning how you like to read the field.`;
      memoryTitle.textContent = `${profile} Device memory: ${runs} ${runs === 1 ? 'run' : 'runs'}.`;
    }
  }

  function incrementRunCount() {
    try {
      const nextValue = (Number.parseInt(localStorage.getItem(STORAGE_RUNS), 10) || 0) + 1;
      localStorage.setItem(STORAGE_RUNS, String(nextValue));
    } catch (err) {
      // noop
    }
  }

  function renderResult(payload) {
    if (!payload || !payload.winner) return;

    setText('simStageLabel', 'Outcome locked');
    setText('simStageStatus', 'Primary path confirmed. The chamber has elevated the strongest live signal.');
    setText('simLensBadge', payload.lens_label);
    setText('simFooterMode', payload.lens_label);
    setText('simFooterWinner', payload.winner.name);
    setText('simStageWinner', payload.winner.name);
    setText('simStageBand', payload.signal_band || 'Live signal');
    setText('simWinnerNumber', payload.winner.number);
    setText('simWinnerName', payload.winner.name);
    setText('simWinnerBand', payload.signal_band || 'Live signal');
    setText('simSummary', payload.summary);
    setText('simWinnerOdds', payload.winner.odds);
    setText('simWinnerTrainer', payload.winner.trainer);
    setText('simWinnerJockey', payload.winner.jockey);
    animateValue('simConfidenceValue', payload.confidence, '%');
    setText('simFooterConfidence', `${payload.confidence}%`);
    setText('simDangerName', payload.danger?.name);
    setText('simDangerMeta', `${payload.danger?.odds || '—'} · ${payload.danger?.trainer || '—'}`);
    setText('simValueName', payload.value?.name);
    setText('simValueMeta', `${payload.value?.odds || '—'} · ${payload.value?.trainer || '—'}`);
    setText('simLensName', payload.lens_label);
    setText('simLensText', payload.lens_subline);

    // Update guest CTA links with the simulation winner
    const guestPickBtn  = document.getElementById('simGuestPickBtn');
    const guestLoginBtn = document.getElementById('simGuestLoginBtn');
    const guestName     = document.getElementById('simGuestWinnerName');
    if (payload.winner && payload.winner.name) {
      const encodedName = encodeURIComponent(payload.winner.name);
      if (guestName)     guestName.textContent = payload.winner.name;
      if (guestPickBtn)  guestPickBtn.href  = `/pick/?pick=${encodedName}`;
      if (guestLoginBtn) guestLoginBtn.href = `/members/login/?pick=${encodedName}`;
    }

    renderNodes(payload.runner_nodes || [], payload.winner.id);
    renderShortlist(payload.shortlist || []);
    renderExplainers(payload.explainers || []);
    renderTelemetry(payload.telemetry || []);
    updateMemoryText(payload);
  }

  function showOverlay(stepTitle, stepText, progress, raceLabel) {
    if (!overlay) return;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    overlayTitle.textContent = stepTitle;
    overlayText.textContent = stepText;
    overlayBar.style.width = `${progress}%`;
    if (overlayLens) overlayLens.textContent = lensLabel(currentLens);
    if (overlayRace && raceLabel) overlayRace.textContent = raceLabel;
  }

  function hideOverlay() {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.style.overflow = '';
  }

  async function runSimulation(evt) {
    if (evt) evt.preventDefault();
    if (isRunning) return;
    isRunning = true;

    const raceLabel = document.querySelector('.sim-race-card__meta')?.textContent || 'Featured race';
    nudgeToStage();
    setSequenceState('entering');
    setText('simStageLabel', 'Entering chamber');
    setText('simStageStatus', 'The environment is folding away as the chamber prepares the featured race.');
    setText('simFooterWinner', 'Booting');

    // Show overlay — hide content, kaleidoscope phase first
    if (overlay) {
      overlay.hidden = false;
      document.body.style.overflow = 'hidden';
      if (overlayContent) overlayContent.classList.remove('is-active');
      if (overlayLens)  overlayLens.textContent  = lensLabel(currentLens);
      if (overlayRace && raceLabel) overlayRace.textContent = raceLabel;
    }

    // Fire API fetch AND kaleidoscope in parallel
    const payloadPromise = fetch(`/simulation/api/run/?lens=${encodeURIComponent(currentLens)}`, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    }).then((response) => {
      if (!response.ok) throw new Error('Simulation request failed');
      return response.json();
    });

    const kaleidoPromise = runKaleidoscope();

    try {
      // Wait for BOTH — API result held until kaleidoscope completes
      const [payload] = await Promise.all([payloadPromise, kaleidoPromise]);

      // Kaleidoscope done — transition to normal overlay content
      if (kaleidoCanvas) kaleidoCanvas.classList.remove('is-active');
      setSequenceState('running');
      if (overlayContent) overlayContent.classList.add('is-active');
      showOverlay('Locking the signal', 'The dominant live path is moving into the final frame.', 85, raceLabel);
      setText('simStageLabel', 'Collapsing outcomes');
      setText('simStageStatus', 'Noise is dropping away as the dominant paths separate from the field.');

      await sleep(320);
      setSequenceState('reveal');
      showOverlay('Signal locked', 'The chamber has elevated the strongest runner into the final frame.', 100, raceLabel);
      setText('simStageLabel', 'Signal reveal');
      setText('simStageStatus', 'The chamber is elevating the dominant runner into the final frame.');
      await sleep(260);
      renderResult(payload);
      initialPayload = payload;
      incrementRunCount();
      updateMemoryText(payload);
      await sleep(360);
      setSequenceState('done');

    } catch (error) {
      if (kaleidoCanvas) kaleidoCanvas.classList.remove('is-active');
      if (kaleidoSignal) kaleidoSignal.classList.remove('is-active');
      if (overlayContent) overlayContent.classList.add('is-active');
      setSequenceState('done');
      setText('simStageLabel', 'Standby');
      setText('simStageStatus', 'The chamber could not complete the run. Please try again.');
      setText('simSummary', 'The chamber could not complete the run. Please try again.');
    } finally {
      isRunning = false;
      setTimeout(hideOverlay, prefersReducedMotion ? 0 : 220);
    }
  }

  lensButtons.forEach((btn) => {
    btn.addEventListener('click', () => setActiveLens(btn.dataset.lens));
  });

  if (launchBtn) launchBtn.addEventListener('click', runSimulation);

  const mobileLaunchBtn = document.getElementById('launchSimulationBtnMobile');
  if (mobileLaunchBtn) mobileLaunchBtn.addEventListener('click', runSimulation);

  // Reveal sticky bar on mobile (aria-hidden removed when visible)
  const stickyBar = document.getElementById('simStickyLaunch');
  if (stickyBar && window.matchMedia('(max-width: 820px)').matches) {
    stickyBar.removeAttribute('aria-hidden');
  }
  if (rerunBtn) rerunBtn.addEventListener('click', runSimulation);

  try {
    const storedLens = localStorage.getItem(STORAGE_LENS);
    if (storedLens && lensButtons.some((btn) => btn.dataset.lens === storedLens)) {
      setActiveLens(storedLens);
    } else {
      updateMemoryText(initialPayload);
    }
  } catch (err) {
    updateMemoryText(initialPayload);
  }

  if (initialPayload && initialPayload.winner) {
    renderResult(initialPayload);
    setSequenceState('done');
    setText('simStageStatus', 'A chamber result is already loaded. You can rerun the simulation at any time.');
  }
})();
