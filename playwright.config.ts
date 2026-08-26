import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3101', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:3101/api/health',
    reuseExistingServer: false,
    timeout: 30_000,
    env: { ...process.env, PORT: '3101', DATA_DIR: path.resolve('test-results/e2e-data') },
  },
});
