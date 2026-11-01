import { test, expect } from '@playwright/test';

const buyerA = '0x0000000000000000000000000000000000000002';
const buyerB = '0x0000000000000000000000000000000000000004';

async function setup(page, mode = 'blockchain') {
  await page.route('https://images.unsplash.com/**', (route) => route.abort());
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '', contentType: 'text/css' }));
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
  await page.addInitScript(() => {
    const buyer = '0x0000000000000000000000000000000000000002';
    const walletListeners = new Set();
    const txListeners = new Set();
    const walletState = { account: null, chainId: 31337n, connected: false, isCorrectNetwork: true, isAdmin: false, revision: 0 };
    let tx = { status: 'idle', operation: null, txHash: null };
    const h = window.tcHarness = {
      listCalls: 0, purchaseCalls: 0, walletCalls: 0, failList: false,
      holdPurchase: false, rejectPurchase: false, holdTicketsFor: null, pendingReads: [],
      owned: {},
      tours: [
        { id: 0n, name: 'Tour từ blockchain', departureTime: 2208988800n, price: 1n, totalTickets: 3n, soldTickets: 0n },
        { id: 42n, name: '<img src=x onerror="window.tcInjected=1">', departureTime: 2208988800n, price: 10000000000000000n, totalTickets: 2n, soldTickets: 0n },
      ],
      changeAccount(account) {
        Object.assign(walletState, { account, connected: Boolean(account), revision: walletState.revision + 1 });
        walletListeners.forEach((listener) => listener({ ...walletState }));
      },
      changeNetwork(correct) {
        Object.assign(walletState, { chainId: correct ? 31337n : 1n, isCorrectNetwork: correct, revision: walletState.revision + 1 });
        walletListeners.forEach((listener) => listener({ ...walletState }));
      },
      releaseReads() { h.pendingReads.splice(0).forEach((read) => read.resolve(read.value)); },
    };
    h.wallet = {
      getState: () => ({ ...walletState }),
      subscribe: (listener) => { walletListeners.add(listener); return () => walletListeners.delete(listener); },
      restore: async () => { h.walletCalls++; h.changeAccount(walletState.account); return { ...walletState }; },
      connect: async () => { h.walletCalls++; h.changeAccount(buyer); return { ...walletState }; },
      switchNetwork: async () => { h.walletCalls++; h.changeNetwork(true); return { ...walletState }; },
      disconnect: () => h.changeAccount(null),
    };
    const emit = (value) => { tx = value; txListeners.forEach((listener) => listener(value)); };
    h.tickets = {
      getTransactionState: () => ({ ...tx }),
      subscribeTransactions: (listener) => { txListeners.add(listener); return () => txListeners.delete(listener); },
      listTours: async () => {
        h.listCalls++;
        if (h.failList) throw Object.assign(new Error('RPC offline'), { code: 'NETWORK_ERROR' });
        return h.tours.map((tour) => ({ ...tour }));
      },
      readTour: async (id) => ({ ...h.tours.find((tour) => tour.id === id) }),
      listMyTickets: async () => {
        const account = walletState.account;
        const value = (h.owned[account] ?? []).map((ticket) => ({ ...ticket }));
        if (h.holdTicketsFor === account) return new Promise((resolve) => h.pendingReads.push({ resolve, value }));
        return value;
      },
      purchaseTicket: async (id) => {
        h.purchaseCalls++;
        const account = walletState.account;
        const operation = 'purchaseTicket';
        emit({ status: 'awaiting_signature', operation, account, txHash: null });
        if (h.rejectPurchase) {
          emit({ status: 'error', operation, account, txHash: null, error: { code: 'USER_REJECTED', message: 'Bạn đã từ chối yêu cầu trong ví.' } });
          throw { code: 4001 };
        }
        const txHash = `0x${'1'.repeat(64)}`;
        emit({ status: 'pending', operation, account, txHash });
        if (h.holdPurchase) await new Promise((resolve) => { h.confirmPurchase = resolve; });
        const tour = h.tours.find((item) => item.id === id);
        tour.soldTickets++;
        h.owned[account] ??= [];
        const ticketId = BigInt(h.owned[account].length);
        h.owned[account].push({ id: ticketId, tourId: id, owner: account, isUsed: false });
        const result = { ticketId, txHash };
        emit({ status: 'success', operation, account, txHash, result, refresh: ['tours', 'myTickets'] });
        return result;
      },
    };
  });
  await page.route('**/src/index.js*', (route) => route.fulfill({
    contentType: 'text/javascript',
    body: 'export const walletService = window.tcHarness.wallet; export const ticketService = window.tcHarness.tickets;',
  }));
  if (mode !== 'blockchain') {
    await page.route('**/src/config/frontend.js*', (route) => route.fulfill({
      contentType: 'text/javascript',
      body: mode === 'demo'
        ? "export function readFrontendSettings() { return { mode: 'demo', config: null, error: null }; }"
        : "export function readFrontendSettings() { return { mode: 'blockchain', config: null, error: Object.assign(new Error('Missing config'), { code: 'CONFIG_ERROR' }) }; }",
    }));
  }
}

test('demo keeps the original layout and never connects or buys, including on mobile', async ({ page }, testInfo) => {
  await setup(page, 'demo');
  await page.goto('/');
  await expect(page.locator('.tc-tour-card')).toHaveCount(6);
  await expect(page.locator('#tc-data-mode')).toHaveText('CHẾ ĐỘ DEMO');
  await expect(page.locator('#tc-connect')).toBeDisabled();
  await page.locator('[data-tc-tour="0"]').click();
  await expect(page.locator('#tc-buy')).toBeDisabled();
  await expect(page.locator('#tc-dialog-message')).toContainText('Không kết nối ví');
  await page.locator('#tc-close-dialog').click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => window.tcHarness.walletCalls + window.tcHarness.purchaseCalls + window.tcHarness.listCalls)).toBe(0);
});

test('public blockchain tours render exact prices, escaped names and fallback images', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await setup(page);
  await page.goto('/');
  await expect(page.locator('.tc-tour-card')).toHaveCount(2);
  await expect(page.locator('.tc-tour-card').first()).toContainText('0.000000000000000001 ETH');
  await expect(page.locator('.tc-tour-card').nth(1).locator('h3')).toHaveText('<img src=x onerror="window.tcInjected=1">');
  await expect(page.locator('.tc-tour-card h3 img')).toHaveCount(0);
  await page.locator('[data-tc-tour="42"]').click();
  await expect(page.locator('#tc-dialog-description')).toContainText('Thông tin giới thiệu đang được bổ sung');
  await expect(page.locator('#tc-dialog-image')).toHaveAttribute('src', /tour-placeholder|^data:image\/svg\+xml/);
  await expect.poll(() => page.locator('#tc-dialog-image').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.locator('#tc-buy')).toHaveText('Kết nối ví để mua vé');
  expect(await page.evaluate(() => window.tcInjected)).toBeUndefined();
  expect(errors).toEqual([]);
});

test('purchase waits for confirmation then refreshes inventory and owned ticket ID zero', async ({ page }) => {
  await setup(page);
  await page.goto('/');
  await page.locator('#tc-connect').click();
  await expect(page.locator('#tc-ticket-list')).toContainText('Bạn chưa có vé');
  await page.evaluate(() => { window.tcHarness.holdPurchase = true; });
  await page.locator('[data-tc-tour="0"]').click();
  await page.locator('#tc-buy').click();
  await expect(page.locator('#tc-buy')).toBeDisabled();
  await expect(page.locator('#tc-transaction')).toHaveAttribute('data-status', 'pending');
  await expect(page.locator('#tc-ticket-list .tc-owned-ticket')).toHaveCount(0);
  await page.evaluate(() => window.tcHarness.confirmPurchase());
  await expect(page.locator('#tc-transaction')).toHaveAttribute('data-status', 'success');
  await expect(page.locator('#tc-dialog-remaining')).toHaveText('2');
  await expect(page.locator('[data-tc-ticket="0"]')).toContainText('Tour từ blockchain');
  await expect(page.locator('[data-tc-ticket="0"]')).toContainText('Chưa sử dụng');
  expect(await page.evaluate(() => window.tcHarness.purchaseCalls)).toBe(1);
});

test('wallet changes clear old tickets and discard delayed responses from the previous account', async ({ page }) => {
  await setup(page);
  await page.goto('/');
  await page.evaluate(({ a, b }) => {
    const h = window.tcHarness;
    h.owned[a] = [{ id: 9n, tourId: 0n, owner: a, isUsed: false }];
    h.owned[b] = [{ id: 7n, tourId: 0n, owner: b, isUsed: true }];
    h.holdTicketsFor = a;
  }, { a: buyerA, b: buyerB });
  await page.locator('#tc-connect').click();
  await expect.poll(() => page.evaluate(() => window.tcHarness.pendingReads.length)).toBe(1);
  await page.evaluate((account) => window.tcHarness.changeAccount(account), buyerB);
  await expect(page.locator('[data-tc-ticket="7"]')).toContainText('Đã sử dụng');
  await page.evaluate(() => window.tcHarness.releaseReads());
  await expect(page.locator('[data-tc-ticket="9"]')).toHaveCount(0);
  await expect(page.locator('#tc-ticket-list')).not.toContainText(buyerA);
  await page.locator('#tc-disconnect').click();
  await expect(page.locator('#tc-ticket-list')).toContainText('Kết nối ví để xem vé');
  await expect(page.locator('.tc-owned-ticket')).toHaveCount(0);
});

test('wrong network, sold-out and departed tours prevent purchases while details stay readable', async ({ page }) => {
  await setup(page);
  await page.goto('/');
  await page.locator('#tc-connect').click();
  await page.evaluate(() => window.tcHarness.changeNetwork(false));
  await expect(page.locator('#tc-ticket-list')).toContainText('Hãy chuyển mạng');
  await page.locator('#tc-switch-network').click();
  await expect(page.locator('#tc-switch-network')).toBeHidden();
  await page.evaluate(() => {
    window.tcHarness.tours[0].soldTickets = window.tcHarness.tours[0].totalTickets;
    window.tcHarness.tours[1].departureTime = 1n;
  });
  await page.locator('#tc-refresh').click();
  await page.locator('[data-tc-tour="0"]').click();
  await expect(page.locator('#tc-buy')).toHaveText('Đã hết vé');
  await expect(page.locator('#tc-buy')).toBeDisabled();
  await page.locator('#tc-close-dialog').click();
  await page.locator('[data-tc-tour="42"]').click();
  await expect(page.locator('#tc-buy')).toHaveText('Tour đã khởi hành');
  await expect(page.locator('#tc-buy')).toBeDisabled();
  expect(await page.evaluate(() => window.tcHarness.purchaseCalls)).toBe(0);
});

test('RPC failure stays in blockchain mode and can be retried without sample data', async ({ page }) => {
  await setup(page);
  await page.goto('/');
  await expect(page.locator('.tc-tour-card')).toHaveCount(2);
  await page.evaluate(() => { window.tcHarness.failList = true; });
  await page.locator('#tc-refresh').click();
  await expect(page.locator('#tc-tour-grid')).toContainText('Không thể kết nối mạng blockchain');
  await expect(page.locator('.tc-tour-card')).toHaveCount(0);
  await expect(page.locator('#tc-data-mode')).toHaveText('CHẾ ĐỘ BLOCKCHAIN');
  await page.evaluate(() => { window.tcHarness.failList = false; });
  await page.locator('#tc-refresh').click();
  await expect(page.locator('.tc-tour-card')).toHaveCount(2);
});

test('configuration errors block blockchain actions without falling back to demo', async ({ page }) => {
  await setup(page, 'config-error');
  await page.goto('/');
  await expect(page.locator('#tc-tour-grid')).toContainText('chưa được cấu hình');
  await expect(page.locator('.tc-tour-card')).toHaveCount(0);
  await expect(page.locator('#tc-connect')).toBeDisabled();
  expect(await page.evaluate(() => window.tcHarness.listCalls + window.tcHarness.walletCalls)).toBe(0);
});

test('signature rejection is shown without creating a ticket or reporting success', async ({ page }) => {
  await setup(page);
  await page.goto('/');
  await page.locator('#tc-connect').click();
  await page.evaluate(() => { window.tcHarness.rejectPurchase = true; });
  await page.locator('[data-tc-tour="0"]').click();
  await page.locator('#tc-buy').click();
  await expect(page.locator('#tc-dialog-message')).toContainText('từ chối');
  await expect(page.locator('#tc-transaction')).toHaveAttribute('data-status', 'error');
  await expect(page.locator('.tc-owned-ticket')).toHaveCount(0);
  await expect(page.locator('#tc-buy')).toBeEnabled();
});

test('incoming admin layout is a preview with disabled actions and preserves customer integration', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await setup(page, 'demo');
  await page.goto('/');
  await expect(page.locator('.tc-tour-card')).toHaveCount(6);
  await page.locator('#tc-login-btn').click();
  await page.locator('[data-tc-preview="admin"]').click();
  await expect(page.locator('#tc-admin-view')).toBeVisible();
  await expect(page.locator('.tc-admin-preview-notice')).toContainText('CHƯA TÍCH HỢP');
  await page.locator('[data-tc-admin-tab="create-tour"]').click();
  await expect(page.locator('#tcMintName')).toBeDisabled();
  await expect(page.locator('#tc-admin-mint-form button')).toBeDisabled();
  await page.locator('[data-tc-admin-tab="contract"]').click();
  await expect(page.locator('#tcPauseContractBtn')).toBeDisabled();
  await page.locator('#tc-login-btn').click();
  await page.locator('[data-tc-preview="user"]').click();
  await expect(page.locator('#tc-customer-view')).toBeVisible();
  await expect(page.locator('#tc-admin-view')).toBeHidden();
  await expect(page.locator('.tc-tour-card')).toHaveCount(6);
  expect(await page.evaluate(() => window.tcHarness.purchaseCalls)).toBe(0);
  expect(errors).toEqual([]);
});
