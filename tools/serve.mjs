// Zero-dependency static server for the sandbox. Playwright starts it for
// every test run; `npm run serve` starts it for manual previews.
import { createServer } from 'node:http';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 8080;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

export function startServer({ root, port = DEFAULT_PORT } = {}) {
  const siteRoot = resolve(root ?? join(fileURLToPath(import.meta.url), '..', '..'));

  // The trail's live feed, replayed. trail_live.js polls /trail/live/ and
  // paints what comes back: races settling, the fox marker moving, the
  // counter and tier record ticking. A static snapshot has nothing to
  // poll, so the page would sit frozen. Each request returns the next
  // frame of fixtures/trail-live-timeline.json (a recorded day, built
  // from the app's own figures) and holds on the last one.
  // `?sim=reset` starts the day again, `?sim=last` jumps to the finished
  // day, `?sim=N` to one frame.
  // Each viewer walks the recording at their own pace, tracked by a
  // cookie: one browser watching the day settle must not fast-forward
  // another's, and every test gets its own fresh day.
  const timelinePath = join(siteRoot, 'fixtures', 'trail-live-timeline.json');
  const positions = new Map();
  let frames = null;

  function viewerId(req, res) {
    const found = /(?:^|;\s*)trail_sim=([a-z0-9]+)/.exec(req.headers.cookie ?? '');
    if (found) return found[1];
    const id = Math.random().toString(36).slice(2, 10);
    res.setHeader('Set-Cookie', `trail_sim=${id}; Path=/; SameSite=Lax`);
    return id;
  }

  function serveLiveFrame(url, req, res) {
    const id = viewerId(req, res);
    let frame = positions.get(id) ?? 0;
    if (frames === null) {
      try {
        frames = JSON.parse(readFileSync(timelinePath, 'utf8')).frames;
      } catch {
        frames = [];
      }
    }
    if (!frames.length) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'fixtures/trail-live-timeline.json is missing' }));
      return;
    }
    const sim = url.searchParams.get('sim');
    if (sim === 'reset') frame = 0;
    else if (sim === 'last') frame = frames.length - 1;
    else if (sim !== null && Number.isInteger(Number(sim))) frame = Number(sim);
    else if (frame < frames.length - 1) frame += 1;
    frame = Math.min(Math.max(frame, 0), frames.length - 1);
    positions.set(id, frame);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      // Which frame of the recording this is, for anyone watching the
      // network panel while they work on the live states.
      'X-Trail-Frame': `${frame + 1}/${frames.length}`,
    });
    res.end(JSON.stringify(frames[frame]));
  }

  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const urlPath = decodeURIComponent(url.pathname);
    if (urlPath === '/trail/live/' || urlPath === '/trail/live') {
      serveLiveFrame(url, req, res);
      return;
    }
    // Fox Signals. A race page asks for its race's live.json once a
    // minute and repaints from it. fixtures/fox-race-live.json (written
    // by tools/build-fox-signals.py) holds the recorded answer for each
    // race that has a page here, by the race's id, so a page stays
    // "live" and still.
    const liveRace = /^\/fox-signals\/race\/(\d+)\/live\.json$/.exec(urlPath);
    if (liveRace) {
      let feeds = {};
      try {
        feeds = JSON.parse(readFileSync(join(siteRoot, 'fixtures', 'fox-race-live.json'), 'utf8'));
      } catch {
        // No recording: every race answers 404, below.
      }
      const feed = feeds[liveRace[1]];
      res.writeHead(feed ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(feed ?? { error: 'no recorded live.json for this race' }));
      return;
    }
    // Starring a race posts here. There is no Stable to save to, so the
    // answer says only that it arrived, and board_star.js keeps the star
    // as the press left it.
    if (urlPath === '/fox-signals/api/stable/toggle/') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    let filePath = normalize(join(siteRoot, urlPath));
    if (filePath !== siteRoot && !filePath.startsWith(siteRoot + sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      if (statSync(filePath).isDirectory()) filePath = join(filePath, 'index.html');
      statSync(filePath);
    } catch {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    createReadStream(filePath).pipe(res);
  });

  return new Promise((done) => server.listen(port, () => done(server)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  const root = process.argv[2];
  startServer({ root, port }).then(() => console.log(`Serving on http://localhost:${port}/`));
}
