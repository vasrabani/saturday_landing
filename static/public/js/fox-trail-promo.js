/* The Fox Trail on the home page. On a phone the cards are one row to
   swipe; open it on the card the page marks as the one to start on
   (the next race off), with the card before it peeking in, so the
   visitor lands where the day is. Scrolls the row only, never the page. */
(function () {
  'use strict';

  function startRow(row) {
    if (row.scrollWidth <= row.clientWidth + 1) return;   // not a scroller here
    var start = row.querySelector('[data-ftp-start]');
    if (!start) return;
    // The row is the cards' offsetParent. Its scroll-padding leaves 64px
    // on the left, so the race before peeks in when the snap settles.
    row.scrollLeft = Math.max(0, start.offsetLeft - 64);
  }

  function init() {
    var rows = document.querySelectorAll('.ftp__cards');
    for (var i = 0; i < rows.length; i++) startRow(rows[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
