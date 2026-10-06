import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openLanding } from './support/landing.js';
import { openTrail } from './support/trail.js';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BASELINE_FILE = join(__dirname, '..', 'tools', 'quality-baseline.json');
const knownViolations = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')).axe;

// The trail brings its cards up as the reader scrolls down to them, so on
// load only the first screen of the board is showing. With reduced motion
// every card is on the board at once: it is opened that way here, so the
// scan sees the whole board and not just the top of it.
async function openWholeTrail(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  return openTrail(page, { live: false });
}

// Both pages the contractor works on, each with its own known list: a
// violation introduced on one must not be excused by the other's.
const PAGES = [
  { file: 'index.html', open: (page) => openLanding(page) },
  { file: 'trail.html', open: openWholeTrail },
];

// Ratchet: a rule not on the known list fails the run, and a known rule
// that no longer fires must come off the list, so the list only shrinks.
for (const { file, open } of PAGES) {
  test(`${file} has no new WCAG 2.1 AA violations`, async ({ page }, testInfo) => {
    await open(page);
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    const found = [...new Set(violations.map((violation) => violation.id))].sort();
    const viewport = testInfo.project.name.replace(/^features-/, '');
    const known = (knownViolations[file] ?? {})[viewport] ?? [];

    await testInfo.attach('axe-violations.json', {
      body: JSON.stringify(
        violations.map(({ id, impact, help, nodes }) => ({ id, impact, help, nodes: nodes.map((node) => node.target) })),
        null,
        2,
      ),
      contentType: 'application/json',
    });

    expect(found.filter((id) => !known.includes(id)), 'new violations').toEqual([]);
    expect(known.filter((id) => !found.includes(id)), 'fixed, so remove from tools/quality-baseline.json').toEqual([]);
  });
}

for (const { file, open } of PAGES) {
  test(`${file} headings never skip a level`, async ({ page }) => {
    await open(page);
    const levels = await page
      .locator('main :is(h1, h2, h3, h4, h5, h6)')
      .evaluateAll((els) => els.filter((el) => el.getClientRects().length).map((el) => Number(el.tagName[1])));
    const skips = levels.slice(1).filter((level, i) => level > levels[i] + 1);
    expect(skips).toEqual([]);
  });
}
