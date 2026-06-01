#!/usr/bin/env node

import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const defaultBaseURL = process.env.LIBRECHAT_BASE_URL || 'http://localhost:3180';
const defaultStorageState = path.resolve(process.cwd(), 'e2e/.auth/messages-storage-state.json');

const args = process.argv.slice(2);

function argValue(name, fallback) {
  const equalsArg = args.find((arg) => arg.startsWith(`${name}=`));
  if (equalsArg) {
    return equalsArg.slice(name.length + 1);
  }

  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }

  return fallback;
}

function hasArg(name) {
  return args.includes(name);
}

function printHelp() {
  console.log(`Capture authenticated Playwright storage state for Messages smoke tests.

Usage:
  npm run e2e:messages-auth:capture
  npm run e2e:messages-auth:capture -- --base-url http://localhost:3180 --output e2e/.auth/messages-storage-state.json

Options:
  --base-url <url>       LibreChat base URL. Defaults to LIBRECHAT_BASE_URL or ${defaultBaseURL}
  --output <path>        Storage-state output path. Defaults to MESSAGES_STORAGE_STATE or ${defaultStorageState}
  --timeout-ms <number>  Login timeout. Defaults to MESSAGES_AUTH_CAPTURE_TIMEOUT_MS or 300000
  --headless            Run Chromium headless. Useful only when auth is already available in the flow.
  --no-base64           Do not print the GitHub secret-friendly base64 value.
  --help                Show this help.
`);
}

if (hasArg('--help') || hasArg('-h')) {
  printHelp();
  process.exit(0);
}

const baseURL = argValue('--base-url', defaultBaseURL);
const outputPath = path.resolve(
  process.cwd(),
  argValue('--output', process.env.MESSAGES_STORAGE_STATE || defaultStorageState),
);
const timeoutMs = Number(
  argValue('--timeout-ms', process.env.MESSAGES_AUTH_CAPTURE_TIMEOUT_MS || '300000'),
);
const headless = hasArg('--headless') || process.env.HEADLESS === '1';
const printBase64 = !hasArg('--no-base64');
const messagesUrl = new URL('/messages', baseURL).toString();
const messagesFrame = 'iframe[title="Street Voices Messages"]';
const messagesSidebar = 'aside[aria-label="Messages workspace"]';

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  console.error('MESSAGES_AUTH_CAPTURE_TIMEOUT_MS / --timeout-ms must be a positive number.');
  process.exit(1);
}

console.log(`Opening ${messagesUrl}`);
console.log('Complete LibreChat OAuth in the browser window if prompted.');

const browser = await chromium.launch({ headless });

try {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(messagesUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForURL((url) => !/\/login|\/api\/auth\/error|\/social\/login/.test(url.pathname), {
    timeout: timeoutMs,
  });

  if (page.url() !== messagesUrl) {
    await page.goto(messagesUrl, { waitUntil: 'domcontentloaded' });
  }

  await page.waitForSelector(messagesFrame, { state: 'attached', timeout: 60000 });
  await page
    .frameLocator(messagesFrame)
    .locator(messagesSidebar)
    .waitFor({ state: 'visible', timeout: 60000 });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await context.storageState({ path: outputPath });

  const rawState = await readFile(outputPath, 'utf8');
  await writeFile(outputPath, `${JSON.stringify(JSON.parse(rawState), null, 2)}\n`, {
    mode: 0o600,
  });

  console.log(`Messages storage-state saved to ${outputPath}`);

  if (printBase64) {
    const normalizedState = await readFile(outputPath, 'utf8');
    console.log('\nGitHub secret value for MESSAGES_STORAGE_STATE_BASE64:');
    console.log(Buffer.from(normalizedState).toString('base64'));
  }
} finally {
  await browser.close();
}
