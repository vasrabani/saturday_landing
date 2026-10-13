"""Build the Fox Signals pages (fox-*.html) from the Django site, in
this sandbox's copy of the site's shell, and copy its stylesheets and
scripts across.

Fox Signals is built in the Django site, not designed here. These pages
are copies for design work: the markup the Django templates produce,
under the same stylesheets and scripts, byte for byte. Run this after
the templates change there, or to refresh the copies:

    <django-venv>/python tools/build-fox-signals.py \\
        --django C:/path/to/saturday --settings saturday.settings_dev \\
        [--pythonpath DIR] [--no-assets]

It needs the Django project and any database with its migrations run,
so it runs with the project's own Python, not node.

Where the day comes from. A development database has no Fox Signals
data, so the day is fixtures/fox-signals-day.json, a real day recorded
from the live site (tools/harvest-fox-signals.py). It is loaded inside a
transaction that is rolled back at the end: nothing is written to the
database. The clock is stopped at the fixture's "clock" time on today's
date, so the same races are finished, next off and still to run every
time the pages are built.

What a visitor is not shown was not recorded, so it is made up here, the
same way on every build, and is not real: conviction figures (kept
inside the recorded level, with two races raised to "high" so that level
is on the page), the track record under each ("wins 24% of 515"), the
evidence behind each signal, and the member's starred races.

The pages:
    fox-board.html          the Board, as a visitor sees it
    fox-board-member.html   the Board, as a member sees it
    fox-race-trace.html     the day's races to open
    fox-race.html           one race, live, as a member
    fox-race-visitor.html   the same race, as a visitor
    fox-race-replay.html    a finished race, as a member
    fox-runner.html         one runner of the live race, as a member
    fox-alerts.html         every signal of the day, as a member
    fox-stable.html         the member's starred races
    fox-settings.html       the member's preferences

What is rewritten on the way in, as for the other pages here:
  - the shell (head, navigation, footer) is meeting.html's, so the page
    wears this sandbox's copy of the site chrome;
  - /static/... becomes static/..., and ?v= is dropped;
  - links between the Fox Signals pages become links between these
    files; every other link into the site becomes
    https://www.saturday-racing.com/...;
  - each race page's refresh (live.json) is saved in
    fixtures/fox-race-live.json, which tools/serve.mjs answers from.
"""
import argparse
import datetime
import hashlib
import io
import json
import os
import re
import shutil
import sys
from unittest import mock

BOX = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://www.saturday-racing.com'
MAIN_OPEN = '<main id="main-content"'
FIXTURE = os.path.join(BOX, 'fixtures', 'fox-signals-day.json')

# Django's copy of each asset, and this sandbox's. Kept byte for byte.
ASSETS = [
    'css/fox_signals_shell.css', 'css/fox_signals_v2.css',
    'js/board_star.js', 'js/signup_nudge.js', 'js/fox_v2_turn.js', 'js/race_trace_chart.js',
]
# Every script meeting.html's shell loads but site.js is the meeting
# page's own: a Fox Signals page loads its own instead.
MEETING_SCRIPT = re.compile(r'[ \t]*<script src="static/(?:races|meeting)/js/[^"]+"[^>]*></script>\n')

ALL_KINDS = ['price_cut', 'price_drift', 'coordinated_move', 'market_leader',
             'withdrawal_shuffle', 'jockey_upgrade', 'going_match', 'class_drop']
SAID = {
    'price_cut': 'Steamer', 'price_drift': 'Drifter', 'coordinated_move': 'Coordinated move',
    'market_leader': 'Market leader', 'withdrawal_shuffle': 'Non-runner reshuffle',
    'jockey_upgrade': 'Jockey upgrade', 'going_match': 'Going match', 'class_drop': 'Class drop',
}


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--django', required=True, help='the Django project directory (where manage.py is)')
    parser.add_argument('--settings', required=True, help='its settings module, e.g. saturday.settings_dev')
    parser.add_argument('--pythonpath', action='append', default=[], help='a directory to add to sys.path (for a settings module kept outside the project)')
    parser.add_argument('--no-assets', action='store_true', help='do not copy the stylesheets and scripts across')
    return parser.parse_args()


def stable(*parts):
    """A number that is the same on every build for the same parts."""
    return int(hashlib.sha256('|'.join(str(p) for p in parts).encode()).hexdigest()[:8], 16)


# ── The day, loaded ────────────────────────────────────────────────

def load_day(day, now):
    """Put the recorded day into the database (inside the caller's
    transaction). Returns what the pages are addressed by."""
    from django.contrib.auth.models import User
    from django.utils import timezone

    from ai.models import PickOutcome
    from fox_signals.models import OddsSnapshot, SignalFlag, StablePin
    from members.models.cub import Cub
    from races.models import Race, Runner

    today = now.date()
    tz = timezone.get_current_timezone()

    def at(clock):
        hours, minutes = (int(x) for x in clock.split(':'))
        return datetime.datetime.combine(today, datetime.time(hours, minutes), tzinfo=tz)

    # Anything the database already has for today would join the card.
    PickOutcome.objects.filter(race_date=today).delete()
    Race.objects.filter(race_date=today).update(race_date=today - datetime.timedelta(days=400))

    in_full = {race['race_id']: race for race in day['races']}
    made = {}                       # the live site's race id → this database's Race
    mediums = [row for row in day['board'] if row['conviction'] == 'medium']
    raised = {row['race_id'] for row in sorted(mediums, key=lambda r: -r['sr'])[:2]}
    last_gone = max((row for row in day['board'] if at(row['time']) < now), key=lambda r: r['time'], default=None)

    for row in day['board']:
        off = at(row['time'])
        full = in_full.get(row['race_id'])
        race = Race.objects.create(
            name=row['name'], course=row['course'], race_time=off.time(), race_date=today,
            distance='1m', going=row['going'], race_class=row['race_class'])
        made[row['race_id']] = race

        # Conviction: a figure inside the recorded level, the same every build.
        if row['race_id'] in raised:
            pct = 66 + stable(row['race_id'], 'high') % 9
        elif row['conviction'] == 'medium':
            pct = 45 + stable(row['race_id'], 'medium') % 19
        elif row['conviction'] == 'high':
            pct = 66 + stable(row['race_id'], 'high') % 20
        else:
            pct = 21 + stable(row['race_id'], 'low') % 23
        # Finished before the clock: settled with the recorded result,
        # but for the last of them, which is "off" and not yet settled.
        gone = off < now
        settled = gone and row['result'] and row is not last_gone
        position = {'won': 1, '2nd': 2, '3rd': 3}.get(row['result'] or '', 8)
        PickOutcome.objects.create(
            race=race, product_source=PickOutcome.PRODUCT_PICK_WINNER, product_lane='',
            pick_source=PickOutcome.PICK_SOURCE_LLM, clamped_confidence=row['conviction'],
            estimated_probability=pct, predicted_at=now - datetime.timedelta(hours=20),
            predicted_winner=row['pick'], predicted_winner_odds=row['odds'], predicted_winner_sr=row['sr'] or None,
            race_date=today, course=row['course'], field_size=row['field_size'], race_class=row['race_class'],
            settled_at=(off + datetime.timedelta(minutes=12)) if settled else None,
            actual_position=position if settled else None,
            won=(position == 1) if settled else None, placed=(position <= 3) if settled else None,
            actual_winner=(row['pick'] if position == 1 else 'Another Horse') if settled else '')

        if full:
            continue
        # A race not recorded in full: its pick, the rest of its field as
        # numbers, and the Board's signals on the pick.
        pick = Runner.objects.create(
            race=race, number=1, horse_name=row['pick'], age=4, weight='9-4', jockey='', trainer='',
            sr_rating=row['sr'] or None, odds=row['odds'], status=Runner.STATUS_DECS_48HRS)
        Runner.objects.bulk_create([
            Runner(race=race, number=n, horse_name='Runner %d' % n, age=4, weight='9-0', jockey='', trainer='',
                   odds='', status=Runner.STATUS_DECS_48HRS)
            for n in range(2, max(row['field_size'], 1) + 1)])
        kinds = [(s['kind'], s['strength']) for s in row['signals']]
        spare = [k for k in ALL_KINDS if k not in {kind for kind, _ in kinds}]
        kinds += [(k, 'medium') for k in spare[:row['more_signals']]]
        for i, (kind, strength) in enumerate(kinds):
            race_level = kind in ('coordinated_move', 'withdrawal_shuffle')
            flag = SignalFlag.objects.create(
                race=race, runner=None if race_level else pick, kind=kind, strength=strength,
                title=SAID[kind] if race_level else '%s: %s' % (SAID[kind], row['odds'] or 'SP'),
                description='Recorded from the Board: the detail of this signal was not.',
                signature='box-%d-%s' % (row['race_id'], kind), evidence={'note': 'a stand-in'})
            SignalFlag.objects.filter(pk=flag.pk).update(
                detected_at=min(now, off) - datetime.timedelta(minutes=30 + 40 * i))

    runner_of = {}                  # the live site's runner id → Runner
    for race_id, full in in_full.items():
        race = made[race_id]
        off = datetime.datetime.combine(today, race.race_time, tzinfo=tz)
        start = datetime.datetime.combine(
            today, datetime.datetime.fromisoformat(full['start_at']).astimezone(tz).time(), tzinfo=tz)
        end_minute = int((min(now, off) - start).total_seconds() // 60)

        for r in full['runners']:
            moves = full['prices'].get(str(r['runner_id']), [])
            seen = [price for minute, price in moves if minute <= end_minute]
            runner_of[r['runner_id']] = Runner.objects.create(
                race=race, number=r['number'], horse_name=r['horse'], age=4, weight='9-4',
                jockey=r['jockey'], trainer=r['trainer'], sr_rating=r['sr'] or None,
                odds=seen[-1] if seen else '', status=Runner.STATUS_DECS_48HRS)

        # A price every five minutes, as the capture job records them.
        snaps = []
        for r in full['runners']:
            moves = full['prices'].get(str(r['runner_id']), [])
            ai = full['ai'].get(str(r['runner_id']), [])
            for minute in range(0, end_minute + 1, 5):
                price = [p for m, p in moves if m <= minute]
                if not price:
                    continue
                confidence = [pct for m, pct in ai if m <= minute]
                snaps.append(OddsSnapshot(
                    race=race, runner=runner_of[r['runner_id']], odds=price[-1],
                    ai_confidence=round(confidence[-1]) if confidence else None,
                    captured_at=start + datetime.timedelta(minutes=minute, seconds=r['number']),
                    source=OddsSnapshot.SOURCE_CRON_5M))
        OddsSnapshot.objects.bulk_create(snaps)

        result = full['result']
        if result and off < now:
            places = result['places'] + [['', ''], ['', '']]
            Race.objects.filter(pk=race.pk).update(
                result_winner=result['winner'], result_winner_sp=result['winner_sp'],
                result_winner_jockey=result['winner_jockey'],
                result_place2=places[0][0], result_place2_sp=places[0][1],
                result_place3=places[1][0], result_place3_sp=places[1][1],
                result_has_winner=True)

        spread = max(end_minute - 30, 30)
        for i, signal in enumerate(full['signals']):
            runner = runner_of.get(signal['runner_id'])
            move = re.search(r': (\S+) → (\S+)', signal['title'])
            evidence = ({'from': move.group(1), 'to': move.group(2), 'note': 'a stand-in'} if move
                        else {'note': 'a stand-in: the evidence is not recorded'})
            when = start + datetime.timedelta(minutes=30 + (stable(race_id, i) % spread))
            for back in range(signal['earlier'] + 1):
                newest = back == 0
                flag = SignalFlag.objects.create(
                    race=race, runner=runner, kind=signal['kind'], strength=signal['strength'],
                    title=signal['title'], description=signal['description'], evidence=evidence,
                    signature='box-%d-%d-%d' % (race_id, i, back),
                    status=SignalFlag.STATUS_ACTIVE if newest else SignalFlag.STATUS_SUPERSEDED)
                SignalFlag.objects.filter(pk=flag.pk).update(
                    detected_at=when - datetime.timedelta(minutes=45 * back))

    # The member, and what they have starred: two of today's races and
    # one tomorrow.
    user = User.objects.create_user(username='sandbox-cub', password=None)
    cub = Cub.objects.create(user=user, subscription_tier=Cub.TIER_CUB)
    to_come = [row for row in day['board'] if at(row['time']) > now]
    live_id = next(r['race_id'] for r in day['races'] if not (r['result'] and at(r['time']) < now))
    replay_id = next(r['race_id'] for r in day['races'] if r['result'] and at(r['time']) < now)
    for race_id in {live_id, to_come[-1]['race_id']}:
        StablePin.objects.create(cub=cub, race=made[race_id])
    tomorrow = Race.objects.create(
        name='Champion Stakes', course='Ascot', race_time=datetime.time(15, 40),
        race_date=today + datetime.timedelta(days=1), distance='1m 2f', going='Good', race_class='Class 1')
    StablePin.objects.create(cub=cub, race=tomorrow)

    live = made[live_id]
    favourite = min(
        (r for r in in_full[live_id]['runners'] if in_full[live_id]['prices'].get(str(r['runner_id']))),
        key=lambda r: r['number'] if False else _decimal(in_full[live_id]['prices'][str(r['runner_id'])][0][1]))
    return {
        'user': user, 'live': live, 'replay': made[replay_id],
        'runner': runner_of[favourite['runner_id']],
        'races': {race.pk: race_id for race_id, race in made.items()},
    }


def _decimal(price):
    found = re.match(r'(\d+)/(\d+)$', price)
    return int(found.group(1)) / int(found.group(2)) + 1 if found else 2.0


def stand_in_receipts():
    """The track record under each conviction figure comes from ninety
    days of settled picks, which this database does not have. Every
    kind of race gets a made-up one, the same on every build."""
    from fox_signals.services import calibration

    def receipts(product, buckets, window_days=90):
        out = {}
        for bucket in buckets:
            n = stable('receipt', *bucket)
            sample = 180 + n % 1100
            rate = 0.11 + (n // 7 % 19) / 100.0
            out[bucket] = calibration.Receipt(
                product=product, class_bucket=bucket[0], going_bucket=bucket[1], field_bucket=bucket[2],
                window_days=window_days, sample_size=sample, wins=round(sample * rate),
                places=round(sample * rate * 2.1), hit_rate=rate, place_rate=min(rate * 2.1, 0.9),
                avg_finish_position=4.2, trust_level=calibration._trust_for(sample, rate),
                signature=hashlib.sha256(repr(bucket).encode()).hexdigest(), as_of=datetime.date.today())
        return out

    calibration.receipts_for_buckets = receipts


# ── The pages ──────────────────────────────────────────────────────

def between_main(html):
    """(before, inside, after) the page's <main>, the footer after it."""
    start = html.index('>', html.index(MAIN_OPEN)) + 1
    end = html.rindex('</main>', start, html.index('<footer', start))
    return html[:start], html[start:end], html[end:]


def swap(text, old, new):
    if text.count(old) != 1:
        sys.exit('Expected exactly one %r in meeting.html\'s shell, found %d.' % (old, text.count(old)))
    return text.replace(old, new)


def page(client, path, name, title, where):
    """Fetch one Django page and write it as this sandbox's file."""
    response = client.get(path)
    if response.status_code != 200:
        sys.exit('The site answered %s for %s (%s)' % (response.status_code, path, name))
    html = response.content.decode('utf-8')
    their_head, body, _ = between_main(html)

    # Which of the Fox Signals scripts this page loads, in its order.
    scripts = re.findall(r'<script[^>]*src="/static/(fox_signals/js/[^"?]+)[^"]*"', html)
    pin = re.search(r'<meta name="fx-toggle-pin-url"[^>]*>', their_head)

    def link(match):
        url = match.group(1)
        query = ''
        if '?' in url:
            url, query = url.split('?', 1)
            query = '?' + query
        for pattern, target in where:
            if re.fullmatch(pattern, url):
                # A link to a page that has no copy here keeps its place
                # on the live site.
                return 'href="%s%s"' % (target, query if target.endswith('.html') else '')
        if url.startswith('/fox-signals/'):
            sys.exit('%s links to %s, which has no place in the sandbox: add it to where_for.' % (name, url))
        return 'href="%s%s%s"' % (SITE, url, query)

    body = re.sub(r'(href|src)="/static/', r'\1="static/', body)
    body = re.sub(r'(static/[^"?]+)\?v=[^"]+', r'\1', body)
    body = re.sub(r'<option value="(/fox-signals/board/[^"]*)"', lambda m: '<option value="fox-board.html%s"' % (
        '?' + m.group(1).split('?', 1)[1] if '?' in m.group(1) else ''), body)
    body = re.sub(r'href="(/[^"]*)"', link, body)
    body = re.sub(r'<script[^>]*src="static/fox_signals/js/[^"]+"[^>]*></script>\s*', '', body)
    body = '\n'.join(line.rstrip() for line in body.splitlines())
    body = re.sub(r'\n{3,}', '\n\n', body)

    shell = io.open(os.path.join(BOX, 'meeting.html'), encoding='utf-8', newline='').read().replace('\r\n', '\n')
    head, _, tail = between_main(shell)
    head = re.sub(r'<title>.*?</title>', '<title>%s | Saturday Racing</title>' % title, head, count=1, flags=re.S)
    # A race's address carries this database's id, not the live site's.
    canonical = re.sub(r'/race/\d+/.*', '/race-trace/', path.split('?')[0])
    head = re.sub(r'(<link rel="canonical"\s+href=")[^"]*"', r'\1%s%s"' % (SITE, canonical), head, count=1)
    head = re.sub(r'\s*<script type="application/ld\+json">.*?</script>', '', head, flags=re.S)
    head = swap(head, '<body class="page-meeting-full">', '<body class="page-meeting-full page-fox-signals">')
    sheet = '<link rel="stylesheet" href="static/meeting/css/meeting.css">'
    head = swap(head, sheet, sheet
                + '\n<link rel="stylesheet" href="static/fox_signals/css/fox_signals_shell.css">'
                + '\n<link rel="stylesheet" href="static/fox_signals/css/fox_signals_v2.css">'
                + ('\n' + pin.group(0).replace('/fox-signals/api/stable/toggle/', '/fox-signals/api/stable/toggle/') if pin else ''))
    tail, removed = MEETING_SCRIPT.subn('', tail)
    if not removed:
        sys.exit('meeting.html loads none of the meeting page\'s scripts: has its shell changed?')
    last = '<script src="static/js/site.js" defer></script>'
    ours = ''.join('\n  <script src="static/%s" defer></script>' % script for script in dict.fromkeys(scripts))
    tail = swap(tail, last, last + ours)

    out = head + '\n' + body.strip('\n') + '\n\n  ' + tail
    io.open(os.path.join(BOX, name), 'w', encoding='utf-8', newline='\n').write(out)
    return '%s (%d KB)' % (name, len(out.encode('utf-8')) // 1024)


def main():
    args = parse_args()
    for path in [args.django] + args.pythonpath:
        sys.path.insert(0, os.path.abspath(path))
    os.chdir(args.django)
    os.environ['DJANGO_SETTINGS_MODULE'] = args.settings

    import django
    django.setup()
    from django.core.cache import cache
    from django.db import transaction
    from django.test import Client, override_settings
    from django.utils import timezone

    day = json.load(io.open(FIXTURE, encoding='utf-8'))
    hours, minutes = (int(x) for x in day['clock'].split(':'))
    now = datetime.datetime.combine(
        timezone.localdate(), datetime.time(hours, minutes), tzinfo=timezone.get_current_timezone())

    if not args.no_assets:
        for asset in ASSETS:
            target = os.path.join(BOX, 'static', 'fox_signals', asset)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            shutil.copyfile(os.path.join(args.django, 'fox_signals', 'static', 'fox_signals', asset), target)

    stand_in_receipts()
    cache.clear()
    built = []
    with mock.patch('django.utils.timezone.now', return_value=now), \
            override_settings(FOX_SIGNALS_DESIGN='v2', ALLOWED_HOSTS=['*']), \
            transaction.atomic():
        made = load_day(day, now)
        live, replay, runner = made['live'], made['replay'], made['runner']

        # Where a link on a page goes in this sandbox. A member's pages
        # link to the member's copies and a visitor's to the visitor's.
        # Only two races have a copy, so every other race opens the live
        # one: a press on any row of the Board lands on a race page.
        def where_for(board, race):
            return [
                (r'/fox-signals/board/', board),
                (r'/fox-signals/stable/', 'fox-stable.html'),
                (r'/fox-signals/race-trace/', 'fox-race-trace.html'),
                (r'/fox-signals/alerts/', 'fox-alerts.html'),
                (r'/fox-signals/settings/', 'fox-settings.html'),
                (r'/fox-signals/race/%d/' % replay.pk, 'fox-race-replay.html'),
                (r'/fox-signals/race/\d+/', race),
                (r'/fox-signals/race/\d+/runner/\d+/', 'fox-runner.html'),
                # The public racecard's address carries this database's
                # race id, which is not the live site's.
                (r'/races/\d+/', SITE + '/races/'),
            ]

        member = Client()
        member.force_login(made['user'])
        visitor = Client()
        as_member = where_for('fox-board-member.html', 'fox-race.html')
        as_visitor = where_for('fox-board.html', 'fox-race-visitor.html')
        said = '%s %s' % (live.course, live.race_time.strftime('%H:%M'))
        for client, path, name, title in [
            (visitor, '/fox-signals/board/', 'fox-board.html', 'The Board · Fox Signals'),
            (member, '/fox-signals/board/', 'fox-board-member.html', 'The Board · Fox Signals (member)'),
            (visitor, '/fox-signals/race-trace/', 'fox-race-trace.html', 'Race Trace · Fox Signals'),
            (member, '/fox-signals/race/%d/' % live.pk, 'fox-race.html', '%s · Race Trace' % said),
            (visitor, '/fox-signals/race/%d/' % live.pk, 'fox-race-visitor.html', '%s · Race Trace (visitor)' % said),
            (member, '/fox-signals/race/%d/' % replay.pk, 'fox-race-replay.html', '%s %s · Race Trace (replay)' % (replay.course, replay.race_time.strftime('%H:%M'))),
            (member, '/fox-signals/race/%d/runner/%d/' % (live.pk, runner.pk), 'fox-runner.html', '%s · %s' % (runner.horse_name, said)),
            (member, '/fox-signals/alerts/', 'fox-alerts.html', 'Alerts · Fox Signals'),
            (member, '/fox-signals/stable/', 'fox-stable.html', 'The Stable · Fox Signals'),
            (member, '/fox-signals/settings/', 'fox-settings.html', 'Settings · Fox Signals'),
        ]:
            built.append(page(client, path, name, title, as_member if client is member else as_visitor))

        # Each race page asks for its race's refresh once a minute:
        # tools/serve.mjs answers from this file, by the race's id.
        feeds = {}
        for race in (live, replay):
            feed = member.get('/fox-signals/race/%d/live.json' % race.pk)
            if feed.status_code != 200:
                sys.exit('The site answered %s for live.json of race %d' % (feed.status_code, race.pk))
            text = re.sub(r'/fox-signals/race/\d+/runner/\d+/', 'fox-runner.html', feed.content.decode('utf-8'))
            feeds[str(race.pk)] = json.loads(text)
        with io.open(os.path.join(BOX, 'fixtures', 'fox-race-live.json'), 'w', encoding='utf-8', newline='\n') as handle:
            json.dump(feeds, handle, ensure_ascii=False)
            handle.write('\n')

        transaction.set_rollback(True)

    cache.clear()
    print('Built at %s on the recorded day (%s):' % (day['clock'], day['day']))
    for line in built:
        print('  ' + line)
    print('  fixtures/fox-race-live.json')
    if not args.no_assets:
        print('Copied %d stylesheets and scripts into static/fox_signals/.' % len(ASSETS))


if __name__ == '__main__':
    main()
