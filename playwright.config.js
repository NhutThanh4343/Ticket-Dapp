import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 20000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort --mode e2e',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    // Test fixtures only. No real network is contacted by the browser tests.
    env: {
      VITE_DATA_MODE: 'blockchain', VITE_CHAIN_ID: '31337', VITE_RPC_URL: 'http://127.0.0.1:8545',
      VITE_CONTRACT_ADDRESS: '0x0000000000000000000000000000000000000003',
      VITE_ADMIN_ADDRESS: '0x0000000000000000000000000000000000000001',
    },
  },
});
