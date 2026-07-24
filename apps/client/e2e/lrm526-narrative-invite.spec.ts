import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/previews/lrm-526-live');
const BASE = process.env.E2E_BASE_URL ?? process.env.FX_BASE_URL ?? 'http://127.0.0.1:3099';

function seed(page: import('@playwright/test').Page, nick: string) {
  const guestId = `g-526-${nick}-${Math.random().toString(36).slice(2, 8)}`;
  return page.addInitScript(
    ({ nick, guestId }) => {
      localStorage.setItem(
        'ddz_onboarding_v1',
        JSON.stringify({
          skipped: true,
          seenIdentity: true,
          seenStart: true,
          seenBidTip: true,
          seenPlayTip: true,
        }),
      );
      localStorage.setItem(
        'ddz_guest_identity',
        JSON.stringify({ guestId, displayName: nick, avatarId: 'av-1', beans: 1000 }),
      );
    },
    { nick, guestId },
  );
}

async function waitConnected(page: import('@playwright/test').Page) {
  await page.goto(BASE);
  await page.waitForFunction(
    () => document.querySelector('.conn')?.textContent?.includes('已连接'),
    null,
    { timeout: 25_000 },
  );
}

test.describe.configure({ mode: 'serial' });

test('LRM-526 narrative invite — host sheet + guest deep link', async ({ browser }) => {
  test.setTimeout(120_000);
  fs.mkdirSync(outDir, { recursive: true });

  const hostCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  await seed(host, '邀请主');
  await seed(guest, '被邀请');
  await waitConnected(host);
  await waitConnected(guest);

  await host.getByRole('button', { name: '创建' }).click();
  await host.waitForURL(/\/room/, { timeout: 20_000 });
  await expect(host.locator('.np-room[data-theme="narrative-pixel"]')).toBeVisible();
  await host.getByTestId('room-invite-open').click();
  await expect(host.getByRole('dialog', { name: /邀请好友同桌/ })).toBeVisible();
  await expect(host.locator('.np-invite-sheet[data-theme], .np-invite-sheet-backdrop[data-theme]')).toBeVisible();

  const roomCode = await host.getByTestId('invite-room-code').locator('code').textContent();
  expect(roomCode?.trim().length).toBeGreaterThan(4);

  await host.screenshot({ path: path.join(outDir, '01-invite-sheet-390x844.png'), fullPage: false });

  await guest.goto(`${BASE}/?room=${encodeURIComponent(roomCode!.trim())}`);
  await guest.waitForURL(/\/room/, { timeout: 20_000 });
  await expect(guest.locator('.seat-card.human, .seat-card.me')).toHaveCount(2, { timeout: 15_000 });
  await guest.screenshot({ path: path.join(outDir, '02-guest-joined-390x844.png'), fullPage: false });

  await hostCtx.close();
  await guestCtx.close();
});

test('LRM-526 deep link room_not_found shows narrative stamp on lobby', async ({ page }) => {
  await seed(page, '深链测');
  await waitConnected(page);
  await page.goto(`${BASE}/?room=nonexistent-room-526`);
  await page.waitForTimeout(1500);
  await expect(page.locator('.np-error-stamp__label')).toContainText('房间不存在', { timeout: 10_000 });
  await expect(page.locator('.np-lobby[data-theme="narrative-pixel"]')).toBeVisible();
});

test('LRM-526 narrative invite — 1920×1080 sheet layout', async ({ browser }) => {
  fs.mkdirSync(outDir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await seed(page, '大屏');
  await waitConnected(page);
  await page.getByRole('button', { name: '创建' }).click();
  await page.waitForURL(/\/room/, { timeout: 20_000 });
  await page.getByTestId('room-invite-open').click();
  await expect(page.getByRole('dialog', { name: /邀请好友同桌/ })).toBeVisible();
  const scroll = await page.evaluate(() => ({
    docH: document.documentElement.scrollHeight,
    winH: window.innerHeight,
  }));
  expect(scroll.docH).toBeLessThanOrEqual(scroll.winH + 2);
  await page.screenshot({ path: path.join(outDir, '03-invite-sheet-1920x1080.png'), fullPage: false });
  await ctx.close();
});
