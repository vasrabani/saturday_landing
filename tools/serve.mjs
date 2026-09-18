// Zero-dependency static server for the sandbox. Playwright starts it for
// every test run; `npm run serve` starts it for manual previews.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
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

  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
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
