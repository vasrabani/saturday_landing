/* The Paddock — chat channel mockup behaviour (sandbox only).
 *
 * Everything here is faked: there is no server. In the real build the
 * word-list check, timestamps, Like counts and tip prices all come from
 * Django; the client never decides them.
 */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const body = document.body;
  const shell = $('.pd-shell');
  const stream = $('#pd-stream');
  const list = $('#pd-msgs');
  const input = $('#pd-input');
  const form = $('[data-form="compose"]');
  const sendBtn = $('.pd-compose__send');
  const typing = $('.pd-typing');
  const newPill = $('.pd-newpill');
  const toastEl = $('.pd-toast');
  const tipSheet = $('#pd-tipsheet');
  const reportSheet = $('#pd-report');

  const SILK = id => `static/meeting/img/silks/${id}.svg`;
  const RUNNERS = [
    { no: 1, name: 'Copper Lantern', j: 'R. Quinlan', t: 'A. Marsh', silk: '171561af107ab17b', price: '9/4', tips: 71 },
    { no: 2, name: 'Midnight Ledger', j: 'C. Doyle', t: 'J. Fenwick', silk: '390fb00648254f90', price: '7/2', tips: 41 },
    { no: 3, name: 'Kalaroo Bay', j: 'S. Mercer', t: 'P. Holloway', silk: '57b3dbef731ed01a', price: '9/2', tips: 33 },
    { no: 4, name: 'Saint Brennan', j: 'D. Hale', t: 'E. Laidlaw', silk: '773bd91d18509529', price: '6/1', tips: 18 },
    { no: 5, name: 'Harbour Lights', j: 'M. Kerr', t: 'R. Penhale', silk: 'a0d565396f5de315', price: '8/1', tips: 12 },
    { no: 6, name: 'Velvet Ridge', j: 'L. Byrne', t: 'S. Ashworth', silk: 'be81187c3d789175', price: '12/1', tips: 7 },
    { no: 7, name: 'Old Brass', j: 'J. Tully', t: 'H. Garside', silk: 'e19052751ea94d2b', price: '16/1', tips: 4 },
    { no: 8, name: 'Wendover Lad', j: 'N. Prior', t: 'G. Vale', silk: '06fe3c05a7591263', price: 'NR', tips: 0, nr: true },
  ];
  const ME = { name: 'Sam R', initials: 'SR', colour: '#2D5BBF' };

  // Stand-in for the server's word list. Normalising leetspeak and
  // separators is the minimum the real check needs against evasion.
  const WORD_LIST = ['idiot', 'moron', 'scum'];
  const normalise = s => s.toLowerCase()
    .replace(/[0]/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e')
    .replace(/[4@]/g, 'a').replace(/[5$]/g, 's')
    .replace(/[^a-z\s]/g, '');
  const isHeld = text => {
    const flat = normalise(text);
    const squashed = flat.replace(/\s+/g, '');
    return WORD_LIST.some(w => new RegExp(`\\b${w}\\b`).test(flat) || squashed.includes(w));
  };

  const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ── mock clock: the page opens at 13:52:42, off at 14:25:00 ───────── */
  const OPENED = Date.now();
  const START = { h: 13, m: 52, s: 42 };
  const OFF_IN = 32 * 60 + 18;
  const nowParts = () => {
    const t = START.h * 3600 + START.m * 60 + START.s + Math.floor((Date.now() - OPENED) / 1000);
    return [Math.floor(t / 3600) % 24, Math.floor(t / 60) % 60, t % 60];
  };
  const pad = n => String(n).padStart(2, '0');
  const hhmm = () => { const [h, m] = nowParts(); return `${pad(h)}:${pad(m)}`; };
  const hhmmss = () => { const [h, m, s] = nowParts(); return `${pad(h)}:${pad(m)}:${pad(s)}`; };

  const clock = $('[data-countdown]');
  let offForced = false;
  function tick() {
    if (body.dataset.race === 'off') { clock.textContent = '14:25'; return; }
    const left = OFF_IN - Math.floor((Date.now() - OPENED) / 1000);
    if (left <= 0 && !offForced) { setRace('off'); return; }
    clock.textContent = `${pad(Math.floor(left / 60))}:${pad(left % 60)}`;
  }
  setInterval(tick, 1000);

  /* ── toast ─────────────────────────────────────────────────────────── */
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2800);
  }

  /* ── scroll helpers ────────────────────────────────────────────────── */
  const nearBottom = () => stream.scrollHeight - stream.scrollTop - stream.clientHeight < 120;
  const toBottom = (smooth = true) => stream.scrollTo({ top: stream.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  let unseen = 0;
  function noteIncoming(wasNear) {
    if (wasNear) { toBottom(); return; }
    unseen += 1;
    newPill.hidden = false;
    $('span', newPill).textContent = `${unseen} new message${unseen > 1 ? 's' : ''}`;
  }
  stream.addEventListener('scroll', () => {
    if (nearBottom()) { unseen = 0; newPill.hidden = true; }
  }, { passive: true });

  /* ── runners panel + tip sheet list ────────────────────────────────── */
  let myTip = null;
  function renderRunners() {
    const total = RUNNERS.reduce((a, r) => a + r.tips, 0);
    $('[data-tipcount]').textContent = total;
    $('[data-runners]').innerHTML = RUNNERS.map(r => {
      const pct = total ? Math.round((r.tips / total) * 100) : 0;
      const cls = ['pd-runner', r.nr ? 'is-nr' : '', myTip && myTip.no === r.no ? 'is-mine' : ''].join(' ').trim();
      return `<li class="${cls}">
        <span class="pd-runner__no">${r.no}</span>
        <img class="pd-runner__silk" src="${SILK(r.silk)}" alt="">
        <span><a class="pd-runner__name" href="#">${esc(r.name)}</a><span class="pd-runner__jt">${esc(r.j)} · ${esc(r.t)}</span></span>
        <span class="pd-runner__price">${r.nr ? 'Non-runner' : r.price}</span>
        ${r.nr ? '' : `<span class="pd-runner__bar" aria-label="${pct}% of Paddock tips"><span class="pd-runner__track"><span class="pd-runner__fill" style="width:${pct}%"></span></span><span class="pd-runner__pct">${pct}%</span></span>`}
      </li>`;
    }).join('');
    $('.pd-tab__n').textContent = RUNNERS.filter(r => !r.nr).length;
  }
  renderRunners();

  function renderPickList() {
    $('[data-pick-list]').innerHTML = RUNNERS.map(r => `
      <div class="pd-pick__opt">
        <input type="radio" name="runner" id="pick-${r.no}" value="${r.no}" ${r.nr ? 'disabled' : ''}>
        <label for="pick-${r.no}">
          <img src="${SILK(r.silk)}" alt="">
          <span><b>${r.no}. ${esc(r.name)}</b><small>${r.nr ? 'Non-runner' : `${esc(r.j)} · ${esc(r.t)}`}</small></span>
          <span>${r.nr ? '' : r.price}</span>
        </label>
      </div>`).join('');
  }

  /* ── message builders ──────────────────────────────────────────────── */
  function msgHTML({ id, name, initials, colour, text, mine, rank, quote, likes = 0, time = hhmm() }) {
    const tools = mine
      ? `<button type="button" data-act="reply" aria-label="Reply to your message"><svg><use href="#i-reply"/></svg></button>`
      : `<button type="button" data-act="reply" aria-label="Reply to ${esc(name)}"><svg><use href="#i-reply"/></svg></button><button type="button" data-act="report" aria-label="Report this message"><svg><use href="#i-report"/></svg></button>`;
    return `<li class="pd-msg${mine ? ' pd-msg--mine' : ''} is-new" data-id="${id}">
      <span class="pd-av" style="--av:${colour}" aria-hidden="true">${initials}</span>
      <div class="pd-msg__main">
        <p class="pd-msg__meta"><b class="pd-msg__name">${esc(name)}</b>${mine ? '<span class="pd-you">You</span>' : ''}${rank ? `<span class="pd-rank">${rank}</span>` : ''}<time>${time}</time></p>
        ${quote ? `<a class="pd-quote" href="#"><b>${esc(quote.name)}</b>${esc(quote.text)}</a>` : ''}
        ${text}
        <div class="pd-msg__foot">
          <button class="pd-like" type="button" aria-pressed="false" data-likes="${likes}"${mine ? ' disabled title="You can\'t like your own message"' : ''}><svg><use href="#i-rosette"/></svg><span class="pd-like__n">${likes}</span></button>
        </div>
      </div>
      <div class="pd-msg__tools">${tools}</div>
    </li>`;
  }

  function tipCardHTML(r, bet, why, time) {
    return `<article class="pd-tipcard">
      <img class="pd-tipcard__silk" src="${SILK(r.silk)}" alt="">
      <div class="pd-tipcard__body"><p class="pd-tipcard__horse">${esc(r.name)}</p><p class="pd-tipcard__sub">No. ${r.no} · ${esc(r.j)} · ${esc(r.t)}</p></div>
      <div class="pd-tipcard__bet"><span class="pd-tipcard__type">${bet}</span><span class="pd-tipcard__price">${r.price}</span><span class="pd-tipcard__at">Price at ${time}</span></div>
      ${why ? `<p class="pd-tipcard__why">“${esc(why)}”</p>` : ''}
    </article>`;
  }

  function append(html) {
    const wasNear = nearBottom();
    list.insertAdjacentHTML('beforeend', html);
    return { el: list.lastElementChild, wasNear };
  }

  /* ── compose ───────────────────────────────────────────────────────── */
  let replyTo = null;
  const countEl = $('[data-count]');
  function syncInput() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
    const len = input.value.length;
    sendBtn.disabled = !input.value.trim();
    countEl.textContent = len > 800 ? `${1000 - len} left` : '';
    countEl.classList.toggle('is-near', len > 950);
  }
  input.addEventListener('input', syncInput);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
    if (e.key === 'Escape' && replyTo) clearReply();
  });

  let seq = 100;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const id = `m${++seq}`;
    const paras = text.split(/\n+/).map(p => `<p class="pd-msg__text">${esc(p)}</p>`).join('');
    const { el } = append(msgHTML({ id, name: ME.name, initials: ME.initials, colour: ME.colour, text: paras, mine: true, quote: replyTo }));
    el.classList.add('is-sending');
    $('.pd-msg__meta', el).insertAdjacentHTML('beforeend', '<span class="pd-msg__status" data-status><svg><use href="#i-clock"/></svg>Sending</span>');
    input.value = '';
    clearReply();
    syncInput();
    toBottom();

    // The server checks, commits, then broadcasts. The author sees
    // "Sending" until it answers; a held message is never broadcast.
    setTimeout(() => {
      el.classList.remove('is-sending');
      $('[data-status]', el).remove();
      if (isHeld(text)) {
        el.classList.add('pd-msg--held');
        $('.pd-msg__foot', el).outerHTML = `<p class="pd-held"><svg><use href="#i-shield"/></svg><span><b>Only you can see this.</b> It's waiting for a moderator to check it against the house rules. You'll get a notification either way.</span></p>`;
        toBottom();
      }
    }, 650);
  });

  function clearReply() {
    replyTo = null;
    $('.pd-replying').hidden = true;
  }

  /* ── follow, rail, tabs, mock ──────────────────────────────────────── */
  function setRail(open) {
    body.classList.toggle('is-rail-open', open);
    $('.pd-top__menu').setAttribute('aria-expanded', String(open));
    if (open) $('.pd-search input').focus({ preventScroll: true });
  }

  function measureRaceTop() {
    const top = stream.getBoundingClientRect().top - shell.getBoundingClientRect().top;
    shell.style.setProperty('--pd-race-top', `${top}px`);
  }
  function setView(view) {
    shell.dataset.view = view;
    $$('.pd-tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === view)));
    measureRaceTop();
  }
  window.addEventListener('resize', measureRaceTop);

  function setAuth(v) {
    body.dataset.auth = v;
    syncMock();
  }
  function setRace(v) {
    body.dataset.race = v;
    offForced = true;
    $('.pd-compose__tip').disabled = v === 'off';
    if (v === 'open') { offForced = false; tick(); } else clock.textContent = '14:25';
    syncMock();
    measureRaceTop();
  }
  function syncMock() {
    $$('[data-mock]').forEach(b => b.setAttribute('aria-pressed', String(body.dataset[b.dataset.mock] === b.dataset.val)));
  }

  /* ── tips ──────────────────────────────────────────────────────────── */
  function openTip() {
    if (body.dataset.auth !== 'in') { toast('Sign in to tip this race.'); return; }
    if (body.dataset.race === 'off') { toast('Tips locked at the off.'); return; }
    if (myTip) { toast("You've tipped this race. Tips can't be changed."); return; }
    renderPickList();
    $('[data-tip-submit]').disabled = true;
    $('[data-tip-submit]').textContent = 'Choose a runner';
    tipSheet.showModal();
  }
  tipSheet.addEventListener('change', e => {
    if (e.target.name !== 'runner' && e.target.name !== 'bet') return;
    const picked = $('input[name="runner"]:checked', tipSheet);
    if (!picked) return;
    const r = RUNNERS.find(x => x.no === Number(picked.value));
    const btn = $('[data-tip-submit]');
    btn.disabled = false;
    btn.textContent = `Post tip · ${r.name} ${r.price}`;
  });
  tipSheet.addEventListener('close', () => {
    if (tipSheet.returnValue !== 'post') return;
    const picked = $('input[name="runner"]:checked', tipSheet);
    if (!picked) return;
    const r = RUNNERS.find(x => x.no === Number(picked.value));
    const bet = $('input[name="bet"]:checked', tipSheet).value;
    const why = $('textarea[name="why"]', tipSheet).value.trim();
    const time = hhmm();
    myTip = { no: r.no };
    r.tips += 1;
    renderRunners();

    const { el } = append(`<li class="pd-msg pd-msg--mine pd-msg--tip is-new" data-id="m${++seq}">
      <span class="pd-av" style="--av:${ME.colour}" aria-hidden="true">${ME.initials}</span>
      <div class="pd-msg__main">
        <p class="pd-msg__meta"><b class="pd-msg__name">${ME.name}</b><span class="pd-you">You</span><span class="pd-msg__did">posted a tip</span><time>${time}</time></p>
        ${tipCardHTML(r, bet, why, time)}
        <div class="pd-msg__foot"><button class="pd-like" type="button" aria-pressed="false" data-likes="0" disabled title="You can't like your own message"><svg><use href="#i-rosette"/></svg><span class="pd-like__n">0</span></button></div>
      </div>
    </li>`);
    toBottom();

    $('[data-mytip="none"]').hidden = true;
    const done = $('[data-mytip="done"]');
    done.hidden = false;
    $('[data-mytip-at]').textContent = hhmmss();
    $('[data-mytip-silk]').src = SILK(r.silk);
    $('[data-mytip-horse]').textContent = r.name;
    $('[data-mytip-bet]').textContent = `${bet} · ${r.price} at ${time}`;
    $('.pd-compose__tip').disabled = true;
    $('textarea[name="why"]', tipSheet).value = '';
    toast(`Tip posted: ${r.name}, ${bet.toLowerCase()} at ${r.price}.`);
    if (shell.dataset.view === 'runners') setView('chat');
    void el;
  });

  /* ── one click handler ─────────────────────────────────────────────── */
  let reportTarget = null;
  document.addEventListener('click', e => {
    const like = e.target.closest('.pd-like');
    if (like) {
      if (like.disabled) return;
      if (body.dataset.auth !== 'in') { toast('Sign in to give Likes.'); return; }
      const on = like.getAttribute('aria-pressed') !== 'true';
      const n = Number(like.dataset.likes) + (on ? 1 : -1);
      like.dataset.likes = n;
      like.setAttribute('aria-pressed', String(on));
      $('.pd-like__n', like).textContent = n;
      if (on) { like.classList.remove('is-pop'); void like.offsetWidth; like.classList.add('is-pop'); }
      return;
    }

    const mock = e.target.closest('[data-mock]');
    if (mock) {
      if (mock.dataset.mock === 'auth') setAuth(mock.dataset.val); else setRace(mock.dataset.val);
      return;
    }

    const tab = e.target.closest('.pd-tab');
    if (tab) { setView(tab.dataset.view); return; }

    const act = e.target.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'rail': setRail(!body.classList.contains('is-rail-open')); break;
      case 'tip': openTip(); break;
      case 'jump': toBottom(); break;
      case 'unreply': clearReply(); input.focus(); break;
      case 'follow': {
        const on = act.getAttribute('aria-pressed') !== 'true';
        act.setAttribute('aria-pressed', String(on));
        $('span', act).textContent = on ? 'Following' : 'Follow';
        toast(on ? "Following. We'll tell you about replies, mentions and the result." : 'Unfollowed this race.');
        break;
      }
      case 'reply': {
        const msg = act.closest('.pd-msg');
        const name = $('.pd-msg__name', msg).textContent;
        const text = ($('.pd-msg__text', msg) || $('.pd-tipcard__horse', msg)).textContent.trim();
        replyTo = { name, text: text.length > 70 ? `${text.slice(0, 70)}…` : text };
        $('[data-reply-name]').textContent = name;
        $('.pd-replying').hidden = false;
        input.focus();
        break;
      }
      case 'report':
        if (body.dataset.auth !== 'in') { toast('Sign in to report a message.'); return; }
        reportTarget = act.closest('.pd-msg');
        reportSheet.showModal();
        break;
      case 'mockfold': {
        const box = act.closest('.pd-mock');
        box.classList.toggle('is-folded');
        act.setAttribute('aria-expanded', String(!box.classList.contains('is-folded')));
        break;
      }
      default:
    }
  });
  reportSheet.addEventListener('close', () => {
    if (reportSheet.returnValue === 'send' && reportTarget) {
      toast('Thanks. A moderator will look at it.');
      $('[data-act="report"]', reportTarget)?.setAttribute('disabled', '');
    }
    reportTarget = null;
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && body.classList.contains('is-rail-open')) setRail(false);
  });

  /* ── fake live feed ────────────────────────────────────────────────── */
  const PEOPLE = {
    dev: { name: 'Dev Kapoor', initials: 'DK', colour: '#8A3FB0' },
    jo: { name: 'Jo Tring', initials: 'JT', colour: '#B8860B', rank: 'Top 20 · 34% of 94' },
    marcus: { name: 'Marcus Ola', initials: 'MO', colour: '#C2552B' },
    alfie: { name: 'Alfie B', initials: 'AB', colour: '#5B6B2E', rank: 'Top 20 · 28% of 67' },
  };
  const bumpLike = id => {
    const like = $(`[data-id="${id}"] .pd-like`);
    if (!like || like.disabled) return;
    const n = Number(like.dataset.likes) + 1;
    like.dataset.likes = n;
    const num = $('.pd-like__n', like);
    num.textContent = n;
    like.classList.remove('is-bump'); void like.offsetWidth; like.classList.add('is-bump');
  };
  const SCRIPT = [
    { who: 'dev', text: 'Market moving: <a class="pd-entity" href="#"><img src="static/meeting/img/silks/57b3dbef731ed01a.svg" alt="">Kalaroo Bay</a> into 4/1 from 9/2.', then: () => { RUNNERS[2].price = '4/1'; renderRunners(); } },
    { like: 'm3' },
    { who: 'jo', tip: { no: 1, bet: 'Win', why: 'Best form in the race and the only one proven at the trip. Ground is a non-issue for him.' } },
    { like: 'm1' },
    { who: 'marcus', text: 'Lantern walking round the paddock like he owns the place. Coat looks great.' },
    { who: 'alfie', text: 'Anyone else think Harbour Lights is overpriced at 8s? Ran a big race in a better contest at Cheltenham.' },
    { like: 'm7' },
  ];
  let step = 0;
  function nextBeat() {
    if (step >= SCRIPT.length) return;
    const beat = SCRIPT[step++];
    if (beat.like) { bumpLike(beat.like); setTimeout(nextBeat, 4000); return; }
    const p = PEOPLE[beat.who];
    $('[data-typing]').textContent = `${p.name} is typing`;
    typing.classList.add('is-on');
    setTimeout(() => {
      typing.classList.remove('is-on');
      let html;
      if (beat.tip) {
        const r = RUNNERS.find(x => x.no === beat.tip.no);
        r.tips += 1; renderRunners();
        const t = hhmm();
        html = msgHTML({ id: `m${++seq}`, ...p, text: tipCardHTML(r, beat.tip.bet, beat.tip.why, t), time: t })
          .replace('class="pd-msg ', 'class="pd-msg pd-msg--tip ')
          .replace('<time>', '<span class="pd-msg__did">posted a tip</span><time>');
      } else {
        html = msgHTML({ id: `m${++seq}`, ...p, text: `<p class="pd-msg__text">${beat.text}</p>` });
      }
      const { wasNear } = append(html);
      noteIncoming(wasNear);
      beat.then?.();
      setTimeout(nextBeat, 7000 + Math.random() * 5000);
    }, 2400);
  }

  /* ── start ─────────────────────────────────────────────────────────── */
  syncInput();
  syncMock();
  measureRaceTop();
  requestAnimationFrame(() => toBottom(false));
  setTimeout(nextBeat, 5000);
})();
