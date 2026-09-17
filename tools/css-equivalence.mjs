// Prove a CSS refactor changed nothing, by comparing the computed styles of
// every element on the page against another commit, at each test width.
//
//   node tools/css-equivalence.mjs <ref>
//
// Stronger than a screenshot for refactors like swapping a colour for the
// variable that holds the same value: it compares what the browser resolved,
// so it cannot be fooled by rendering noise.
import { execFileSync, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { startServer } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKTREE = join(ROOT, '.equivalence');
const WIDTHS = [375, 768, 1024, 1440];
const PROPERTIES = [
  'display', 'position', 'width', 'height', 'margin', 'padding', 'color',
  'background-color', 'background-image', 'font-family', 'font-size',
  'font-weight', 'line-height', 'letter-spacing', 'border', 'border-radius',
  'opacity', 'transform', 'visibility', 'z-index', 'flex', 'gap',
  'grid-template-columns', 'text-transform', 'box-shadow',
  'top', 'left', 'right', 'bottom',
];

// Animations are switched off while measuring: otherwise a blinking dot or
// a drifting gradient reports a different opacity or transform on each
// side purely because of when it was sampled. Animation names themselves
// are not compared here; `npm run check` and grep cover those.
const SETTLE_MS = 300;
const FREEZE_ANIMATIONS = '*, *::before, *::after { animation: none !important; transition: none !important; }';

const ref = process.argv[2];
if (!ref) throw new Error('usage: node tools/css-equivalence.mjs <ref>');

const snapshot = async (page, port, width) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
  await page.addStyleTag({ content: FREEZE_ANIMATIONS });
  await page.evaluate(async () => { await document.fonts.ready; });
  // Some layout work is deferred to an animation frame (the day hub clamps
  // race titles that way), so let it run before measuring.
  await page.waitForTimeout(SETTLE_MS);
  const rows = await page.evaluate((properties) => {
    const out = [];
    document.querySelectorAll('body *').forEach((el, index) => {
      const style = getComputedStyle(el);
      out.push(`${index}|${el.tagName}.${el.className}|${properties.map((p) => style.getPropertyValue(p)).join('|')}`);
    });
    return out;
  }, PROPERTIES);
  // Computed url() values are absolute, so each copy reports its own port.
  return rows.map((row) => row.split(`http://localhost:${port}/`).join('/'));
};

spawnSync('git', ['worktree', 'remove', '--force', WORKTREE], { cwd: ROOT, stdio: 'ignore' });
rmSync(WORKTREE, { recursive: true, force: true });
execFileSync('git', ['worktree', 'add', '--detach', WORKTREE, ref], { cwd: ROOT, stdio: 'inherit' });

const servers = [await startServer({ root: ROOT, port: 4290 }), await startServer({ root: WORKTREE, port: 4291 })];
const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost'] });
const page = await (await browser.newContext()).newPage();

let identical = true;
try {
  for (const width of WIDTHS) {
    const after = await snapshot(page, 4290, width);
    const before = await snapshot(page, 4291, width);
    const differences = after.filter((row, index) => row !== before[index]);
    if (differences.length || before.length !== after.length) {
      identical = false;
      console.log(`${width}px: ${differences.length} of ${after.length} elements differ`);
      differences.slice(0, 8).forEach((row) => {
        const index = after.indexOf(row);
        const beforeParts = before[index].split('|');
        const afterParts = row.split('|');
        const changed = afterParts
          .map((value, i) => (value === beforeParts[i] ? null : `${PROPERTIES[i - 2] ?? 'field ' + i}: ${beforeParts[i]} -> ${value}`))
          .filter(Boolean);
        console.log(`   ${afterParts[1]}  ${changed.join('; ').slice(0, 220)}`);
      });
    } else {
      console.log(`${width}px: identical (${after.length} elements)`);
    }
  }
} finally {
  await browser.close();
  servers.forEach((server) => server.close());
  execFileSync('git', ['worktree', 'remove', '--force', WORKTREE], { cwd: ROOT, stdio: 'inherit' });
}

console.log(identical ? `RESULT: renders identically to ${ref}` : `RESULT: differs from ${ref}`);
process.exitCode = identical ? 0 : 1;
