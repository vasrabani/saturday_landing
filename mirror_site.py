"""
Mirror the saturday-racing.com landing page + all its assets into a
self-contained static bundle. Runs against the LIVE production site,
so the sandbox always matches whatever's currently deployed.

Scope: the landing page only + its DIRECT assets (CSS, JS, images,
fonts, whatever CSS `url()` refs pull in transitively). Does NOT
follow HTML links to other pages — the contractor works on the
landing page, nav and footer only, and nav+footer render on every
page, so the landing snapshot is sufficient.

Usage:
    cd C:\\Agile_Frameworks\\saturday_landing
    set PYTHONIOENCODING=utf-8      (Windows console)
    python -X utf8 mirror_site.py

    # or point at a different origin
    python -X utf8 mirror_site.py --origin https://staging.saturday-racing.com

Stdlib only. Same-origin only (never crawls onto CDNs or third-party
domains, so analytics scripts don't accidentally leak into the bundle).
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError


DEFAULT_ORIGIN     = 'https://www.saturday-racing.com'
DEFAULT_START_PATH = '/'
MAX_ASSET_BYTES    = 10 * 1024 * 1024
USER_AGENT         = 'saturday-landing-mirror/1.0'
TIMEOUT_SECS       = 30

# HTML attributes that can hold a URL we want to mirror.
URL_ATTRS = {'src', 'href', 'poster', 'data-src', 'data-bg', 'content'}

# Binary extensions we won't chase.
SKIP_EXTS = {'.mp4', '.webm', '.mov', '.pdf', '.zip', '.gz'}

_URL_LIKE = re.compile(r'^(https?://|/[^/])', re.I)
_CSS_URL_RE = re.compile(r"url\(\s*(['\"]?)([^)'\"]+)\1\s*\)")
_CSS_IMPORT_RE = re.compile(r"@import\s+(?:url\(\s*)?(['\"]?)([^)'\";]+)\1")


class LinkCollector(HTMLParser):
    """Pulls out every URL-shaped attribute value from an HTML doc,
    tagged by the tag it came from so we know if it's an HTML link
    (which we'll skip for recursion) or a real asset."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        # (tag_name, url) tuples.
        self.hits: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if value and name in URL_ATTRS and _URL_LIKE.match(value):
                self.hits.append((tag, value))
            elif value and name == 'srcset':
                for part in value.split(','):
                    piece = part.strip().split()
                    if piece and _URL_LIKE.match(piece[0]):
                        self.hits.append((tag, piece[0]))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)


def fetch(url: str) -> tuple[bytes, str]:
    req = Request(url, headers={'User-Agent': USER_AGENT})
    with urlopen(req, timeout=TIMEOUT_SECS) as resp:
        return resp.read(), resp.headers.get('Content-Type', '')


def same_origin(url: str, origin_netloc: str) -> bool:
    p = urlparse(url)
    if not p.netloc:
        return True
    return p.netloc.lower() == origin_netloc.lower()


def local_path_for(url: str, origin_netloc: str, base_dir: Path) -> Path | None:
    if not same_origin(url, origin_netloc):
        return None
    p = urlparse(url)
    path = p.path or '/'
    if path.endswith('/') or path == '':
        path = path + 'index.html'
    if path.startswith('/'):
        path = path[1:]
    return base_dir / path


def _relativise(target_url: str, from_url: str) -> str:
    from_path = urlparse(from_url).path or '/'
    if from_path.endswith('/'):
        from_dir_parts = from_path.strip('/').split('/')
    else:
        from_dir_parts = from_path.strip('/').split('/')[:-1]
    from_dir_parts = [p for p in from_dir_parts if p]
    target_path = urlparse(target_url).path or '/'
    target_parts = [p for p in target_path.strip('/').split('/') if p]
    i = 0
    while i < min(len(from_dir_parts), len(target_parts)) and from_dir_parts[i] == target_parts[i]:
        i += 1
    ups = ['..'] * (len(from_dir_parts) - i)
    downs = target_parts[i:]
    rel = '/'.join(ups + downs) or '.'
    if target_path.endswith('/'):
        rel = rel.rstrip('/') + '/index.html'
    return rel


# Tags whose href/src is a page LINK (we don't recurse into them).
_LINK_TAGS = {'a', 'form', 'area', 'iframe'}


def rewrite_html(html: str, from_page_url: str, origin_netloc: str) -> tuple[str, list[str]]:
    """Rewrite the HTML doc so ASSET urls become page-relative + get
    queued for download. HTML LINKS (anchor tags etc.) get rewritten to
    absolute production URLs so 'click a nav item' still works if the
    contractor previews the sandbox — they'll bounce to production."""
    collector = LinkCollector()
    try:
        collector.feed(html)
    except Exception:
        pass

    to_fetch: list[str] = []
    rewritten = html
    # Dedupe while preserving order.
    seen_rewrites: set[str] = set()
    for tag, raw in collector.hits:
        absolute = urljoin(from_page_url, raw)

        if tag in _LINK_TAGS:
            # Turn relative links into absolute production URLs so
            # anchor clicks route to the live site (nothing broken).
            if raw not in seen_rewrites and not raw.startswith(('http://', 'https://', 'mailto:', 'tel:', '#')):
                rewritten = rewritten.replace(f'"{raw}"', f'"{absolute}"')
                rewritten = rewritten.replace(f"'{raw}'", f"'{absolute}'")
                seen_rewrites.add(raw)
            continue

        # Asset — same-origin, not skipped ext.
        if not same_origin(absolute, origin_netloc):
            continue
        ext = Path(urlparse(absolute).path).suffix.lower()
        if ext in SKIP_EXTS:
            continue
        rel = _relativise(absolute.split('?', 1)[0], from_page_url)
        if raw not in seen_rewrites:
            rewritten = rewritten.replace(raw, rel)
            seen_rewrites.add(raw)
        to_fetch.append(absolute)
    return rewritten, to_fetch


def rewrite_css(css_text: str, css_url: str, origin_netloc: str) -> tuple[str, list[str]]:
    to_fetch: list[str] = []
    def _sub(m: re.Match) -> str:
        raw = m.group(2).strip()
        if raw.startswith(('data:', '#')):
            return m.group(0)
        absolute = urljoin(css_url, raw)
        if not same_origin(absolute, origin_netloc):
            return m.group(0)
        ext = Path(urlparse(absolute).path).suffix.lower()
        if ext in SKIP_EXTS:
            return m.group(0)
        to_fetch.append(absolute)
        rel = _relativise(absolute.split('?', 1)[0], css_url)
        return f'url("{rel}")'
    css_text = _CSS_URL_RE.sub(_sub, css_text)
    # Also chase @import.
    for m in _CSS_IMPORT_RE.finditer(css_text):
        raw = m.group(2).strip()
        if raw.startswith('data:'):
            continue
        absolute = urljoin(css_url, raw)
        if same_origin(absolute, origin_netloc):
            to_fetch.append(absolute)
    return css_text, to_fetch


def mirror(origin: str, start_path: str, base_dir: Path) -> None:
    origin_netloc = urlparse(origin).netloc
    seen: set[str] = set()
    queue: list[tuple[bool, str]] = [(True, urljoin(origin, start_path))]  # (is_root_html, url)
    landing_html_url = urljoin(origin, start_path)

    while queue:
        is_root, url = queue.pop(0)
        clean_url = url.split('?', 1)[0]
        if clean_url in seen:
            continue
        seen.add(clean_url)

        dest = local_path_for(clean_url, origin_netloc, base_dir)
        if dest is None:
            continue

        print(f'  . {url}', flush=True)
        try:
            body, ctype = fetch(url)
        except (HTTPError, URLError, TimeoutError) as e:
            print(f'    ! skip ({e})')
            continue
        if len(body) > MAX_ASSET_BYTES:
            print(f'    ! skip (too large: {len(body):,} bytes)')
            continue

        ctype = ctype.split(';', 1)[0].strip().lower()

        if is_root or ctype == 'text/html' or dest.name.endswith('.html'):
            # Only the ROOT HTML gets processed. Any other HTML we
            # somehow queued (shouldn't happen with the LINK_TAGS
            # guard, but defensive) is written as-is with no recursion.
            html = body.decode('utf-8', errors='replace')
            if is_root:
                rewritten, more = rewrite_html(html, url, origin_netloc)
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_text(rewritten, encoding='utf-8')
                queue.extend((False, u) for u in more)
            else:
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_text(html, encoding='utf-8')
        elif ctype in ('text/css', 'application/css') or dest.suffix == '.css':
            css = body.decode('utf-8', errors='replace')
            rewritten, more = rewrite_css(css, url, origin_netloc)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(rewritten, encoding='utf-8')
            queue.extend((False, u) for u in more)
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(body)

    print(f'\nDone. {len(seen)} URLs. Bundle at {base_dir}')


def main(argv: Iterable[str]) -> int:
    ap = argparse.ArgumentParser(description='Mirror the Saturday Racing landing page for the contractor sandbox.')
    ap.add_argument('--origin', default=DEFAULT_ORIGIN)
    ap.add_argument('--path',   default=DEFAULT_START_PATH)
    ap.add_argument('--out',    default=str(Path(__file__).parent))
    args = ap.parse_args(list(argv))

    base_dir = Path(args.out).resolve()
    base_dir.mkdir(parents=True, exist_ok=True)
    print(f'Mirroring {args.origin}{args.path} -> {base_dir}\n')
    mirror(args.origin, args.path, base_dir)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
