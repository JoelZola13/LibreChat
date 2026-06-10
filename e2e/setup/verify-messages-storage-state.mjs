#!/usr/bin/env node

import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const defaultBaseURL = process.env.LIBRECHAT_BASE_URL || 'http://localhost:3180';
const defaultStorageState = path.resolve(process.cwd(), 'e2e/.auth/messages-storage-state.json');
const messagesFrame = 'iframe[title="Street Voices Messages"]';
const messagesSidebar = 'aside[aria-label="Messages workspace"]';
const integratedMessagesHeading = 'Direct messages';
const integratedMessagesSidebarItem = 'Channel browser';

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

function fail(message) {
  console.error(`Messages storage-state verification failed: ${message}`);
  process.exit(1);
}

function printHelp() {
  console.log(`Verify authenticated Playwright storage state for Messages smoke tests.

Usage:
  npm run e2e:messages-auth:verify
  npm run e2e:messages-auth:verify -- --base-url http://localhost:3180 --storage-state e2e/.auth/messages-storage-state.json

Options:
  --base-url <url>         LibreChat base URL. Defaults to LIBRECHAT_BASE_URL or ${defaultBaseURL}
  --storage-state <path>   Storage-state file. Defaults to MESSAGES_STORAGE_STATE or ${defaultStorageState}
  --timeout-ms <number>    Verification timeout. Defaults to MESSAGES_AUTH_VERIFY_TIMEOUT_MS or 60000
  --min-cookie-ttl-minutes <number>
                            Minimum remaining TTL for persistent host cookies. Defaults to MESSAGES_AUTH_MIN_COOKIE_TTL_MINUTES or 0
  --skip-host-check        Skip the static storage-state host/domain check.
  --help                  Show this help.
`);
}

if (hasArg('--help') || hasArg('-h')) {
  printHelp();
  process.exit(0);
}

const baseURL = argValue('--base-url', defaultBaseURL);
const storageStatePath = path.resolve(
  process.cwd(),
  argValue('--storage-state', process.env.MESSAGES_STORAGE_STATE || defaultStorageState),
);
const timeoutMs = Number(
  argValue('--timeout-ms', process.env.MESSAGES_AUTH_VERIFY_TIMEOUT_MS || '60000'),
);
const minCookieTtlMinutes = Number(
  argValue('--min-cookie-ttl-minutes', process.env.MESSAGES_AUTH_MIN_COOKIE_TTL_MINUTES || '0'),
);
const messagesUrl = new URL('/messages', baseURL).toString();
const expectedHostname = new URL(baseURL).hostname.toLowerCase();
const skipHostCheck = hasArg('--skip-host-check');

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  fail('MESSAGES_AUTH_VERIFY_TIMEOUT_MS / --timeout-ms must be a positive number.');
}

if (!Number.isFinite(minCookieTtlMinutes) || minCookieTtlMinutes < 0) {
  fail('MESSAGES_AUTH_MIN_COOKIE_TTL_MINUTES / --min-cookie-ttl-minutes must be zero or greater.');
}

if (!fs.existsSync(storageStatePath)) {
  fail(`${storageStatePath} does not exist.`);
}

function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .replace(/^\./, '')
    .toLowerCase();
}

function domainMatchesHostname(domain, hostname) {
  const normalizedDomain = normalizeDomain(domain);
  return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
}

function hostnameFromOrigin(origin) {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function summarizeHosts(storageState) {
  const cookieHosts = new Set(
    (storageState.cookies || []).map((cookie) => normalizeDomain(cookie.domain)).filter(Boolean),
  );
  const originHosts = new Set(
    (storageState.origins || []).map((origin) => hostnameFromOrigin(origin.origin)).filter(Boolean),
  );

  return {
    cookieHosts: [...cookieHosts].sort(),
    originHosts: [...originHosts].sort(),
  };
}

function verifyStorageStateHost(storageState) {
  const { cookieHosts, originHosts } = summarizeHosts(storageState);
  const hasMatchingCookie = cookieHosts.some((domain) =>
    domainMatchesHostname(domain, expectedHostname),
  );
  const hasMatchingOrigin = originHosts.some((hostname) =>
    domainMatchesHostname(hostname, expectedHostname),
  );

  if (hasMatchingCookie || hasMatchingOrigin) {
    const matchedBy = [
      hasMatchingCookie ? 'cookie domain' : null,
      hasMatchingOrigin ? 'origin' : null,
    ]
      .filter(Boolean)
      .join(' and ');
    console.log(
      `Messages storage-state host preflight matched ${expectedHostname} by ${matchedBy}.`,
    );
    return;
  }

  fail(
    `storage state does not contain cookies or localStorage origins for ${expectedHostname}. ` +
      `Cookie domains: ${cookieHosts.join(', ') || 'none'}. ` +
      `Origins: ${originHosts.join(', ') || 'none'}. ` +
      'Capture a fresh Messages auth state for the same LIBRECHAT_BASE_URL.',
  );
}

function isPersistentCookie(cookie) {
  return typeof cookie.expires === 'number' && cookie.expires > 0;
}

function isExpiredCookie(cookie, nowMs) {
  return isPersistentCookie(cookie) && cookie.expires * 1000 <= nowMs;
}

function formatDuration(minutes) {
  if (minutes < 90) {
    return `${Math.max(0, Math.floor(minutes))} minutes`;
  }

  return `${(minutes / 60).toFixed(1)} hours`;
}

function verifyCookieExpiry(storageState) {
  const matchingCookies = (storageState.cookies || []).filter((cookie) =>
    domainMatchesHostname(cookie.domain, expectedHostname),
  );

  if (matchingCookies.length === 0) {
    console.log(
      `Messages storage-state cookie expiry preflight found no cookies for ${expectedHostname}; browser verification will validate the session.`,
    );
    return;
  }

  const nowMs = Date.now();
  const activeCookies = matchingCookies.filter((cookie) => !isExpiredCookie(cookie, nowMs));

  if (activeCookies.length === 0) {
    fail(
      `all ${matchingCookies.length} cookie(s) for ${expectedHostname} are expired. ` +
        'Capture a fresh Messages auth state.',
    );
  }

  const persistentActiveCookies = activeCookies.filter(isPersistentCookie);

  if (minCookieTtlMinutes > 0 && persistentActiveCookies.length > 0) {
    const soonestExpiryMs = Math.min(
      ...persistentActiveCookies.map((cookie) => cookie.expires * 1000),
    );
    const remainingMinutes = (soonestExpiryMs - nowMs) / 60000;

    if (remainingMinutes < minCookieTtlMinutes) {
      fail(
        `the soonest persistent cookie for ${expectedHostname} expires in ${formatDuration(
          remainingMinutes,
        )}, below the ${formatDuration(minCookieTtlMinutes)} minimum. ` +
          'Capture a fresh Messages auth state.',
      );
    }
  }

  const sessionCookieCount = activeCookies.length - persistentActiveCookies.length;
  const persistentCookieCount = persistentActiveCookies.length;
  const cookieSummary = [
    sessionCookieCount > 0 ? `${sessionCookieCount} session cookie(s)` : null,
    `${persistentCookieCount} active persistent cookie(s)`,
  ]
    .filter(Boolean)
    .join(' and ');
  const expiryDetail =
    persistentCookieCount > 0 && minCookieTtlMinutes > 0
      ? ` persistent cookies meet the ${formatDuration(minCookieTtlMinutes)} minimum.`
      : '.';
  console.log(
    `Messages storage-state cookie expiry preflight found ${cookieSummary} for ${expectedHostname}${expiryDetail}`,
  );
}

let storageState;
try {
  storageState = JSON.parse(fs.readFileSync(storageStatePath, 'utf8'));
} catch (error) {
  fail(
    `${storageStatePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
  );
}

if (!storageState || typeof storageState !== 'object') {
  fail(`${storageStatePath} must be a Playwright storage-state object.`);
}

if (!Array.isArray(storageState.cookies) || !Array.isArray(storageState.origins)) {
  fail(`${storageStatePath} must include Playwright cookies and origins arrays.`);
}

if (!skipHostCheck) {
  verifyStorageStateHost(storageState);
  verifyCookieExpiry(storageState);
}

const browser = await chromium.launch({ headless: true });
let verificationError;
let context;

try {
  context = await browser.newContext({ storageState: storageStatePath });
  const page = await context.newPage();

  await page.goto(messagesUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs });

  const currentUrl = new URL(page.url());
  if (/\/login|\/api\/auth\/error|\/social\/login/.test(currentUrl.pathname)) {
    throw new Error(
      `stored auth redirected to ${currentUrl.pathname}; capture a fresh Messages auth state.`,
    );
  }

  await Promise.race([
    page.waitForSelector(messagesFrame, { state: 'attached', timeout: timeoutMs }),
    page.getByRole('heading', { name: integratedMessagesHeading }).waitFor({
      state: 'visible',
      timeout: timeoutMs,
    }),
  ]);

  const embeddedFrameCount = await page.locator(messagesFrame).count();
  if (embeddedFrameCount > 0) {
    await page
      .frameLocator(messagesFrame)
      .locator(messagesSidebar)
      .waitFor({ state: 'visible', timeout: timeoutMs });
  } else {
    await page.getByText(integratedMessagesSidebarItem, { exact: true }).waitFor({
      state: 'visible',
      timeout: timeoutMs,
    });
  }

  await context.storageState({ path: storageStatePath });

  console.log(`Messages storage-state verified against ${messagesUrl}`);
} catch (error) {
  const detail = (error instanceof Error ? error.message : String(error)).split('\n')[0];
  verificationError = `could not render the authenticated Messages page shell/sidebar at ${messagesUrl}. Capture a fresh Messages auth state. ${detail}`;
} finally {
  await browser.close();
}

if (verificationError) {
  fail(verificationError);
}
