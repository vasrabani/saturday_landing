/*
 * "Challenge me, Cubs": the step between "Pick your horse" and a race.
 *
 * Pick your horse opens a dialog where the Fox throws down the challenge
 * and the Cub chooses today's races or the featured race. The featured
 * choice goes where the button that opened it was going.
 *
 * Behaviour tests, not design tests: every visual decision stays open.
 */
import { test, expect } from '@playwright/test';
import { openLanding } from './support/landing.js';

const dialog = (page) => page.locator('#foxChallenge');
const pickButton = (page) => page.locator('.hf-ctas__pick');

test('is closed until Pick your horse is pressed', async ({ page }) => {
  await openLanding(page);
  await expect(dialog(page)).not.toBeVisible();
});

test('Pick your horse opens it instead of leaving the page', async ({ page }) => {
  await openLanding(page);
  const url = page.url();
  await pickButton(page).click();
  await expect(dialog(page)).toBeVisible();
  expect(page.url()).toBe(url);
  await expect(page.getByRole('dialog', { name: /Challenge me, Cubs/ })).toBeVisible();
  await expect(dialog(page)).toContainText("Pick a horse from today’s racing or the featured race");
});

test('offers today\'s races and the featured race, in that order', async ({ page }) => {
  await openLanding(page);
  await pickButton(page).click();
  const choices = dialog(page).locator('.fox-challenge__choice');
  await expect(choices).toHaveCount(2);
  await expect(choices.nth(0)).toContainText('Today’s races');
  await expect(choices.nth(0)).toHaveAttribute('href', /\/races\/$/);
  await expect(choices.nth(1)).toContainText('Featured race');
});

test('the featured race goes where Pick your horse was going, and names it', async ({ page }) => {
  await openLanding(page);
  const target = await pickButton(page).getAttribute('href');
  await pickButton(page).click();
  const featured = dialog(page).locator('.fox-challenge__choice--featured');
  await expect(featured).toHaveAttribute('href', target);
  await expect(featured).toContainText('15:45 Musselburgh');
});

test('closes with the close button and with Escape', async ({ page }) => {
  await openLanding(page);
  await pickButton(page).click();
  await dialog(page).getByRole('button', { name: 'Close' }).click();
  await expect(dialog(page)).not.toBeVisible();
  await pickButton(page).click();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).not.toBeVisible();
});

test('fits the screen: both choices are on screen without scrolling', async ({ page }) => {
  await openLanding(page);
  await pickButton(page).click();
  const box = await dialog(page).boundingBox();
  const vp = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
  for (const choice of await dialog(page).locator('.fox-challenge__choice').all()) {
    await expect(choice).toBeInViewport({ ratio: 1 });
  }
});
