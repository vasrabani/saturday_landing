/* wire_search.js — the Wire's search panel.
 *
 *   1. The search button in the nav ([data-wire-search-open]) opens the
 *      panel (#wire-search) from the left and takes the keyboard to its
 *      search box. While it is open the rest of the page is inert; the
 *      close button, the shade behind it ([data-wire-search-close]) and
 *      Escape close it and give the keyboard back to the search button.
 *   2. As the reader types, the panel asks the server
 *      (data-wire-search-url, /news/search/?q=) and lists what comes
 *      back: each story's title as a link, its desk and date under it.
 *      A newer question cancels the one still on its way.
 *
 * The wording for no results and for a server that does not answer
 * lives on the results list (data-wire-none, data-wire-offline).
 * It writes the wire-search-open class on <html>, aria-expanded on the
 * button, `inert` on the page around the panel, and the results list.
 */
(function () {
  'use strict';

  const panel = document.getElementById('wire-search');
  const opener = document.querySelector('[data-wire-search-open]');
  const input = panel && panel.querySelector('input[type="search"]');
  const results = panel && panel.querySelector('[data-wire-search-results]');
  const endpoint = panel && panel.getAttribute('data-wire-search-url');
  if (!opener || !input || !results || !endpoint) return;

  const closers = document.querySelectorAll('[data-wire-search-close]');
  const root = document.documentElement;
  const DELAY_MS = 150;

  /* ── 1. Open and close ──────────────────────────────────────── */

  // Everything in <body> but the panel and its shade.
  const page = Array.from(document.body.children)
    .filter((el) => el !== panel && !el.matches('[data-wire-search-close], script'));

  function setOpen(open) {
    root.classList.toggle('wire-search-open', open);
    opener.setAttribute('aria-expanded', String(open));
    page.forEach((el) => { el.inert = open; });
    (open ? input : opener).focus();
  }

  opener.addEventListener('click', () => setOpen(true));
  closers.forEach((el) => el.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && root.classList.contains('wire-search-open')) setOpen(false);
  });

  /* ── 2. Ask and list ────────────────────────────────────────── */

  let pending = null;
  let timer = 0;

  function note(text) {
    const p = document.createElement('p');
    p.className = 'wire-search__none';
    p.textContent = text;
    results.replaceChildren(p);
  }

  function list(stories) {
    if (!stories.length) {
      note(results.getAttribute('data-wire-none'));
      return;
    }
    results.replaceChildren(...stories.map((story) => {
      const link = document.createElement('a');
      const about = document.createElement('span');
      link.href = story.url;
      link.textContent = story.title;
      about.textContent = [story.desk, story.when].filter(Boolean).join(' · ');
      link.appendChild(about);
      return link;
    }));
  }

  function ask(query) {
    if (pending) pending.abort();
    if (!query) {
      results.replaceChildren();
      return;
    }
    pending = new AbortController();
    fetch(`${endpoint}?q=${encodeURIComponent(query)}`, { signal: pending.signal, headers: { Accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error(`search answered ${response.status}`);
        return response.json();
      })
      .then((answer) => list(answer.results))
      .catch((error) => {
        if (error.name !== 'AbortError') note(results.getAttribute('data-wire-offline'));
      });
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => ask(input.value.trim()), DELAY_MS);
  });
})();
