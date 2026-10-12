/* meeting_slip.js — the bet slip as a betting ticket, and its limit of
 * six picks.
 *
 * The page's own bet_slip.js does all the work — adding, replacing and
 * removing picks, the stake, the returns, the sheet on a phone — and
 * writes each pick as a course, a time, a horse and a price. This adds
 * what makes it a racing ticket, from data already on the page:
 *
 *   1. On each pick: the jockey's silks, the horse's number cloth and
 *      the jockey, copied from the runner's row (matched on course,
 *      time and horse).
 *   2. Under the slip's head, the card: the slip's six places on a rail
 *      to the winning post. Each pick takes the next place and shows
 *      its silks; the rest are open. A place with a pick jumps to its
 *      race, or opens its meeting when the pick was made at another.
 *   3. In the bar the slip folds to on a phone: the picks' silks, and
 *      the count out of six.
 *   4. The sheet closes on a tap outside it, or on Escape.
 *   5. Six picks at most: one horse in each of six races, from any of
 *      the day's meetings (the same limit the server applies when a
 *      member submits). bet_slip.js takes any number, so the limit is
 *      kept here: a press that would put a seventh race in the slip is
 *      heard first (on the way down) and stopped before the page's
 *      script hears it, with a message saying why. Changing the horse
 *      in a race already picked, and taking a pick out, go through as
 *      ever. Once the slip is full, Pick in every race not yet picked
 *      stands down: paler, with a tooltip, but still pressable, since
 *      a disabled button could not say why. A slip that already holds
 *      more than six (filled elsewhere) is not cut down: the card says
 *      how many are over, and no new race is taken until they are out.
 *
 * bet_slip.js rebuilds the list of picks on every change, so the
 * ticket is redone whenever the list changes. The slip is the day's,
 * shared across its meetings: a pick made at another meeting has no
 * row here to copy from, so what is copied for each pick is kept in
 * localStorage (beside bet_slip.js's own record, for as long as the
 * pick is in the slip), and a pick from elsewhere is dressed from that.
 * One never seen being made gets a jockey's cap in place of silks.
 *
 * Everything added is an element with an mfr- class ("meeting full,
 * revamp") or a data-mfr-* attribute, read by meeting.css and by nothing
 * else. bet_slip.js's own elements, classes and storage are untouched.
 */
(function () {
  'use strict';

  /* A slip holds six picks: Pick Six. The template can say otherwise
     with data-pick-limit on .mf-wrap, should the day's limit
     (daily_pick_limit on the server) ever change; every word below that
     names the number is derived from it. */
  const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const word = (n) => WORDS[n] || String(n);
  const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const picksOf = (n) => word(n) + (n === 1 ? ' pick' : ' picks');   /* "six picks" */
  const racesOf = (n) => word(n) + (n === 1 ? ' race' : ' races');   /* "six races" */
  function pickLimit() {
    const wrap = document.querySelector('.mf-wrap');
    const n = parseInt((wrap && wrap.dataset.pickLimit) || '', 10);
    return n > 0 ? n : 6;
  }

  const shown = (node) => !!node && node.offsetParent !== null;

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /* A line icon, drawn by the stylesheet from static/meeting/img/icons/. */
  function icon(name) {
    const node = make('span', 'mfr-i mfr-i--' + name);
    node.setAttribute('aria-hidden', 'true');
    return node;
  }

  /* ── 4. The sheet ────────────────────────────────────────────── */

  function slip() {
    const panel = document.getElementById('betSlip');
    const handle = document.getElementById('slipHandle');
    if (!panel || !handle) return;

    const backdrop = make('button', 'mfr-slip-backdrop');
    backdrop.type = 'button';
    backdrop.tabIndex = -1;
    backdrop.setAttribute('aria-label', 'Close bet slip');
    panel.insertAdjacentElement('afterend', backdrop);

    /* bet_slip.js owns the open state; closing is a click on its own
       handle. */
    const close = () => {
      if (!panel.classList.contains('is-open')) return;
      /* What is inside the sheet is about to be hidden. If the keyboard
         is in there (the stake, a ticket's remove), it goes back to the
         handle, or it would be left on nothing. */
      const inside = panel.contains(document.activeElement) && document.activeElement !== handle;
      handle.click();
      if (inside) handle.focus();
    };
    backdrop.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && shown(handle)) close();
    });

    ticket(panel, handle, close, pickLimit());
  }

  /* ── 1–3. The ticket ─────────────────────────────────────────── */

  function ticket(panel, handle, close, LIMIT) {
    const list = document.getElementById('slipLegs');
    const head = panel.querySelector('.mf-slip__head');
    if (!list || !head) return;

    const key = (course, time, horse) => [course, time, horse].map((s) => String(s || '').trim().toLowerCase()).join('|');
    /* The runners on the page, by key. Read again when a turn to
       another meeting has changed them (survey(), below). */
    const rows = new Map();
    const readRows = () => {
      rows.clear();
      document.querySelectorAll('.racecard__runner').forEach((row) => {
        rows.set(key(row.dataset.course, row.dataset.raceTime, row.dataset.horseName), row);
      });
    };
    readRows();

    /* Where this page's silks come from: the same place for every
       runner. A kept kit (from storage) is only drawn from there, or
       from the silks services the racing data has used, never from
       anywhere else. */
    const first = document.querySelector('img.racecard__silk[src]');
    const folder = first ? first.getAttribute('src').replace(/[^/?]*$/, '') : '';
    const picture = (src) => {
      if (!src || !(folder && src.startsWith(folder)) && !/^https:\/\/(silks\.theracingapi\.com\/silk\?|www\.rp-assets\.com\/svg\/)/.test(src)) return null;
      const copy = make('img');
      copy.src = src;
      copy.alt = '';
      return copy;
    };
    /* A pick's key: its course, time and horse, as its ticket has them.
       bet_slip.js writes the course as the first text of the ticket's
       "where" line; should it ever stamp the ticket with data-course,
       data-race-time and data-horse-name instead, those come first. */
    const keyOf = (leg) => {
      const d = leg.dataset;
      if (d.course && d.raceTime && d.horseName) return key(d.course, d.raceTime, d.horseName);
      const where = leg.querySelector('.mf-slip__leg-where');
      const time = leg.querySelector('.mf-slip__leg-time');
      const horse = leg.querySelector('.mf-slip__leg-horse');
      if (!where || !time || !horse) return null;
      const course = where.firstChild && where.firstChild.nodeType === Node.TEXT_NODE ? where.firstChild.nodeValue : '';
      return key(course, time.textContent, horse.textContent);
    };
    /* What a ticket shows of a runner, from its row. */
    const kitOf = (row) => {
      const img = row.querySelector('img.racecard__silk');
      const jockey = row.querySelector('.racecard__jockey-name');
      const number = row.dataset.number || '';
      return {
        silks: img ? img.getAttribute('src') : '',
        number: /^\d+$/.test(number) && +number > 0 ? number : '',
        jockey: jockey ? jockey.textContent.replace(/\s+/g, ' ').trim() : '',
      };
    };
    const wrap = document.querySelector('.mf-wrap');
    const KIT = 'mfr-slip-kit:';
    const KEPT = KIT + ((wrap && wrap.dataset.storageKey) || 'slip');
    /* A day's kits are kept with that day's slip, whose key ends in its
       date, so a visitor can move between today's card and tomorrow's
       and find both dressed. One from more than a week before this
       page's day is no use to anyone, and is cleared. */
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const dayOf = (name) => {
      const m = /(\d{4})-(\d{2})-(\d{2})$/.exec(name);
      return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
    };
    try {
      const today = dayOf(KEPT);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const name = localStorage.key(i);
        if (name && name.indexOf(KIT) === 0 && today - dayOf(name) > WEEK_MS) localStorage.removeItem(name);
      }
    } catch (e) {
      /* No storage: nothing was kept. */
    }
    const kept = () => {
      try {
        return JSON.parse(localStorage.getItem(KEPT)) || {};
      } catch (e) {
        return {};
      }
    };
    const keep = (kits) => {
      try {
        localStorage.setItem(KEPT, JSON.stringify(kits));
      } catch (e) {
        /* No storage: picks from other meetings go without their silks. */
      }
    };

    /* The card: the slip's six places on the rail to the winning post.
       Each pick takes the next place, in the order picked; the rest stay
       open, a horseshoe in each. */
    const card = make('nav', 'mfr-card');
    card.setAttribute('aria-label', 'Your ' + picksOf(LIMIT));
    const rail = card.appendChild(make('ol', 'mfr-card__rail'));
    const marks = [];
    for (let i = 0; i < LIMIT; i++) {
      const mark = rail.appendChild(make('li')).appendChild(make('a', 'mfr-card__place'));
      mark.appendChild(icon('horseshoe'));
      marks.push(mark);
    }
    rail.appendChild(make('li', 'mfr-card__post')).setAttribute('aria-hidden', 'true');
    const count = card.appendChild(make('p', 'mfr-card__count'));
    const help = card.appendChild(make('p', 'mfr-card__help'));
    /* In the sheet, going to a race means leaving the sheet. */
    card.addEventListener('click', (e) => {
      if (e.target.closest('.mfr-card__place[href]') && shown(handle)) close();
    });
    head.insertAdjacentElement('afterend', card);

    /* The day's other meetings, by course, from the tabs: where a place
       goes for a pick made at one of them. */
    const meetings = new Map();
    const readMeetings = () => {
      meetings.clear();
      document.querySelectorAll('a.mf-switcher__chip[href]').forEach((chip) => {
        const course = chip.querySelector('.mf-switcher__course');
        if (course) meetings.set(course.textContent.trim().toLowerCase(), chip.getAttribute('href'));
      });
    };
    readMeetings();
    const courseOf = (leg) => {
      if (leg.dataset.course) return leg.dataset.course.trim().toLowerCase();
      const where = leg.querySelector('.mf-slip__leg-where');
      const node = where && where.firstChild;
      return node && node.nodeType === Node.TEXT_NODE ? node.nodeValue.trim().toLowerCase() : '';
    };

    const bar = make('span', 'mfr-bar__silks');
    bar.setAttribute('aria-hidden', 'true');
    const chevron = handle.querySelector('.mf-slip__handle-chevron');
    if (chevron) handle.insertBefore(bar, chevron);
    else handle.appendChild(bar);

    const limit = atMost(panel, head, list, LIMIT);

    function dress() {
      const legs = Array.from(list.children).filter((leg) => leg.classList.contains('mf-slip__leg'));

      /* Each pick's kit: from its row if it is on this page, or else as
         kept when it was made. Only the picks now in the slip are kept. */
      const before = kept();
      const now = {};
      const kits = legs.map((leg) => {
        const k = keyOf(leg);
        const row = k ? rows.get(k) : null;
        const kit = row ? kitOf(row) : (k && before[k]) || null;
        if (k && kit) now[k] = kit;
        return kit;
      });
      /* bet_slip.js draws the whole slip again on every keystroke in the
         stake. The tickets need dressing again each time, since they are
         new; the kit only needs writing, and the Pick buttons walking
         (below), when the picks themselves have changed. */
      const picked = JSON.stringify(now);
      const changed = picked !== lastPicked || legs.length !== lastCount;
      lastPicked = picked;
      lastCount = legs.length;
      if (changed) keep(now);

      legs.forEach((leg, i) => {
        if (leg.querySelector('.mfr-leg__silks')) return;
        const kit = kits[i] || {};
        const silks = make('span', 'mfr-leg__silks');
        silks.appendChild(picture(kit.silks) || icon('cap'));
        if (kit.number) silks.appendChild(make('span', 'mfr-cloth', String(kit.number)));
        leg.insertBefore(silks, leg.firstChild);

        const info = leg.querySelector('.mf-slip__leg-info');
        if (kit.jockey && info) {
          const line = make('div', 'mfr-leg__jockey');
          line.appendChild(icon('cap'));
          line.appendChild(make('span', '', String(kit.jockey)));
          info.appendChild(line);
        }
      });

      /* The places: a pick each, in the order picked; the rest open. */
      marks.forEach((mark, i) => {
        const leg = legs[i] || null;
        const k = leg && keyOf(leg);
        const row = k ? rows.get(k) : null;
        const race = row && row.closest('.mf-race[id]');
        const old = mark.querySelector('.mfr-card__silk');
        if (old) old.remove();
        mark.removeAttribute('href');
        mark.setAttribute('data-mfr-taken', String(!!leg));
        let label = 'Place ' + (i + 1) + ' of ' + LIMIT + ': open';
        if (leg) {
          /* A pick never seen being made has no silks: a jockey's cap. */
          const kit = kits[i] || {};
          const pic = picture(kit.silks) || icon('cap');
          pic.classList.add('mfr-card__silk');
          mark.appendChild(pic);
          const horse = leg.querySelector('.mf-slip__leg-horse');
          const where = leg.querySelector('.mf-slip__leg-where');
          label = 'Pick ' + (i + 1) + ' of ' + LIMIT + ': ' + (horse ? horse.textContent.trim() : '') + (where ? ', ' + where.textContent.replace(/\s+/g, ' ').trim() : '');
          if (race) {
            mark.href = '#' + race.id;
          } else {
            const away = meetings.get(courseOf(leg));
            if (away) mark.href = away;
            label += ' (another meeting)';
          }
        }
        mark.setAttribute('aria-label', label);
        mark.title = label;
      });

      /* The count: how many of the six, and how many of those were
         picked at the day's other meetings (no row here). */
      const n = legs.length;
      const elsewhere = legs.filter((leg) => {
        const k = keyOf(leg);
        return !(k && rows.has(k));
      }).length;
      card.setAttribute('data-mfr-state', n > LIMIT ? 'over' : n === LIMIT ? 'full' : n === LIMIT - 1 ? 'last' : 'open');
      count.textContent = '';
      if (n === 0) {
        count.appendChild(document.createTextNode('Up to ' + picksOf(LIMIT) + ', one a race'));
      } else {
        count.appendChild(make('strong', '', String(n)));
        count.appendChild(
          document.createTextNode(
            n > LIMIT
              ? ' picks · ' + (n - LIMIT) + ' over the ' + word(LIMIT)
              : ' of ' + LIMIT + (n === LIMIT ? ' · full' : n === LIMIT - 1 ? ' picks · one place left' : ' picks')
          )
        );
        if (elsewhere > 0) {
          count.appendChild(document.createTextNode(' · '));
          count.appendChild(make('strong', '', String(elsewhere)));
          count.appendChild(document.createTextNode(elsewhere === 1 ? ' at another meeting' : ' at other meetings'));
        }
      }
      help.textContent =
        n > LIMIT
          ? 'A slip holds ' + picksOf(LIMIT) + '. Take ' + (n - LIMIT) + ' out.'
          : n === LIMIT
            ? 'That’s your ' + word(LIMIT) + '. Change a horse, or take one out to pick another race.'
            : '';

      /* Up to four in the bar; the count beside them is the whole slip. */
      bar.textContent = '';
      const inBar = kits.map((kit) => kit && picture(kit.silks)).filter(Boolean).slice(0, 4);
      inBar.forEach((img) => bar.appendChild(img));
      if (inBar.length && legs.length > inBar.length) bar.appendChild(make('span', 'mfr-bar__more', '+' + (legs.length - inBar.length)));

      if (changed) limit(legs.length);
    }

    let lastPicked = null;
    let lastCount = -1;
    new MutationObserver(dress).observe(list, { childList: true });
    dress();

    /* A turn to another meeting (meeting_masthead.js) has put other
       races, and other tabs, in the page. The picks are the same, but
       what they are matched against is not: read it again, and bring
       the tickets, the places and the Pick buttons up to date as if the
       picks had changed. */
    window.mfrMeeting = window.mfrMeeting || {};
    window.mfrMeeting.slip = () => {
      readRows();
      readMeetings();
      limit.survey();
      lastPicked = null;
      list.querySelectorAll('.mfr-leg__silks, .mfr-leg__jockey').forEach((node) => node.remove());
      dress();
    };
  }

  /* ── 5. Six at most ──────────────────────────────────────────── */

  /* Returns the function that brings the limit's state up to date for
     a number of picks; ticket() calls it whenever the slip changes. */
  function atMost(panel, head, list, LIMIT) {
    const picks = () => Array.from(list.children).filter((leg) => leg.classList.contains('mf-slip__leg')).length;

    /* The runner a Pick button would add as one more race: none where
       the button is off already, where the runner has no price yet
       (bet_slip.js takes none without one, and says so itself), or
       where its race has a pick (bet_slip.js marks such a race), since
       picking there changes the horse and adds nothing. */
    const fresh = (btn) => {
      if (btn.disabled) return null;
      const row = btn.closest('.racecard__runner, .mf-runner');
      if (!row || !Number.isFinite(parseFloat(row.dataset.oddsDecimal))) return null;
      const race = document.getElementById('race-' + row.dataset.raceId) || row.closest('.mf-race');
      return race && race.classList.contains('mf-race--has-selection') ? null : row;
    };

    /* The message. bet_slip.js has one of its own ("Added…",
       "Removed…") in the same place; only one of the two shows at a
       time. */
    const note = make('div', 'mfr-toast');
    note.setAttribute('role', 'status');
    document.body.appendChild(note);
    let showing = 0;
    const hush = () => {
      clearTimeout(showing);
      note.classList.remove('is-visible');
    };
    const say = (text) => {
      const theirs = document.querySelector('.mf-toast.is-visible');
      if (theirs) theirs.classList.remove('is-visible');
      /* Emptied first: a status region set to the words it already has
         says nothing, and the same horse can be refused twice. */
      note.textContent = '';
      note.classList.add('is-visible');
      requestAnimationFrame(() => { note.textContent = text; });
      clearTimeout(showing);
      showing = setTimeout(hush, 4500);
    };

    /* Stand a Pick button down, or put it back as it was. */
    const stand = (btn, down) => {
      if (down === btn.hasAttribute('data-mfr-shut')) return;
      if (down) {
        btn.setAttribute('data-mfr-shut', '');
        btn.setAttribute('aria-disabled', 'true');
        if (btn.hasAttribute('title')) btn.dataset.mfrTitle = btn.getAttribute('title');
        btn.title = 'Your slip is full: ' + picksOf(LIMIT) + ' at most. Take one out to pick this one.';
        return;
      }
      btn.removeAttribute('data-mfr-shut');
      btn.removeAttribute('aria-disabled');
      if (btn.dataset.mfrTitle != null) {
        btn.title = btn.dataset.mfrTitle;
        delete btn.dataset.mfrTitle;
      } else {
        btn.removeAttribute('title');
      }
    };

    let buttons = [];
    const survey = () => {
      buttons = Array.from(document.querySelectorAll('[data-action="add-to-slip"]'));
    };
    survey();
    const inBar = document.getElementById('slipHandleCount');
    if (inBar) inBar.setAttribute('data-mfr-of', '/' + LIMIT);

    function limit(n) {
      panel.setAttribute('data-mfr-six', n > LIMIT ? 'over' : n === LIMIT ? 'full' : n === LIMIT - 1 ? 'last' : 'open');
      buttons.forEach((btn) => stand(btn, n >= LIMIT && !!fresh(btn)));
    }

    /* The seventh. Heard on the way down, before bet_slip.js (which
       listens on the document, on the way back up), and stopped there.
       Stopping it there also keeps the press from site.js's document
       listener, which closes an open navigation dropdown on any click,
       so a refused press leaves such a dropdown open until the next
       click: a smaller wrong than the alternative, letting the press
       through and undoing bet_slip.js's add, which would flash a ticket
       and write to storage. */
    let nudged = 0;
    document.addEventListener(
      'click',
      (e) => {
        if (picks() < LIMIT) return;
        const btn = e.target.closest && e.target.closest('[data-action="add-to-slip"]');
        const row = btn && fresh(btn);
        if (!row) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        say(capital(racesOf(LIMIT)) + ' is the most you can pick. Take one out to add ' + row.dataset.horseName + '.');

        /* And the card answers: brought into view, with a shake of the
           head. */
        const body = head.parentElement;
        if (body && body.scrollTop > 0) body.scrollTop = 0;
        panel.removeAttribute('data-mfr-nudge');
        void panel.offsetWidth;
        panel.setAttribute('data-mfr-nudge', '');
        clearTimeout(nudged);
        nudged = setTimeout(() => panel.removeAttribute('data-mfr-nudge'), 700);
      },
      true
    );

    const update = (n) => {
      hush();
      limit(n);
    };
    update.survey = survey;
    return update;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', slip);
  else slip();
})();
