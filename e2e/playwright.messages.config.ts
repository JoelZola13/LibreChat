import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const baseURL = process.env.LIBRECHAT_BASE_URL || 'http://localhost:3180';
const defaultMessagesStorageState = path.resolve(
  process.cwd(),
  'e2e/.auth/messages-storage-state.json',
);
const storageState =
  process.env.MESSAGES_STORAGE_STATE ||
  (fs.existsSync(defaultMessagesStorageState) ? defaultMessagesStorageState : undefined);

export default defineConfig({
  testDir: 'specs',
  outputDir: 'specs/.test-results/messages-smoke',
  reporter: [['list']],
  retries: 0,
  workers: 1,
  use: {
    baseURL,
    headless: process.env.HEADED === '1' ? false : true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    storageState,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
