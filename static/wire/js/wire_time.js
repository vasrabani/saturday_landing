/* wire_time.js — "3 hrs ago" on the news pages.
 *
 * A story's filing time is printed as its date ("30 Oct"), which is
 * right for anything older than a week. For the past week this reads
 * <time data-wire-ago datetime="…"> against the reader's clock and
 * writes how long ago it was instead: "12 mins ago", "3 hrs ago",
 * "2 days ago". A time in the future, or one it cannot read, keeps its
 * date. It writes only the text of those <time> elements.
 */
(function () {
  'use strict';

  const MINUTE = 60 * 1000;
  const HOUR = 60;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const now = Date.now();

  const plural = (count, one, many) => `${count} ${count === 1 ? one : many} ago`;

  document.querySelectorAll('time[data-wire-ago]').forEach((time) => {
    const minutes = Math.floor((now - Date.parse(time.dateTime)) / MINUTE);
    if (Number.isNaN(minutes) || minutes < 0 || minutes >= WEEK) return;
    if (minutes < HOUR) time.textContent = plural(Math.max(minutes, 1), 'min', 'mins');
    else if (minutes < DAY) time.textContent = plural(Math.floor(minutes / HOUR), 'hr', 'hrs');
    else time.textContent = plural(Math.floor(minutes / DAY), 'day', 'days');
  });
})();
