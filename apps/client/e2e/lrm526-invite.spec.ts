import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/previews/lrm-526-live');
const livePort = process.env.E2E_PORT ?? '3099';
const BASE =
  process.env.E2E_BASE_URL ??
  (process.env.E2E_LIVE || process.env.CI
    ? `http://127.0.0.1:${livePort}`
    : 'http://127.0.0.1:5173');

function seed(page: Page, nick: string) {
  const guestId = `g-526-${nick}-${Math.random().toString(36).slice(2, 8)}`;
  return page.addInitScript(
    ({ nick, guestId }) => {
      localStorage.setItem(
        'ddz_onboarding_v1',
        JSON.stringify({
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

async function waitConnected(page: Page) {
  await page.goto(BASE);
  await waitConnectedOnCurrentPage(page);
}

async function waitConnectedOnCurrentPage(page: Page) {
  await page.waitForFunction(
    () => document.querySelector('.conn')?.textContent?.includes('已连接'),
    null,
    { timeout: 25_000 },
  );
}

async function waitOnRoomPage(page: Page) {
  await page.waitForFunction(() => window.location.pathname === '/room', null, {
    timeout: 20_000,
  });
}

test.describe.configure({ mode: 'serial' });

test('LRM-526 narrative invite sheet + hash deep link join', async ({ browser }) => {
  fs.mkdirSync(outDir, { recursive: true });

  const hostCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  await seed(host, '邀请主');
  await seed(guest, '被邀请');
  await waitConnected(host);

  await host.getByRole('button', { name: '创建' }).click();
  await waitOnRoomPage(host);
  await host.getByTestId('room-invite-open').click();
  await expect(host.locator('.np-invite')).toBeVisible();
  await expect(host.getByRole('dialog', { name: /邀请好友同桌/ })).toBeVisible();

  const roomCode = (await host.getByTestId('invite-room-code').locator('code').textContent())?.trim();
  expect(roomCode?.length).toBeGreaterThan(4);

  const shareLink = await host.getByTestId('invite-share-link').textContent();
  expect(shareLink).toContain('#/room/');
  expect(shareLink).toContain(encodeURIComponent(roomCode!));

  await host.screenshot({ path: path.join(outDir, '01-invite-sheet-390x844.png'), fullPage: false });

  await guest.goto(`${BASE}/#/room/${encodeURIComponent(roomCode!)}`);
  await waitConnectedOnCurrentPage(guest);
  await waitOnRoomPage(guest);
  await expect(guest.getByText('邀请主')).toBeVisible({ timeout: 10_000 });
  await guest.screenshot({ path: path.join(outDir, '02-guest-joined-390x844.png'), fullPage: false });

  await hostCtx.close();
  await guestCtx.close();
});

test('LRM-526 deep link errors show narrative stamp on lobby', async ({ page }) => {
  await seed(page, '深链错');
  await page.goto(`${BASE}/#/room/room-does-not-exist-526`);
  await waitConnectedOnCurrentPage(page);
  await page.waitForFunction(() => window.location.pathname === '/', null, { timeout: 10_000 });
  await expect(page.locator('.np-lobby[data-theme="narrative-pixel"]')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('.np-error-stamp__label')).toHaveText('房间不存在', { timeout: 10_000 });
});

test('LRM-526 invite + deep link — 1920×1080 + 390×844', async ({ browser }) => {
  fs.mkdirSync(outDir, { recursive: true });

  for (const [name, vp] of [
    ['03-invite-sheet-1920x1080.png', { width: 1920, height: 1080 }],
    ['04-invite-sheet-390x844.png', { width: 390, height: 844 }],
  ] as const) {
    const ctx = await browser.newContext({ viewport: vp });
    const p = await ctx.newPage();
    await seed(p, `视口${vp.width}`);
    await waitConnected(p);
    await p.getByRole('button', { name: '创建' }).click();
    await waitOnRoomPage(p);
    await p.getByTestId('room-invite-open').click();
    await expect(p.locator('.np-invite')).toBeVisible();
    await p.screenshot({ path: path.join(outDir, name), fullPage: false });
    await ctx.close();
  }
});
