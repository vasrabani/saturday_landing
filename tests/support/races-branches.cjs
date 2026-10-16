// The branches of the races template that no capture caught, each built
// from a captured page by the smallest change that gives it the markup
// the template would render. The class names are the template's own
// (meetings_browse.html styles every one of them in its <style> block,
// which says what drives each); the words and the exact nesting are a
// stand-in, to design and test against, until the port checks them
// against the real template (docs/races-brief.md, "States no capture
// has"). tools/build-races-states.mjs draws them; tests/races.spec.js
// tests them. CommonJS, so the Node tool and the tests both load it on
// every Node the repo supports.
'use strict';

function swap(html, from, to, what) {
  const at = html.indexOf(from);
  if (at < 0) throw new Error(`races-branches: ${what} not found`);
  return html.slice(0, at) + to + html.slice(at + from.length);
}

/** The markup of the meeting with this id, and where it sits in the page. */
function meetingOf(html, id) {
  const start = html.indexOf(`id="${id}"`);
  const open = html.lastIndexOf('<article', start);
  const end = html.indexOf('</article>', start) + '</article>'.length;
  if (start < 0 || open < 0) throw new Error(`races-branches: meeting ${id} not found`);
  return { open, end, markup: html.slice(open, end) };
}

/** The markup of the race whose line links to /races/<raceId>/. */
function raceOf(html, raceId) {
  const start = html.indexOf(`<a href="https://www.saturday-racing.com/races/${raceId}/"`, html.indexOf('<section class="meetings-paper"'));
  const end = html.indexOf('</a>', html.indexOf('race-row__cta', start)) + '</a>'.length;
  if (start < 0) throw new Error(`races-branches: race ${raceId} not found`);
  return { start, end, markup: html.slice(start, end) };
}

function inMeeting(html, id, change) {
  const meeting = meetingOf(html, id);
  return html.slice(0, meeting.open) + change(meeting.markup) + html.slice(meeting.end);
}

function inRace(html, raceId, change) {
  const race = raceOf(html, raceId);
  return html.slice(0, race.start) + change(race.markup) + html.slice(race.end);
}

/** A race marked abandoned: the modifier, and the tag after its name. */
function abandon(race) {
  let markup = race.replace(/class="race-row\b/, 'class="race-row race-row--abandoned');
  const name = markup.indexOf('</span>', markup.indexOf('race-row__name'));
  markup = `${markup.slice(0, name + 7)}\n                <span class="abandoned-tag">Abandoned</span>${markup.slice(name + 7)}`;
  return markup;
}

const BRANCHES = {
  // Race.is_featured on Champions Day's big race: the banner under the
  // masthead's figures, its meeting (first already) trimmed and
  // flagged, its line on the gold wash with the tag.
  bigRace: {
    day: 'tomorrow',
    change(html) {
      const RACE = '6552';
      let page = inRace(html, RACE, (race) => {
        let markup = race.replace('class="race-row"', 'class="race-row race-row--featured"');
        const name = markup.indexOf('</span>', markup.indexOf('race-row__name'));
        markup = `${markup.slice(0, name + 7)}\n                <span class="featured-tag">Big race</span>${markup.slice(name + 7)}`;
        return markup;
      });
      page = inMeeting(page, 'meeting-1', (meeting) =>
        swap(
          meeting.replace('class="meeting-block"', 'class="meeting-block meeting-block--featured"'),
          'data-meeting-block>',
          'data-meeting-block>\n        <div class="meeting-block__featured-flag">Big race meeting</div>',
          'the meeting\'s opening tag',
        ));
      const banner = [
        `  <a href="https://www.saturday-racing.com/races/${RACE}/" class="browse-featured-banner">`,
        '    <span class="browse-featured-banner__star" aria-hidden="true">★</span>',
        '    <span class="browse-featured-banner__text">',
        '      <span class="browse-featured-banner__label">Big race</span>',
        '      <span class="browse-featured-banner__title">Qatar Racing Champion Stakes (Group 1)</span>',
        '      <span class="browse-featured-banner__meta">Ascot · 16:00 · £737,230</span>',
        '    </span>',
        '  </a>',
      ].join('\n');
      return swap(page, '  </header>', `  </header>\n${banner}`, 'the hero');
    },
  },

  // A meeting called off (the last of today's, Dundalk): its tab, its
  // status line and every one of its races.
  abandonedMeeting: {
    day: 'today',
    change(html) {
      const tab = /(<a href="#meeting-5"\s+class="meeting-tab\s+)meeting-tab--upcoming("[\s\S]*?<span class="meeting-tab__state">)[\s\S]*?(<\/span>)/;
      if (!tab.test(html)) throw new Error('races-branches: the fifth tab not found');
      let page = html.replace(tab, '$1meeting-tab--abandoned$2Abandoned$3');
      page = inMeeting(page, 'meeting-5', (meeting) =>
        meeting
          .replace(
            /<div class="meeting-block__status meeting-block__status--upcoming">[\s\S]*?<\/div>/,
            '<div class="meeting-block__status meeting-block__status--abandoned">\n              <span class="meeting-block__status-value">Abandoned</span>\n              <span class="meeting-block__status-sep">·</span>\n              <span>Racing called off</span>\n            </div>',
          )
          .replace(/<a href="[^"]+"\s+class="race-row"[\s\S]*?race-row__cta[\s\S]*?<\/a>/g, abandon));
      return page;
    },
  },

  // One race abandoned at a meeting that is running (Haydock's last).
  abandonedRace: {
    day: 'today',
    change: (html) => inRace(html, '6513', abandon),
  },

  // A member's pick in a race still to run (signed in).
  yourPick: {
    day: 'today',
    change: (html) =>
      inRace(html, '6536', (race) =>
        swap(
          race,
          '<span class="race-row__cta">',
          [
            '<span class="race-row__pick-chip" title="Your pick in this race">',
            '                <span class="race-row__pick-chip-icon" aria-hidden="true">✓</span>',
            '                <span class="race-row__pick-chip-eyebrow">Your pick</span>',
            '                <span class="race-row__pick-chip-name">Rula Bula</span>',
            '                <span class="race-row__pick-chip-odds">6/4</span>',
            '              </span>',
            '              <span class="race-row__cta">',
          ].join('\n'),
          'the race\'s Racecard link',
        )),
  },

  // The cubs' chip in the Fox's colour: a cub the Fox promoted has
  // picked in the race.
  foxCubs: {
    day: 'today',
    change: (html) => inRace(html, '6527', (race) => swap(race, 'class="race-row__crowd-chip"', 'class="race-row__crowd-chip race-row__crowd-chip--fox"', 'the cubs\' chip')),
  },

  // A day with no racing: the template's message in the masthead, and
  // no tabs, meetings or notes.
  noRacing: {
    day: 'today',
    change(html) {
      const start = html.indexOf('<div class="browse-masthead">');
      const end = html.indexOf('</section>', html.indexOf('<section class="browse-notes"')) + '</section>'.length;
      const hero = html.slice(html.indexOf('<div class="container">', start), html.indexOf('  </header>', start) + '  </header>'.length);
      const quiet = hero
        .replace(/<div class="browse-stats">[\s\S]*?<\/div>/, '<div class="browse-stats">\n      <span><strong>0</strong> races</span>\n      <span><strong>0</strong> meetings</span>\n    </div>');
      const band = [
        '<div class="browse-masthead">',
        quiet,
        '  <div class="browse-empty">',
        '    <div class="browse-empty__icon" aria-hidden="true">🏇</div>',
        '    <h2 class="browse-empty__title">No racing today</h2>',
        '    <p>There are no meetings on the card today. Tomorrow’s racecards are up.</p>',
        '  </div>',
        '</div>',
        '</div>',
      ].join('\n');
      return html.slice(0, start) + band + html.slice(end);
    },
  },
};

module.exports = { BRANCHES };
