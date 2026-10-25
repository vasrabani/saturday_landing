"""Build the Enclosure pages (enclosure/**) from the Django site, and
copy its stylesheets, scripts and icons across.

The Enclosure is the phone app a corporate client's guests use on
their race day: the card, their picks in the Corporate Cup, the feed
of results, notes and photos, and the host's Steward's Room. It is
built in the Django site, not designed here. These pages are copies
for design work: the markup the Django templates produce, under the
same stylesheets and scripts, byte for byte. Run this after the
templates change there, or to refresh the copies:

    <django-venv>/python tools/build-enclosure.py \\
        --django C:/path/to/saturday --settings saturday.settings_dev \\
        [--pythonpath DIR] [--no-assets]

It needs the Django project and any database with its migrations run,
so it runs with the project's own Python, not node. Point it at a
copy of the development database if you would rather it never opened
the real one: nothing is written either way.

Where the day comes from. The card is fixtures/enclosure-day.json, a
real day at Bath recorded from the live site's public showcase event
(tools/harvest-enclosure.py): nine races, every runner, the result and
LLaMa's read on each race. The room is made up here, the same way on
every build, and is not real: the client (Hartwell & Penn), the host,
eleven guests, their picks and stakes, their notes and photos (drawn
stand-ins), and the host's briefings. All of it is loaded inside a
transaction that is rolled back at the end, with the clock stopped at
each scenario's time on the recorded day.

The scenarios, one folder each under enclosure/:
    morning/    12:40, a guest before the first race: picks in, nothing off
    race-day/   16:20, a guest mid-card: five races settled, the 16:35 next
    day-done/   19:05, a guest after the last race: awards, the day closed
    steward/    16:20, the host: the Steward's Room in place of Home
    visitor/    19:05, a visitor with no invitation on a public showcase
                day (what the live JDL Consultants page shows), and the
                sign-in page

The Django templates are copied to docs/enclosure-templates/ to be
read (they show the states no scenario reaches); nothing uses them.

What is rewritten on the way in:
  - /static/enclosure/... becomes ../../static/enclosure/..., ?v= dropped;
  - links between the Enclosure's pages become links between these
    files (the Card's race N is race-N.html, the Feed's filters are
    feed-racing.html and so on); every other link into the site becomes
    https://www.saturday-racing.com/...;
  - each page's poll (live.json) is saved beside it as <page>.live.json,
    and each thing a guest can send (a pick, a note, a photo, a host's
    briefing) has its recorded answer saved as a .json file the form
    or script posts to, so the page behaves as it does on the day;
  - photos are copied to enclosure/media/.
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
import tempfile
from unittest import mock

BOX = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://www.saturday-racing.com'
OUT = os.path.join(BOX, 'enclosure')
FIXTURE = os.path.join(BOX, 'fixtures', 'enclosure-day.json')
SLUG = 'hartwell-penn-bath-day'

# Django's copy of each asset folder, and this sandbox's. Kept byte for byte.
ASSET_DIRS = ['css', 'js', 'icons']

SCENARIOS = [
    # folder, clock, who is looking, event state, visibility
    ('morning', '12:40', 'guest', 'live', 'private'),
    ('race-day', '16:20', 'guest', 'live', 'private'),
    ('day-done', '19:05', 'guest', 'closed', 'private'),
    ('steward', '16:20', 'host', 'live', 'private'),
    ('visitor', '19:05', 'visitor', 'closed', 'showcase'),
]

# The room. Made up, and kept the same on every build.
HOST = ('Ruth Calder', 'ruth.calder@hartwellpenn.example')
VIEWER = ('Priya Shah', 'priya.shah@hartwellpenn.example')
GUESTS = [
    VIEWER,
    ('Tom Ellery', 'tom.ellery@hartwellpenn.example'),
    ('Grace Okafor', 'grace.okafor@hartwellpenn.example'),
    ('Daniel Reyes', 'daniel.reyes@northgate.example'),
    ('Hannah Brook', 'hannah.brook@hartwellpenn.example'),
    ('Sam Whitlock', 'sam.whitlock@northgate.example'),
    ('Olivia Marsh', 'olivia.marsh@hartwellpenn.example'),
    ('Marcus Lindqvist', 'marcus.lindqvist@aldenbank.example'),
    ('Chloe Banner', 'chloe.banner@hartwellpenn.example'),
    ('Ben Adeyemi', 'ben.adeyemi@aldenbank.example'),
    # Declined to be named: shows as "Anonymous guest" on the Standings.
    ('James Kerr', 'james.kerr@aldenbank.example'),
]
ANONYMOUS = 'james.kerr@aldenbank.example'

# The viewer's own day, so her pages tell a story: a winner in the
# first, a loser or two, a short-priced banker, one live at 16:20 and
# the last races still open to pick. Race number → (horse, stake).
VIEWER_PICKS = {
    1: ('Oman', 50),
    2: ('Cosmo Brown', 40),
    4: ('Divide And Conquer', 100),
    5: ('South Shore', 30),
    6: ('Past Passion', 40),
    7: ('Distant Rumble', 60),
}
# A guest who backs the winner, race by race, so the Feed has some
# celebrating to do. Race number → guest index.
WINNER_BACKERS = {1: 3, 2: 2, 3: 7, 4: 1, 5: 5, 6: 6, 7: 8, 8: 4}

NOTES = [
    # clock, guest index, race number to attach (or None), text
    ('12:05', 1, None, 'Table 4 has the best view of the finish. Just saying.'),
    ('12:32', 4, 1, 'Going with the apprentice race on gut feel. Wish me luck.'),
    ('14:10', 3, 1, 'Oman! Told you all at lunch.'),
    ('14:41', 6, 2, 'That was close for a mile and a half. My horse needed another furlong.'),
    ('15:40', 2, 4, 'Divide And Conquer at 1/4 is not a bet, it is a savings account.'),
    ('16:11', 5, 5, 'FORAGER AT 18/1. I will be insufferable for the rest of the day.'),
    ('17:15', 8, 7, 'Silver Wraith for the second time this season. Same jockey too.'),
    ('18:15', 0, 9, 'Thank you Ruth and everyone. Best day out this year.'),
]
PHOTOS = [
    # clock, guest index, race number, caption, palette
    ('13:20', 2, 1, 'Parade ring before the first', 'paddock'),
    ('15:05', 7, 3, 'Chilly Breeze coming back in', 'finish'),
    ('16:14', 5, 5, 'Proof I backed Forager', 'ticket'),
    ('17:44', 9, 8, 'The view from the box', 'stand'),
]
BRIEFINGS = [
    # clock, headline, body
    ('11:45', 'Welcome to Bath', 'Lunch is in the Lansdown Suite from 12:30. The first race is off at 14:02, so get your picks in before then.'),
    ('15:45', 'Tea and the big race', 'Afternoon tea is served at 16:00. The 16:02 sprint is the race to watch: five furlongs, twelve runners.'),
    ('18:30', 'Prize-giving at the bar', 'The Corporate Champion and the Wooden Spoon will be presented at 18:45. Thank you all for coming.'),
]


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--django', required=True, help='the Django project directory (where manage.py is)')
    parser.add_argument('--settings', required=True, help='its settings module, e.g. saturday.settings_dev')
    parser.add_argument('--pythonpath', action='append', default=[], help='a directory to add to sys.path (for a settings module kept outside the project)')
    parser.add_argument('--no-assets', action='store_true', help='do not copy the stylesheets, scripts and icons across')
    return parser.parse_args()


def stable(*parts):
    """A number that is the same on every build for the same parts."""
    return int(hashlib.sha256('|'.join(str(p) for p in parts).encode()).hexdigest()[:8], 16)


def clock_on(day, clock):
    from django.utils import timezone
    hours, minutes = (int(x) for x in clock.split(':'))
    return datetime.datetime.combine(day, datetime.time(hours, minutes), tzinfo=timezone.get_current_timezone())


class Clock:
    """Stops timezone.now() at a moment, and moves it on as the day is
    replayed. Every service reads the time through timezone.now()."""

    def __init__(self, moment):
        self.moment = moment
        self.patch = mock.patch('django.utils.timezone.now', lambda: self.moment)

    def __enter__(self):
        self.patch.start()
        return self

    def __exit__(self, *exc):
        self.patch.stop()


# ── Stand-in photos ────────────────────────────────────────────────

def stand_in_photo(palette, caption):
    """A drawn picture the size of a phone photo, plainly not a real
    one, so the Feed and the lightbox have something to lay out."""
    from PIL import Image, ImageDraw
    portrait = palette in ('ticket',)
    width, height = (900, 1200) if portrait else (1200, 900)
    skies = {'paddock': ('#C9D8E4', '#EEF1EC'), 'finish': ('#AFC6DA', '#E7EEF2'),
             'ticket': ('#E9DFC8', '#F6F0E2'), 'stand': ('#F2C9A0', '#F7E7D3')}
    top, bottom = skies[palette]
    image = Image.new('RGB', (width, height), top)
    draw = ImageDraw.Draw(image)
    t = tuple(int(top[i:i + 2], 16) for i in (1, 3, 5))
    b = tuple(int(bottom[i:i + 2], 16) for i in (1, 3, 5))
    horizon = int(height * 0.55)
    for y in range(horizon):
        mix = y / horizon
        draw.line([(0, y), (width, y)], fill=tuple(int(t[i] + (b[i] - t[i]) * mix) for i in range(3)))
    draw.rectangle([0, horizon, width, height], fill='#6F8F5A')
    draw.rectangle([0, horizon + 40, width, horizon + 52], fill='#F7F4EC')
    for x in range(0, width, 90):
        draw.rectangle([x, horizon + 20, x + 8, horizon + 52], fill='#F7F4EC')
    if palette == 'ticket':
        draw.rounded_rectangle([140, 300, width - 140, 860], radius=24, fill='#FFFDF6', outline='#B08D57', width=6)
        draw.text((190, 360), 'FORAGER  18/1', fill='#2F3B2C')
        draw.text((190, 420), 'Race 5 · 16:02 Bath', fill='#5D6658')
    draw.rectangle([0, height - 70, width, height], fill='#2F3B2C')
    draw.text((24, height - 50), f'Stand-in photo · {caption}', fill='#F4EFE2')
    buffer = io.BytesIO()
    image.save(buffer, 'JPEG', quality=82)
    return buffer.getvalue()


# ── The day, staged ────────────────────────────────────────────────

def stage(day_data, day, clock, state, visibility):
    """Put the recorded card and the made-up room into the database
    (inside the caller's transaction), replaying the day up to `clock`.
    Returns what the pages are addressed by."""
    from django.contrib.auth.models import User
    from django.core.files.uploadedfile import SimpleUploadedFile

    from corporate.models import Event, EventConsent, EventGuest, EventPick, Organisation
    from corporate.services.settlement import settle_event
    from corporate.services.timeline import emit_award_awarded, emit_closing
    from enclosure.services.notes import post_note
    from enclosure.services.photos import post_photo
    from enclosure.services.steward_briefings import post_briefing
    from letters.models import LetterCampaign, RaceLetter
    from races.models import Race, Runner

    stop = clock_on(day, clock)
    course = day_data['races'][0]['course']

    # Anything the database already has at this meeting would join the card.
    Race.objects.filter(race_date=day, course__iexact=course).update(race_date=day - datetime.timedelta(days=4000))
    LetterCampaign.objects.filter(race_date=day, course__iexact=course).delete()

    host_user = User.objects.create_user(username=HOST[1], email=HOST[1], password=None, first_name=HOST[0].split()[0])
    org = Organisation.objects.create(name='Hartwell & Penn')
    event = Event.objects.create(
        organisation=org, name='Hartwell & Penn at Bath', slug=SLUG,
        meeting_date=day, meeting_course=course, state=state, visibility=visibility,
        host_user=host_user)

    guests = []
    for name, email in GUESTS:
        user = User.objects.create_user(username=email, email=email, password=None, first_name=name.split()[0])
        guest = EventGuest.objects.create(
            event=event, user=user, email=email, display_name=name,
            role=EventGuest.Role.GUEST, rsvp_state=EventGuest.RSVP.ATTENDED,
            starting_credits=event.starting_credits)
        for scope in EventConsent.Scope.values:
            EventConsent.objects.create(guest=guest, scope=scope, granted=(email != ANONYMOUS), granted_at=stop if email != ANONYMOUS else None)
        guests.append(guest)

    campaign = LetterCampaign.objects.create(course=course, race_date=day, slug=f'{course.lower()}-{day.isoformat()}',
                                             title=f'Letters from {course}')
    races = []
    for number, recorded in enumerate(day_data['races'], start=1):
        hours, minutes = (int(x) for x in recorded['time'].split(':'))
        race = Race.objects.create(
            name=recorded['name'], course=recorded['course'], race_date=day,
            race_time=datetime.time(hours, minutes), distance=recorded['distance'],
            going=recorded['going'], race_class=recorded['race_class'], prize_money=recorded['prize_money'])
        for runner in recorded['runners']:
            # Age and weight are not on the Enclosure's pages, so they
            # were not recorded; the model needs something.
            Runner.objects.create(
                race=race, number=runner['number'], horse_name=runner['horse_name'],
                age=3 + stable('age', runner['horse_name']) % 5, weight='9-0',
                jockey=runner['jockey'], trainer=runner['trainer'], form=runner['form'],
                odds=runner['odds'], silk_url=runner['silk_url'], is_favourite=runner['is_favourite'],
                headgear=runner['headgear'], or_rating=runner['or_rating'], sr_rating=runner['sr_rating'],
                status=Runner.STATUS_NON_RUNNER if runner['is_nr'] else Runner.STATUS_DECS_48HRS)
        if recorded['letter']:
            RaceLetter.objects.create(
                campaign=campaign, race=race, letter_number=number,
                headline=f'Letter {number}: {recorded["name"]}'[:200],
                verdict=recorded['letter']['verdict'],
                predicted_finish=recorded['letter']['predicted_finish'],
                confidence=recorded['letter']['confidence'], is_published=True)
        races.append((number, race, recorded))

    # The day's beats, in the order they happened. Only those before
    # the clock are replayed.
    beats = []
    for at, headline, body in BRIEFINGS:
        beats.append((at, 'briefing', (headline, body)))
    for number, race, recorded in races:
        off = clock_on(day, recorded['time'])
        runners = [r for r in recorded['runners'] if not r['is_nr'] and r['odds']]
        for index, guest in enumerate(guests):
            planned = None
            if index == 0:
                planned = VIEWER_PICKS.get(number)
            elif WINNER_BACKERS.get(number) == index and recorded['result']:
                winner = recorded['result']['winner']
                planned = (next(r['horse_name'] for r in runners if winner.lower().startswith(r['horse_name'].lower())), 20 + stable(number, index) % 5 * 10)
            elif stable('picks', number, index) % 10 < 6:
                # Most guests back something near the top of the market.
                ranked = sorted(runners, key=lambda r: price(r['odds']))
                choice = ranked[stable('horse', number, index) % min(len(ranked), 5)]
                planned = (choice['horse_name'], 10 + stable('stake', number, index) % 9 * 10)
            if planned:
                # Early birds pick at lunch; the rest in the half hour before the off.
                lead = 130 + stable('early', number, index) % 60 if stable('when', index) % 3 == 0 else 5 + stable('lead', number, index) % 30
                beats.append(((off - datetime.timedelta(minutes=lead)).strftime('%H:%M'), 'pick', (guest, race, planned)))
        if recorded['result']:
            beats.append(((off + datetime.timedelta(minutes=8)).strftime('%H:%M'), 'result', (race, recorded)))
    for at, who, number, text in NOTES:
        beats.append((at, 'note', (guests[who], number, text)))
    for at, who, number, caption, palette in PHOTOS:
        beats.append((at, 'photo', (guests[who], number, caption, palette)))
    beats.append(('18:35', 'awards', None))
    beats.append(('18:40', 'closing', None))

    race_by_number = {number: race for number, race, _ in races}
    with Clock(stop) as now:
        for at, kind, payload in sorted(beats, key=lambda b: (b[0], b[1] != 'result')):
            moment = clock_on(day, at)
            if moment >= stop:
                continue
            now.moment = moment
            if kind == 'briefing':
                post_briefing(event, headline=payload[0], body=payload[1], client_nonce=f'brief-{at}')
            elif kind == 'pick':
                guest, race, (horse, stake) = payload
                runner = race.runners.get(horse_name=horse)
                EventPick.objects.update_or_create(
                    event=event, guest=guest, race=race,
                    defaults={'horse_name': horse, 'runner': runner, 'runner_number': runner.number,
                              'stake_credits': stake, 'odds_captured': runner.odds})
            elif kind == 'result':
                race, recorded = payload
                for runner in recorded['runners']:
                    if runner['finish_position']:
                        race.runners.filter(number=runner['number']).update(
                            finish_position=runner['finish_position'], finish_status=Runner.FINISH_STATUS_COMPLETED)
                race.result_winner = recorded['result']['winner']
                race.save(update_fields=['result_winner'])
                settle_event(event)
            elif kind == 'note':
                guest, number, text = payload
                post_note(event, guest, text=text, race_id=race_by_number[number].pk if number else None,
                          client_nonce=f'note-{at}')
            elif kind == 'photo':
                guest, number, caption, palette = payload
                upload = SimpleUploadedFile(f'{palette}.jpg', stand_in_photo(palette, caption), content_type='image/jpeg')
                post_photo(event, guest, upload=upload, caption=caption, race_id=race_by_number[number].pk,
                           client_nonce=f'photo-{at}', now=moment)
            elif kind == 'awards':
                for award in event.awards.all():
                    emit_award_awarded(event, award)
            elif kind == 'closing':
                emit_closing(event, headline='That is a wrap from Bath',
                             body='Thank you for joining Hartwell & Penn at the races. The Race Book follows by email.')
        now.moment = stop

    return {
        'event': event,
        'viewer': guests[0],
        'host_user': host_user,
        'guests': guests,
        'races': [(number, race) for number, race, _ in races],
    }


def price(odds):
    from corporate.services.settlement import parse_odds_to_decimal
    return parse_odds_to_decimal(odds) or 99.0


# ── The pages ──────────────────────────────────────────────────────

class Rewriter:
    """Turns the site's URLs into this folder's files."""

    def __init__(self, staged, folder):
        self.base = f'/enclosure/{SLUG}/'
        self.folder = folder
        self.race_file = {race.pk: f'race-{number}' for number, race in staged['races']}
        self.guest_file = {guest.pk: f'guest-{index + 1}' for index, guest in enumerate(staged['guests'])}
        self.media = set()

    def page_url(self, rest, query=''):
        """The file for a path under /enclosure/<slug>/, or None."""
        if rest == '':
            return 'index.html'
        if rest in ('card/', 'cup/', 'me/', 'steward/'):
            return rest[:-1] + '.html'
        if rest == 'feed/':
            found = re.match(r'\?filter=(\w+)', query or '')
            return 'feed.html' if not found or found.group(1) == 'all' else f'feed-{found.group(1)}.html'
        found = re.fullmatch(r'card/(\d+)/', rest)
        if found and int(found.group(1)) in self.race_file:
            return self.race_file[int(found.group(1))] + '.html'
        found = re.fullmatch(r'guest/(\d+)/', rest)
        if found and int(found.group(1)) in self.guest_file:
            return self.guest_file[int(found.group(1))] + '.html'
        if rest == 'signin/':
            return '../visitor/signin.html'
        if rest == 'signout/':
            return '../visitor/index.html'
        # What a guest sends, and what each page polls: recorded answers.
        endpoints = {'home/live.json': 'index.live.json', 'cup/live.json': 'cup.live.json',
                     'feed/live.json': 'feed.live.json', 'feed/note/': 'note.json',
                     'feed/photo/': 'photo.json', 'steward/briefing/': 'briefing.json',
                     'manifest.webmanifest': 'manifest.webmanifest'}
        if rest in endpoints:
            return endpoints[rest]
        found = re.fullmatch(r'card/(\d+)/(live\.json|pick/)', rest)
        if found and int(found.group(1)) in self.race_file:
            return self.race_file[int(found.group(1))] + ('.live.json' if found.group(2) == 'live.json' else '.pick.json')
        return None

    def __call__(self, markup, page=None):
        # Static assets: the sandbox's copies, no cache-busting query.
        markup = re.sub(r'/static/enclosure/([\w./-]+?)(?:\?v=\d+)?(?=["\'\s)])', r'../../static/enclosure/\1', markup)
        # A feed page polls for its own filter.
        if page and page.startswith('feed'):
            markup = markup.replace(f'"{self.base}feed/live.json"', f'"{page}.live.json"')

        def link(match):
            rest, query = match.group(2), match.group(3) or ''
            target = self.page_url(rest, query)
            if target is None:
                return match.group(1) + SITE + self.base + rest + query
            return match.group(1) + target
        markup = re.sub(r'(["\'])' + re.escape(self.base) + r'([\w./-]*)(\?[\w=&%-]*)?', link, markup)
        # The Feed's filter chips are relative: href="?filter=racing".
        markup = re.sub(r'href="\?filter=(\w+)"', lambda m: f'href="{"feed.html" if m.group(1) == "all" else "feed-" + m.group(1) + ".html"}"', markup)
        # Photos.
        def photo(match):
            self.media.add(match.group(1))
            return f'../media/{self.folder}-{os.path.basename(match.group(1))}'
        markup = re.sub(r'/media/([\w./-]+\.(?:jpe?g|png|webp))', photo, markup)
        # Every other link into the site goes to the live site.
        markup = re.sub(r'(href|action)="/(?!/)', rf'\1="{SITE}/', markup)
        # Per-render values, held still so a rebuild changes nothing.
        markup = re.sub(r'(name="csrfmiddlewaretoken" value=")[^"]+', r'\1sandbox', markup)
        return markup


def render(client, url, ok=(200,)):
    response = client.get(url, HTTP_ACCEPT='text/html')
    if response.status_code not in ok:
        raise SystemExit(f'{url} answered {response.status_code}')
    return response


def post_json(client, url, data, files=None):
    response = client.post(url, {**data, **(files or {})}, HTTP_ACCEPT='application/json')
    return response.status_code, json.loads(response.content)


def write(folder, name, content):
    path = os.path.join(OUT, folder, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write(content)


def write_json(folder, name, payload, rewrite):
    payload = {key: rewrite(value) if isinstance(value, str) else value for key, value in payload.items()}
    # Server timestamps would make every rebuild a change.
    payload.pop('ts', None)
    write(folder, name, json.dumps(payload, indent=1, ensure_ascii=False) + '\n')


def build_scenario(folder, clock, who, state, visibility, day_data, day):
    from django.db import transaction
    from django.test import Client
    from django.test.utils import override_settings
    from django.core.files.uploadedfile import SimpleUploadedFile

    class Rollback(Exception):
        pass

    shutil.rmtree(os.path.join(OUT, folder), ignore_errors=True)
    pages = []
    # A media folder of its own, so a photo keeps its plain name.
    media_root = tempfile.mkdtemp(prefix='enclosure-media-')
    try:
        with override_settings(MEDIA_ROOT=media_root), transaction.atomic():
            staged = stage(day_data, day, clock, state, visibility)
            rewrite = Rewriter(staged, folder)
            client = Client()
            if who == 'guest':
                client.force_login(staged['viewer'].user)
            elif who == 'host':
                client.force_login(staged['host_user'])
            base = f'/enclosure/{SLUG}/'

            with Clock(clock_on(day, clock)):
                targets = [('index.html', base), ('card.html', 'card/'), ('cup.html', 'cup/'), ('me.html', 'me/')]
                if who == 'host':
                    targets.append(('steward.html', 'steward/'))
                for key in ('all', 'racing', 'comments', 'photos'):
                    targets.append(('feed.html' if key == 'all' else f'feed-{key}.html', f'feed/?filter={key}'))
                for number, race in staged['races']:
                    targets.append((f'race-{number}.html', f'card/{race.pk}/'))
                for index, guest in enumerate(staged['guests']):
                    if guest.email != ANONYMOUS:
                        targets.append((f'guest-{index + 1}.html', f'guest/{guest.pk}/'))
                if who == 'visitor':
                    targets.append(('signin.html', 'signin/'))

                for name, path in targets:
                    url = path if path.startswith('/') else base + path
                    response = render(client, url)
                    write(folder, name, rewrite(response.content.decode('utf-8'), page=name[:-5]))
                    pages.append(name)

                # What each page polls.
                for name, path in [('index.live.json', 'home/live.json'), ('cup.live.json', 'cup/live.json')]:
                    write_json(folder, name, json.loads(render(client, base + path).content), rewrite)
                for key in ('all', 'racing', 'comments', 'photos'):
                    payload = json.loads(render(client, f'{base}feed/live.json?filter={key}').content)
                    write_json(folder, 'feed.live.json' if key == 'all' else f'feed-{key}.live.json', payload, rewrite)
                for number, race in staged['races']:
                    write_json(folder, f'race-{number}.live.json',
                               json.loads(render(client, f'{base}card/{race.pk}/live.json').content), rewrite)
                manifest = json.loads(render(client, base + 'manifest.webmanifest').content)
                manifest['start_url'] = 'index.html'
                manifest['scope'] = './'
                for icon in manifest['icons']:
                    icon['src'] = rewrite(f'"{icon["src"]}"').strip('"')
                write(folder, 'manifest.webmanifest', json.dumps(manifest, indent=1, ensure_ascii=False) + '\n')

                # What a guest sends: the answer to one of each, each
                # undone before the next.
                def recorded(name, url, data, files=None):
                    try:
                        with transaction.atomic():
                            _, payload = post_json(client, url, data, files)
                            write_json(folder, name, payload, rewrite)
                            raise Rollback
                    except Rollback:
                        pass

                # A pick on every race: the favourite for 50. A race that
                # is off, or a viewer who is not a guest, gets the
                # refusal the site gives.
                for number, race in staged['races']:
                    favourite = min(race.runners.exclude(odds=''), key=lambda r: price(r.odds))
                    recorded(f'race-{number}.pick.json', f'{base}card/{race.pk}/pick/',
                             {'horse_name': favourite.horse_name, 'stake_credits': '50'})
                # The host and a visitor are not guests: the site refuses
                # their notes and photos (403), and that refusal is what is
                # recorded. (So is a refused pick, above.)
                recorded('note.json', base + 'feed/note/', {'text': 'Who else is on the favourite in the next?', 'client_nonce': 'sandbox-note'})
                image = SimpleUploadedFile('sandbox.jpg', stand_in_photo('stand', 'Your photo here'), content_type='image/jpeg')
                recorded('photo.json', base + 'feed/photo/', {'caption': 'Your photo here', 'client_nonce': 'sandbox-photo'}, {'image': image})
                if who == 'host':
                    recorded('briefing.json', base + 'steward/briefing/', {'headline': 'Five minutes to the off', 'body': 'Head down to the rail for the finish.', 'client_nonce': 'sandbox-brief'})

            for path in rewrite.media:
                source = os.path.join(media_root, path)
                if os.path.exists(source):
                    os.makedirs(os.path.join(OUT, 'media'), exist_ok=True)
                    shutil.copyfile(source, os.path.join(OUT, 'media', f'{folder}-{os.path.basename(path)}'))
            raise Rollback
    except Rollback:
        pass
    finally:
        shutil.rmtree(media_root, ignore_errors=True)
    print(f'enclosure/{folder}/: {len(pages)} pages at {clock}, as the {who}')


def main():
    args = parse_args()
    for path in [args.django, *args.pythonpath]:
        sys.path.insert(0, os.path.abspath(path))
    os.environ['DJANGO_SETTINGS_MODULE'] = args.settings
    import django
    django.setup()
    from django.test.utils import override_settings

    with open(FIXTURE, encoding='utf-8') as handle:
        day_data = json.load(handle)
    # The recorded day: "Bath · 29 Sep" in the year it was recorded.
    day = datetime.date(2026, 9, 29)

    if not args.no_assets:
        for folder in ASSET_DIRS:
            source = os.path.join(args.django, 'enclosure', 'static', 'enclosure', folder)
            target = os.path.join(BOX, 'static', 'enclosure', folder)
            shutil.rmtree(target, ignore_errors=True)
            shutil.copytree(source, target)
        # The templates, to read: they show the states no scenario
        # reaches. Not used by any page here, and not copied back.
        target = os.path.join(BOX, 'docs', 'enclosure-templates')
        shutil.rmtree(target, ignore_errors=True)
        shutil.copytree(os.path.join(args.django, 'enclosure', 'templates', 'enclosure'), target)

    shutil.rmtree(os.path.join(OUT, 'media'), ignore_errors=True)
    with override_settings(ALLOWED_HOSTS=['testserver']):
        for scenario in SCENARIOS:
            build_scenario(*scenario, day_data, day)

    # The service worker: a no-op, as the site's is, registered with
    # the scope /enclosure/ by pwa.js.
    write('', 'sw.js', "self.addEventListener('install', (e) => self.skipWaiting());\n"
                       "self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));\n")


if __name__ == '__main__':
    main()
