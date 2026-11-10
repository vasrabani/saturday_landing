/* wire_off.js — "off in 2h 10m" on Horses to Watch.
 *
 * A pick's race time is printed as "Off 15:40", which stays true on a
 * cached page. This reads <time data-wire-off datetime="…"> against the
 * reader's clock and, for a race still to run today, writes how long is
 * left instead: "Off in 2h 10m", "Off in 25m". A race already off, more
 * than twelve hours away, or a time it cannot read keeps its printed
 * time. It writes only the text of those <time> elements.
 */
(function () {
  'use strict';

  const MINUTE = 60 * 1000;
  const WINDOW = 12 * 60;
  const now = Date.now();

  document.querySelectorAll('time[data-wire-off]').forEach((time) => {
    const minutes = Math.round((Date.parse(time.dateTime) - now) / MINUTE);
    if (Number.isNaN(minutes) || minutes < 1 || minutes > WINDOW) return;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    time.textContent = `Off in ${hours ? `${hours}h ` : ''}${rest}m`;
  });
})();
