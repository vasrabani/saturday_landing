'use strict';

window.addEventListener('DOMContentLoaded', function () {

  var stage      = document.getElementById('pickStage');
  var body       = document.getElementById('pickBody');
  var curtain    = document.getElementById('heroCurtain');
  var identity   = document.getElementById('heroIdentity');
  var arrow      = document.getElementById('heroArrow');
  var finaleCard = document.getElementById('heroFinaleCard');
  var finaleCta  = document.getElementById('heroFinaleCta');
  var skipBtn    = document.getElementById('heroSkipBtn');
  var pCanvas    = document.getElementById('heroParticleCanvas');
  var commentary = document.querySelector('.hero-commentary');
  var lines      = document.querySelectorAll('.hero-commentary__line');

  if (!stage || !body) return;

  // ── A11y: cinematic containers start hidden/busy for SR. Flip them
  // to announceable state at the right moments. `exposeIdentity` runs
  // early (SR hears the race name quickly); `finishCinematicA11y` runs
  // when the cinematic completes or is skipped. Both are idempotent.
  function exposeIdentity() {
    if (identity) identity.removeAttribute('aria-hidden');
  }
  function finishCinematicA11y() {
    exposeIdentity();
    if (commentary) commentary.setAttribute('aria-busy', 'false');
  }

  var particles = null;

  function revealGrid(instant) {
    if (particles) particles.stop();
    if (skipBtn) {
      skipBtn.classList.remove('is-visible', 'is-advertising');
      skipBtn.setAttribute('aria-hidden', 'true');
      skipBtn.tabIndex = -1;
    }
    finishCinematicA11y();
    if (instant) {
      stage.style.minHeight = '0';
      stage.classList.add('pick-stage--done');
      body.classList.add('pick-body--visible', 'pick-body--instant');
    } else {
      gsap.to(stage, {
        minHeight: 0, duration: 0.55, ease: 'power2.inOut',
        onComplete: function () {
          stage.classList.add('pick-stage--done');
          stage.style.minHeight = '';
        }
      });
      body.classList.add('pick-body--visible');
    }
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealGrid(true);
    return;
  }

  if (pCanvas && window.PickHeroParticles) {
    particles = new PickHeroParticles(pCanvas);
    particles.start();
    window.addEventListener('resize', function () { particles.resize(); });
  }

  if (identity) identity.style.opacity = '1';

  var tl = gsap.timeline({
    defaults: { ease: 'power3.out' },
    onComplete: function () { revealGrid(false); }
  });

  // Reveal the skip button shortly after the cinematic starts. Add an
  // "advertising" pulse a few seconds later so impatient users notice
  // it, but only if they haven't already hovered/focused it.
  if (skipBtn) {
    setTimeout(function () { skipBtn.classList.add('is-visible'); }, 400);
    setTimeout(function () {
      if (!stage.classList.contains('pick-stage--done')) {
        skipBtn.classList.add('is-advertising');
      }
    }, 3200);
    skipBtn.addEventListener('pointerenter', function () {
      skipBtn.classList.remove('is-advertising');
    }, { once: true });
  }

  if (curtain) {
    tl.fromTo(curtain,
      { scaleX: 0, transformOrigin: 'left center' },
      { scaleX: 1, duration: 0.9, ease: 'power2.inOut' }, 0.2);
    tl.to(curtain, { opacity: 0, duration: 0.4 }, 1.0);
  }

  if (identity) {
    var eyebrow = identity.querySelector('.hero-identity__eyebrow');
    var title   = identity.querySelector('.hero-identity__title');
    var meta    = identity.querySelector('.hero-identity__meta');
    // Flip aria-hidden at the same beat the eyebrow starts fading in —
    // SR users hear the race name early, in sync with visual reveal.
    tl.call(exposeIdentity, [], 0.6);
    if (eyebrow) {
      tl.fromTo(eyebrow, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.5 }, 0.6);
    }
    if (title) {
      var titleWords = title.querySelectorAll('.hero-word');
      if (titleWords.length) {
        tl.fromTo(titleWords,
          { opacity: 0, y: 28 },
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.06, ease: 'back.out(1.4)' }, 0.85);
      }
    }
    if (meta) {
      tl.fromTo(meta, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 1.3);
    }
  }

  var TIMES     = [1.8, 3.0, 4.4, 6.0];
  var HOLDS     = [1.0, 1.2, 1.2, 1.4];
  var SURGE_IDX = 3;

  lines.forEach(function (line, i) {
    var start = TIMES[i];
    var hold  = HOLDS[i] || 1.0;
    var words = line.querySelectorAll('.hero-word');
    if (!words.length) return;

    tl.fromTo(words,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.055, ease: 'power2.out' }, start);

    if (i === SURGE_IDX) {
      tl.fromTo(line, { scale: 0.88 }, { scale: 1, duration: 0.5, ease: 'back.out(1.8)' }, start);
      if (particles) {
        tl.call(function () { particles.surge(2.8, 1400); }, [], start);
      }
    }

    if (i < lines.length - 1) {
      var fadeAt = start + hold + (words.length * 0.055) + 0.3;
      tl.to(words, { opacity: 0, y: -8, duration: 0.35, stagger: 0.03 }, fadeAt);
    }
  });

  if (arrow) {
    tl.fromTo(arrow,
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(2)' }, 7.6);
    tl.call(function () {
      gsap.to(arrow, { y: 10, duration: 0.6, ease: 'sine.inOut', repeat: -1, yoyo: true });
    }, [], 8.0);
  }

  tl.call(function () {
    var lastWords = lines[SURGE_IDX] ? lines[SURGE_IDX].querySelectorAll('.hero-word') : null;
    if (lastWords) gsap.to(lastWords, { opacity: 0.12, duration: 0.6 });
    if (arrow)     gsap.to(arrow,    { opacity: 0.2,  duration: 0.4 });
  }, [], 8.4);

  if (finaleCard) {
    tl.fromTo(finaleCard,
      { opacity: 0, y: 60, scale: 0.95 },
      { opacity: 1, y: 0,  scale: 1, duration: 0.7, ease: 'back.out(1.4)' }, 8.5);
    tl.to(finaleCard, {
      boxShadow: '0 0 48px rgba(212,175,55,0.45), 0 0 12px rgba(212,175,55,0.25)',
      duration: 0.5, yoyo: true, repeat: 1
    }, 9.0);
  }

  if (finaleCta) {
    tl.fromTo(finaleCta,
      { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45 }, 9.0);
    tl.call(function () {
      gsap.to(finaleCta, { scale: 1.03, duration: 0.5, ease: 'sine.inOut', repeat: -1, yoyo: true });
    }, [], 9.3);
  }

  function skip() {
    tl.kill();
    gsap.killTweensOf([arrow, finaleCta]);
    revealGrid(true);
  }

  // Explicit skip button — the primary, discoverable way to skip.
  if (skipBtn) {
    skipBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      skip();
    });
  }

  // Stage-wide fallback: clicking the cinematic (anywhere) or pressing
  // Enter/Space/Escape also skips — matches the original behaviour.
  stage.addEventListener('click', skip, { once: true });
  stage.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') skip();
  });

  window.PickHeroExperience = { skip: skip };

});
