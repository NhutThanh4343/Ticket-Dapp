import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Contract, JsonRpcProvider, parseEther } from 'ethers';

// The wallet transport below forwards to unlocked accounts on the real local
// Hardhat node. It does not stub the frontend services, contract or receipts.
let rpc, contract, admin, buyer, other, snapshot;
test.beforeAll(async () => {
  rpc = new JsonRpcProvider('http://127.0.0.1:18545', undefined, { cacheTimeout: 0 });
  [admin, buyer, other] = await rpc.listAccounts();
  const deployment = JSON.parse(await readFile('.local/e2e/deployments/31337.json', 'utf8'));
  const artifact = JSON.parse(await readFile('artifacts/contracts/TourTicketContract.sol/TourTicketContract.json', 'utf8'));
  contract = new Contract(deployment.address, artifact.abi, admin);
  snapshot = await rpc.send('evm_snapshot', []);
});
test.beforeEach(async () => {
  await rpc.send('evm_revert', [snapshot]);
  snapshot = await rpc.send('evm_snapshot', []);
});
test.afterAll(() => rpc?.destroy());

async function setup(page, account) {
  await page.route('https://images.unsplash.com/**', (route) => route.abort());
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '', contentType: 'text/css' }));
  await page.addInitScript(({ initial }) => {
    const listeners = new Map();
    let authorized = sessionStorage.getItem('tc-test-authorized') === 'yes';
    let selected = sessionStorage.getItem('tc-test-account') || initial;
    let chain = '0x7a69';
    const emit = (name, value) => (listeners.get(name) ?? new Set()).forEach((listener) => listener(value));
    const wallet = window.tcTestWallet = {
      isMetaMask: true,
      rejectNext: false,
      select(address) { selected = address; sessionStorage.setItem('tc-test-account', address); emit('accountsChanged', authorized ? [address] : []); },
      wrongNetwork() { chain = '0x1'; emit('chainChanged', chain); },
      on(name, listener) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(listener); },
      removeListener(name, listener) { listeners.get(name)?.delete(listener); },
      async request({ method, params = [] }) {
        if (method === 'eth_requestAccounts') { authorized = true; sessionStorage.setItem('tc-test-authorized', 'yes'); return [selected]; }
        if (method === 'eth_accounts') return authorized ? [selected] : [];
        if (method === 'eth_chainId') return chain;
        if (method === 'wallet_switchEthereumChain') { chain = params[0].chainId; emit('chainChanged', chain); return null; }
        if (method === 'eth_sendTransaction' && wallet.rejectNext) { wallet.rejectNext = false; throw { code: 4001, message: 'User rejected' }; }
        const response = await fetch('http://127.0.0.1:18545', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        });
        const data = await response.json();
        if (data.error) throw Object.assign(new Error(data.error.message), data.error);
        return data.result;
      },
    };
    window.ethereum = wallet;
  }, { initial: account });
  await page.goto('/');
}
async function createTour(name = 'Hành trình blockchain', supply = 2n) {
  const block = await rpc.getBlock('latest');
  await (await contract.createTour(name, BigInt(block.timestamp) + 86400n, parseEther('0.01'), supply)).wait();
}
async function choose(page, account) {
  await page.evaluate((address) => window.tcTestWallet.select(address), account);
}

test('admin creates a real tour, customer buys, admin uses the ticket and data survives reload', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await setup(page, admin.address);
  await expect(page.locator('#tc-tour-grid')).toContainText('Chưa có tour');
  await page.locator('#tc-connect').click();
  await page.locator('#tc-admin-open').click();
  await expect(page.locator('#tc-stat-tours')).toHaveText('0');
  await page.locator('[data-tc-admin-tab="create-tour"]').click();
  await page.locator('#tc-create-name').fill('Hành trình đã xác nhận');
  await page.locator('#tc-create-departure').fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  await page.locator('#tc-create-price').fill('0.01');
  await page.locator('#tc-create-count').fill('2');
  await page.locator('#tc-create-submit').click();
  await expect(page.locator('#tc-transaction')).toHaveAttribute('data-status', 'success');
  expect((await contract.getTours()).length).toBe(1);
  await page.locator('[data-tc-admin-tab="overview"]').click();
  await expect(page.locator('#tc-stat-tours')).toHaveText('1');
  await page.locator('#tc-admin-open').click();
  await choose(page, buyer.address);
  await expect(page.locator('#tc-admin-open')).toBeHidden();
  await page.locator('[data-tc-tour="0"]').click();
  const balance = await rpc.getBalance(admin.address);
  await page.locator('#tc-buy').click();
  await expect(page.locator('[data-tc-ticket="0"]')).toContainText('Chưa sử dụng');
  expect(await rpc.getBalance(admin.address)).toBe(balance + parseEther('0.01'));
  await expect(page.locator('#tc-dialog-remaining')).toHaveText('1');
  await page.locator('#tc-close-dialog').click();
  await page.reload();
  await expect(page.locator('[data-tc-ticket="0"]')).toContainText(buyer.address);
  await choose(page, admin.address);
  await page.locator('#tc-admin-open').click();
  await expect(page.locator('#tc-stat-sold')).toHaveText('1');
  await expect(page.locator('#tc-stat-revenue')).toHaveText('0.01 ETH');
  await page.locator('[data-tc-admin-tab="checkin"]').click();
  await page.locator('#tc-checkin-id').fill('0');
  await page.locator('#tc-lookup-submit').click();
  await expect(page.locator('#tc-checkin-result')).toContainText(buyer.address);
  await page.locator('#tc-checkin-owner').fill(buyer.address);
  await page.locator('#tc-checkin-confirm').check();
  await page.locator('#tc-use-submit').click();
  await expect(page.locator('#tc-checkin-result')).toContainText('Đã sử dụng');
  expect((await contract.tickets(0n)).isUsed).toBe(true);
  await page.locator('[data-tc-admin-tab="overview"]').click();
  await expect(page.locator('#tc-stat-used')).toHaveText('1');
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
  await page.screenshot({ path: info.outputPath('admin.png'), fullPage: true });
  await choose(page, buyer.address);
  await expect(page.locator('#tc-admin-view')).toBeHidden();
  await expect(page.locator('[data-tc-ticket="0"]')).toContainText('Đã sử dụng');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: info.outputPath('customer-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('redesigned tour filters, wallet entry and admin forms work on desktop and mobile', async ({ page }, info) => {
  await createTour('Đà Lạt giữa ngàn thông', 1n);
  const block = await rpc.getBlock('latest');
  await (await contract.createTour('Hạ Long xanh', BigInt(block.timestamp) + 172800n, parseEther('0.005'), 5n)).wait();
  await (await contract.createTour('Sa Pa mây trắng', BigInt(block.timestamp) + 259200n, parseEther('0.02'), 8n)).wait();
  await (await contract.connect(buyer).buyTicket(0n, { value: parseEther('0.01') })).wait();
  await setup(page, admin.address);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('.tc-tour-card')).toHaveCount(3);
  expect(await page.locator('.tc-hero-visual img').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.locator('#tc-tour-filter').selectOption('available');
  await expect(page.locator('.tc-tour-card')).toHaveCount(2);
  await page.locator('#tc-tour-sort').selectOption('price');
  await expect(page.locator('.tc-tour-card h3').first()).toHaveText('Hạ Long xanh');
  await page.locator('#tc-search').fill('không có');
  await expect(page.locator('#tc-tour-grid')).toContainText('Chưa tìm thấy tour phù hợp');
  await page.locator('#tc-clear-search').click();
  await expect(page.locator('.tc-tour-card')).toHaveCount(2);
  await page.locator('#tc-tour-filter').selectOption('sold-out');
  await expect(page.locator('.tc-tour-card')).toHaveCount(1);
  await expect(page.locator('.tc-tour-card')).toContainText('Đã hết vé');
  await page.locator('#tc-tour-filter').selectOption('all');
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
  await page.screenshot({ path: info.outputPath('home-desktop.png'), fullPage: true });
  await page.locator('[data-tc-connect-tickets]').click();
  await page.locator('#tc-admin-open').click();
  await expect(page.locator('#tc-stat-tours')).toHaveText('3');
  await page.locator('[data-tc-admin-shortcut="create-tour"]').click();
  await expect(page.locator('#tc-admin-page-title')).toHaveText('Mở một hành trình mới');
  await expect(page.locator('#tc-create-name')).toBeVisible();
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
  await page.screenshot({ path: info.outputPath('create-tour-desktop.png'), fullPage: true });
  await page.locator('[data-tc-admin-tab="overview"]').click();
  await page.locator('[data-tc-admin-shortcut="checkin"]').click();
  await expect(page.locator('#tc-admin-page-title')).toHaveText('Check-in & sử dụng vé');
  await page.locator('#tc-checkin-id').fill('0');
  await page.locator('#tc-lookup-submit').click();
  await expect(page.locator('#tc-checkin-result')).toContainText(buyer.address);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#tc-checkin-owner')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
  await page.screenshot({ path: info.outputPath('checkin-mobile.png'), fullPage: true });
  await page.locator('[data-tc-admin-tab="overview"]').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#tc-admin-open').click();
  await page.locator('.tc-faq summary').first().click();
  await expect(page.locator('.tc-faq details').first()).toHaveAttribute('open', '');
  await page.setViewportSize({ width: 360, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a customer cannot gain admin access by calling the service directly', async ({ page }) => {
  await setup(page, buyer.address);
  await page.locator('#tc-connect').click();
  await expect(page.locator('#tc-admin-open')).toBeHidden();
  const code = await page.evaluate(async () => {
    const { ticketService } = await import('/src/services/ticketService.js');
    try { await ticketService.createTour({ name: 'Unauthorized', departureTime: BigInt(Math.floor(Date.now() / 1000)) + 86400n, price: 1n, totalTickets: 1n }); }
    catch (error) { return error.code; }
  });
  expect(code).toBe('Unauthorized');
  expect((await contract.getTours()).length).toBe(0);
});

test('a rejected signature creates no ticket, then a pending transaction waits for a mined receipt', async ({ page }) => {
  await createTour();
  await setup(page, buyer.address);
  await page.locator('#tc-connect').click();
  await page.locator('[data-tc-tour="0"]').click();
  await page.evaluate(() => { window.tcTestWallet.rejectNext = true; });
  await page.locator('#tc-buy').click();
  await expect(page.locator('#tc-dialog-message')).toContainText('từ chối');
  expect((await contract.getTour(0n)).soldTickets).toBe(0n);
  await rpc.send('evm_setAutomine', [false]);
  try {
    await page.locator('#tc-buy').click();
    await expect(page.locator('#tc-transaction')).toHaveAttribute('data-status', 'pending');
    await expect(page.locator('#tc-buy')).toBeDisabled();
    await expect(page.locator('.tc-owned-ticket')).toHaveCount(0);
    await rpc.send('evm_mine', []);
    await expect(page.locator('[data-tc-ticket="0"]')).toContainText('Chưa sử dụng');
  } finally { await rpc.send('evm_setAutomine', [true]); }
});

test('changing accounts and networks clears previous tickets and sold-out tours stay readable', async ({ page }) => {
  await createTour('Tour hai khách', 2n);
  await (await contract.connect(buyer).buyTicket(0n, { value: parseEther('0.01') })).wait();
  await (await contract.connect(other).buyTicket(0n, { value: parseEther('0.01') })).wait();
  await (await contract.markTicketUsed(1n)).wait();
  await setup(page, buyer.address);
  await page.locator('#tc-connect').click();
  await expect(page.locator('[data-tc-ticket="0"]')).toContainText(buyer.address);
  await choose(page, other.address);
  await expect(page.locator('[data-tc-ticket="1"]')).toContainText('Đã sử dụng');
  await expect(page.locator('[data-tc-ticket="0"]')).toHaveCount(0);
  await page.evaluate(() => window.tcTestWallet.wrongNetwork());
  await expect(page.locator('#tc-ticket-list')).toContainText('Hãy chuyển mạng');
  await page.locator('#tc-switch-network').click();
  await expect(page.locator('[data-tc-ticket="1"]')).toBeVisible();
  await page.locator('[data-tc-tour="0"]').click();
  await expect(page.locator('#tc-buy')).toHaveText('Đã hết vé');
  await expect(page.locator('#tc-buy')).toBeDisabled();
});

test('on-chain names are escaped and RPC failures do not show invented tours', async ({ page }) => {
  await createTour('<img src=x onerror="window.tcInjected=1">');
  await setup(page, buyer.address);
  await expect(page.locator('.tc-tour-card')).toHaveCount(1);
  await expect(page.locator('.tc-tour-card h3')).toHaveText('<img src=x onerror="window.tcInjected=1">');
  await expect(page.locator('.tc-tour-card h3 img')).toHaveCount(0);
  expect(await page.evaluate(() => window.tcInjected)).toBeUndefined();
  await page.route('http://127.0.0.1:18545/**', (route) => route.abort());
  await page.route('http://127.0.0.1:18545', (route) => route.abort());
  await page.locator('#tc-refresh').click();
  await expect(page.locator('#tc-tour-grid')).toContainText('Chưa tải được');
  await expect(page.locator('.tc-tour-card')).toHaveCount(0);
});

test('deployment page signs a real deployment and exports only public configuration', async ({ page }) => {
  await setup(page, admin.address);
  await page.goto('/deploy.html');
  await page.locator('#tc-deploy-network').selectOption('31337');
  await page.locator('#tc-deploy-rpc').fill('http://127.0.0.1:18545');
  await page.locator('#tc-deploy-connect').click();
  await expect(page.locator('#tc-deploy-account')).toContainText(admin.address);
  await page.locator('#tc-deploy-submit').click();
  await expect(page.locator('#tc-deploy-status')).toContainText('Triển khai đã xác nhận');
  const config = await page.locator('#tc-deploy-result').textContent();
  expect(config).toContain('VITE_CHAIN_ID=31337');
  expect(config).toContain(`VITE_ADMIN_ADDRESS=${admin.address}`);
  expect(config).not.toMatch(/PRIVATE|MNEMONIC|SEED/);
  const address = /VITE_CONTRACT_ADDRESS=(0x[0-9a-fA-F]+)/.exec(config)[1];
  expect(await rpc.getCode(address)).not.toBe('0x');
  const deployed = new Contract(address, contract.interface, rpc);
  expect(await deployed.admin()).toBe(admin.address);
  const download = page.waitForEvent('download');
  await page.locator('#tc-deploy-download').click();
  expect((await download).suggestedFilename()).toBe('tourchain.env.txt');
});
