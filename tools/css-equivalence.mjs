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
    // Key each element by its position in the tree rather than a running
    // index, so adding or removing an element only reports that element
    // instead of shifting everything after it.
    const pathOf = (el) => {
      const steps = [];
      for (let node = el; node && node.tagName !== 'BODY'; node = node.parentElement) {
        const siblings = [...node.parentElement.children].filter((sibling) => sibling.tagName === node.tagName);
        steps.unshift(`${node.tagName.toLowerCase()}:${siblings.indexOf(node) + 1}`);
      }
      return steps.join('/');
    };
    const out = {};
    document.querySelectorAll('body *').forEach((el) => {
      const style = getComputedStyle(el);
      out[pathOf(el)] = `${el.tagName}.${el.className}|${properties.map((p) => style.getPropertyValue(p)).join('|')}`;
    });
    return out;
  }, PROPERTIES);
  // Computed url() values are absolute, so each copy reports its own port.
  return Object.fromEntries(
    Object.entries(rows).map(([path, row]) => [path, row.split(`http://localhost:${port}/`).join('/')]),
  );
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
    const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
    const added = [...paths].filter((path) => !before[path]);
    const removed = [...paths].filter((path) => !after[path]);
    const changedPaths = [...paths].filter((path) => before[path] && after[path] && before[path] !== after[path]);

    if (added.length || removed.length || changedPaths.length) {
      identical = false;
      const counts = [
        `${changedPaths.length} changed`,
        added.length ? `${added.length} added` : null,
        removed.length ? `${removed.length} removed` : null,
      ].filter(Boolean);
      console.log(`${width}px: ${counts.join(', ')} of ${Object.keys(after).length} elements`);
      changedPaths.slice(0, 10).forEach((path) => {
        const beforeParts = before[path].split('|');
        const afterParts = after[path].split('|');
        const changed = afterParts
          .map((value, i) => (value === beforeParts[i] ? null : `${PROPERTIES[i - 1] ?? 'element'}: ${beforeParts[i]} -> ${value}`))
          .filter(Boolean);
        console.log(`   ${afterParts[0]}  ${changed.join('; ').slice(0, 200)}`);
      });
      added.slice(0, 5).forEach((path) => console.log(`   added: ${after[path].split('|')[0]}`));
      removed.slice(0, 5).forEach((path) => console.log(`   removed: ${before[path].split('|')[0]}`));
    } else {
      console.log(`${width}px: identical (${Object.keys(after).length} elements)`);
    }
  }
} finally {
  await browser.close();
  servers.forEach((server) => server.close());
  execFileSync('git', ['worktree', 'remove', '--force', WORKTREE], { cwd: ROOT, stdio: 'inherit' });
}

console.log(identical ? `RESULT: renders identically to ${ref}` : `RESULT: differs from ${ref}`);
process.exitCode = identical ? 0 : 1;
