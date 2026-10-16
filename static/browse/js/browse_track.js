/* browse_track.js — the reveal track in each meeting's head.
 *
 * Once a meeting has a result, a course is drawn along the foot of its
 * head: a tick for each race of the card, the part already run lit,
 * and a gold horse at the start. Each winner the reader reveals moves
 * the horse a race up the course; when every race has been run and
 * revealed it stands at the post. Beside it, how many of the results
 * are showing ("3 of 8 revealed").
 *
 * The page's spoiler script keeps that state: aria-pressed on each
 * [data-spoiler], remembered across visits. This reads it through a
 * MutationObserver, so it follows every way a winner is shown or
 * hidden (one race, a whole meeting, the remembered ones as the page
 * opens) whichever of the two scripts runs first.
 *
 * Adds one element, .rbr-track (read by browse.css and nothing else),
 * to the head of each meeting with a result, and sets
 * data-rbr-done on it once the horse is at the post.
 */
(function () {
  'use strict';

  const paper = document.querySelector('.meetings-paper');
  if (!paper) return;

  const tracks = new Map();

  function make(tag, className) {
    const node = document.createElement(tag);
    node.className = className;
    return node;
  }

  function draw(block) {
    const track = tracks.get(block);
    if (!track) return;
    const results = track.spoilers.length;
    const shown = track.spoilers.filter((spoiler) => spoiler.getAttribute('aria-pressed') === 'true').length;
    const lane = track.lane.style;
    lane.setProperty('--rbr-races', track.races);
    lane.setProperty('--rbr-run', results / track.races);
    lane.setProperty('--rbr-at', shown / track.races);
    track.count.textContent = shown === results && results > 1 ? `All ${results} revealed` : `${shown} of ${results} revealed`;
    track.node.toggleAttribute('data-rbr-done', shown === track.races);
  }

  /* A track for each meeting with a result. Its races are the card's
     lines, less any abandoned (which will never have a result). */
  paper.querySelectorAll('[data-meeting-block]').forEach((block) => {
    const head = block.querySelector('.meeting-block__header');
    const spoilers = Array.from(block.querySelectorAll('[data-spoiler]'));
    if (!head || !spoilers.length) return;
    const running = block.querySelectorAll('.race-row:not(.race-row--abandoned)').length;

    const node = make('div', 'rbr-track');
    const count = make('p', 'rbr-track__count');
    const lane = make('span', 'rbr-track__lane');
    lane.setAttribute('aria-hidden', 'true');
    lane.append(make('span', 'rbr-track__horse'), make('span', 'rbr-track__post'));
    node.append(count, lane);
    head.append(node);

    tracks.set(block, { node, count, lane, spoilers, races: Math.max(running, spoilers.length) });
    draw(block);
  });
  if (!tracks.size) return;

  new MutationObserver((records) => {
    new Set(records.map((record) => record.target.closest('[data-meeting-block]'))).forEach(draw);
  }).observe(paper, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
})();
