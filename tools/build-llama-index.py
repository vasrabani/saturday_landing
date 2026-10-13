"""Build llama-index.html: the Django site's /llama-index/ for one day,
in this sandbox's copy of the site's shell.

The LLaMa Index is built in the Django site, not designed here. This
page is a copy kept so the tests here cover every page that shares
meeting.css and the slip's scripts. Run this after the page's markup
changes there (and copy llama_index.css, llama_index.js and
meeting_form.js across, byte for byte):

    <django-venv>/python tools/build-llama-index.py \\
        --django C:/path/to/saturday --settings saturday.settings_dev \\
        --date 2026-10-12 [--stand-in-signals] [--pythonpath DIR]

It needs the Django project and a database with that day's runners, so
it runs with the project's own Python, not node. It reads the page as a
visitor would (no account), with LLAMA_INDEX_LIVE on for the request.

--stand-in-signals gives every fourth runner one to four signals. A
development database has runners but no tips; without this the copy has
no signal chips, and the filters that count them have nothing to count.
The stand-ins are made here and nowhere else: nothing is written to the
database.

What is rewritten on the way in, as for the other pages here:
  - the shell (head, navigation, footer) is meeting.html's, so the page
    wears this sandbox's copy of the site chrome;
  - /static/... becomes static/..., and ?v= is dropped;
  - links into the site become https://www.saturday-racing.com/...;
  - silks, which the live page loads from the racing data provider, are
    borrowed from static/meeting/img/silks/ (the tests run offline).
"""
import argparse
import io
import os
import re
import sys

BOX = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://www.saturday-racing.com'
MAIN_OPEN = '<main id="main-content"'
STAND_IN_SOURCES = ['top_rated', 'steamer', 'htw', 'bod', 'letters', 'featured']
# Scripts of the meeting page the index does not load.
NOT_THE_INDEXS = (
    'static/races/js/racecard.js', 'static/races/js/racecard_collapse.js', 'static/races/js/meeting_full.js',
    'static/meeting/js/meeting_racecard.js', 'static/meeting/js/meeting_masthead.js',
)


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--django', required=True, help='the Django project directory (where manage.py is)')
    parser.add_argument('--settings', required=True, help='its settings module, e.g. saturday.settings_dev')
    parser.add_argument('--date', required=True, help='the day to copy, YYYY-MM-DD')
    parser.add_argument('--pythonpath', action='append', default=[], help='a directory to add to sys.path (for a settings module kept outside the project)')
    parser.add_argument('--stand-in-signals', action='store_true', help='give every fourth runner signals (a database with no tips)')
    return parser.parse_args()


def stand_in_signals():
    """Wrap the Trail's adapters so every fourth runner of a day has
    one to four signals. In memory only."""
    from grid.services import source_adapters
    from grid.services.consolidator import SourcePick

    real = source_adapters.picks_by_race_for_day

    def with_stand_ins(day):
        from races.models import Runner
        by_race, health = real(day)
        runners = Runner.objects.filter(race__race_date=day).exclude(status='non_runner').order_by('id')
        for i, runner in enumerate(runners):
            if i % 4:
                continue
            for k in range(1 + (i // 4) % 4):
                by_race.setdefault(runner.race_id, []).append(SourcePick(
                    source=STAND_IN_SOURCES[(i // 4 + k) % len(STAND_IN_SOURCES)],
                    horse_name=runner.horse_name, flagship=(k == 0 and i % 32 == 0)))
        return by_race, health

    source_adapters.picks_by_race_for_day = with_stand_ins


def the_page(day):
    from django.core.cache import cache
    from django.test import Client, override_settings

    cache.clear()
    with override_settings(LLAMA_INDEX_LIVE=True, ALLOWED_HOSTS=['*'], LLAMA_INDEX_CACHE_SECONDS=0):
        response = Client().get('/llama-index/', {'date': day})
    if response.status_code != 200:
        sys.exit('The site answered %s for /llama-index/?date=%s' % (response.status_code, day))
    return response.content.decode('utf-8')


def between_main(html):
    """(before, inside, after) the page's <main>, the footer after it."""
    start = html.index('>', html.index(MAIN_OPEN)) + 1
    end = html.rindex('</main>', start, html.index('<footer', start))
    return html[:start], html[start:end], html[end:]


def main():
    args = parse_args()
    for path in [args.django] + args.pythonpath:
        sys.path.insert(0, os.path.abspath(path))
    os.chdir(args.django)
    os.environ['DJANGO_SETTINGS_MODULE'] = args.settings

    import django
    django.setup()
    if args.stand_in_signals:
        stand_in_signals()

    _, body, _ = between_main(the_page(args.date))
    rows = body.count('class="racecard__runner li-row')
    if not rows:
        sys.exit('No runners on %s in that database: nothing to copy.' % args.date)

    silks = sorted(os.listdir(os.path.join(BOX, 'static', 'meeting', 'img', 'silks')))
    seen = [0]

    def borrowed_silk(_match):
        seen[0] += 1
        return 'src="static/meeting/img/silks/%s"' % silks[(seen[0] * 7) % len(silks)]

    body = re.sub(r'(<img class="racecard__silk[^>]*?)src="https?://[^"]*"', lambda m: m.group(1) + borrowed_silk(m), body, flags=re.S)
    body = re.sub(r'(href|src)="/static/', r'\1="static/', body)
    body = re.sub(r'(static/[^"?]+)\?v=[^"]+', r'\1', body)
    body = re.sub(r'href="/', 'href="%s/' % SITE, body)
    body = '\n'.join(line.rstrip() for line in body.splitlines())
    body = re.sub(r'\n{3,}', '\n\n', body)

    shell = io.open(os.path.join(BOX, 'meeting.html'), encoding='utf-8', newline='').read().replace('\r\n', '\n')
    head, _, tail = between_main(shell)

    import datetime
    day = datetime.date.fromisoformat(args.date)
    title = 'The LLaMa Index — every horse, A to Z, %s | Saturday Racing' % day.strftime('%A %d %B').replace(' 0', ' ')
    head = re.sub(r'<title>.*?</title>', '<title>%s</title>' % title, head, count=1, flags=re.S)
    head = re.sub(r'(<link rel="canonical"\s+href=")[^"]*"', r'\1%s/llama-index/"' % SITE, head, count=1)
    head = re.sub(r'\s*<script type="application/ld\+json">.*?</script>', '', head, flags=re.S)
    head = swap(head, '<body class="page-meeting-full">', '<body class="page-meeting-full page-llama-index">')
    sheet = '<link rel="stylesheet" href="static/meeting/css/meeting.css">'
    head = swap(head, sheet, sheet + '\n<link rel="stylesheet" href="static/llama/css/llama_index.css">')

    for script in NOT_THE_INDEXS:
        tail, found = re.subn(r'[ \t]*<script src="%s"[^>]*></script>\n' % re.escape(script), '', tail)
        if found != 1:
            sys.exit('meeting.html no longer loads %s: update NOT_THE_INDEXS.' % script)
    last = '<script src="static/meeting/js/meeting_slip.js" defer></script>'
    tail = swap(tail, last, last + '\n  <script src="static/llama/js/llama_index.js" defer></script>')
    if 'static/meeting/js/meeting_form.js' not in tail:
        sys.exit('meeting.html does not load meeting_form.js, which the index needs before llama_index.js.')

    out = head + '\n' + body.strip('\n') + '\n\n  ' + tail
    io.open(os.path.join(BOX, 'llama-index.html'), 'w', encoding='utf-8', newline='\n').write(out)
    print('llama-index.html: %d horses, %d silks borrowed, %d KB' % (rows, seen[0], len(out.encode('utf-8')) // 1024))


def swap(text, old, new):
    if text.count(old) != 1:
        sys.exit('Expected exactly one %r in meeting.html\'s shell, found %d.' % (old, text.count(old)))
    return text.replace(old, new)


if __name__ == '__main__':
    main()
