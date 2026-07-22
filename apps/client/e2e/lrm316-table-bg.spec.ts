import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/previews/lrm-316');

test.describe.configure({ mode: 'serial' });

test('LRM-316 table background assets — 1080p + 390×844', async ({ browser }) => {
  fs.mkdirSync(outDir, { recursive: true });

  const desktop = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const desktopPage = await desktop.newPage();
  await desktopPage.goto('/fx-demo?scene=turn');
  await expect(desktopPage.locator('[data-fx="turn"]')).toBeVisible({ timeout: 15_000 });
  await desktopPage.waitForTimeout(400);
  const desktopScroll = await desktopPage.evaluate(() => ({
    scrollY: window.scrollY,
    docH: document.documentElement.scrollHeight,
    winH: window.innerHeight,
  }));
  expect(desktopScroll.docH).toBeLessThanOrEqual(desktopScroll.winH + 2);
  await desktopPage.screenshot({
    path: path.join(outDir, '01-play-state-1920x1080.png'),
    fullPage: false,
  });
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto('/fx-demo?scene=turn');
  await expect(mobilePage.locator('[data-fx="turn"]')).toBeVisible({ timeout: 15_000 });
  await mobilePage.waitForTimeout(400);
  const mobileScroll = await mobilePage.evaluate(() => ({
    docH: document.documentElement.scrollHeight,
    winH: window.innerHeight,
  }));
  expect(mobileScroll.docH).toBeLessThanOrEqual(mobileScroll.winH + 2);
  await mobilePage.screenshot({
    path: path.join(outDir, '02-play-state-390x844.png'),
    fullPage: false,
  });
  await mobile.close();
});
