// Static quality checks for the landing sandbox. Zero dependencies.
//
//   npm run check             report, exit 1 on any regression
//   npm run check -- --update rewrite the known-issues list to match today
//
// Every rule is a ratchet against tools/quality-baseline.json. A problem
// not on the list fails the run; a listed problem that has been fixed also
// fails until it is removed, so the list can only shrink. Updating the
// list shows up in the PR diff, so accepting a new problem is a visible,
// reviewed decision.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_FILE = join(ROOT, 'tools', 'quality-baseline.json');

// Folders this repo owns. static/races, letters, news and voting are
// shared with other pages of the live site and treated as read-only, so
// only reference checks look at them.
const OWNED_DIRS = ['static/css', 'static/js', 'static/public', 'static/fonts'];
const LANDING_IMAGE_DIR = 'static/public/img';
const ENTRY_HTML = 'index.html';

const IMAGE_BUDGET_BYTES = 300 * 1024;
const RASTER_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);
const IMAGE_EXTENSIONS = new Set([...RASTER_EXTENSIONS, '.svg']);
const ALLOWED_BREAKPOINTS = new Set([767, 768, 1023, 1024]);
const ALLOWED_THIRD_PARTY_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com', 'www.saturday-racing.com']);
const GENERIC_FONT_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif',
  'ui-monospace', 'ui-rounded', 'emoji', 'math', 'inherit', 'initial', 'unset', 'revert',
  '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'roboto', 'helvetica neue', 'helvetica', 'arial',
  'georgia', 'times new roman', 'courier new', 'menlo', 'consolas', 'monaco', 'apple color emoji',
  'segoe ui emoji', 'segoe ui symbol', 'noto color emoji', 'sf mono', 'liberation mono',
]);
// Inline <script> blocks that execute: no type, or a JavaScript type.
// JSON-LD and JSON data islands mention URLs but load nothing.
const EXECUTABLE_SCRIPT = /^(?![\s\S]*\stype=)|\stype="(?:text\/javascript|module)"/;
const DEBUG_MARKERS =[/#region agent log/, /X-Debug-Session-Id/, /\bdebugger;/];
const LOCAL_ENDPOINT = /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?[^\s'"`)]*/g;

const toPosix = (path) => path.split(sep).join('/');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

function walk(dir) {
  const absolute = join(ROOT, dir);
  let entries;
  try {
    entries = readdirSync(absolute);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const path = posix.join(dir, name);
    return statSync(join(ROOT, path)).isDirectory() ? walk(path) : [path];
  });
}

const ownedFiles = OWNED_DIRS.flatMap(walk);
const ownedOfType = (...extensions) => ownedFiles.filter((file) => extensions.includes(extname(file)));
const allCss = walk('static').filter((file) => extname(file) === '.css');
const exists = (path) => {
  try {
    statSync(join(ROOT, path));
    return true;
  } catch {
    return false;
  }
};
const localPath = (reference) => reference.split(/[?#]/)[0];
const isExternal = (reference) => /^(?:[a-z]+:|\/\/|#|%23)/i.test(reference);

function countBy(items) {
  const counts = {};
  for (const item of items) counts[item] = (counts[item] ?? 0) + 1;
  return counts;
}

// Each rule returns { key: count }. A count above the baseline, or a key
// missing from it, is a regression.
const RULES = {
  'css-url-missing': {
    help: 'CSS url() points at a file that does not exist (comments included: the production static build reads them)',
    run: () =>
      countBy(
        allCss.flatMap((file) =>
          [...read(file).matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)]
            .map((match) => match[1].trim())
            .filter((reference) => !isExternal(reference) && !reference.startsWith('data:'))
            .filter((reference) => !exists(posix.join(posix.dirname(file), localPath(reference))))
            .map((reference) => `${file} -> ${reference}`),
        ),
      ),
  },

  'html-ref-missing': {
    help: 'index.html references a local file that does not exist',
    run: () =>
      countBy(
        [...read(ENTRY_HTML).matchAll(/\s(?:src|href|srcset|poster)="([^"]+)"/g)]
          .flatMap((match) => match[1].split(',').map((candidate) => candidate.trim().split(/\s+/)[0]))
          .filter((reference) => reference && !isExternal(reference) && !reference.startsWith('data:'))
          .filter((reference) => !exists(localPath(reference).replace(/^\//, '') || ENTRY_HTML))
          .map((reference) => reference),
      ),
  },

  'debug-endpoint': {
    help: 'shipped code calls a localhost address',
    run: () =>
      countBy(
        [ENTRY_HTML, ...ownedOfType('.js', '.css', '.html')].flatMap((file) =>
          [...read(file).matchAll(LOCAL_ENDPOINT)].map((match) => `${file} -> ${match[0]}`),
        ),
      ),
  },

  'debug-marker': {
    help: 'debug scaffolding left in shipped code',
    run: () =>
      countBy(
        [ENTRY_HTML, ...ownedOfType('.js')].flatMap((file) =>
          DEBUG_MARKERS.filter((marker) => marker.test(read(file))).map((marker) => `${file} -> ${marker.source}`),
        ),
      ),
  },

  'third-party-script': {
    help: 'index.html loads a script from a host that is not allow-listed (analytics must not run in the sandbox)',
    run: () => {
      const html = read(ENTRY_HTML);
      const hosts = [
        ...[...html.matchAll(/<script[^>]*\ssrc="(https?:)?\/\/([^/"]+)/g)].map((match) => match[2]),
        ...[...html.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g)]
          .filter((match) => EXECUTABLE_SCRIPT.test(match[1]))
          .flatMap((match) => [...match[2].matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)].map((url) => url[1])),
      ];
      return countBy(hosts.filter((host) => !ALLOWED_THIRD_PARTY_HOSTS.has(host)));
    },
  },

  'hidden-section': {
    help: 'a section of the page is commented out',
    run: () =>
      countBy([...read(ENTRY_HTML).matchAll(/<!--\s*TEMP HIDDEN:?\s*([^\n]*)/g)].map((match) => match[1].trim())),
  },

  'image-over-budget': {
    help: `landing image larger than ${IMAGE_BUDGET_BYTES / 1024} KB`,
    run: () =>
      countBy(
        walk(LANDING_IMAGE_DIR)
          .filter((file) => RASTER_EXTENSIONS.has(extname(file).toLowerCase()))
          .filter((file) => statSync(join(ROOT, file)).size > IMAGE_BUDGET_BYTES),
      ),
  },

  'unused-image': {
    help: 'landing image that no HTML, CSS or JS file references',
    run: () => {
      const corpus = [ENTRY_HTML, ...ownedOfType('.css', '.js', '.html')].map(read).join('\n');
      return countBy(
        walk(LANDING_IMAGE_DIR)
          .filter((file) => IMAGE_EXTENSIONS.has(extname(file).toLowerCase()))
          .filter((file) => !corpus.includes(relative(join(ROOT, 'static/public'), join(ROOT, file)).split(sep).join('/'))),
      );
    },
  },

  'svg-export-junk': {
    help: 'SVG with design-tool export leftovers (preserveAspectRatio="none" or a fractional viewBox)',
    run: () =>
      countBy(
        walk(LANDING_IMAGE_DIR)
          .filter((file) => extname(file) === '.svg')
          .filter((file) => {
            const svg = read(file);
            const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1] ?? '';
            return /preserveAspectRatio="none"/.test(svg) || /\d\.\d/.test(viewBox);
          }),
      ),
  },

  'important-count': {
    help: '!important declarations per file',
    run: () =>
      Object.fromEntries(
        ownedOfType('.css')
          .map((file) => [file, (read(file).match(/!important/g) ?? []).length])
          .filter(([, count]) => count > 0),
      ),
  },

  'token-colour-hardcoded': {
    help: 'a colour typed out even though a base.css variable holds that exact value',
    run: () => {
      const tokens = new Map(
        [...read('static/css/base.css').matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-f]{3,8})\s*;/gi)].map((match) => [
          match[2].toLowerCase(),
          match[1],
        ]),
      );
      return countBy(
        ownedOfType('.css').flatMap((file) =>
          [...read(file).matchAll(/(--[\w-]+\s*:\s*)?(#[0-9a-f]{6}|#[0-9a-f]{3})\b/gi)]
            .filter((match) => !match[1] && tokens.has(match[2].toLowerCase()))
            .map((match) => `${file} -> ${match[2].toLowerCase()} (use ${tokens.get(match[2].toLowerCase())})`),
        ),
      );
    },
  },

  'off-scale-breakpoint': {
    help: `media query width outside ${[...ALLOWED_BREAKPOINTS].join('/')}px`,
    run: () =>
      countBy(
        ownedOfType('.css').flatMap((file) =>
          [...read(file).matchAll(/@media[^{]*?\((min|max)-width:\s*(\d+)px\)/g)]
            .filter((match) => !ALLOWED_BREAKPOINTS.has(Number(match[2])))
            .map((match) => `${file} -> ${match[1]}-width:${match[2]}px`),
        ),
      ),
  },

  'font-not-loaded': {
    help: 'first-choice font-family that is never loaded (system fallbacks later in the stack are fine)',
    run: () => {
      const css = allCss.map(read).join('\n');
      const loaded = new Set(
        [...css.matchAll(/@font-face\s*{[^}]*font-family:\s*['"]?([^'";]+)/g)].map((match) => match[1].trim().toLowerCase()),
      );
      for (const match of read(ENTRY_HTML).matchAll(/fonts\.googleapis\.com\/css2?\?family=([^"&:]+)/g)) {
        loaded.add(decodeURIComponent(match[1]).replace(/\+/g, ' ').toLowerCase());
      }
      return countBy(
        ownedOfType('.css').flatMap((file) =>
          [...read(file).matchAll(/font-family:\s*([^;}]+)/g)]
            .map((match) => match[1].trim())
            .filter((stack) => !stack.startsWith('var('))
            .map((stack) => stack.split(',')[0].trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean)
            .filter((family) => !loaded.has(family.toLowerCase()) && !GENERIC_FONT_FAMILIES.has(family.toLowerCase()))
            .map((family) => `${file} -> ${family}`),
        ),
      );
    },
  },
};

function compare(found, known = {}) {
  const regressions = [];
  const fixed = [];
  for (const [key, count] of Object.entries(found)) {
    const allowed = known[key] ?? 0;
    if (count > allowed) regressions.push(allowed ? `${key} (${allowed} -> ${count})` : `${key}${count > 1 ? ` (x${count})` : ''}`);
  }
  for (const [key, allowed] of Object.entries(known)) {
    const count = found[key] ?? 0;
    if (count < allowed) fixed.push(count ? `${key} (${allowed} -> ${count})` : key);
  }
  return { regressions, fixed };
}

const update = process.argv.includes('--update');
const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
const results = Object.fromEntries(Object.entries(RULES).map(([name, rule]) => [name, rule.run()]));

if (update) {
  const sorted = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
  baseline.check = Object.fromEntries(Object.entries(results).map(([name, found]) => [name, sorted(found)]));
  writeFileSync(BASELINE_FILE, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Updated ${toPosix(relative(ROOT, BASELINE_FILE))}.`);
  process.exit(0);
}

let failed = false;
for (const [name, rule] of Object.entries(RULES)) {
  const known = baseline.check?.[name] ?? {};
  const { regressions, fixed } = compare(results[name], known);
  const knownTotal = Object.values(known).reduce((sum, count) => sum + count, 0);
  const status = regressions.length ? 'FAIL' : fixed.length ? 'STALE' : 'ok';
  console.log(`${status.padEnd(5)} ${name}  (${knownTotal} known)  ${rule.help}`);
  for (const line of regressions) console.log(`        new: ${line}`);
  for (const line of fixed) console.log(`      fixed: ${line}`);
  if (regressions.length || fixed.length) failed = true;
}

if (failed) {
  console.log('\nFix new problems. If a listed problem was fixed, run `npm run check -- --update` and commit the shorter list.');
  process.exit(1);
}
