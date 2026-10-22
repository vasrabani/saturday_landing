/* Fox Signals v2 — the pills change the page in place.
 *
 * A press on a room pill, a meeting chip, a filter or the sort menu
 * used to load the next page, and the load showed: the screen went
 * blank for a moment before the same masthead came back. Here the
 * next page is fetched, and what is inside .fxv-wrap (masthead, pills,
 * the room) is swapped for the fetched page's, with the address and
 * the title. Nothing is unloaded, so nothing flickers. This is the
 * meeting tabs' way (meeting_masthead.js).
 *
 * Every link stays a real link: without this script, on any error, on
 * a modified click, or for a page that needs a script this one cannot
 * start (the Race Trace chart), the browser goes to the page as before.
 */
(function () {
  'use strict';

  var WRAP = '.fxv-wrap';
  // What is taken over: the room pills, and the Board's own controls.
  var LINKS = '.fxv-nav__rooms a[href], .fxv-tools a[href], .fxv-empty a[href]';
  // Scripts that find their page by events on the document, so they
  // can arrive after it. Any other script a page asks for means that
  // page is loaded the old way.
  var LATE_OK = /\/(board_star|board_filters|signup_nudge|fox_v2_turn)\.js$/;
  var FRESH_MS = 30000;

  if (!window.fetch || !window.history || !window.DOMParser) return;
  if (!document.querySelector(WRAP)) return;

  // The sort menu asks before it navigates by itself (board_v2.html),
  // and the Board's filters hand it a choice wider than the page holds.
  window.fxvTurn = function (href) {
    var address = addressOf(href);
    if (address) turnTo(address, true);
    else window.location.assign(href);
  };

  var pages = {};   // address → { at, text: Promise<string> }

  function addressOf(href) {
    var url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    return url.pathname + url.search;
  }

  function fetchPage(address) {
    var kept = pages[address];
    if (kept && Date.now() - kept.at < FRESH_MS) return kept.text;
    var text = fetch(address, {
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'fetch' },
    }).then(function (response) {
      // A redirect (a members' room, to a visitor) is a different
      // page: let the browser follow it.
      if (!response.ok || response.redirected) throw new Error('HTTP ' + response.status);
      return response.text();
    });
    pages[address] = { at: Date.now(), text: text };
    text.catch(function () { delete pages[address]; });
    return text;
  }

  function scriptPath(el) {
    try { return new URL(el.src, window.location.href).pathname; }
    catch (e) { return ''; }
  }

  /* Bring what the next page asks for in its head: scripts that can
     start late, and the star's endpoint. False if either page runs a
     script that cannot (the race page's chart, which draws on its own
     page and keeps a clock and a poll): that page is reached, and left,
     the old way. */
  function bringHead(doc) {
    var have = {};
    var running = document.querySelectorAll('script[src*="/fox_signals/"]');
    for (var r = 0; r < running.length; r++) {
      var mine = scriptPath(running[r]);
      if (!LATE_OK.test(mine)) return false;
      have[mine] = true;
    }
    var wanted = doc.querySelectorAll('script[src*="/fox_signals/"]');
    var missing = [];
    for (var i = 0; i < wanted.length; i++) {
      var path = scriptPath(wanted[i]);
      if (!LATE_OK.test(path)) return false;
      if (have[path]) continue;
      missing.push(wanted[i].getAttribute('src'));
    }
    missing.forEach(function (src) {
      var s = document.createElement('script');
      s.src = src;
      document.head.appendChild(s);
    });
    var pin = doc.querySelector('meta[name="fx-toggle-pin-url"]');
    if (pin && !document.querySelector('meta[name="fx-toggle-pin-url"]')) {
      document.head.appendChild(document.importNode(pin, true));
    }
    return true;
  }

  function swap(text, sameRoom) {
    var doc = new DOMParser().parseFromString(text, 'text/html');
    var next = doc.querySelector(WRAP);
    var wrap = document.querySelector(WRAP);
    if (!next || !wrap || !bringHead(doc)) return false;

    // Where the pills pin: a change of room starts there if the reader
    // had scrolled past it, and is otherwise left where it was.
    var nav = wrap.querySelector('.fxv-nav');
    var hero = wrap.querySelector('.fxv-hero');
    var past = nav && hero && window.scrollY > hero.offsetHeight;

    wrap.setAttribute('data-active-tab', next.getAttribute('data-active-tab') || '');
    var fresh = document.importNode(next, true);
    wrap.replaceChildren.apply(wrap, Array.prototype.slice.call(fresh.childNodes));
    if (doc.title) document.title = doc.title;

    if (!sameRoom && past) {
      var newHero = wrap.querySelector('.fxv-hero');
      window.scrollTo(0, newHero ? newHero.offsetHeight : 0);
    }
    showRoom();
    return true;
  }

  // The pill of the room the reader is in is brought into the strip's
  // view: on a phone the pills scroll sideways, and the current one
  // can start under the strip's fade.
  function showRoom() {
    var rooms = document.querySelector('.fxv-nav__rooms');
    var on = rooms && rooms.querySelector('[aria-current="page"]');
    if (!on || rooms.scrollWidth <= rooms.clientWidth) return;
    var left = on.getBoundingClientRect().left - rooms.getBoundingClientRect().left;
    var seen = rooms.clientWidth - 60;              // short of the fade
    if (left + on.offsetWidth > seen) rooms.scrollLeft += left + on.offsetWidth - seen;
    else if (left < 0) rooms.scrollLeft += left;
  }

  var turning = 0;

  function turnTo(address, push) {
    var mine = ++turning;
    var sameRoom = address.split('?')[0] === window.location.pathname;
    document.documentElement.classList.add('fxv-turning');
    return fetchPage(address).then(function (text) {
      if (mine !== turning) return;            // a later press won
      if (!swap(text, sameRoom)) throw new Error('not swappable');
      if (push) window.history.pushState({ fxv: true }, '', address);
    }).catch(function () {
      if (mine === turning) window.location.href = address;
    }).then(function () {
      if (mine === turning) document.documentElement.classList.remove('fxv-turning');
    });
  }

  function linkFor(target) {
    var link = target.closest && target.closest(LINKS);
    if (!link || !link.closest(WRAP)) return null;
    // A members' room, to a visitor: the sign-up prompt takes the press.
    if (link.hasAttribute('data-fx-locked-tab')) return null;
    if (link.target && link.target !== '_self') return null;
    return link;
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var link = linkFor(e.target);
    if (!link) return;
    var address = addressOf(link.href);
    if (!address) return;
    e.preventDefault();
    turnTo(address, true);
  });

  document.addEventListener('change', function (e) {
    var menu = e.target.closest && e.target.closest('.fxv-select');
    if (!menu || !menu.value) return;
    var address = addressOf(menu.value);
    if (address) turnTo(address, true);
  });

  // Pointed at, or touched: the page is on its way before the press.
  function eager(e) {
    var link = linkFor(e.target);
    if (!link) return;
    var address = addressOf(link.href);
    if (address) fetchPage(address).catch(function () {});
  }
  document.addEventListener('pointerover', eager, { passive: true });
  document.addEventListener('touchstart', eager, { passive: true });
  document.addEventListener('focusin', eager);

  // A star changes what every kept page would show.
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-fx-star]')) pages = {};
  }, true);

  // Back and forward walk the same swaps.
  window.history.replaceState({ fxv: true }, '', window.location.href);
  window.addEventListener('popstate', function () {
    turnTo(window.location.pathname + window.location.search, false);
  });

  showRoom();
})();
