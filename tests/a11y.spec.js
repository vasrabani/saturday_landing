import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { knownIssue, openLanding } from './support/landing.js';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BASELINE_FILE = join(__dirname, '..', 'tools', 'quality-baseline.json');
const knownViolations = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')).axe;

// Ratchet: a rule not on the known list fails the run, and a known rule
// that no longer fires must come off the list, so the list only shrinks.
test('has no new WCAG 2.1 AA violations', async ({ page }, testInfo) => {
  await openLanding(page);
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const found = [...new Set(violations.map((violation) => violation.id))].sort();
  const viewport = testInfo.project.name.replace(/^features-/, '');
  const known = knownViolations[viewport] ?? [];

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

test('headings never skip a level', async ({ page }) => {
  knownIssue('PR 5', 'the hero jumps from h1 to h3');
  await openLanding(page);
  const levels = await page
    .locator('main :is(h1, h2, h3, h4, h5, h6)')
    .evaluateAll((els) => els.filter((el) => el.getClientRects().length).map((el) => Number(el.tagName[1])));
  const skips = levels.slice(1).filter((level, i) => level > levels[i] + 1);
  expect(skips).toEqual([]);
});
