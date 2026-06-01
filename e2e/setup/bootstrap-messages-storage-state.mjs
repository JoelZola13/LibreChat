#!/usr/bin/env node

import fs from 'node:fs';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const requireState = args.has('--require');
const defaultStorageState = path.resolve(process.cwd(), 'e2e/.auth/messages-storage-state.json');
const storageStatePath = path.resolve(
  process.cwd(),
  process.env.MESSAGES_STORAGE_STATE || defaultStorageState,
);
const jsonSecret = process.env.MESSAGES_STORAGE_STATE_JSON?.trim();
const base64Secret = process.env.MESSAGES_STORAGE_STATE_BASE64?.trim();

function fail(message) {
  console.error(`Messages storage-state bootstrap failed: ${message}`);
  process.exit(1);
}

function parseStorageState(source, label) {
  try {
    return JSON.parse(source);
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function decodeBase64StorageState(source) {
  try {
    return Buffer.from(source, 'base64').toString('utf8');
  } catch (error) {
    fail(
      `MESSAGES_STORAGE_STATE_BASE64 could not be decoded: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function validateStorageState(value, label) {
  if (!value || typeof value !== 'object') {
    fail(`${label} must be a Playwright storage-state object.`);
  }

  if (!Array.isArray(value.cookies) || !Array.isArray(value.origins)) {
    fail(`${label} must include Playwright cookies and origins arrays.`);
  }

  if (value.cookies.length === 0 && value.origins.length === 0) {
    fail(`${label} does not contain any cookies or localStorage origins.`);
  }
}

async function exposeStorageStatePath() {
  if (process.env.GITHUB_ENV) {
    await appendFile(process.env.GITHUB_ENV, `MESSAGES_STORAGE_STATE=${storageStatePath}\n`);
  }
}

async function writeStorageState(value, label) {
  validateStorageState(value, label);
  await mkdir(path.dirname(storageStatePath), { recursive: true });
  await writeFile(storageStatePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await exposeStorageStatePath();
  console.log(`Messages storage-state written to ${storageStatePath}`);
}

async function useExistingStorageState() {
  const raw = await readFile(storageStatePath, 'utf8');
  const value = parseStorageState(raw, storageStatePath);
  validateStorageState(value, storageStatePath);
  await exposeStorageStatePath();
  console.log(`Messages storage-state already exists at ${storageStatePath}`);
}

if (jsonSecret) {
  await writeStorageState(
    parseStorageState(jsonSecret, 'MESSAGES_STORAGE_STATE_JSON'),
    'MESSAGES_STORAGE_STATE_JSON',
  );
} else if (base64Secret) {
  const decoded = decodeBase64StorageState(base64Secret);
  await writeStorageState(
    parseStorageState(decoded, 'MESSAGES_STORAGE_STATE_BASE64'),
    'MESSAGES_STORAGE_STATE_BASE64',
  );
} else if (fs.existsSync(storageStatePath)) {
  await useExistingStorageState();
} else if (requireState) {
  fail(
    'set MESSAGES_STORAGE_STATE_JSON or MESSAGES_STORAGE_STATE_BASE64, or provide an existing MESSAGES_STORAGE_STATE file.',
  );
} else {
  console.log('No Messages storage-state secret found; signed-in Messages smoke tests will skip.');
}
