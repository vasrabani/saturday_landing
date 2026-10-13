"""Record a day of Fox Signals from the live site into
fixtures/fox-signals-day.json.

The Fox Signals pages here (fox-*.html) are built by
tools/build-fox-signals.py from the Django site, and a development
database has no Fox Signals data: no picks, no price history, no
signals. This records one real day as a visitor sees it, so the build
has a full card to draw: the Board's 38 races, and for a few chosen
races the whole Race Trace (runners, every price move, signals, result).

    python tools/harvest-fox-signals.py --races 6411,6415,6392 [--clock 15:02]

It reads public pages only (no account), with the standard library.
What a visitor is not shown is not recorded: conviction figures and the
evidence behind each signal are members', and the build tool makes
stand-ins for them.

--clock is the time of day the pages are built "at" (the build tool
stops the clock there): races before it are finished, the next one is
"next off". Race ids are the live site's and change every day: take
them from the Board's links on the day you record.

This reads the live site's markup, so it breaks when that markup
changes. It is run rarely, by Vas, to refresh the recording; the
developer does not need it.
"""
import argparse
import html
import io
import json
import os
import re
import sys
import urllib.request

BOX = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://www.saturday-racing.com'
OUT = os.path.join(BOX, 'fixtures', 'fox-signals-day.json')

# The chip a signal carries on the Race Trace rail, back to its kind.
KIND_OF_LABEL = {
    'CUT': 'price_cut', 'DRIFT': 'price_drift', 'COORDINATED': 'coordinated_move',
    'LEADER': 'market_leader', 'NR SHUFFLE': 'withdrawal_shuffle', 'JOCKEY': 'jockey_upgrade',
    'GOING': 'going_match', 'CLASS': 'class_drop',
}


def fetch(path):
    request = urllib.request.Request(SITE + path, headers={'User-Agent': 'saturday-landing-harvest'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode('utf-8')


def text(fragment):
    """The words of a fragment of markup, on one line."""
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', fragment))).strip()


def first(pattern, source, default=''):
    found = re.search(pattern, source, re.S)
    return text(found.group(1)) if found else default


def board():
    page = fetch('/fox-signals/board/')
    day = first(r'class="mf-hero__title-eyeline">(.*?)</span>', page)
    rows = []
    for article in re.findall(r'<article class="fxv-row.*?</article>', page, re.S):
        opening = article[:article.index('>')]
        facts = first(r'class="fxv-row__facts">(.*?)</span>', article).split(' · ')
        runners = next((f for f in facts if 'runner' in f), '')
        result = first(r'class="fxv-result[^"]*">(.*?)</span>', article)
        rows.append({
            'race_id': int(re.search(r'data-race-id="(\d+)"', opening).group(1)),
            'time': re.search(r'<time datetime="([\d:]+)"', article).group(1),
            'course': first(r'class="fxv-row__link"[^>]*>(.*?)</a>', article),
            'race_class': next((f for f in facts if f.lower().startswith(('class', 'group', 'grade', 'listed'))), ''),
            'going': next((f for f in facts if f not in (runners,) and not f.lower().startswith(('class', 'group', 'grade', 'listed'))), ''),
            'field_size': int(re.sub(r'\D', '', runners) or 0),
            'name': first(r'class="fxv-row__name">(.*?)</p>', article),
            'pick': first(r'class="fxv-row__horse">(.*?)(?:<span|</p>)', article),
            'sr': int(re.sub(r'\D', '', first(r'class="fxv-row__sr"[^>]*>(.*?)</span>', article)) or 0),
            'odds': first(r'class="fxv-price">(.*?)</span>', article),
            'conviction': re.search(r'fxv-row--(high|medium|low)', opening).group(1),
            'signals': [
                {'kind': kind, 'strength': strength}
                for strength, kind in re.findall(r'class="fxv-chip fxv-chip--(\w+)[^"]*" data-kind="(\w+)"', article)
            ],
            'more_signals': int(re.sub(r'\D', '', first(r'class="fxv-row__more">(.*?)</span>', article)) or 0),
            'result': result.lower() or None,
        })
    return day, rows


def race(race_id):
    page = fetch('/fox-signals/race/%d/' % race_id)
    data = json.loads(re.search(r'<script id="fx-trace-data"[^>]*>(.*?)</script>', page, re.S).group(1))

    runners = []
    table = page[page.index('class="fx-trace__runners'):]
    for row in re.findall(r'<div class="fx-trace__runner[ "].*?(?=<div class="fx-trace__runner[ "]|</section>)', table, re.S):
        found = re.search(r'data-runner-id="(\d+)"', row)
        if not found:
            continue
        runners.append({
            'runner_id': int(found.group(1)),
            'number': int(first(r'fx-trace__rcol--num[^>]*>(.*?)</div>', row) or 0),
            'horse': first(r'class="fx-trace__horse-name">(.*?)</span>', row),
            'trainer': first(r'class="fx-trace__trainer">(.*?)</span>', row),
            'jockey': first(r'fx-trace__rcol--jockey[^>]*>(.*?)</div>', row),
            'sr': int(re.sub(r'\D', '', first(r'fx-trace__rcol--sr[^>]*>(.*?)</div>', row)) or 0),
        })

    # A runner's prices, kept only where they change: [minute, price].
    prices, ai = {}, {}
    for series in data.get('series', []):
        moves, last = [], None
        for point in series['points']:
            if point['fractional'] != last:
                moves.append([point['minute'], point['fractional']])
                last = point['fractional']
        prices[str(series['runner_id'])] = moves
        ai_points = series.get('ai_points') or []
        if ai_points:
            ai[str(series['runner_id'])] = [[p['minute'], p['pct']] for p in ai_points[::12]]

    signals = []
    for item in re.findall(r'<li class="fx-trace__signal .*?</li>', page, re.S):
        chip = re.search(r'class="fx-chip fx-chip--(\w+) fx-trace__signal-chip">(.*?)</span>', item, re.S)
        title = re.search(r'class="fx-trace__signal-title">(.*?)(?:<span|</p>)', item, re.S)
        runner = re.search(r'data-runner-id="(\d+)"', item[:item.index('>')])
        signals.append({
            'kind': KIND_OF_LABEL.get(text(chip.group(2)), 'price_drift'),
            'strength': chip.group(1),
            'title': text(title.group(1)),
            'description': first(r'class="fx-trace__signal-desc">(.*?)</p>', item),
            'runner_id': int(runner.group(1)) if runner else None,
            'earlier': int(re.sub(r'\D', '', first(r'class="fx-trace__signal-earlier"[^>]*>(.*?)</span>', item)) or 0),
        })

    result = None
    if 'fx-replay__callout' in page:
        places = re.findall(r'class="fx-replay__callout-place">\s*<span class="fx-num">(.*?)</span>(.*?)<span class="fx-num">(.*?)</span>', page, re.S)
        result = {
            'winner': first(r'class="fx-replay__callout-name">(.*?)</span>', page),
            'winner_sp': first(r'class="fx-replay__callout-sp[^"]*">(.*?)</span>', page),
            'winner_jockey': first(r'class="fx-replay__callout-jockey">(.*?)</span>', page).lstrip('· '),
            'places': [[text(name), text(sp)] for _, name, sp in places],
        }

    return {
        'race_id': race_id,
        'time': first(r'class="fx-num fx-trace__time">(.*?)</span>', page),
        'course': first(r'class="fx-trace__course">(.*?)</span>', page),
        'name': first(r'class="fx-trace__deck">(.*?)</p>', page),
        'start_at': data.get('start_at'),
        'span_min': data.get('span_min'),
        'runners': runners,
        'prices': prices,
        'ai': ai,
        'signals': signals,
        'result': result,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--races', required=True, help='race ids to record in full, comma separated (from the Board\'s links today)')
    parser.add_argument('--clock', default='15:02', help='the time of day the pages are built at, HH:MM')
    args = parser.parse_args()

    day, rows = board()
    if not rows:
        sys.exit('The Board has no races right now: nothing to record.')
    races = [race(int(race_id)) for race_id in args.races.split(',')]
    out = {'day': day, 'clock': args.clock, 'board': rows, 'races': races}
    with io.open(OUT, 'w', encoding='utf-8', newline='\n') as handle:
        json.dump(out, handle, ensure_ascii=False, indent=1)
        handle.write('\n')
    print('fixtures/fox-signals-day.json: %s, %d races on the Board, %d in full (%s), %d KB' % (
        day, len(rows), len(races),
        ', '.join('%s %s: %d runners, %d signals%s' % (r['time'], r['course'], len(r['runners']), len(r['signals']), ', result' if r['result'] else '') for r in races),
        os.path.getsize(OUT) // 1024))


if __name__ == '__main__':
    main()
