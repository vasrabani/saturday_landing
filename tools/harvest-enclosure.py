"""Record a corporate race day's card from the live site into
fixtures/enclosure-day.json.

The Enclosure pages here (enclosure/**) are built by
tools/build-enclosure.py from the Django site, and a development
database has no runners for a recent meeting. This records one real
card from a public showcase event: every race, every runner with
jockey, trainer, form, ratings, silks and price, the finishing order,
the winner's starting price, and LLaMa's predicted 1-2-3-4 where a
Letter was published.

    python tools/harvest-enclosure.py [--event jdl-consultants-bath-day]

It reads public pages only (no account), with the standard library.
The guests, their picks, notes, photos and the host's briefings are
not recorded: those belong to real people. The build tool makes up a
room of its own for them.

This reads the live site's markup, so it breaks when that markup
changes. It is run rarely, by Vas, to refresh the recording; the
developer does not need it.
"""
import argparse
import html
import json
import os
import re
import urllib.request

BOX = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://www.saturday-racing.com'
OUT = os.path.join(BOX, 'fixtures', 'enclosure-day.json')


def fetch(path):
    request = urllib.request.Request(SITE + path, headers={'User-Agent': 'saturday-landing-harvest'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode('utf-8')


def text(fragment):
    """The visible text of a piece of markup, whitespace folded."""
    fragment = re.sub(r'<[^>]+>', ' ', fragment or '')
    return re.sub(r'\s+', ' ', html.unescape(fragment)).strip()


def first(pattern, source, default=''):
    found = re.search(pattern, source, re.S)
    return found.group(1) if found else default


def parse_runner(tile):
    name_block = first(r'class="enc-runner__name">(.*?)</span>\s*<span class="enc-runner__people"', tile)
    gear = first(r'class="enc-runner__gear"[^>]*>(.*?)</span>', name_block)
    name = text(re.sub(r'<span class="enc-runner__(?:gear|fav)".*?</span>', '', name_block, flags=re.S))
    people = text(first(r'class="enc-runner__people">(.*?)</span>', tile))
    jockey, _, trainer = people.partition(' · ')
    stats = text(first(r'class="enc-runner__stats">(.*?)</span>', tile))
    fin = text(first(r'class="enc-runner__fin-chip enc-runner__fin-chip--(?:gold|silver|bronze|rest)">(.*?)</span>', tile))
    dnf = text(first(r'class="enc-runner__fin-chip enc-runner__fin-chip--dnf">(.*?)</span>', tile))
    return {
        'number': int(first(r'data-runner-number="(\d+)"', tile, '0')),
        'horse_name': html.unescape(first(r'data-horse-name="([^"]*)"', tile)) or name,
        'headgear': text(gear),
        'is_favourite': 'enc-runner__fav' in tile,
        'jockey': jockey,
        'trainer': trainer,
        'form': first(r'Form (\S+)', stats),
        'or_rating': int(first(r'OR (\d+)', stats, '0')) or None,
        'sr_rating': int(first(r'SR (\d+)', stats, '0')) or None,
        'silk_url': html.unescape(first(r'<img src="([^"]+)"', tile)),
        'odds': text(first(r'class="enc-runner__price">(.*?)</span>', tile)),
        'is_nr': 'enc-runner__nr-chip' in tile,
        'finish_position': int(first(r'(\d+)', fin, '0')) or None,
        'finish_status': dnf,
    }


def parse_letter(page):
    panel = first(r'(<section class="enc-cd-letter.*?</section>)', page)
    if not panel:
        return None
    slots = []
    for slot in re.findall(r'<li class="enc-cd-letter__slot.*?</li>', panel, re.S):
        slots.append({
            'position': int(first(r'enc-cd-letter__slot--pos-(\d+)', slot, '0')),
            'horse_name': text(first(r'class="enc-cd-letter__horse">(.*?)</p>', slot)),
            'odds_seen': text(first(r'class="enc-cd-letter__price">(.*?)</span>', slot)),
            'reasoning': text(first(r'class="enc-cd-letter__slot-note">(.*?)</p>', slot)),
        })
    return {
        'confidence': first(r'enc-cd-letter--(high|medium|speculative)', panel, 'medium'),
        'verdict': text(first(r'class="enc-cd-letter__verdict">(.*?)</p>', panel)),
        'predicted_finish': slots,
    }


def parse_race(race_id, page):
    head = first(r'(<section class="enc-cd-head".*?</section>)', page)
    meta = [part.strip() for part in text(first(r'class="enc-cd-head__meta">(.*?)</p>', head)).split('·')]
    course, clock = meta[0], meta[1]
    rest = meta[2:]
    going = next((p for p in rest if re.search(r'Good|Firm|Soft|Heavy|Standard|Yielding', p)), '')
    race_class = next((p for p in rest if p.startswith('Class')), '')
    distance = next((p for p in rest if p not in (going, race_class)), '')
    prize = text(first(r'Prize</span>\s*<span class="enc-cd-chip__value">(.*?)</span>', head))
    tiles = re.findall(r'<button type="button"\s+class="enc-runner.*?</button>', page, re.S)
    return {
        'race_id': race_id,
        'course': course,
        'time': clock,
        'name': text(first(r'class="enc-cd-head__title">(.*?)</h1>', head)),
        'distance': distance,
        'going': going,
        'race_class': race_class,
        'prize_money': prize,
        'runners': [parse_runner(tile) for tile in tiles],
        'letter': parse_letter(page),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--event', default='jdl-consultants-bath-day', help='a showcase event slug on the live site')
    args = parser.parse_args()
    base = f'/enclosure/{args.event}/'

    home = fetch(base)
    course_date = text(first(r'class="enc-top__meta">(.*?)</div>', home))
    card = fetch(base + 'card/')
    race_ids = []
    for found in re.findall(rf'href="{re.escape(base)}card/(\d+)/"', card):
        if int(found) not in race_ids:
            race_ids.append(int(found))
    races = [parse_race(race_id, fetch(f'{base}card/{race_id}/')) for race_id in race_ids]

    # The winner's starting price is on the Feed's result lines:
    # "18:07 Bath · Jeewan (A) at 7/4".
    feed = fetch(base + 'feed/?filter=racing')
    sp = {}
    for clock, horse, price in re.findall(r'(\d{1,2}:\d{2}) [^·<]+ · ([^<]+?) at ([0-9/]+[A-Z]*)\s*<', feed):
        sp[clock] = {'winner': html.unescape(horse).strip(), 'sp': price}
    for race in races:
        race['result'] = sp.get(race['time'])

    day = {
        'source': SITE + base,
        'recorded_from': course_date,
        'races': races,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8', newline='\n') as handle:
        json.dump(day, handle, indent=1, ensure_ascii=False)
        handle.write('\n')
    print(f'{len(races)} races, {sum(len(r["runners"]) for r in races)} runners -> {os.path.relpath(OUT, BOX)}')


if __name__ == '__main__':
    main()
