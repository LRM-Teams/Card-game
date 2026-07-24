import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/previews/lrm-385');
const livePort = process.env.E2E_PORT ?? '3099';
const BASE =
  process.env.E2E_BASE_URL ??
  (process.env.E2E_LIVE || process.env.CI
    ? `http://127.0.0.1:${livePort}`
    : 'http://127.0.0.1:5173');

function seed(page: import('@playwright/test').Page, nick: string) {
  const guestId = `g-385-${nick}-${Math.random().toString(36).slice(2, 8)}`;
  return page.addInitScript(({ nick, guestId }) => {
    localStorage.setItem(
      'ddz_onboarding_v1',
      JSON.stringify({ seenIdentity: true, seenStart: true, seenBidTip: true, seenPlayTip: true }),
    );
    localStorage.setItem(
      'ddz_guest_identity',
      JSON.stringify({ guestId, displayName: nick, avatarId: 'av-1', beans: 1000 }),
    );
  }, { nick, guestId });
}

async function waitConnected(page: import('@playwright/test').Page) {
  await page.goto(BASE);
  await waitConnectedOnCurrentPage(page);
}

async function waitConnectedOnCurrentPage(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => document.querySelector('.conn')?.textContent?.includes('已连接'),
    null,
    { timeout: 25_000 },
  );
}

async function waitOnRoomPage(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => window.location.pathname === '/room', null, {
    timeout: 20_000,
  });
}

test.describe.configure({ mode: 'serial' });

test('LRM-385 invite flow — host sheet + guest deep link same room', async ({ browser }) => {
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
  await expect(host.getByTestId('room-invite-open')).toBeVisible();
  await host.getByTestId('room-invite-open').click();
  await expect(host.getByRole('dialog', { name: /邀请好友同桌/ })).toBeVisible();
  const roomCode = await host.getByTestId('invite-room-code').locator('code').textContent();
  expect(roomCode?.trim().length).toBeGreaterThan(4);

  await host.screenshot({ path: path.join(outDir, '01-invite-sheet-390x844.png'), fullPage: false });

  await guest.goto(`${BASE}/?room=${encodeURIComponent(roomCode!.trim())}`);
  await waitConnectedOnCurrentPage(guest);
  await waitOnRoomPage(guest);
  await expect(guest.getByText('邀请主')).toBeVisible({ timeout: 10_000 });

  await guest.screenshot({ path: path.join(outDir, '02-guest-joined-390x844.png'), fullPage: false });

  await hostCtx.close();
  await guestCtx.close();
});
